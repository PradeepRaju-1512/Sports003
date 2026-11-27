import { Router } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.ts";
import {
  matchEvents,
  matches,
  playerMatchStats,
  playerProfiles,
  sports,
  standings,
  teamRosters,
  teams,
  tournaments,
  users,
} from "../db/schema.ts";
import { requireAuth } from "../middleware/auth.ts";
import { canScoreMatch, hasGlobalSportsAuthority } from "../middleware/rbac.ts";
import { recordAuditLog } from "../lib/audit.ts";
import { getExcludedNonStudentIds } from "../lib/clubLeadership.ts";
import { broadcastSse } from "../lib/sse.ts";
import {
  extractIdempotencyKey,
  findIdempotencyRecord,
  parsePositiveIntId,
  saveIdempotencyRecord,
} from "../lib/http.ts";
import { reduceMatchEvents } from "../../shared/scoring/reducers/index.ts";
import { computeStandingsForSport } from "../../shared/scoring/standings.ts";
import type { SportId } from "../../shared/scoring/types.ts";

const router = Router();

async function hydrateMatchFull(matchId: number) {
  const [m] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!m) return null;

  const [sport] = await db.select().from(sports).where(eq(sports.id, m.sportId)).limit(1);
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, m.tournamentId))
    .limit(1);

  const pairTeams = await db
    .select()
    .from(teams)
    .where(inArray(teams.id, [m.teamAId, m.teamBId]));
  const teamA = pairTeams.find((t) => t.id === m.teamAId) ?? null;
  const teamB = pairTeams.find((t) => t.id === m.teamBId) ?? null;

  const rosterRows = await db
    .select({
      teamId: teamRosters.teamId,
      playerProfileId: teamRosters.playerProfileId,
      playingRole: teamRosters.playingRole,
      displayName: playerProfiles.displayName,
      batch: playerProfiles.batch,
      branch: playerProfiles.branch,
    })
    .from(teamRosters)
    .innerJoin(playerProfiles, eq(teamRosters.playerProfileId, playerProfiles.id))
    .where(inArray(teamRosters.teamId, [m.teamAId, m.teamBId]));

  const events = await db
    .select()
    .from(matchEvents)
    .where(eq(matchEvents.matchId, m.id))
    .orderBy(asc(matchEvents.seq));

  // Build comprehensive playerNames lookup across both teams' rosters, lineups, and event IDs
  const referencedIds = new Set<number>([
    ...rosterRows.map((r) => r.playerProfileId),
    ...(Array.isArray(m.lineupAJson) ? m.lineupAJson : []),
    ...(Array.isArray(m.lineupBJson) ? m.lineupBJson : []),
  ]);
  for (const ev of events) {
    const p = ev.payloadJson ?? {};
    for (const k of ["batterId", "nonStrikerId", "bowlerId", "fielderId", "scorerId", "assistId", "playerId", "defenderId", "chaserId"]) {
      const val = Number(p[k]);
      if (Number.isFinite(val) && val > 0) referencedIds.add(val);
    }
  }
  const extraProfileRows =
    referencedIds.size > 0
      ? await db
          .select({ id: playerProfiles.id, displayName: playerProfiles.displayName })
          .from(playerProfiles)
          .where(inArray(playerProfiles.id, Array.from(referencedIds)))
      : [];
  const playerNames: Record<number, string> = {};
  for (const r of rosterRows) playerNames[r.playerProfileId] = r.displayName;
  for (const p of extraProfileRows) playerNames[p.id] = p.displayName;

  const [mvpRow] = await db
    .select({ playerProfileId: playerMatchStats.playerProfileId })
    .from(playerMatchStats)
    .where(and(eq(playerMatchStats.matchId, m.id), eq(playerMatchStats.isMvp, true)))
    .limit(1);

  const scorerUser = m.scorerUserId
    ? (
        await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, m.scorerUserId))
          .limit(1)
      )[0] ?? null
    : null;

  const cfg = (m.configJson as Record<string, unknown>) ?? {};
  const derived = reduceMatchEvents(
    (sport?.slug as SportId) ?? "cricket",
    events.map((e) => ({
      id: e.id,
      seq: e.seq,
      occurredAt: e.occurredAt.toISOString(),
      matchClockMs: e.matchClockMs,
      eventType: e.eventType,
      payloadJson: e.payloadJson,
      voided: e.voided,
    })),
    {
      teamAShort: teamA?.shortCode ?? "TEAM A",
      teamBShort: teamB?.shortCode ?? "TEAM B",
      teamAName: teamA?.name ?? "Team A",
      teamBName: teamB?.name ?? "Team B",
      ...cfg,
    }
  );

  return {
    match: m,
    sport,
    tournament,
    teamA: teamA ? { ...teamA, roster: rosterRows.filter((r) => r.teamId === teamA.id) } : null,
    teamB: teamB ? { ...teamB, roster: rosterRows.filter((r) => r.teamId === teamB.id) } : null,
    scorerUser,
    events: events.map(({ createdBy: _createdBy, ...ev }) => ev),
    playerNames,
    mvpPlayerProfileId: mvpRow?.playerProfileId ?? null,
    derived,
    serverNowMs: Date.now(),
    clock: {
      clockRunning: derived.clock.running,
      clockAnchorMs: derived.clock.anchorEpochMs,
      clockAccumulatedMs: derived.clock.accumulatedMs,
    },
  };
}

router.get("/", async (_req, res) => {
  const allMatches = await db
    .select()
    .from(matches)
    .orderBy(desc(matches.scheduledAt));

  const allSports = await db.select().from(sports);
  const allTeams = await db.select().from(teams);
  const allTournaments = await db.select().from(tournaments);

  const sportMap = Object.fromEntries(allSports.map((s) => [s.id, s]));
  const teamMap = Object.fromEntries(allTeams.map((t) => [t.id, t]));
  const tourMap = Object.fromEntries(allTournaments.map((t) => [t.id, t]));

  const formatted = allMatches
    .filter((m) => tourMap[m.tournamentId]?.status !== "ARCHIVED")
    .map((m) => ({
      ...m,
      sport: sportMap[m.sportId] ?? null,
      teamA: teamMap[m.teamAId] ?? null,
      teamB: teamMap[m.teamBId] ?? null,
      tournamentName: tourMap[m.tournamentId]?.name ?? "",
    }));

  res.json({
    liveMatches: formatted.filter((m) => m.status === "LIVE"),
    upcomingMatches: formatted.filter((m) => m.status === "UPCOMING"),
    completedMatches: formatted.filter((m) => m.status === "COMPLETED"),
  });
});

router.get("/:id", async (req, res) => {
  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }

  const hydrated = await hydrateMatchFull(matchId);
  if (!hydrated) {
    res.status(404).json({ error: "Match not found." });
    return;
  }

  res.json({
    ...hydrated,
    permissions: {
      canScore: canScoreMatch(req.actor, hydrated.match.scorerUserId),
      canVerify: hasGlobalSportsAuthority(req.actor),
    },
  });
});

router.post("/:id/transition", requireAuth, async (req, res) => {
  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  const [existing] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Match not found." });
    return;
  }
  if (!canScoreMatch(req.actor, existing.scorerUserId)) {
    res.status(403).json({ error: "Only the assigned Match Scorer or Sports Secretary can change match state." });
    return;
  }

  const schema = z.object({
    nextStatus: z.enum(["LIVE", "COMPLETED"]),
    expectedVersion: z.number().int().positive(),
    winnerTeamId: z.number().int().positive().nullable().optional(),
    resultNote: z.string().max(240).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid match transition payload." });
    return;
  }

  if (existing.status === "COMPLETED" && parsed.data.nextStatus === "LIVE") {
    if (!hasGlobalSportsAuthority(req.actor)) {
      res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can reopen a completed match." });
      return;
    }
  }

  if (existing.version !== parsed.data.expectedVersion) {
    res.status(409).json({
      error: "Stale match version detected (concurrent update). Please refresh before continuing.",
    });
    return;
  }

  const isPlaceholderSummary = (val: string | null | undefined) => {
    const s = (val ?? "").trim().toLowerCase();
    return s === "" || s === "scheduled" || s === "kickoff scheduled";
  };

  const updated = await db.transaction(async (tx) => {
    let nextScoreSummary = existing.scoreSummary;
    let nextResultNote = parsed.data.resultNote?.trim() || existing.resultNote;

    if (parsed.data.nextStatus === "LIVE") {
      if (isPlaceholderSummary(nextScoreSummary)) {
        nextScoreSummary = "Live — In Progress";
      }
    } else if (parsed.data.nextStatus === "COMPLETED") {
      const [sportRow] = await tx
        .select({ slug: sports.slug })
        .from(sports)
        .where(eq(sports.id, existing.sportId))
        .limit(1);
      const pairTeams = await tx
        .select()
        .from(teams)
        .where(inArray(teams.id, [existing.teamAId, existing.teamBId]));
      const teamA = pairTeams.find((t) => t.id === existing.teamAId);
      const teamB = pairTeams.find((t) => t.id === existing.teamBId);

      const events = await tx
        .select()
        .from(matchEvents)
        .where(and(eq(matchEvents.matchId, matchId), eq(matchEvents.voided, false)))
        .orderBy(asc(matchEvents.seq));

      if (events.length > 0 && sportRow) {
        const derived = reduceMatchEvents(
          sportRow.slug as SportId,
          events.map((e) => ({
            id: e.id,
            seq: e.seq,
            occurredAt: e.occurredAt.toISOString(),
            matchClockMs: e.matchClockMs,
            eventType: e.eventType,
            payloadJson: e.payloadJson,
            voided: e.voided,
          })),
          {
            teamAShort: teamA?.shortCode ?? "TEAM A",
            teamBShort: teamB?.shortCode ?? "TEAM B",
            ...(existing.configJson as Record<string, unknown>),
          }
        );
        if (derived.summaryText?.trim()) {
          nextScoreSummary = derived.summaryText.trim();
        }
      }

      if (isPlaceholderSummary(nextScoreSummary) || nextScoreSummary === "Live — In Progress") {
        const winnerId =
          parsed.data.winnerTeamId !== undefined ? parsed.data.winnerTeamId : existing.winnerTeamId;
        const winnerTeam =
          winnerId === existing.teamAId ? teamA : winnerId === existing.teamBId ? teamB : null;
        if (nextResultNote?.trim()) {
          nextScoreSummary = nextResultNote.trim();
        } else if (winnerTeam) {
          nextScoreSummary = `${winnerTeam.name} Won`;
        } else if (parsed.data.winnerTeamId === null) {
          nextScoreSummary = "Match Tied";
        } else {
          nextScoreSummary = "Completed — Final Score";
        }
      }

      if (!nextResultNote?.trim()) {
        nextResultNote = nextScoreSummary ?? "Completed — Final Score";
      }
    }

    const [row] = await tx
      .update(matches)
      .set({
        status: parsed.data.nextStatus,
        version: existing.version + 1,
        scoreSummary: nextScoreSummary,
        ...(existing.status === "COMPLETED" && parsed.data.nextStatus === "LIVE"
          ? { verifiedBy: null, verifiedAt: null }
          : {}),
        ...(parsed.data.winnerTeamId !== undefined ? { winnerTeamId: parsed.data.winnerTeamId } : {}),
        ...(nextResultNote ? { resultNote: nextResultNote } : {}),
      })
      .where(and(eq(matches.id, matchId), eq(matches.version, parsed.data.expectedVersion)))
      .returning();

    if (row) {
      if (existing.status === "COMPLETED" && parsed.data.nextStatus === "LIVE") {
        await recomputeStandingsForTournamentSport(tx, existing.tournamentId, existing.sportId);
      }
      await recordAuditLog(tx, req.actor!.id, `MATCH_STATUS_${parsed.data.nextStatus}`, "matches", matchId, {
        from: existing.status,
        to: parsed.data.nextStatus,
      });
    }
    return row ?? null;
  });

  if (!updated) {
    res.status(409).json({ error: "Concurrent update conflict." });
    return;
  }

  const liveCountRows = await db.select({ id: matches.id }).from(matches).where(eq(matches.status, "LIVE"));
  broadcastSse("MATCH_STATUS", {
    matchId,
    status: updated.status,
    version: updated.version,
    hasLiveMatches: liveCountRows.length > 0,
  });
  broadcastSse("NAV_UPDATED", { hasLiveMatches: liveCountRows.length > 0 });

  res.json({ match: updated });
});

router.post("/:id/clock", requireAuth, async (req, res) => {
  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }

  const [preMatch] = await db
    .select({ id: matches.id, scorerUserId: matches.scorerUserId })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!preMatch) {
    res.status(404).json({ error: "Match not found." });
    return;
  }
  if (!canScoreMatch(req.actor, preMatch.scorerUserId)) {
    res.status(403).json({
      error: "Only the assigned Match Scorer or Sports Secretary can control the match clock.",
    });
    return;
  }

  const schema = z.object({
    action: z.enum(["START", "PAUSE", "RESET"]),
    expectedVersion: z.number().int().positive().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid clock action." });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [match] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .for("update")
      .limit(1);

    if (!match) {
      return { ok: false as const, status: 404, error: "Match not found." };
    }
    if (!canScoreMatch(req.actor, match.scorerUserId)) {
      return {
        ok: false as const,
        status: 403,
        error: "Only the assigned Match Scorer or Sports Secretary can control the match clock.",
      };
    }
    if (parsed.data.expectedVersion !== undefined && match.version !== parsed.data.expectedVersion) {
      return {
        ok: false as const,
        status: 409,
        error: "Stale match version detected. Please refresh before continuing.",
      };
    }

    const nowMs = Date.now();
    const prevCfg = (match.configJson as Record<string, unknown>) ?? {};
    const wasRunning = Boolean(prevCfg.clockRunning);
    const prevAnchor = prevCfg.clockAnchorMs ? Number(prevCfg.clockAnchorMs) : null;
    let clockAccumulatedMs = Math.max(0, Number(prevCfg.clockAccumulatedMs ?? 0));
    let clockRunning = wasRunning;
    let clockAnchorMs: number | null = prevAnchor;

    if (parsed.data.action === "START") {
      if (!wasRunning) {
        clockRunning = true;
        clockAnchorMs = nowMs;
      }
    } else if (parsed.data.action === "PAUSE") {
      if (wasRunning && prevAnchor !== null) {
        clockAccumulatedMs += Math.max(0, nowMs - prevAnchor);
      }
      clockRunning = false;
      clockAnchorMs = null;
    } else {
      clockRunning = false;
      clockAnchorMs = null;
      clockAccumulatedMs = 0;
    }

    const nextConfig = {
      ...prevCfg,
      clockRunning,
      clockAnchorMs,
      clockAccumulatedMs,
      clockManuallyReset: parsed.data.action === "RESET",
    };

    const [updated] = await tx
      .update(matches)
      .set({
        configJson: nextConfig,
        version: match.version + 1,
      })
      .where(and(eq(matches.id, matchId), eq(matches.version, match.version)))
      .returning();

    if (!updated) {
      return { ok: false as const, status: 409, error: "Concurrent clock update conflict." };
    }

    await recordAuditLog(tx, req.actor!.id, `MATCH_CLOCK_${parsed.data.action}`, "matches", matchId, {
      clockRunning,
      clockAnchorMs,
      clockAccumulatedMs,
    });

    return {
      ok: true as const,
      payload: {
        matchId,
        clockRunning,
        clockAnchorMs,
        clockAccumulatedMs,
        version: updated.version,
      },
    };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  broadcastSse("MATCH_CLOCK", result.payload);
  res.json(result.payload);
});

router.post("/:id/events", requireAuth, async (req, res) => {
  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }

  const [preMatch] = await db
    .select({ id: matches.id, scorerUserId: matches.scorerUserId })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!preMatch) {
    res.status(404).json({ error: "Match not found." });
    return;
  }
  if (!canScoreMatch(req.actor, preMatch.scorerUserId)) {
    res.status(403).json({
      error: "Read-only access: Only the assigned Match Scorer or Sports Secretary can score this match.",
    });
    return;
  }

  const schema = z.object({
    eventType: z.string().min(2).max(40),
    payloadJson: z.record(z.string(), z.unknown()).default({}),
    matchClockMs: z.number().int().nonnegative().nullable().optional(),
    expectedVersion: z.number().int().positive().optional(),
    idempotencyKey: z.string().min(4).max(120).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid scoring event payload." });
    return;
  }

  const idemKey = extractIdempotencyKey(req);
  const idemScope = `MATCH_EVENT:${matchId}`;

  const result = await db.transaction(async (tx) => {
    if (idemKey) {
      const prior = await findIdempotencyRecord(tx, idemScope, idemKey);
      if (prior) {
        return {
          ok: true as const,
          replayed: true as const,
          statusCode: prior.statusCode,
          responseJson: prior.responseJson,
        };
      }
    }

    const [match] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .for("update")
      .limit(1);

    if (!match) {
      return { ok: false as const, status: 404, error: "Match not found." };
    }
    if (!canScoreMatch(req.actor, match.scorerUserId)) {
      return {
        ok: false as const,
        status: 403,
        error: "Read-only access: Only the assigned Match Scorer or Sports Secretary can score this match.",
      };
    }
    if (match.status !== "LIVE") {
      return { ok: false as const, status: 400, error: "Match must be LIVE to record scoring events." };
    }
    if (parsed.data.expectedVersion !== undefined && match.version !== parsed.data.expectedVersion) {
      return {
        ok: false as const,
        status: 409,
        error: "Stale match version detected. Please refresh before scoring.",
      };
    }

    const [sport] = await tx.select().from(sports).where(eq(sports.id, match.sportId)).limit(1);
    const pairTeams = await tx.select().from(teams).where(inArray(teams.id, [match.teamAId, match.teamBId]));
    const teamA = pairTeams.find((t) => t.id === match.teamAId);
    const teamB = pairTeams.find((t) => t.id === match.teamBId);

    const existingEvents = await tx
      .select()
      .from(matchEvents)
      .where(eq(matchEvents.matchId, matchId))
      .orderBy(asc(matchEvents.seq));

    const nextSeq = (existingEvents[existingEvents.length - 1]?.seq ?? 0) + 1;
    const [inserted] = await tx
      .insert(matchEvents)
      .values({
        matchId,
        seq: nextSeq,
        eventType: parsed.data.eventType,
        payloadJson: parsed.data.payloadJson,
        matchClockMs: parsed.data.matchClockMs ?? null,
        createdBy: req.actor!.id,
      })
      .returning();

    const allEvents = [...existingEvents, inserted];
    const prevCfg = (match.configJson as Record<string, unknown>) ?? {};
    const shouldAutoStartClock =
      !prevCfg.clockRunning &&
      !prevCfg.clockAnchorMs &&
      Number(prevCfg.clockAccumulatedMs ?? 0) === 0 &&
      !prevCfg.clockManuallyReset &&
      !["CLOCK_START", "CLOCK_PAUSE", "CLOCK_RESET"].includes(parsed.data.eventType);

    const nextCfg = shouldAutoStartClock
      ? {
          ...prevCfg,
          clockRunning: true,
          clockAnchorMs: Date.now(),
          clockAccumulatedMs: 0,
        }
      : prevCfg;

    const derived = reduceMatchEvents(
      (sport?.slug as SportId) ?? "cricket",
      allEvents.map((e) => ({
        id: e.id,
        seq: e.seq,
        occurredAt: e.occurredAt.toISOString(),
        matchClockMs: e.matchClockMs,
        eventType: e.eventType,
        payloadJson: e.payloadJson,
        voided: e.voided,
      })),
      {
        teamAShort: teamA?.shortCode ?? "TEAM A",
        teamBShort: teamB?.shortCode ?? "TEAM B",
        ...nextCfg,
      }
    );

    const [updatedMatch] = await tx
      .update(matches)
      .set({
        scoreSummary: derived.summaryText,
        configJson: nextCfg,
        version: match.version + 1,
      })
      .where(and(eq(matches.id, matchId), eq(matches.version, match.version)))
      .returning();

    if (!updatedMatch) {
      return { ok: false as const, status: 409, error: "Concurrent scoring conflict." };
    }

    const autoStartedClock = shouldAutoStartClock
      ? {
          clockRunning: true,
          clockAnchorMs: Number(nextCfg.clockAnchorMs),
          clockAccumulatedMs: 0,
        }
      : null;

    const responseJson = {
      event: inserted,
      derived,
      version: updatedMatch.version,
      clock: autoStartedClock,
    };

    if (idemKey) {
      await saveIdempotencyRecord(tx, {
        scope: idemScope,
        key: idemKey,
        actorUserId: req.actor!.id,
        statusCode: 201,
        responseJson: responseJson as unknown as Record<string, unknown>,
      });
    }

    return {
      ok: true as const,
      replayed: false as const,
      inserted,
      derived,
      newVersion: updatedMatch.version,
      autoStartedClock,
      responseJson,
    };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  if (result.replayed) {
    res.status(result.statusCode).json(result.responseJson);
    return;
  }

  if (result.autoStartedClock) {
    broadcastSse("MATCH_CLOCK", {
      matchId,
      ...result.autoStartedClock,
      version: result.newVersion,
    });
  }

  broadcastSse("MATCH_EVENT", {
    matchId,
    event: result.inserted,
    scoreSummary: result.derived.summaryText,
    version: result.newVersion,
  });

  res.status(201).json(result.responseJson);
});

router.post("/:id/events/:seq/void", requireAuth, async (req, res) => {
  const matchId = parsePositiveIntId(req.params.id);
  const seq = parsePositiveIntId(req.params.seq);
  if (!matchId || !seq) {
    res.status(400).json({ error: "Invalid match ID or event sequence." });
    return;
  }

  const expectedVersion =
    req.body && typeof req.body === "object" && Number.isInteger(req.body.expectedVersion)
      ? Number(req.body.expectedVersion)
      : undefined;

  const result = await db.transaction(async (tx) => {
    const [match] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .for("update")
      .limit(1);

    if (!match) {
      return { ok: false as const, status: 404, error: "Match not found." };
    }
    if (!canScoreMatch(req.actor, match.scorerUserId)) {
      return {
        ok: false as const,
        status: 403,
        error: "Only the assigned Match Scorer or Sports Secretary can undo events.",
      };
    }
    if (match.status !== "LIVE") {
      return {
        ok: false as const,
        status: 409,
        error: "Cannot void events on a match that is not LIVE. Reopen the match first if correction is required.",
      };
    }
    if (expectedVersion !== undefined && match.version !== expectedVersion) {
      return {
        ok: false as const,
        status: 409,
        error: "Stale match version detected. Please refresh before undoing.",
      };
    }

    const [sport] = await tx.select().from(sports).where(eq(sports.id, match.sportId)).limit(1);
    const pairTeams = await tx.select().from(teams).where(inArray(teams.id, [match.teamAId, match.teamBId]));
    const teamA = pairTeams.find((t) => t.id === match.teamAId);
    const teamB = pairTeams.find((t) => t.id === match.teamBId);

    const [voidedRow] = await tx
      .update(matchEvents)
      .set({ voided: true })
      .where(and(eq(matchEvents.matchId, matchId), eq(matchEvents.seq, seq), eq(matchEvents.voided, false)))
      .returning();

    if (!voidedRow) {
      return { ok: false as const, status: 409, error: "Event already voided or not found." };
    }

    const allEvents = await tx
      .select()
      .from(matchEvents)
      .where(eq(matchEvents.matchId, matchId))
      .orderBy(asc(matchEvents.seq));

    const derived = reduceMatchEvents(
      (sport?.slug as SportId) ?? "cricket",
      allEvents.map((e) => ({
        id: e.id,
        seq: e.seq,
        occurredAt: e.occurredAt.toISOString(),
        matchClockMs: e.matchClockMs,
        eventType: e.eventType,
        payloadJson: e.payloadJson,
        voided: e.voided,
      })),
      {
        teamAShort: teamA?.shortCode ?? "TEAM A",
        teamBShort: teamB?.shortCode ?? "TEAM B",
        ...(match.configJson as Record<string, unknown>),
      }
    );

    const [updatedMatch] = await tx
      .update(matches)
      .set({ scoreSummary: derived.summaryText, version: match.version + 1 })
      .where(and(eq(matches.id, matchId), eq(matches.version, match.version)))
      .returning();

    if (!updatedMatch) {
      return { ok: false as const, status: 409, error: "Concurrent void conflict." };
    }

    await recordAuditLog(tx, req.actor!.id, "VOID_MATCH_EVENT", "match_events", `${matchId}:${seq}`, {});
    return { ok: true as const, derived, newVersion: updatedMatch.version };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  broadcastSse("MATCH_EVENT", {
    matchId,
    voidedSeq: seq,
    scoreSummary: result.derived.summaryText,
    version: result.newVersion,
  });

  res.json({ derived: result.derived, version: result.newVersion });
});

router.patch("/:id/lineup", requireAuth, async (req, res) => {
  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  const schema = z.object({
    side: z.enum(["A", "B"]),
    playerProfileIds: z.array(z.number().int().positive()),
    overrideReason: z.string().max(240).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid lineup payload." });
    return;
  }

  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) {
    res.status(404).json({ error: "Match not found." });
    return;
  }
  if (match.status === "COMPLETED") {
    res.status(409).json({ error: "Cannot edit lineup on a completed match." });
    return;
  }

  const uniqueIds = Array.from(new Set(parsed.data.playerProfileIds));
  if (uniqueIds.length > 0) {
    const excludedIds = await getExcludedNonStudentIds();
    const excludedSet = new Set(excludedIds);
    const validProfiles = await db
      .select({ id: playerProfiles.id, userId: users.id, accountType: users.accountType })
      .from(playerProfiles)
      .innerJoin(users, eq(playerProfiles.userId, users.id))
      .where(inArray(playerProfiles.id, uniqueIds));
    if (
      validProfiles.length !== uniqueIds.length ||
      validProfiles.some((p) => p.accountType !== "STUDENT" || excludedSet.has(p.userId))
    ) {
      res.status(400).json({ error: "All lineup playerProfileIds must belong to active student profiles." });
      return;
    }
  }

  const targetTeamId = parsed.data.side === "A" ? match.teamAId : match.teamBId;
  const [team] = await db.select().from(teams).where(eq(teams.id, targetTeamId)).limit(1);
  const isTeamCaptain = team?.captainUserId === req.actor!.id;
  const isScorerOrAdmin = canScoreMatch(req.actor, match.scorerUserId);

  if (!isTeamCaptain && !isScorerOrAdmin) {
    res.status(403).json({ error: "Only the team Captain, assigned Scorer, or Sports Secretary can update lineup." });
    return;
  }

  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(matches)
      .set(
        parsed.data.side === "A"
          ? { lineupAJson: uniqueIds }
          : { lineupBJson: uniqueIds }
      )
      .where(eq(matches.id, matchId))
      .returning();

    await recordAuditLog(
      tx,
      req.actor!.id,
      isScorerOrAdmin && !isTeamCaptain ? "LINEUP_GROUND_OVERRIDE" : "MATCH_LINEUP_UPDATED",
      "matches",
      matchId,
      {
        side: parsed.data.side,
        playerCount: uniqueIds.length,
        reason: parsed.data.overrideReason ?? "Match-scoped lineup adjustment",
      }
    );
    return [row];
  });

  broadcastSse("MATCH_LINEUP", {
    matchId,
    side: parsed.data.side,
    playerProfileIds: uniqueIds,
  });
  res.json({ match: updated });
});

router.post("/:id/lineup/members", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can modify match-scoped squads." });
    return;
  }

  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  const schema = z.object({
    side: z.enum(["A", "B"]),
    action: z.enum(["ADD", "REMOVE"]),
    playerProfileId: z.number().int().positive(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid match lineup member payload." });
    return;
  }

  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) {
    res.status(404).json({ error: "Match not found." });
    return;
  }
  if (match.status === "COMPLETED") {
    res.status(409).json({ error: "Cannot edit lineup on a completed match." });
    return;
  }

  const excludedIds = await getExcludedNonStudentIds();
  const [profile] = await db
    .select({ id: playerProfiles.id, userId: users.id, accountType: users.accountType })
    .from(playerProfiles)
    .innerJoin(users, eq(playerProfiles.userId, users.id))
    .where(eq(playerProfiles.id, parsed.data.playerProfileId))
    .limit(1);
  if (!profile) {
    res.status(404).json({ error: "Player profile not found." });
    return;
  }
  if (profile.accountType !== "STUDENT" || excludedIds.includes(profile.userId)) {
    res.status(400).json({ error: "Only eligible student accounts can be added to match lineups." });
    return;
  }

  const currentList = Array.isArray(
    parsed.data.side === "A" ? match.lineupAJson : match.lineupBJson
  )
    ? [...(parsed.data.side === "A" ? match.lineupAJson : match.lineupBJson)]
    : [];

  let nextList: number[];
  if (parsed.data.action === "ADD") {
    nextList = Array.from(new Set([...currentList, parsed.data.playerProfileId]));
  } else {
    nextList = currentList.filter((id) => id !== parsed.data.playerProfileId);
  }

  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(matches)
      .set(parsed.data.side === "A" ? { lineupAJson: nextList } : { lineupBJson: nextList })
      .where(eq(matches.id, matchId))
      .returning();

    await recordAuditLog(tx, req.actor!.id, "MATCH_LINEUP_UPDATED", "matches", matchId, {
      side: parsed.data.side,
      action: parsed.data.action,
      playerProfileId: parsed.data.playerProfileId,
    });
    return [row];
  });

  broadcastSse("MATCH_STATUS", { matchId });
  res.json({ match: updated });
});

async function recomputeStandingsForTournamentSport(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  tournamentId: number,
  sportId: number
) {
  const [sport] = await tx.select().from(sports).where(eq(sports.id, sportId)).limit(1);
  const sportSlug = (sport?.slug as SportId) ?? "cricket";

  const sportTeams = await tx
    .select()
    .from(teams)
    .where(and(eq(teams.tournamentId, tournamentId), eq(teams.sportId, sportId)));
  const teamMap = Object.fromEntries(sportTeams.map((t) => [t.id, t]));

  const sportMatches = await tx
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.tournamentId, tournamentId),
        eq(matches.sportId, sportId),
        eq(matches.status, "COMPLETED")
      )
    );

  const allEvents =
    sportMatches.length > 0
      ? await tx
          .select()
          .from(matchEvents)
          .where(inArray(matchEvents.matchId, sportMatches.map((m) => m.id)))
          .orderBy(asc(matchEvents.seq))
      : [];

  const completedInputs = sportMatches.map((m) => {
    const mEvents = allEvents.filter((e) => e.matchId === m.id);
    const derived = reduceMatchEvents(
      sportSlug,
      mEvents.map((e) => ({
        id: e.id,
        seq: e.seq,
        occurredAt: e.occurredAt.toISOString(),
        matchClockMs: e.matchClockMs,
        eventType: e.eventType,
        payloadJson: e.payloadJson,
        voided: e.voided,
      })),
      {
        teamAShort: teamMap[m.teamAId]?.shortCode ?? "A",
        teamBShort: teamMap[m.teamBId]?.shortCode ?? "B",
        ...(m.configJson as Record<string, unknown>),
      }
    );
    return {
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      winnerTeamId: m.winnerTeamId,
      sportId: sportSlug,
      derived,
    };
  });

  const computed = computeStandingsForSport(
    sportSlug,
    sportTeams.map((t) => t.id),
    completedInputs
  );

  for (const row of computed) {
    await tx
      .insert(standings)
      .values({
        tournamentId,
        sportId,
        teamId: row.teamId,
        played: row.played,
        won: row.won,
        lost: row.lost,
        drawn: row.drawn,
        points: row.points,
        nrr: row.nrr,
        goalDiff: row.goalDiff,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        setsWon: row.setsWon,
        setsLost: row.setsLost,
        rank: row.rank,
      })
      .onConflictDoUpdate({
        target: [standings.tournamentId, standings.sportId, standings.teamId],
        set: {
          played: row.played,
          won: row.won,
          lost: row.lost,
          drawn: row.drawn,
          points: row.points,
          nrr: row.nrr,
          goalDiff: row.goalDiff,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          setsWon: row.setsWon,
          setsLost: row.setsLost,
          rank: row.rank,
          updatedAt: new Date(),
        },
      });
  }
}

router.patch("/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can edit scheduled matches." });
    return;
  }

  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  const [existing] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Match not found." });
    return;
  }

  const rawBody = req.body && typeof req.body === "object" ? req.body : {};
  const normalized = {
    ...rawBody,
    scheduledAt: rawBody.scheduledAt ?? rawBody.scheduledTime,
    roundLabel: rawBody.roundLabel ?? rawBody.stage,
  };

  const schema = z.object({
    roundLabel: z.string().trim().min(2).max(80).optional(),
    matchOrder: z.number().int().positive().optional(),
    venue: z.string().trim().min(2).max(160).optional(),
    scheduledAt: z.string().datetime().optional(),
    teamAId: z.number().int().positive().optional(),
    teamBId: z.number().int().positive().optional(),
    scorerUserId: z.number().int().positive().nullable().optional(),
    expectedVersion: z.number().int().positive().optional(),
  });
  const parsed = schema.safeParse(normalized);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid match update payload." });
    return;
  }

  if (parsed.data.scorerUserId) {
    const [scorerRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, parsed.data.scorerUserId))
      .limit(1);
    if (!scorerRow) {
      res.status(404).json({ error: "Assigned scorer user not found." });
      return;
    }
  }

  const nextTeamAId = parsed.data.teamAId ?? existing.teamAId;
  const nextTeamBId = parsed.data.teamBId ?? existing.teamBId;
  if (nextTeamAId === nextTeamBId) {
    res.status(400).json({ error: "Team A and Team B must be different teams." });
    return;
  }

  if (parsed.data.teamAId !== undefined || parsed.data.teamBId !== undefined) {
    const pairTeams = await db
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.tournamentId, existing.tournamentId),
          eq(teams.sportId, existing.sportId),
          inArray(teams.id, [nextTeamAId, nextTeamBId])
        )
      );
    if (
      pairTeams.length !== 2 ||
      pairTeams.some((t) => t.submissionStatus !== "APPROVED" && t.submissionStatus !== "LOCKED")
    ) {
      res.status(400).json({ error: "Both teams must be APPROVED for this tournament and sport." });
      return;
    }
  }

  const editOutcome = await db.transaction(async (tx) => {
    const [lockedMatch] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .for("update")
      .limit(1);

    if (!lockedMatch) {
      return { ok: false as const, status: 404, error: "Match not found." };
    }
    if (
      parsed.data.expectedVersion !== undefined &&
      lockedMatch.version !== parsed.data.expectedVersion
    ) {
      return {
        ok: false as const,
        status: 409,
        error: "Match updated concurrently (stale version). Refreshing state.",
      };
    }

    const [row] = await tx
      .update(matches)
      .set({
        ...(parsed.data.roundLabel !== undefined ? { roundLabel: parsed.data.roundLabel } : {}),
        ...(parsed.data.matchOrder !== undefined ? { matchOrder: parsed.data.matchOrder } : {}),
        ...(parsed.data.venue !== undefined ? { venue: parsed.data.venue } : {}),
        ...(parsed.data.scheduledAt !== undefined ? { scheduledAt: new Date(parsed.data.scheduledAt) } : {}),
        ...(parsed.data.teamAId !== undefined ? { teamAId: parsed.data.teamAId } : {}),
        ...(parsed.data.teamBId !== undefined ? { teamBId: parsed.data.teamBId } : {}),
        ...(parsed.data.scorerUserId !== undefined ? { scorerUserId: parsed.data.scorerUserId } : {}),
        version: lockedMatch.version + 1,
      })
      .where(and(eq(matches.id, matchId), eq(matches.version, lockedMatch.version)))
      .returning();

    if (!row) {
      return {
        ok: false as const,
        status: 409,
        error: "Match updated concurrently (stale version). Refreshing state.",
      };
    }

    if (
      lockedMatch.status === "COMPLETED" &&
      (parsed.data.teamAId !== undefined || parsed.data.teamBId !== undefined)
    ) {
      await recomputeStandingsForTournamentSport(tx, lockedMatch.tournamentId, lockedMatch.sportId);
    }

    await recordAuditLog(tx, req.actor!.id, "EDIT_MATCH", "matches", matchId, {
      fields: Object.keys(parsed.data),
    });
    return { ok: true as const, row };
  });

  if (!editOutcome.ok) {
    res.status(editOutcome.status).json({ error: editOutcome.error });
    return;
  }
  const updated = editOutcome.row;

  broadcastSse("MATCH_STATUS", { matchId, version: updated.version });
  res.json({ match: updated });
});

router.delete("/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can delete matches." });
    return;
  }

  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  const [existing] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Match not found." });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.delete(matches).where(eq(matches.id, matchId));
    if (existing.status === "COMPLETED") {
      await recomputeStandingsForTournamentSport(tx, existing.tournamentId, existing.sportId);
    }
    await recordAuditLog(tx, req.actor!.id, "DELETE_MATCH", "matches", matchId, {
      tournamentId: existing.tournamentId,
      sportId: existing.sportId,
      status: existing.status,
    });
  });

  const liveCountRows = await db.select({ id: matches.id }).from(matches).where(eq(matches.status, "LIVE"));
  broadcastSse("MATCH_STATUS", { matchId, deleted: true, hasLiveMatches: liveCountRows.length > 0 });
  broadcastSse("NAV_UPDATED", { hasLiveMatches: liveCountRows.length > 0 });
  res.json({ ok: true });
});

router.post("/:id/verify", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can verify match results." });
    return;
  }

  const matchId = parsePositiveIntId(req.params.id);
  if (!matchId) {
    res.status(400).json({ error: "Invalid match id." });
    return;
  }

  const schema = z.object({
    winnerTeamId: z.number().int().positive().nullable(),
    resultNote: z.string().min(2).max(240),
    mvpPlayerProfileId: z.number().int().positive().nullable().optional(),
    expectedVersion: z.number().int().positive().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid verification payload." });
    return;
  }

  const outcome = await db.transaction(async (tx) => {
    const [match] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .for("update")
      .limit(1);

    if (!match) {
      return { ok: false as const, status: 404, error: "Match not found." };
    }
    if (parsed.data.expectedVersion !== undefined && match.version !== parsed.data.expectedVersion) {
      return {
        ok: false as const,
        status: 409,
        error: "Match updated concurrently (stale version). Refreshing state.",
      };
    }

    if (
      parsed.data.winnerTeamId !== null &&
      parsed.data.winnerTeamId !== match.teamAId &&
      parsed.data.winnerTeamId !== match.teamBId
    ) {
      return {
        ok: false as const,
        status: 400,
        error: "winnerTeamId must be one of the participating teams in this match.",
      };
    }

    const prevSummary = (match.scoreSummary ?? "").trim().toLowerCase();
    const shouldReplaceSummary =
      prevSummary === "" ||
      prevSummary === "scheduled" ||
      prevSummary === "kickoff scheduled" ||
      prevSummary === "live — in progress";

    await tx
      .update(matches)
      .set({
        status: "COMPLETED",
        winnerTeamId: parsed.data.winnerTeamId,
        resultNote: parsed.data.resultNote.trim(),
        ...(shouldReplaceSummary ? { scoreSummary: parsed.data.resultNote.trim() } : {}),
        verifiedBy: req.actor!.id,
        verifiedAt: new Date(),
        version: match.version + 1,
      })
      .where(and(eq(matches.id, matchId), eq(matches.version, match.version)));

    await recomputeStandingsForTournamentSport(tx, match.tournamentId, match.sportId);

    if (parsed.data.mvpPlayerProfileId) {
      await tx
        .update(playerMatchStats)
        .set({ isMvp: false })
        .where(eq(playerMatchStats.matchId, matchId));

      const [mvpRoster] = await tx
        .select({ teamId: teamRosters.teamId })
        .from(teamRosters)
        .where(
          and(
            inArray(teamRosters.teamId, [match.teamAId, match.teamBId]),
            eq(teamRosters.playerProfileId, parsed.data.mvpPlayerProfileId)
          )
        )
        .limit(1);

      const mvpTeamId = mvpRoster?.teamId ?? parsed.data.winnerTeamId ?? match.teamAId;
      await tx
        .insert(playerMatchStats)
        .values({
          matchId,
          playerProfileId: parsed.data.mvpPlayerProfileId,
          teamId: mvpTeamId,
          sportId: match.sportId,
          statsJson: { verifiedResult: parsed.data.resultNote },
          isMvp: true,
          verified: true,
        })
        .onConflictDoUpdate({
          target: [playerMatchStats.matchId, playerMatchStats.playerProfileId],
          set: { teamId: mvpTeamId, isMvp: true, verified: true },
        });
    }

    await recordAuditLog(tx, req.actor!.id, "VERIFY_MATCH_RESULT", "matches", matchId, {
      winnerTeamId: parsed.data.winnerTeamId,
      resultNote: parsed.data.resultNote,
    });

    return { ok: true as const };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  const liveCountRows = await db.select({ id: matches.id }).from(matches).where(eq(matches.status, "LIVE"));
  broadcastSse("MATCH_STATUS", {
    matchId,
    status: "COMPLETED",
    verified: true,
    hasLiveMatches: liveCountRows.length > 0,
  });
  broadcastSse("NAV_UPDATED", { hasLiveMatches: liveCountRows.length > 0 });

  res.json({ ok: true });
});

export default router;
