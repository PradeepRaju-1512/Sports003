import { Router } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.ts";
import {
  clubMemberships,
  matches,
  playerMatchStats,
  playerProfiles,
  sports,
  sportsClubs,
  teamRosters,
  teams,
  tournaments,
  users,
} from "../db/schema.ts";
import { requireAuth } from "../middleware/auth.ts";
import { hasGlobalSportsAuthority } from "../middleware/rbac.ts";
import { recordAuditLog } from "../lib/audit.ts";
import { parsePositiveIntId } from "../lib/http.ts";
import { FIXED_COLLEGE, maxSemesterForProgram } from "../../shared/academic.ts";

const router = Router();

router.get("/:id", async (req, res) => {
  const profileId = Number(req.params.id);
  if (!Number.isFinite(profileId)) {
    res.status(400).json({ error: "Invalid player profile ID." });
    return;
  }

  const [profile] = await db
    .select()
    .from(playerProfiles)
    .where(eq(playerProfiles.id, profileId))
    .limit(1);

  if (!profile) {
    res.status(404).json({ error: "Player profile not found." });
    return;
  }

  const isAuthenticated = Boolean(req.actor);
  const isOwner = req.actor?.playerProfileId === profile.id;

  // Strict privacy split:
  // Public never sees email, phone, facility bookings, or equipment borrowing history.
  // If visibility is IIITT_ONLY or PRIVATE, personal bio/roll are hidden to public,
  // while official tournament participation & career archive history remain public institute records.
  const canViewPersonalBio =
    isOwner ||
    profile.visibility === "PUBLIC" ||
    (profile.visibility === "IIITT_ONLY" && isAuthenticated);

  const clubBadges = await db
    .select({
      clubId: sportsClubs.id,
      clubSlug: sportsClubs.slug,
      clubName: sportsClubs.name,
      role: clubMemberships.role,
      batchScope: clubMemberships.batchScope,
      scopeLabel: clubMemberships.scopeLabel,
      status: clubMemberships.status,
      inductedAt: clubMemberships.inductedAt,
    })
    .from(clubMemberships)
    .innerJoin(sportsClubs, eq(clubMemberships.clubId, sportsClubs.id))
    .where(
      and(eq(clubMemberships.playerProfileId, profile.id), eq(clubMemberships.status, "INDUCTED"))
    )
    .orderBy(asc(sportsClubs.name));

  const teamAppearances = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      shortCode: teams.shortCode,
      playingRole: teamRosters.playingRole,
      playerClass: teamRosters.playerClass,
      tournamentId: tournaments.id,
      tournamentName: tournaments.name,
      academicYear: tournaments.academicYear,
      sportName: sports.name,
      sportSlug: sports.slug,
    })
    .from(teamRosters)
    .innerJoin(teams, eq(teamRosters.teamId, teams.id))
    .innerJoin(tournaments, eq(teams.tournamentId, tournaments.id))
    .innerJoin(sports, eq(teams.sportId, sports.id))
    .where(eq(teamRosters.playerProfileId, profile.id))
    .orderBy(desc(tournaments.academicYear));

  const matchStatRows = await db
    .select({
      matchId: matches.id,
      roundLabel: matches.roundLabel,
      scoreSummary: matches.scoreSummary,
      resultNote: matches.resultNote,
      scheduledAt: matches.scheduledAt,
      sportName: sports.name,
      statsJson: playerMatchStats.statsJson,
      isMvp: playerMatchStats.isMvp,
    })
    .from(playerMatchStats)
    .innerJoin(matches, eq(playerMatchStats.matchId, matches.id))
    .innerJoin(sports, eq(playerMatchStats.sportId, sports.id))
    .where(eq(playerMatchStats.playerProfileId, profile.id))
    .orderBy(desc(matches.scheduledAt));

  res.json({
    profile: {
      id: profile.id,
      displayName: profile.displayName,
      college: profile.college ?? FIXED_COLLEGE,
      batch: profile.batch,
      programType: profile.programType ?? "BTECH",
      currentSemester: profile.currentSemester ?? 1,
      isGraduated: Boolean(profile.isGraduated),
      gender: profile.gender ?? "BOYS",
      branch: profile.branch,
      rollNumber: isAuthenticated ? profile.rollNumber : null, // Internal @iiitt.ac.in only
      avatarUrl: profile.avatarUrl,
      visibility: profile.visibility,
      isClaimed: profile.isClaimed,
      bio: canViewPersonalBio ? profile.bio : null,
      preferredSports: canViewPersonalBio ? profile.preferredSports : [],
      privacyRestricted: !canViewPersonalBio,
    },
    clubBadges,
    teamAppearances,
    matchStats: matchStatRows,
  });
});

router.patch("/me", requireAuth, async (req, res) => {
  if (!req.actor?.playerProfileId) {
    res.status(404).json({ error: "Player profile not found." });
    return;
  }

  const schema = z.object({
    bio: z.string().max(400).optional().nullable(),
    branch: z.string().max(40).optional().nullable(),
    preferredSports: z.array(z.string()).max(10).optional(),
    visibility: z.enum(["PUBLIC", "IIITT_ONLY", "PRIVATE"]).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile update payload." });
    return;
  }

  const [updated] = await db
    .update(playerProfiles)
    .set({
      ...(parsed.data.bio !== undefined ? { bio: parsed.data.bio?.trim() || null } : {}),
      ...(parsed.data.branch !== undefined ? { branch: parsed.data.branch?.trim() || null } : {}),
      ...(parsed.data.preferredSports ? { preferredSports: parsed.data.preferredSports } : {}),
      ...(parsed.data.visibility ? { visibility: parsed.data.visibility } : {}),
    })
    .where(eq(playerProfiles.id, req.actor.playerProfileId))
    .returning();

  res.json({ profile: updated });
});

router.patch("/:id/academic", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({
      error: "Only Sports Secretary or Faculty Advisor can override academic progression.",
    });
    return;
  }

  const profileId = parsePositiveIntId(req.params.id);
  if (!profileId) {
    res.status(400).json({ error: "Invalid player profile ID." });
    return;
  }

  const schema = z.object({
    batch: z.enum(["1ST", "2ND", "3RD", "4TH", "MTECH"]),
    branch: z.string().trim().min(2).max(40).optional().nullable(),
    programType: z.enum(["BTECH", "MTECH"]),
    currentSemester: z.number().int().min(1).max(8),
    isGraduated: z.boolean().default(false),
    gender: z.enum(["BOYS", "GIRLS"]).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid academic override payload." });
    return;
  }

  const cap = maxSemesterForProgram(parsed.data.programType);
  if (parsed.data.currentSemester > cap) {
    res.status(400).json({
      error: `Semester cannot exceed ${cap} for ${parsed.data.programType}.`,
    });
    return;
  }

  const updated = await db.transaction(async (tx) => {
    const [prof] = await tx
      .select()
      .from(playerProfiles)
      .where(eq(playerProfiles.id, profileId))
      .limit(1);
    if (!prof) return null;

    const [nextProf] = await tx
      .update(playerProfiles)
      .set({
        college: FIXED_COLLEGE,
        batch: parsed.data.batch,
        programType: parsed.data.programType,
        currentSemester: parsed.data.currentSemester,
        isGraduated: parsed.data.isGraduated,
        ...(parsed.data.branch !== undefined
          ? { branch: parsed.data.branch?.trim().toUpperCase() || null }
          : {}),
        ...(parsed.data.gender ? { gender: parsed.data.gender } : {}),
      })
      .where(eq(playerProfiles.id, profileId))
      .returning();

    if (prof.userId) {
      await tx
        .update(users)
        .set({
          college: FIXED_COLLEGE,
          batch: parsed.data.batch,
          programType: parsed.data.programType,
          currentSemester: parsed.data.currentSemester,
          isGraduated: parsed.data.isGraduated,
          ...(parsed.data.gender ? { gender: parsed.data.gender } : {}),
        })
        .where(eq(users.id, prof.userId));
    }

    await recordAuditLog(tx, req.actor!.id, "ACADEMIC_OVERRIDE", "player_profiles", profileId, {
      batch: parsed.data.batch,
      programType: parsed.data.programType,
      currentSemester: parsed.data.currentSemester,
      isGraduated: parsed.data.isGraduated,
    });

    return nextProf;
  });

  if (!updated) {
    res.status(404).json({ error: "Player profile not found." });
    return;
  }
  res.json({ profile: updated });
});

export default router;
