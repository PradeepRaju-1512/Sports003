import { Router } from "express";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.ts";
import {
  matches,
  notifications,
  playerProfiles,
  siteSettings,
  sports,
  standings,
  teamRosters,
  teams,
  tournaments,
  tournamentSports,
  userRoles,
  users,
} from "../db/schema.ts";
import { requireAuth } from "../middleware/auth.ts";
import { hasGlobalSportsAuthority } from "../middleware/rbac.ts";
import { recordAuditLog } from "../lib/audit.ts";
import { broadcastSse } from "../lib/sse.ts";
import { parsePositiveIntId } from "../lib/http.ts";
import { invalidateBootstrapCache } from "./bootstrap.ts";

const router = Router();

router.get("/sports", async (_req, res) => {
  const allSports = await db.select().from(sports).orderBy(asc(sports.displayOrder));
  res.json({ sports: allSports });
});

router.get("/", async (_req, res) => {
  const [rows, allSports] = await Promise.all([
    db
      .select()
      .from(tournaments)
      .where(ne(tournaments.status, "ARCHIVED"))
      .orderBy(desc(tournaments.isCurrent), desc(tournaments.startsAt), desc(tournaments.id)),
    db.select().from(sports).orderBy(asc(sports.displayOrder)),
  ]);
  res.json({ tournaments: rows, sports: allSports });
});

router.get("/current", async (req, res) => {
  const [current] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.isCurrent, true))
    .orderBy(desc(tournaments.id))
    .limit(1);

  if (!current) {
    const [upcomingTournaments, allSports] = await Promise.all([
      db
        .select()
        .from(tournaments)
        .where(ne(tournaments.status, "ARCHIVED"))
        .orderBy(desc(tournaments.startsAt), desc(tournaments.id)),
      db.select().from(sports).orderBy(asc(sports.displayOrder)),
    ]);
    res.json({
      tournament: null,
      sports: [],
      teams: [],
      standings: [],
      matches: [],
      upcomingTournaments,
      allSports,
      canManage: hasGlobalSportsAuthority(req.actor),
    });
    return;
  }

  const [configuredSports, allSports] = await Promise.all([
    db
      .select({
        id: sports.id,
        slug: sports.slug,
        name: sports.name,
        category: sports.category,
        format: tournamentSports.format,
        minSquadSize: tournamentSports.minSquadSize,
        maxSquadSize: tournamentSports.maxSquadSize,
        registrationDeadline: tournamentSports.registrationDeadline,
      })
      .from(tournamentSports)
      .innerJoin(sports, eq(tournamentSports.sportId, sports.id))
      .where(eq(tournamentSports.tournamentId, current.id))
      .orderBy(asc(sports.displayOrder)),
    db.select().from(sports).orderBy(asc(sports.displayOrder)),
  ]);

  const teamRows = await db
    .select()
    .from(teams)
    .where(eq(teams.tournamentId, current.id))
    .orderBy(asc(teams.id));

  const teamIds = teamRows.map((t) => t.id);
  const rosterRows =
    teamIds.length > 0
      ? await db
          .select({
            id: teamRosters.id,
            teamId: teamRosters.teamId,
            playerProfileId: teamRosters.playerProfileId,
            playingRole: teamRosters.playingRole,
            playerClass: teamRosters.playerClass,
            displayName: playerProfiles.displayName,
            batch: playerProfiles.batch,
            branch: playerProfiles.branch,
          })
          .from(teamRosters)
          .innerJoin(playerProfiles, eq(teamRosters.playerProfileId, playerProfiles.id))
          .where(inArray(teamRosters.teamId, teamIds))
      : [];

  const standingsRows = await db
    .select()
    .from(standings)
    .where(eq(standings.tournamentId, current.id))
    .orderBy(asc(standings.rank));

  const matchRows = await db
    .select()
    .from(matches)
    .where(eq(matches.tournamentId, current.id))
    .orderBy(desc(matches.matchOrder), desc(matches.scheduledAt));

  const teamMap = Object.fromEntries(teamRows.map((t) => [t.id, t]));
  const sportMap = Object.fromEntries(configuredSports.map((s) => [s.id, s]));

  const nowMs = Date.now();
  res.json({
    tournament: current,
    sports: configuredSports.map((s) => ({
      ...s,
      registrationOpen:
        !s.registrationDeadline || nowMs <= new Date(s.registrationDeadline).getTime(),
    })),
    teams: teamRows.map((t) => ({
      ...t,
      roster: rosterRows.filter((r) => r.teamId === t.id),
    })),
    standings: standingsRows.map((s) => ({
      ...s,
      team: teamMap[s.teamId] ?? null,
    })),
    matches: matchRows.map((m) => ({
      ...m,
      teamA: teamMap[m.teamAId] ?? null,
      teamB: teamMap[m.teamBId] ?? null,
      sport: sportMap[m.sportId] ?? null,
    })),
    allSports,
    canManage: hasGlobalSportsAuthority(req.actor),
  });
});

router.post("/", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can configure tournaments." });
    return;
  }

  const schema = z.object({
    name: z.string().min(3).max(160),
    academicYear: z.number().int().min(2020).max(2040),
    semester: z.enum(["ODD", "EVEN", "ANNUAL"]),
    tournamentType: z.enum(["FLAGSHIP", "INTER_HOSTEL", "OPEN", "INTRA_CLUB", "PROTHYMOS"]),
    format: z.enum(["KNOCKOUT", "LEAGUE", "ROUND_ROBIN", "GROUP_KNOCKOUT", "BEST_OF_SERIES"]),
    rosterMode: z.enum(["AUCTION", "CAPTAIN_SUBMISSION"]),
    splitMode: z.enum(["COMBINED", "SEPARATE_BOYS_GIRLS"]).default("COMBINED"),
    description: z.string().max(600).optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().optional(),
    sportIds: z.array(z.number().int().positive()).min(1),
    setAsCurrent: z.boolean().default(true),
    notifyEveryone: z.boolean().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid tournament configuration." });
    return;
  }

  const created = await db.transaction(async (tx) => {
    if (parsed.data.setAsCurrent) {
      await tx.update(tournaments).set({ isCurrent: false }).where(eq(tournaments.isCurrent, true));
    }

    const [t] = await tx
      .insert(tournaments)
      .values({
        name: parsed.data.name.trim(),
        academicYear: parsed.data.academicYear,
        semester: parsed.data.semester,
        tournamentType: parsed.data.tournamentType,
        format: parsed.data.format,
        rosterMode: parsed.data.rosterMode,
        splitMode: parsed.data.splitMode,
        status: "ACTIVE",
        isCurrent: parsed.data.setAsCurrent,
        description: parsed.data.description?.trim() || null,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      })
      .returning();

    await tx.insert(tournamentSports).values(
      parsed.data.sportIds.map((sid) => ({
        tournamentId: t.id,
        sportId: sid,
        format: parsed.data.format,
      }))
    );

    if (parsed.data.setAsCurrent) {
      await tx
        .insert(siteSettings)
        .values({ key: "currentTournamentId", valueJson: t.id, updatedBy: req.actor!.id })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { valueJson: t.id, updatedBy: req.actor!.id, updatedAt: new Date() },
        });
    }

    if (parsed.data.notifyEveryone) {
      const allUsers = await tx.select({ id: users.id }).from(users);
      if (allUsers.length > 0) {
        await tx.insert(notifications).values(
          allUsers.map((u) => ({
            userId: u.id,
            title: `Tournament Announced: ${t.name}`,
            message: "Fixtures, team submissions, and live schedules are now open.",
            linkUrl: "/tournaments/current",
          }))
        );
      }
    }

    await recordAuditLog(tx, req.actor!.id, "CREATE_TOURNAMENT", "tournaments", t.id, {
      notifyEveryone: parsed.data.notifyEveryone,
    });
    return t;
  });

  if (parsed.data.notifyEveryone) {
    broadcastSse("NOTIFICATION", { tournamentId: created.id });
  }
  res.status(201).json({ tournament: created });
});

async function applyTournamentStatusTransition(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: {
    tournamentId: number;
    existing: typeof tournaments.$inferSelect;
    nextStatus: "CURRENT" | "ACTIVE" | "UPCOMING" | "COMPLETED" | "ARCHIVED";
    previousStatus?: "UPCOMING" | "ARCHIVED";
    actorId: number;
    auditAction: string;
  }
) {
  const { tournamentId, existing, nextStatus, previousStatus, actorId, auditAction } = params;

  if (nextStatus === "CURRENT") {
    await tx
      .update(tournaments)
      .set({
        isCurrent: false,
        status: previousStatus ?? "UPCOMING",
      })
      .where(and(eq(tournaments.isCurrent, true), ne(tournaments.id, tournamentId)));

    const [activated] = await tx
      .update(tournaments)
      .set({ isCurrent: true, status: "ACTIVE" })
      .where(eq(tournaments.id, tournamentId))
      .returning();

    await tx
      .insert(siteSettings)
      .values({ key: "currentTournamentId", valueJson: activated.id, updatedBy: actorId })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { valueJson: activated.id, updatedBy: actorId, updatedAt: new Date() },
      });

    await recordAuditLog(tx, actorId, auditAction, "tournaments", tournamentId, {
      name: activated.name,
    });
    return activated;
  }

  const isFinished = nextStatus === "COMPLETED" || nextStatus === "ARCHIVED";
  const [row] = await tx
    .update(tournaments)
    .set({
      status: nextStatus,
      ...(isFinished ? { isCurrent: false } : {}),
      ...(nextStatus === "ARCHIVED"
        ? { completenessStatus: "VERIFIED", verifiedBy: actorId }
        : {}),
    })
    .where(eq(tournaments.id, tournamentId))
    .returning();

  if (isFinished) {
    await tx
      .update(userRoles)
      .set({ active: false })
      .where(
        and(
          eq(userRoles.roleCode, "CAPTAIN"),
          eq(userRoles.tournamentId, tournamentId),
          eq(userRoles.active, true)
        )
      );

    if (existing.isCurrent) {
      await tx
        .delete(siteSettings)
        .where(eq(siteSettings.key, "currentTournamentId"));
    }
  }

  await recordAuditLog(tx, actorId, auditAction, "tournaments", tournamentId, {});
  return row;
}

router.patch("/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can update tournaments." });
    return;
  }

  const tournamentId = parsePositiveIntId(req.params.id);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament ID." });
    return;
  }
  const schema = z.object({
    status: z.enum(["CURRENT", "ACTIVE", "UPCOMING", "COMPLETED", "ARCHIVED"]),
    previousStatus: z.enum(["UPCOMING", "ARCHIVED"]).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid tournament update payload." });
    return;
  }

  const [existing] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Tournament not found." });
    return;
  }

  const updated = await db.transaction((tx) =>
    applyTournamentStatusTransition(tx, {
      tournamentId,
      existing,
      nextStatus: parsed.data.status,
      previousStatus: parsed.data.previousStatus,
      actorId: req.actor!.id,
      auditAction:
        parsed.data.status === "CURRENT"
          ? "ACTIVATE_CURRENT_TOURNAMENT"
          : `TOURNAMENT_${parsed.data.status}`,
    })
  );

  invalidateBootstrapCache();
  broadcastSse("NAV_UPDATED", { currentTournamentId: updated.isCurrent ? updated.id : null });
  res.json({ tournament: updated });
});

router.patch("/:id/config", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can configure tournaments." });
    return;
  }

  const tournamentId = parsePositiveIntId(req.params.id);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament ID." });
    return;
  }

  const sportConfigSchema = z.object({
    sportId: z.number().int().positive(),
    minSquadSize: z.number().int().min(1).max(30).default(1),
    maxSquadSize: z.number().int().min(1).max(40).default(15),
    registrationDeadline: z.string().datetime().nullable().optional(),
  });

  const schema = z.object({
    name: z.string().trim().min(3).max(160),
    format: z.enum(["KNOCKOUT", "LEAGUE", "ROUND_ROBIN", "GROUP_KNOCKOUT", "BEST_OF_SERIES"]),
    rosterMode: z.enum(["AUCTION", "CAPTAIN_SUBMISSION"]),
    splitMode: z.enum(["COMBINED", "SEPARATE_BOYS_GIRLS"]).optional(),
    description: z.string().max(600).nullable().optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable().optional(),
    sportsConfig: z.array(sportConfigSchema).min(1),
    notifyEveryone: z.boolean().default(false),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid tournament configuration payload." });
    return;
  }

  for (const sc of parsed.data.sportsConfig) {
    if (sc.minSquadSize > sc.maxSquadSize) {
      res.status(400).json({ error: "Minimum squad size cannot exceed maximum squad size." });
      return;
    }
  }

  const [existing] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Tournament not found." });
    return;
  }
  if (existing.status === "ARCHIVED") {
    res.status(409).json({ error: "Archived tournaments cannot be reconfigured." });
    return;
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(tournaments)
      .set({
        name: parsed.data.name,
        format: parsed.data.format,
        rosterMode: parsed.data.rosterMode,
        ...(parsed.data.splitMode ? { splitMode: parsed.data.splitMode } : {}),
        description: parsed.data.description?.trim() || null,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      })
      .where(eq(tournaments.id, tournamentId))
      .returning();

    const existingTs = await tx
      .select()
      .from(tournamentSports)
      .where(eq(tournamentSports.tournamentId, tournamentId));
    const existingBySportId = new Map(existingTs.map((s) => [s.sportId, s]));
    const nextSportIds = parsed.data.sportsConfig.map((s) => s.sportId);

    for (const sc of parsed.data.sportsConfig) {
      const prior = existingBySportId.get(sc.sportId);
      if (prior) {
        await tx
          .update(tournamentSports)
          .set({
            format: parsed.data.format,
            minSquadSize: sc.minSquadSize,
            maxSquadSize: sc.maxSquadSize,
            registrationDeadline: sc.registrationDeadline ? new Date(sc.registrationDeadline) : null,
          })
          .where(eq(tournamentSports.id, prior.id));
      } else {
        await tx.insert(tournamentSports).values({
          tournamentId,
          sportId: sc.sportId,
          format: parsed.data.format,
          minSquadSize: sc.minSquadSize,
          maxSquadSize: sc.maxSquadSize,
          registrationDeadline: sc.registrationDeadline ? new Date(sc.registrationDeadline) : null,
        });
      }
    }

    const removedSportIds = existingTs
      .map((s) => s.sportId)
      .filter((sid) => !nextSportIds.includes(sid));
    if (removedSportIds.length > 0) {
      await tx
        .delete(tournamentSports)
        .where(
          and(
            eq(tournamentSports.tournamentId, tournamentId),
            inArray(tournamentSports.sportId, removedSportIds)
          )
        );
    }

    if (parsed.data.notifyEveryone) {
      const allUsers = await tx.select({ id: users.id }).from(users);
      if (allUsers.length > 0) {
        await tx.insert(notifications).values(
          allUsers.map((u) => ({
            userId: u.id,
            title: `Tournament Updated: ${row.name}`,
            message: "Sports lineup, schedules, or registration deadlines were updated.",
            linkUrl: "/tournaments/current",
          }))
        );
      }
    }

    await recordAuditLog(tx, req.actor!.id, "UPDATE_TOURNAMENT_CONFIG", "tournaments", tournamentId, {
      sportCount: parsed.data.sportsConfig.length,
      notifyEveryone: parsed.data.notifyEveryone,
    });

    return row;
  });

  if (parsed.data.notifyEveryone) {
    broadcastSse("NOTIFICATION", { tournamentId: updated.id });
  }
  invalidateBootstrapCache();
  broadcastSse("NAV_UPDATED", { currentTournamentId: updated.isCurrent ? updated.id : null });
  res.json({ tournament: updated });
});

router.patch("/:id/status", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can update tournament status." });
    return;
  }

  const tournamentId = parsePositiveIntId(req.params.id);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament ID." });
    return;
  }
  const schema = z.object({
    status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid tournament status." });
    return;
  }

  const [existing] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Tournament not found." });
    return;
  }

  const updated = await db.transaction((tx) =>
    applyTournamentStatusTransition(tx, {
      tournamentId,
      existing,
      nextStatus: parsed.data.status,
      actorId: req.actor!.id,
      auditAction: `TOURNAMENT_STATUS_${parsed.data.status}`,
    })
  );

  invalidateBootstrapCache();
  broadcastSse("NAV_UPDATED", { currentTournamentId: updated.isCurrent ? updated.id : null });
  res.json({ tournament: updated });
});

router.post("/:id/archive", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can archive tournaments." });
    return;
  }

  const tournamentId = parsePositiveIntId(req.params.id);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament ID." });
    return;
  }
  const [existing] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Tournament not found." });
    return;
  }

  const updated = await db.transaction((tx) =>
    applyTournamentStatusTransition(tx, {
      tournamentId,
      existing,
      nextStatus: "ARCHIVED",
      actorId: req.actor!.id,
      auditAction: "ARCHIVE_TOURNAMENT",
    })
  );

  invalidateBootstrapCache();
  broadcastSse("NAV_UPDATED", { currentTournamentId: updated.isCurrent ? updated.id : null });
  res.json({ tournament: updated });
});

router.post("/:id/teams", requireAuth, async (req, res) => {
  const tournamentId = parsePositiveIntId(req.params.id);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament ID." });
    return;
  }
  const schema = z.object({
    teamId: z.number().int().positive().optional(),
    sportId: z.number().int().positive(),
    track: z.enum(["COMBINED", "BOYS", "GIRLS"]).optional(),
    name: z.string().min(2).max(80),
    shortCode: z.string().min(2).max(6).transform((s) => s.toUpperCase()),
    accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#B91C1C"),
    playerProfileIds: z.array(z.number().int().positive()).min(1),
    submitImmediately: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid team submission payload." });
    return;
  }

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament || tournament.status !== "ACTIVE") {
    res.status(400).json({ error: "Team roster submissions are closed because this tournament is not active." });
    return;
  }
  if (tournament.rosterMode !== "CAPTAIN_SUBMISSION") {
    res.status(400).json({ error: "This tournament uses AUCTION squads rather than captain roster submissions." });
    return;
  }

  const [tsConfig] = await db
    .select()
    .from(tournamentSports)
    .where(
      and(
        eq(tournamentSports.tournamentId, tournamentId),
        eq(tournamentSports.sportId, parsed.data.sportId)
      )
    )
    .limit(1);

  if (!tsConfig) {
    res.status(400).json({ error: "Selected sport is not configured for this tournament." });
    return;
  }

  if (tsConfig.registrationDeadline && Date.now() > new Date(tsConfig.registrationDeadline).getTime()) {
    if (!hasGlobalSportsAuthority(req.actor)) {
      res.status(400).json({ error: "Team registration deadline has passed." });
      return;
    }
  }

  // Allow editing/resubmitting an existing DRAFT or CHANGES_REQUESTED team by the same captain;
  // block duplicate active submissions (SUBMITTED / APPROVED / LOCKED).
  let editableTeamId: number | null = null;
  if (parsed.data.teamId) {
    const [targetTeam] = await db
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.id, parsed.data.teamId),
          eq(teams.tournamentId, tournamentId),
          eq(teams.sportId, parsed.data.sportId)
        )
      )
      .limit(1);
    if (!targetTeam) {
      res.status(404).json({ error: "Team to edit not found for this tournament and sport." });
      return;
    }
    if (!hasGlobalSportsAuthority(req.actor) && targetTeam.captainUserId !== req.actor!.id) {
      res.status(403).json({ error: "You can only edit your own team submission." });
      return;
    }
    if (targetTeam.submissionStatus !== "DRAFT" && targetTeam.submissionStatus !== "CHANGES_REQUESTED") {
      res.status(409).json({ error: "Only DRAFT or CHANGES_REQUESTED teams can be edited and resubmitted." });
      return;
    }
    editableTeamId = targetTeam.id;
  } else if (!hasGlobalSportsAuthority(req.actor)) {
    const existingOwn = await db
      .select({ id: teams.id, submissionStatus: teams.submissionStatus })
      .from(teams)
      .where(
        and(
          eq(teams.tournamentId, tournamentId),
          eq(teams.sportId, parsed.data.sportId),
          eq(teams.captainUserId, req.actor!.id)
        )
      );
    const blockingTeam = existingOwn.find(
      (t) =>
        t.submissionStatus !== "REJECTED" &&
        t.submissionStatus !== "DRAFT" &&
        t.submissionStatus !== "CHANGES_REQUESTED"
    );
    if (blockingTeam) {
      res.status(409).json({ error: "You have already submitted a team for this sport in this tournament." });
      return;
    }
    const editableTeam = existingOwn.find(
      (t) => t.submissionStatus === "DRAFT" || t.submissionStatus === "CHANGES_REQUESTED"
    );
    if (editableTeam) {
      editableTeamId = editableTeam.id;
    }
  }

  const uniquePlayerIds = Array.from(new Set(parsed.data.playerProfileIds));
  if (
    parsed.data.submitImmediately &&
    (uniquePlayerIds.length < tsConfig.minSquadSize || uniquePlayerIds.length > tsConfig.maxSquadSize)
  ) {
    res.status(400).json({
      error: `Squad size must be between ${tsConfig.minSquadSize} and ${tsConfig.maxSquadSize} players (got ${uniquePlayerIds.length}).`,
    });
    return;
  }

  // Prevent placing the same student on two teams in the same tournament + sport
  const duplicateRosterRows = await db
    .select({
      playerProfileId: teamRosters.playerProfileId,
      teamId: teams.id,
      teamName: teams.name,
    })
    .from(teamRosters)
    .innerJoin(teams, eq(teamRosters.teamId, teams.id))
    .where(
      and(
        eq(teams.tournamentId, tournamentId),
        eq(teams.sportId, parsed.data.sportId),
        ne(teams.submissionStatus, "REJECTED"),
        inArray(teamRosters.playerProfileId, uniquePlayerIds),
        ...(editableTeamId ? [ne(teams.id, editableTeamId)] : [])
      )
    );
  if (duplicateRosterRows.length > 0) {
    res.status(409).json({
      error: `One or more selected players are already registered on another team (${duplicateRosterRows[0].teamName}) for this sport.`,
    });
    return;
  }

  // Strictly enforce student eligibility (reject FACULTY_ADVISOR, EQUIPMENT_STAFF, SUPER_ADMIN, non-STUDENT accounts)
  const selectedProfiles = await db
    .select({
      profileId: playerProfiles.id,
      userId: users.id,
      accountType: users.accountType,
    })
    .from(playerProfiles)
    .innerJoin(users, eq(playerProfiles.userId, users.id))
    .where(inArray(playerProfiles.id, uniquePlayerIds));

  if (selectedProfiles.length !== uniquePlayerIds.length) {
    res.status(400).json({ error: "One or more selected players do not have an active IIITT student account." });
    return;
  }
  if (selectedProfiles.some((p) => p.accountType !== "STUDENT")) {
    res.status(400).json({ error: "Faculty, ground staff, and admin accounts cannot be added to student team rosters." });
    return;
  }
  const selectedUserIds = selectedProfiles.map((p) => p.userId);
  const forbiddenHolders = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(
      and(
        inArray(userRoles.userId, selectedUserIds),
        eq(userRoles.active, true),
        inArray(userRoles.roleCode, ["FACULTY_ADVISOR", "EQUIPMENT_STAFF", "SUPER_ADMIN"])
      )
    );
  if (forbiddenHolders.length > 0) {
    res.status(400).json({ error: "Faculty, staff, and system admin accounts cannot join student team rosters." });
    return;
  }

  const saved = await db.transaction(async (tx) => {
    const nextStatus = parsed.data.submitImmediately ? "SUBMITTED" : "DRAFT";
    let team: typeof teams.$inferSelect;
    if (editableTeamId) {
      const [updatedTeam] = await tx
        .update(teams)
        .set({
          name: parsed.data.name.trim(),
          shortCode: parsed.data.shortCode,
          accentColor: parsed.data.accentColor,
          submissionStatus: nextStatus,
        })
        .where(eq(teams.id, editableTeamId))
        .returning();
      team = updatedTeam;
      await tx.delete(teamRosters).where(eq(teamRosters.teamId, team.id));
    } else {
      const [insertedTeam] = await tx
        .insert(teams)
        .values({
          tournamentId,
          sportId: parsed.data.sportId,
          track:
            tournament.splitMode === "SEPARATE_BOYS_GIRLS"
              ? parsed.data.track === "GIRLS"
                ? "GIRLS"
                : "BOYS"
              : "COMBINED",
          name: parsed.data.name.trim(),
          shortCode: parsed.data.shortCode,
          accentColor: parsed.data.accentColor,
          captainUserId: req.actor!.id,
          submissionStatus: nextStatus,
        })
        .returning();
      team = insertedTeam;
    }

    await tx.insert(teamRosters).values(
      uniquePlayerIds.map((pid, idx) => ({
        teamId: team.id,
        playerProfileId: pid,
        playingRole: idx === 0 ? "Captain" : "Squad Member",
        playerClass: "OPEN",
      }))
    );

    await recordAuditLog(
      tx,
      req.actor!.id,
      editableTeamId ? "RESUBMIT_TEAM_SUBMISSION" : "CREATE_TEAM_SUBMISSION",
      "teams",
      team.id,
      {
        status: team.submissionStatus,
        playerCount: uniquePlayerIds.length,
      }
    );
    return team;
  });

  res.status(editableTeamId ? 200 : 201).json({ team: saved });
});

router.patch("/teams/:teamId/review", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can approve/reject teams." });
    return;
  }

  const teamId = parsePositiveIntId(req.params.teamId);
  if (!teamId) {
    res.status(400).json({ error: "Invalid team ID." });
    return;
  }
  const schema = z.object({
    decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED", "LOCKED"]),
    reviewNotes: z.string().max(300).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid team review decision." });
    return;
  }

  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(teams)
      .set({
        submissionStatus: parsed.data.decision,
        reviewNotes: parsed.data.reviewNotes?.trim() || null,
        reviewedBy: req.actor!.id,
      })
      .where(eq(teams.id, teamId))
      .returning();

    if (row?.captainUserId) {
      if (parsed.data.decision === "APPROVED" || parsed.data.decision === "LOCKED") {
        // Grant tournament-scoped CAPTAIN role (automatically revoked when tournament finishes)
        const [existingCaptain] = await tx
          .select({ id: userRoles.id })
          .from(userRoles)
          .where(
            and(
              eq(userRoles.userId, row.captainUserId),
              eq(userRoles.roleCode, "CAPTAIN"),
              eq(userRoles.tournamentId, row.tournamentId),
              eq(userRoles.active, true)
            )
          )
          .limit(1);
        if (!existingCaptain) {
          await tx.insert(userRoles).values({
            userId: row.captainUserId,
            roleCode: "CAPTAIN",
            tournamentId: row.tournamentId,
            grantedBy: req.actor!.id,
          });
        }
      } else if (parsed.data.decision === "REJECTED") {
        // Revoke tournament-scoped CAPTAIN role if they have no other approved team in this tournament
        const otherApproved = await tx
          .select({ id: teams.id })
          .from(teams)
          .where(
            and(
              eq(teams.tournamentId, row.tournamentId),
              eq(teams.captainUserId, row.captainUserId),
              inArray(teams.submissionStatus, ["APPROVED", "LOCKED"])
            )
          );
        if (otherApproved.length === 0) {
          await tx
            .update(userRoles)
            .set({ active: false })
            .where(
              and(
                eq(userRoles.userId, row.captainUserId),
                eq(userRoles.roleCode, "CAPTAIN"),
                eq(userRoles.tournamentId, row.tournamentId),
                eq(userRoles.active, true)
              )
            );
        }
      }

      await tx.insert(notifications).values({
        userId: row.captainUserId,
        title: `Team ${row.name}: ${parsed.data.decision}`,
        message: parsed.data.reviewNotes?.trim() || "Roster status updated by Sports Secretary.",
        linkUrl: "/tournaments/current",
      });
    }

    if (row) {
      await recordAuditLog(tx, req.actor!.id, `TEAM_${parsed.data.decision}`, "teams", teamId, {});
    }
    return [row];
  });

  if (!updated) {
    res.status(404).json({ error: "Team not found." });
    return;
  }
  if (updated.captainUserId) {
    broadcastSse("NOTIFICATION", { teamId, decision: parsed.data.decision }, [updated.captainUserId]);
  }
  res.json({ team: updated });
});

router.post("/:id/matches", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can schedule matches." });
    return;
  }

  const tournamentId = parsePositiveIntId(req.params.id);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament ID." });
    return;
  }
  const schema = z.object({
    sportId: z.number().int().positive(),
    track: z.enum(["COMBINED", "BOYS", "GIRLS"]).optional(),
    roundLabel: z.string().min(2).max(80),
    matchOrder: z.number().int().positive().default(1),
    teamAId: z.number().int().positive().optional(),
    teamBId: z.number().int().positive().optional(),
    customTeamAName: z.string().trim().min(2).max(80).optional(),
    customTeamBName: z.string().trim().min(2).max(80).optional(),
    venue: z.string().min(2).max(160),
    scheduledAt: z.string().datetime(),
    scorerUserId: z.number().int().positive().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid fixture details." });
    return;
  }

  const fixtureOutcome = await db.transaction(async (tx) => {
    const [tournament] = await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1);
    if (!tournament) {
      return { ok: false as const, status: 404, error: "Tournament not found." };
    }
    if (tournament.status === "ARCHIVED") {
      return { ok: false as const, status: 400, error: "Cannot schedule fixtures in an archived tournament." };
    }

    const [tsConfig] = await tx
      .select({ id: tournamentSports.id })
      .from(tournamentSports)
      .where(
        and(
          eq(tournamentSports.tournamentId, tournamentId),
          eq(tournamentSports.sportId, parsed.data.sportId)
        )
      )
      .limit(1);
    if (!tsConfig) {
      return { ok: false as const, status: 400, error: "Selected sport is not configured for this tournament." };
    }

    if (parsed.data.scorerUserId) {
      const [scorer] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, parsed.data.scorerUserId))
        .limit(1);
      if (!scorer) {
        return { ok: false as const, status: 404, error: "Assigned scorer user not found." };
      }
    }

    const resolveOrCreateTeam = async (teamId?: number, customName?: string): Promise<number | null> => {
      if (teamId) return teamId;
      if (!customName) return null;
      const code =
        customName
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase()
          .slice(0, 4) || "TM";
      const [createdTeam] = await tx
        .insert(teams)
        .values({
          tournamentId,
          sportId: parsed.data.sportId,
          name: customName.trim(),
          shortCode: code,
          submissionStatus: "APPROVED",
          reviewedBy: req.actor!.id,
        })
        .returning();
      return createdTeam.id;
    };

    const resolvedA = await resolveOrCreateTeam(parsed.data.teamAId, parsed.data.customTeamAName);
    const resolvedB = await resolveOrCreateTeam(parsed.data.teamBId, parsed.data.customTeamBName);
    if (!resolvedA || !resolvedB || resolvedA === resolvedB) {
      return { ok: false as const, status: 400, error: "Select or enter two distinct teams." };
    }

    // Enforce tournament + sport membership and mandatory team approval gate
    const pairTeams = await tx
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.tournamentId, tournamentId),
          eq(teams.sportId, parsed.data.sportId),
          inArray(teams.id, [resolvedA, resolvedB])
        )
      );
    if (
      pairTeams.length !== 2 ||
      pairTeams.some((t) => t.submissionStatus !== "APPROVED" && t.submissionStatus !== "LOCKED")
    ) {
      return {
        ok: false as const,
        status: 400,
        error: "Both teams must belong to this tournament & sport and be APPROVED or LOCKED before scheduling.",
      };
    }

    const effectiveMatchTrack =
      tournament.splitMode === "SEPARATE_BOYS_GIRLS"
        ? parsed.data.track === "GIRLS"
          ? "GIRLS"
          : "BOYS"
        : "COMBINED";

    const [created] = await tx
      .insert(matches)
      .values({
        tournamentId,
        sportId: parsed.data.sportId,
        track: effectiveMatchTrack,
        roundLabel: parsed.data.roundLabel.trim(),
        matchOrder: parsed.data.matchOrder,
        teamAId: resolvedA,
        teamBId: resolvedB,
        venue: parsed.data.venue.trim(),
        scheduledAt: new Date(parsed.data.scheduledAt),
        status: "UPCOMING",
        scorerUserId: parsed.data.scorerUserId ?? null,
        scoreSummary: "Scheduled",
      })
      .returning();

    return { ok: true as const, created };
  });

  if (!fixtureOutcome.ok) {
    res.status(fixtureOutcome.status).json({ error: fixtureOutcome.error });
    return;
  }

  res.status(201).json({ match: fixtureOutcome.created });
});

export default router;
