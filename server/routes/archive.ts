import { Router } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.ts";
import {
  matches,
  playerProfiles,
  sports,
  standings,
  teamRosters,
  teams,
  tournamentMedia,
  tournaments,
  tournamentSports,
} from "../db/schema.ts";
import { requireAuth } from "../middleware/auth.ts";
import { hasGlobalSportsAuthority } from "../middleware/rbac.ts";
import { recordAuditLog } from "../lib/audit.ts";

const router = Router();

router.get("/years", async (_req, res) => {
  const archived = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.status, "ARCHIVED"))
    .orderBy(desc(tournaments.academicYear), desc(tournaments.startsAt));

  const years = Array.from(new Set(archived.map((t) => t.academicYear))).sort((a, b) => b - a);
  res.json({ years, tournaments: archived });
});

router.get("/:year", async (req, res) => {
  const year = Number(req.params.year);
  if (!Number.isFinite(year)) {
    res.status(400).json({ error: "Invalid archive year." });
    return;
  }

  const q = String(req.query.q ?? "").trim().toLowerCase();
  const formatFilter = String(req.query.format ?? "").trim();
  const typeFilter = String(req.query.tournamentType ?? "").trim();

  const tourRows = await db
    .select()
    .from(tournaments)
    .where(and(eq(tournaments.status, "ARCHIVED"), eq(tournaments.academicYear, year)))
    .orderBy(desc(tournaments.startsAt));

  const allYearIds = tourRows.map((t) => t.id);
  const [allTsRows, allTeamRows, allRosterPlayers] =
    allYearIds.length > 0
      ? await Promise.all([
          db
            .select({
              tournamentId: tournamentSports.tournamentId,
              sportId: sports.id,
              slug: sports.slug,
              name: sports.name,
              winnerTeamId: tournamentSports.winnerTeamId,
              runnerUp1TeamId: tournamentSports.runnerUp1TeamId,
              runnerUp2TeamId: tournamentSports.runnerUp2TeamId,
            })
            .from(tournamentSports)
            .innerJoin(sports, eq(tournamentSports.sportId, sports.id))
            .where(inArray(tournamentSports.tournamentId, allYearIds))
            .orderBy(asc(sports.displayOrder)),
          db
            .select({
              id: teams.id,
              tournamentId: teams.tournamentId,
              name: teams.name,
              shortCode: teams.shortCode,
            })
            .from(teams)
            .where(inArray(teams.tournamentId, allYearIds)),
          db
            .select({
              tournamentId: teams.tournamentId,
              displayName: playerProfiles.displayName,
            })
            .from(teamRosters)
            .innerJoin(teams, eq(teamRosters.teamId, teams.id))
            .innerJoin(playerProfiles, eq(teamRosters.playerProfileId, playerProfiles.id))
            .where(inArray(teams.tournamentId, allYearIds)),
        ])
      : [[], [], []];

  const filteredTours = tourRows.filter((t) => {
    if (formatFilter && t.format !== formatFilter) return false;
    if (typeFilter && t.tournamentType !== typeFilter) return false;
    if (q) {
      const matchesTournament =
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        String(t.academicYear).includes(q);
      const matchesSport = allTsRows.some(
        (s) =>
          s.tournamentId === t.id &&
          (s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q))
      );
      const matchesTeam = allTeamRows.some(
        (tm) =>
          tm.tournamentId === t.id &&
          (tm.name.toLowerCase().includes(q) || tm.shortCode.toLowerCase().includes(q))
      );
      const matchesPlayer = allRosterPlayers.some(
        (p) => p.tournamentId === t.id && p.displayName.toLowerCase().includes(q)
      );
      if (!matchesTournament && !matchesSport && !matchesTeam && !matchesPlayer) {
        return false;
      }
    }
    return true;
  });

  const tourIds = filteredTours.map((t) => t.id);
  const tsRows = allTsRows.filter((s) => tourIds.includes(s.tournamentId));
  const teamRows = allTeamRows.filter((tm) => tourIds.includes(tm.tournamentId));

  const mediaRows =
    tourIds.length > 0
      ? await db
          .select()
          .from(tournamentMedia)
          .where(inArray(tournamentMedia.tournamentId, tourIds))
      : [];

  const matchRows =
    tourIds.length > 0
      ? await db
          .select({
            id: matches.id,
            tournamentId: matches.tournamentId,
            roundLabel: matches.roundLabel,
            scoreSummary: matches.scoreSummary,
            resultNote: matches.resultNote,
            sportName: sports.name,
            sportSlug: sports.slug,
            teamAId: matches.teamAId,
            teamBId: matches.teamBId,
          })
          .from(matches)
          .innerJoin(sports, eq(matches.sportId, sports.id))
          .where(inArray(matches.tournamentId, tourIds))
          .orderBy(desc(matches.matchOrder), desc(matches.scheduledAt))
      : [];

  const teamMap = Object.fromEntries(teamRows.map((t) => [t.id, t]));

  res.json({
    year,
    tournaments: filteredTours.map((t) => ({
      ...t,
      sports: tsRows.filter((s) => s.tournamentId === t.id),
      media: mediaRows.filter((m) => m.tournamentId === t.id),
      matches: matchRows
        .filter((m) => m.tournamentId === t.id)
        .map((m) => ({
          ...m,
          teamA: teamMap[m.teamAId] ?? null,
          teamB: teamMap[m.teamBId] ?? null,
        })),
    })),
  });
});

router.get("/:year/:tournamentId/:sportSlug", async (req, res) => {
  const year = Number(req.params.year);
  const tournamentId = Number(req.params.tournamentId);
  if (!Number.isFinite(year) || !Number.isFinite(tournamentId)) {
    res.status(404).json({ error: "Archived tournament not found." });
    return;
  }

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.id, tournamentId),
        eq(tournaments.status, "ARCHIVED"),
        eq(tournaments.academicYear, year)
      )
    )
    .limit(1);
  if (!tournament || tournament.status !== "ARCHIVED" || tournament.academicYear !== year) {
    res.status(404).json({ error: "Archived tournament not found for this year." });
    return;
  }

  const [sport] = await db
    .select()
    .from(sports)
    .where(eq(sports.slug, req.params.sportSlug))
    .limit(1);
  if (!sport) {
    res.status(404).json({ error: "Sport not found." });
    return;
  }

  const [ts] = await db
    .select()
    .from(tournamentSports)
    .where(
      and(eq(tournamentSports.tournamentId, tournamentId), eq(tournamentSports.sportId, sport.id))
    )
    .limit(1);

  const teamRows = await db
    .select()
    .from(teams)
    .where(and(eq(teams.tournamentId, tournamentId), eq(teams.sportId, sport.id)))
    .orderBy(asc(teams.name));

  const teamIds = teamRows.map((t) => t.id);
  const rosterRows =
    teamIds.length > 0
      ? await db
          .select({
            teamId: teamRosters.teamId,
            playerProfileId: teamRosters.playerProfileId,
            playingRole: teamRosters.playingRole,
            playerClass: teamRosters.playerClass,
            soldPrice: teamRosters.soldPrice,
            displayName: playerProfiles.displayName,
            batch: playerProfiles.batch,
            branch: playerProfiles.branch,
          })
          .from(teamRosters)
          .innerJoin(playerProfiles, eq(teamRosters.playerProfileId, playerProfiles.id))
          .where(inArray(teamRosters.teamId, teamIds))
      : [];

  const standingRows = await db
    .select()
    .from(standings)
    .where(and(eq(standings.tournamentId, tournamentId), eq(standings.sportId, sport.id)))
    .orderBy(asc(standings.rank));

  // Reverse chronological order: Final down to Opening Match
  const matchRows = await db
    .select()
    .from(matches)
    .where(and(eq(matches.tournamentId, tournamentId), eq(matches.sportId, sport.id)))
    .orderBy(desc(matches.matchOrder), desc(matches.scheduledAt));

  const teamMap = Object.fromEntries(teamRows.map((t) => [t.id, t]));

  res.json({
    tournament,
    sport,
    podium: {
      winner: ts?.winnerTeamId ? teamMap[ts.winnerTeamId] ?? null : null,
      runnerUp1: ts?.runnerUp1TeamId ? teamMap[ts.runnerUp1TeamId] ?? null : null,
      runnerUp2: ts?.runnerUp2TeamId ? teamMap[ts.runnerUp2TeamId] ?? null : null,
    },
    standings: standingRows.map((s) => ({
      ...s,
      team: teamMap[s.teamId] ?? null,
    })),
    matches: matchRows.map((m) => ({
      ...m,
      teamA: teamMap[m.teamAId] ?? null,
      teamB: teamMap[m.teamBId] ?? null,
    })),
    teams: teamRows.map((t) => ({
      ...t,
      roster: rosterRows.filter((r) => r.teamId === t.id),
    })),
  });
});

router.post("/legacy", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can add legacy archive records." });
    return;
  }

  const schema = z.object({
    name: z.string().min(3).max(160),
    academicYear: z.number().int().min(2015).max(2030),
    semester: z.enum(["ODD", "EVEN", "ANNUAL"]).default("ANNUAL"),
    tournamentType: z.enum(["FLAGSHIP", "INTER_HOSTEL", "OPEN", "INTRA_CLUB", "PROTHYMOS"]),
    format: z.enum(["KNOCKOUT", "LEAGUE", "ROUND_ROBIN", "GROUP_KNOCKOUT", "BEST_OF_SERIES"]),
    completenessStatus: z.enum(["RESULTS_ONLY", "PARTIAL", "COMPLETE", "VERIFIED"]),
    sportId: z.number().int().positive(),
    winnerName: z.string().min(2).max(80),
    runnerUp1Name: z.string().min(2).max(80),
    runnerUp2Name: z.string().max(80).optional().nullable(),
    finalSummary: z.string().min(3).max(240),
    description: z.string().max(400).optional(),
    mediaUrl: z.string().max(400).optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid legacy archive record." });
    return;
  }

  const created = await db.transaction(async (tx) => {
    const [t] = await tx
      .insert(tournaments)
      .values({
        name: parsed.data.name.trim(),
        academicYear: parsed.data.academicYear,
        semester: parsed.data.semester,
        tournamentType: parsed.data.tournamentType,
        format: parsed.data.format,
        rosterMode: "CAPTAIN_SUBMISSION",
        status: "ARCHIVED",
        completenessStatus: parsed.data.completenessStatus,
        isCurrent: false,
        description: parsed.data.description?.trim() || null,
        startsAt: new Date(`${parsed.data.academicYear}-03-15T09:00:00Z`),
        verifiedBy: req.actor!.id,
      })
      .returning();

    const [winTeam] = await tx
      .insert(teams)
      .values({
        tournamentId: t.id,
        sportId: parsed.data.sportId,
        name: parsed.data.winnerName.trim(),
        shortCode: parsed.data.winnerName.trim().slice(0, 3).toUpperCase(),
        submissionStatus: "LOCKED",
      })
      .returning();

    const [ru1Team] = await tx
      .insert(teams)
      .values({
        tournamentId: t.id,
        sportId: parsed.data.sportId,
        name: parsed.data.runnerUp1Name.trim(),
        shortCode: parsed.data.runnerUp1Name.trim().slice(0, 3).toUpperCase(),
        submissionStatus: "LOCKED",
      })
      .returning();

    let ru2Id: number | null = null;
    if (parsed.data.runnerUp2Name?.trim()) {
      const [ru2Team] = await tx
        .insert(teams)
        .values({
          tournamentId: t.id,
          sportId: parsed.data.sportId,
          name: parsed.data.runnerUp2Name.trim(),
          shortCode: parsed.data.runnerUp2Name.trim().slice(0, 3).toUpperCase(),
          submissionStatus: "LOCKED",
        })
        .returning();
      ru2Id = ru2Team.id;
    }

    await tx.insert(tournamentSports).values({
      tournamentId: t.id,
      sportId: parsed.data.sportId,
      format: parsed.data.format,
      winnerTeamId: winTeam.id,
      runnerUp1TeamId: ru1Team.id,
      runnerUp2TeamId: ru2Id,
    });

    await tx.insert(matches).values({
      tournamentId: t.id,
      sportId: parsed.data.sportId,
      roundLabel: "Final",
      matchOrder: 1,
      teamAId: winTeam.id,
      teamBId: ru1Team.id,
      venue: "IIITT Campus Ground",
      scheduledAt: new Date(`${parsed.data.academicYear}-03-20T16:00:00Z`),
      status: "COMPLETED",
      scoreSummary: parsed.data.finalSummary.trim(),
      resultNote: `${winTeam.name} won the championship`,
      winnerTeamId: winTeam.id,
      verifiedBy: req.actor!.id,
      verifiedAt: new Date(),
    });

    if (parsed.data.mediaUrl) {
      await tx.insert(tournamentMedia).values({
        tournamentId: t.id,
        title: `${t.name} Official Record`,
        mediaType: parsed.data.mediaUrl.endsWith(".pdf") ? "PDF" : "IMAGE",
        fileUrl: parsed.data.mediaUrl,
        uploadedBy: req.actor!.id,
      });
    }

    await recordAuditLog(tx, req.actor!.id, "CREATE_LEGACY_ARCHIVE", "tournaments", t.id, {});
    return t;
  });

  res.status(201).json({ tournament: created });
});

export default router;
