import type { Request, Response } from "express";
import { Router } from "express";
import { and, asc, desc, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.ts";
import {
  clubActivities,
  clubMemberships,
  notifications,
  playerProfiles,
  sports,
  sportsClubs,
  userRoles,
  users,
} from "../db/schema.ts";
import { requireAuth } from "../middleware/auth.ts";
import {
  canEvaluateClubTrial,
  canManageClubActivity,
  hasGlobalSportsAuthority,
} from "../middleware/rbac.ts";
import { recordAuditLog } from "../lib/audit.ts";
import { broadcastSse } from "../lib/sse.ts";
import { parsePositiveIntId } from "../lib/http.ts";
import {
  appointClubCoordinator,
  assertStudentCandidate,
  canActorActAsClubSecretary,
  canActorManageClubBatch,
  getExcludedNonStudentIds,
  removeClubCoordinator,
} from "../lib/clubLeadership.ts";

const router = Router();

router.get("/", async (_req, res) => {
  const clubRows = await db
    .select({
      id: sportsClubs.id,
      slug: sportsClubs.slug,
      name: sportsClubs.name,
      tagline: sportsClubs.tagline,
      bannerUrl: sportsClubs.bannerUrl,
      practiceSchedule: sportsClubs.practiceSchedule,
      inductionOpen: sportsClubs.inductionOpen,
      sportName: sports.name,
      category: sports.category,
      displayOrder: sports.displayOrder,
    })
    .from(sportsClubs)
    .innerJoin(sports, eq(sportsClubs.sportId, sports.id))
    .orderBy(asc(sports.displayOrder));

  const memberCounts = await db
    .select({
      clubId: clubMemberships.clubId,
      status: clubMemberships.status,
    })
    .from(clubMemberships);

  const upcomingCountRows = await db
    .select({
      clubId: clubActivities.clubId,
      scheduledAt: clubActivities.scheduledAt,
    })
    .from(clubActivities);

  const nowMs = Date.now();
  const enriched = clubRows.map((c) => ({
    ...c,
    inductedCount: memberCounts.filter((m) => m.clubId === c.id && m.status === "INDUCTED").length,
    upcomingActivitiesCount: upcomingCountRows.filter(
      (a) => a.clubId === c.id && new Date(a.scheduledAt).getTime() >= nowMs - 3600 * 1000
    ).length,
  }));

  res.json({
    outdoorClubs: enriched.filter((c) => c.category === "OUTDOOR_TEAM"),
    indoorClubs: enriched.filter((c) => c.category === "INDOOR"),
    clubs: enriched,
  });
});

router.get("/:slug", async (req, res) => {
  const [club] = await db
    .select({
      id: sportsClubs.id,
      sportId: sportsClubs.sportId,
      slug: sportsClubs.slug,
      name: sportsClubs.name,
      tagline: sportsClubs.tagline,
      description: sportsClubs.description,
      bannerUrl: sportsClubs.bannerUrl,
      practiceSchedule: sportsClubs.practiceSchedule,
      inductionOpen: sportsClubs.inductionOpen,
      sportName: sports.name,
      category: sports.category,
    })
    .from(sportsClubs)
    .innerJoin(sports, eq(sportsClubs.sportId, sports.id))
    .where(eq(sportsClubs.slug, String(req.params.slug)))
    .limit(1);

  if (!club) {
    res.status(404).json({ error: "Sports club not found." });
    return;
  }

  const activities = await db
    .select()
    .from(clubActivities)
    .where(eq(clubActivities.clubId, club.id))
    .orderBy(asc(clubActivities.scheduledAt));

  const membershipRows = await db
    .select({
      id: clubMemberships.id,
      playerProfileId: clubMemberships.playerProfileId,
      role: clubMemberships.role,
      batchScope: clubMemberships.batchScope,
      scopeLabel: clubMemberships.scopeLabel,
      status: clubMemberships.status,
      trialNotes: clubMemberships.trialNotes,
      evaluationScore: clubMemberships.evaluationScore,
      inductedAt: clubMemberships.inductedAt,
      createdAt: clubMemberships.createdAt,
      displayName: playerProfiles.displayName,
      batch: playerProfiles.batch,
      branch: playerProfiles.branch,
      avatarUrl: playerProfiles.avatarUrl,
      userId: playerProfiles.userId,
    })
    .from(clubMemberships)
    .innerJoin(playerProfiles, eq(clubMemberships.playerProfileId, playerProfiles.id))
    .where(eq(clubMemberships.clubId, club.id))
    .orderBy(asc(clubMemberships.id));

  const secretary = membershipRows.find((m) => m.role === "SECRETARY" && m.status === "INDUCTED") ?? null;
  const isMembershipSecretary = Boolean(
    req.actor &&
      membershipRows.some(
        (m) =>
          m.role === "SECRETARY" &&
          m.status === "INDUCTED" &&
          (m.userId === req.actor!.id ||
            (req.actor!.playerProfileId && m.playerProfileId === req.actor!.playerProfileId))
      )
  );

  const isMembershipCoordinator = Boolean(
    req.actor &&
      membershipRows.some(
        (m) =>
          m.role === "COORDINATOR" &&
          m.status === "INDUCTED" &&
          (m.userId === req.actor!.id ||
            (req.actor!.playerProfileId && m.playerProfileId === req.actor!.playerProfileId))
      )
  );

  const canDecide = await canActorActAsClubSecretary(req.actor, club.id) || isMembershipSecretary;
  const canManage = canManageClubActivity(req.actor, club.id) || canDecide || isMembershipCoordinator;

  const sanitizePublicMember = (m: (typeof membershipRows)[number]) => {
    const { trialNotes: _tn, evaluationScore: _es, userId: _uid, ...publicFields } = m;
    return publicFields;
  };

  const publicSecretary = secretary ? sanitizePublicMember(secretary) : null;
  const coordinators = membershipRows
    .filter((m) => m.role === "COORDINATOR" && m.status === "INDUCTED")
    .map(sanitizePublicMember);
  const inductedMembers = membershipRows
    .filter((m) => m.status === "INDUCTED")
    .map(sanitizePublicMember);

  const sanitizedActivities = req.actor
    ? activities
    : activities.map((act) => {
        if (!Array.isArray(act.selectedSquadJson)) return act;
        return {
          ...act,
          selectedSquadJson: act.selectedSquadJson.map((entry) => {
            if (!entry || typeof entry !== "object") return entry;
            const { rollNumber: _rn, userId: _uid, ...rest } = entry as Record<string, unknown>;
            return rest;
          }),
        };
      });

  const myApplication = req.actor?.playerProfileId
    ? membershipRows.find((m) => m.playerProfileId === req.actor!.playerProfileId) ?? null
    : null;

  const inductionQueue = canManage
    ? membershipRows.filter((m) => m.status !== "INDUCTED")
    : myApplication
    ? [myApplication]
    : [];

  res.json({
    club,
    activities: sanitizedActivities,
    secretary: publicSecretary,
    coordinators,
    inductedMembers,
    myApplication,
    inductionQueue,
    permissions: {
      canManageActivities: canManage,
      canEvaluateTrials: canManage,
      canDecideInductions: canDecide,
      canManageLeadership: canDecide,
      canPublishExternalSelection: canDecide,
    },
  });
});

const activitySchema = z.object({
  activityType: z.enum([
    "PRACTICE",
    "INDUCTION",
    "MEETING",
    "INTER_IIIT",
    "EXTERNAL_MATCH",
    "OTHER",
  ]),
  customTypeLabel: z.string().max(80).optional().nullable(),
  targetBatch: z.enum(["1ST", "2ND", "3RD", "4TH", "MTECH", "ALL"]),
  category: z.enum(["BOYS", "GIRLS", "OPEN"]),
  scheduledAt: z.string().datetime(),
  venue: z.string().min(2).max(160),
  notes: z.string().max(400).optional().nullable(),
  selectedPlayerProfileIds: z.array(z.number().int().positive()).max(50).optional().default([]),
});

router.post("/:slug/activities", requireAuth, async (req, res) => {
  const [club] = await db
    .select()
    .from(sportsClubs)
    .where(eq(sportsClubs.slug, String(req.params.slug)))
    .limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }

  const parsed = activitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid club activity details. Ensure valid ISO date/time and venue." });
    return;
  }

  if (parsed.data.activityType === "OTHER" && !parsed.data.customTypeLabel?.trim()) {
    res.status(400).json({ error: "Custom activity label is required when Type is 'Other'." });
    return;
  }

  const uniqueSquadIds = Array.from(new Set(parsed.data.selectedPlayerProfileIds ?? []));
  const isExternalTeamSelection =
    parsed.data.activityType === "INTER_IIIT" ||
    parsed.data.activityType === "EXTERNAL_MATCH" ||
    uniqueSquadIds.length > 0;

  if (isExternalTeamSelection) {
    if (!(await canActorActAsClubSecretary(req.actor, club.id))) {
      res.status(403).json({
        error: "Only the Club Secretary, Sports Secretary, or Faculty Advisor can publish external or Inter-IIIT team selections.",
      });
      return;
    }
  } else if (!(await canActorManageClubBatch(req.actor, club.id, parsed.data.targetBatch))) {
    res.status(403).json({
      error: `Unauthorized: You cannot schedule ${parsed.data.targetBatch} activities for ${club.name}.`,
    });
    return;
  }

  // Validate and resolve selected squad players (both inducted club members and non-club students)
  type SquadEntry = {
    userId: number;
    playerProfileId: number;
    name: string;
    rollNumber: string | null;
    batch: string;
    branch: string | null;
    isClubMember: boolean;
  };
  let resolvedSquad: SquadEntry[] = [];

  if (uniqueSquadIds.length > 0) {
    const excludedIds = await getExcludedNonStudentIds();
    const conds = [inArray(playerProfiles.id, uniqueSquadIds), eq(users.accountType, "STUDENT")];
    if (excludedIds.length > 0) {
      conds.push(notInArray(users.id, excludedIds));
    }

    const candidateRows = await db
      .select({
        userId: users.id,
        playerProfileId: playerProfiles.id,
        name: playerProfiles.displayName,
        rollNumber: users.rollNumber,
        batch: playerProfiles.batch,
        branch: playerProfiles.branch,
      })
      .from(playerProfiles)
      .innerJoin(users, eq(playerProfiles.userId, users.id))
      .where(and(...conds));

    if (candidateRows.length !== uniqueSquadIds.length) {
      res.status(400).json({
        error: "One or more selected squad players are not eligible student accounts.",
      });
      return;
    }

    const inductedRows = await db
      .select({ playerProfileId: clubMemberships.playerProfileId })
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, club.id),
          eq(clubMemberships.status, "INDUCTED"),
          inArray(clubMemberships.playerProfileId, uniqueSquadIds)
        )
      );
    const inductedSet = new Set(inductedRows.map((r) => r.playerProfileId));

    const rowByProfileId = new Map(candidateRows.map((r) => [r.playerProfileId, r]));
    resolvedSquad = uniqueSquadIds
      .map((pid) => rowByProfileId.get(pid))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({
        userId: r.userId,
        playerProfileId: r.playerProfileId,
        name: r.name,
        rollNumber: r.rollNumber,
        batch: r.batch,
        branch: r.branch,
        isClubMember: inductedSet.has(r.playerProfileId),
      }));
  }

  const { created, recipientUserIds } = await db.transaction(async (tx) => {
    const [act] = await tx
      .insert(clubActivities)
      .values({
        clubId: club.id,
        activityType: parsed.data.activityType,
        customTypeLabel:
          parsed.data.activityType === "OTHER" ? parsed.data.customTypeLabel?.trim() || null : null,
        targetBatch: parsed.data.targetBatch,
        category: parsed.data.category,
        scheduledAt: new Date(parsed.data.scheduledAt),
        venue: parsed.data.venue.trim(),
        notes: parsed.data.notes?.trim() || null,
        selectedSquadJson: resolvedSquad,
        createdBy: req.actor!.id,
      })
      .returning();

    // Notify matching inducted club members (and pending induction applicants when INDUCTION)
    const eligibleStatuses =
      parsed.data.activityType === "INDUCTION"
        ? ["INDUCTED", "APPLIED", "TRIAL_ATTENDED"]
        : ["INDUCTED"];

    const memberRows = await tx
      .select({ userId: playerProfiles.userId, batch: playerProfiles.batch })
      .from(clubMemberships)
      .innerJoin(playerProfiles, eq(clubMemberships.playerProfileId, playerProfiles.id))
      .where(
        and(
          eq(clubMemberships.clubId, club.id),
          inArray(clubMemberships.status, eligibleStatuses)
        )
      );

    const clubMemberTargetIds = memberRows
      .filter(
        (m) =>
          m.userId !== null &&
          m.userId !== req.actor!.id &&
          (parsed.data.targetBatch === "ALL" || m.batch === parsed.data.targetBatch)
      )
      .map((m) => m.userId!);

    const squadUserIdSet = new Set(
      resolvedSquad.map((s) => s.userId).filter((uid) => uid !== req.actor!.id)
    );
    const targetIds = Array.from(new Set([...clubMemberTargetIds, ...squadUserIdSet]));

    const typeDisplay =
      act.activityType === "OTHER" && act.customTypeLabel
        ? act.customTypeLabel
        : act.activityType === "INTER_IIIT"
        ? "Inter-IIIT Selection"
        : act.activityType === "EXTERNAL_MATCH"
        ? "External Match Selection"
        : act.activityType;

    if (targetIds.length > 0) {
      await tx.insert(notifications).values(
        targetIds.map((uid) => ({
          userId: uid,
          title: squadUserIdSet.has(uid)
            ? `${club.name}: Selected for ${typeDisplay}`
            : `${club.name}: ${typeDisplay}`,
          message: squadUserIdSet.has(uid)
            ? `You have been named in the ${act.category} squad at ${act.venue}.`
            : `${act.targetBatch} • ${act.category} at ${act.venue}`,
          linkUrl: `/clubs/${club.slug}`,
        }))
      );
    }

    await recordAuditLog(tx, req.actor!.id, "CREATE_CLUB_ACTIVITY", "club_activities", act.id, {
      clubSlug: club.slug,
      notifiedCount: targetIds.length,
      squadCount: resolvedSquad.length,
    });

    return { created: act, recipientUserIds: targetIds };
  });

  broadcastSse("CLUB_ACTIVITY", { clubSlug: club.slug, activity: created });
  if (recipientUserIds.length > 0) {
    broadcastSse("NOTIFICATION", { clubSlug: club.slug }, recipientUserIds);
  }
  res.status(201).json({ activity: created, notifiedCount: recipientUserIds.length });
});

router.patch("/:slug/activities/:activityId", requireAuth, async (req, res) => {
  const [club] = await db.select().from(sportsClubs).where(eq(sportsClubs.slug, String(req.params.slug))).limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }

  const parsed = activitySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid activity update payload." });
    return;
  }

  const activityId = parsePositiveIntId(req.params.activityId);
  if (!activityId) {
    res.status(400).json({ error: "Invalid activity ID." });
    return;
  }
  const [existing] = await db
    .select()
    .from(clubActivities)
    .where(and(eq(clubActivities.id, activityId), eq(clubActivities.clubId, club.id)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Activity not found." });
    return;
  }

  const nextTargetBatch = parsed.data.targetBatch ?? existing.targetBatch;
  const canManageExisting = await canActorManageClubBatch(req.actor, club.id, existing.targetBatch);
  const canManageTarget = await canActorManageClubBatch(req.actor, club.id, nextTargetBatch);
  if (!canManageExisting || !canManageTarget) {
    res.status(403).json({ error: "Unauthorized to edit this activity." });
    return;
  }

  const existingSquad = Array.isArray(existing.selectedSquadJson) ? existing.selectedSquadJson : [];
  const isSecretaryOnlyActivity =
    existing.activityType === "INTER_IIIT" ||
    existing.activityType === "EXTERNAL_MATCH" ||
    parsed.data.activityType === "INTER_IIIT" ||
    parsed.data.activityType === "EXTERNAL_MATCH" ||
    existingSquad.length > 0 ||
    (parsed.data.selectedPlayerProfileIds?.length ?? 0) > 0;
  if (isSecretaryOnlyActivity && !(await canActorActAsClubSecretary(req.actor, club.id))) {
    res.status(403).json({
      error: "Only the Club Secretary or Sports Secretary can edit Inter-IIIT / External Match activities or team selections.",
    });
    return;
  }

  const [updated] = await db
    .update(clubActivities)
    .set({
      ...(parsed.data.activityType ? { activityType: parsed.data.activityType } : {}),
      ...(parsed.data.customTypeLabel !== undefined ? { customTypeLabel: parsed.data.customTypeLabel } : {}),
      ...(parsed.data.targetBatch ? { targetBatch: parsed.data.targetBatch } : {}),
      ...(parsed.data.category ? { category: parsed.data.category } : {}),
      ...(parsed.data.scheduledAt ? { scheduledAt: new Date(parsed.data.scheduledAt) } : {}),
      ...(parsed.data.venue ? { venue: parsed.data.venue.trim() } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    })
    .where(eq(clubActivities.id, activityId))
    .returning();

  broadcastSse("CLUB_ACTIVITY", { clubSlug: club.slug, activity: updated });
  res.json({ activity: updated });
});

router.delete("/:slug/activities/:activityId", requireAuth, async (req, res) => {
  const [club] = await db.select().from(sportsClubs).where(eq(sportsClubs.slug, String(req.params.slug))).limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }

  const activityId = parsePositiveIntId(req.params.activityId);
  if (!activityId) {
    res.status(400).json({ error: "Invalid activity ID." });
    return;
  }
  const [existing] = await db
    .select()
    .from(clubActivities)
    .where(and(eq(clubActivities.id, activityId), eq(clubActivities.clubId, club.id)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Activity not found." });
    return;
  }

  if (!(await canActorManageClubBatch(req.actor, club.id, existing.targetBatch))) {
    res.status(403).json({ error: "Unauthorized to delete this activity." });
    return;
  }

  const existingSquad = Array.isArray(existing.selectedSquadJson) ? existing.selectedSquadJson : [];
  if (
    (existing.activityType === "INTER_IIIT" ||
      existing.activityType === "EXTERNAL_MATCH" ||
      existingSquad.length > 0) &&
    !(await canActorActAsClubSecretary(req.actor, club.id))
  ) {
    res.status(403).json({
      error: "Only the Club Secretary or Sports Secretary can delete Inter-IIIT / External Match activities or team selections.",
    });
    return;
  }

  await db.delete(clubActivities).where(eq(clubActivities.id, activityId));
  broadcastSse("CLUB_ACTIVITY", { clubSlug: club.slug, deletedId: activityId });
  res.json({ ok: true });
});

router.post("/:slug/toggle-induction", requireAuth, async (req, res) => {
  const [club] = await db.select().from(sportsClubs).where(eq(sportsClubs.slug, String(req.params.slug))).limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }
  if (!(await canActorActAsClubSecretary(req.actor, club.id))) {
    res.status(403).json({ error: "Only the Club Secretary or Sports Secretary can open/close inductions." });
    return;
  }
  const schema = z.object({ inductionOpen: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }
  const [updated] = await db
    .update(sportsClubs)
    .set({ inductionOpen: parsed.data.inductionOpen })
    .where(eq(sportsClubs.id, club.id))
    .returning();
  res.json({ club: updated });
});

async function handleApplyInduction(req: Request, res: Response) {
  const [club] = await db.select().from(sportsClubs).where(eq(sportsClubs.slug, String(req.params.slug))).limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }
  if (!club.inductionOpen) {
    res.status(400).json({ error: "Inductions are currently closed for this club." });
    return;
  }

  let playerProfileId = req.actor?.playerProfileId ?? null;
  if (!playerProfileId && req.actor && req.actor.accountType === "STUDENT") {
    const [createdProfile] = await db
      .insert(playerProfiles)
      .values({
        userId: req.actor.id,
        displayName: req.actor.name,
        batch: req.actor.batch,
        rollNumber: req.actor.rollNumber,
        avatarUrl: req.actor.avatarUrl,
        visibility: "PUBLIC",
        isClaimed: true,
      })
      .returning({ id: playerProfiles.id });
    playerProfileId = createdProfile?.id ?? null;
  }

  if (!playerProfileId) {
    res.status(403).json({ error: "Only students with a player profile can apply for club induction." });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, club.id),
          eq(clubMemberships.playerProfileId, playerProfileId)
        )
      )
      .limit(1);

    if (existing && existing.status !== "REJECTED") {
      return { ok: false as const, status: 409, error: `Already applied or inducted in this club (status: ${existing.status}).` };
    }

    if (existing) {
      const [reapplied] = await tx
        .update(clubMemberships)
        .set({
          status: "APPLIED",
          trialNotes: null,
          evaluationScore: null,
          evaluatedBy: null,
          approvedBy: null,
          inductedAt: null,
        })
        .where(
          and(
            eq(clubMemberships.id, existing.id),
            eq(clubMemberships.status, "REJECTED")
          )
        )
        .returning();
      if (!reapplied) {
        return { ok: false as const, status: 409, error: "Induction state changed concurrently; please refresh." };
      }
      return { ok: true as const, membership: reapplied };
    }

    const [inserted] = await tx
      .insert(clubMemberships)
      .values({
        clubId: club.id,
        playerProfileId,
        role: "MEMBER",
        status: "APPLIED",
      })
      .returning();
    return { ok: true as const, membership: inserted };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.status(201).json({ membership: result.membership });
}

router.post("/:slug/inductions/apply", requireAuth, handleApplyInduction);
router.post("/:slug/induction-apply", requireAuth, handleApplyInduction);

router.patch("/:slug/inductions/:membershipId/trial", requireAuth, async (req, res) => {
  const [club] = await db.select().from(sportsClubs).where(eq(sportsClubs.slug, String(req.params.slug))).limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }

  const membershipId = parsePositiveIntId(req.params.membershipId);
  if (!membershipId) {
    res.status(400).json({ error: "Invalid induction record ID." });
    return;
  }
  const [target] = await db
    .select({
      membership: clubMemberships,
      batch: playerProfiles.batch,
    })
    .from(clubMemberships)
    .innerJoin(playerProfiles, eq(clubMemberships.playerProfileId, playerProfiles.id))
    .where(and(eq(clubMemberships.id, membershipId), eq(clubMemberships.clubId, club.id)))
    .limit(1);

  if (!target) {
    res.status(404).json({ error: "Induction record not found." });
    return;
  }

  if (
    !canEvaluateClubTrial(req.actor, club.id, target.batch) &&
    !(await canActorManageClubBatch(req.actor, club.id, target.batch))
  ) {
    res.status(403).json({
      error: `Unauthorized: Only ${target.batch}-year coordinator, Club Secretary, or Sports Secretary can record this trial.`,
    });
    return;
  }

  const schema = z.object({
    trialNotes: z.string().min(2).max(500),
    evaluationScore: z.number().int().min(1).max(10).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide valid trial evaluation notes." });
    return;
  }

  if (target.membership.status !== "APPLIED") {
    res.status(409).json({
      error: `Trial attendance can only be recorded when status is APPLIED (current: ${target.membership.status}).`,
    });
    return;
  }

  const [updated] = await db.transaction(async (tx) => {
    return tx
      .update(clubMemberships)
      .set({
        status: "TRIAL_ATTENDED",
        trialNotes: parsed.data.trialNotes.trim(),
        evaluationScore: parsed.data.evaluationScore ?? null,
        evaluatedBy: req.actor!.id,
      })
      .where(
        and(
          eq(clubMemberships.id, membershipId),
          eq(clubMemberships.status, "APPLIED")
        )
      )
      .returning();
  });

  if (!updated) {
    res.status(409).json({
      error: "Trial attendance transition conflict: status is no longer APPLIED.",
    });
    return;
  }

  res.json({ membership: updated });
});

async function handleInductionDecision(req: Request, res: Response) {
  const [club] = await db.select().from(sportsClubs).where(eq(sportsClubs.slug, String(req.params.slug))).limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }

  if (!(await canActorActAsClubSecretary(req.actor, club.id))) {
    res.status(403).json({ error: "Only the Club Secretary or Sports Secretary can approve/reject inductions." });
    return;
  }

  const schema = z.object({
    decision: z.enum(["INDUCTED", "REJECTED"]),
    notes: z.string().max(300).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid decision payload." });
    return;
  }

  const membershipId = parsePositiveIntId(req.params.membershipId);
  if (!membershipId) {
    res.status(400).json({ error: "Invalid induction record ID." });
    return;
  }
  const [target] = await db
    .select({
      membership: clubMemberships,
      userId: playerProfiles.userId,
    })
    .from(clubMemberships)
    .innerJoin(playerProfiles, eq(clubMemberships.playerProfileId, playerProfiles.id))
    .where(and(eq(clubMemberships.id, membershipId), eq(clubMemberships.clubId, club.id)))
    .limit(1);

  if (!target) {
    res.status(404).json({ error: "Induction application not found." });
    return;
  }

  if (target.membership.status === "INDUCTED" || target.membership.status === "REJECTED") {
    res.status(409).json({
      error: `Induction application is already finalized as ${target.membership.status} and cannot be changed.`,
    });
    return;
  }

  const expectedPriorStatus = target.membership.status;
  if (expectedPriorStatus === "APPLIED" && parsed.data.decision === "INDUCTED") {
    res.status(400).json({
      error: "Invalid induction transition: APPLIED -> INDUCTED is not allowed. Candidate must be marked TRIAL_ATTENDED first.",
    });
    return;
  }
  if (expectedPriorStatus !== "TRIAL_ATTENDED" && expectedPriorStatus !== "APPLIED") {
    res.status(400).json({
      error: `Invalid induction transition from ${expectedPriorStatus}.`,
    });
    return;
  }

  const txResult = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(clubMemberships)
      .set({
        status: parsed.data.decision,
        approvedBy: req.actor!.id,
        inductedAt: parsed.data.decision === "INDUCTED" ? new Date() : null,
        ...(parsed.data.notes ? { trialNotes: parsed.data.notes } : {}),
      })
      .where(
        and(
          eq(clubMemberships.id, membershipId),
          eq(clubMemberships.status, expectedPriorStatus)
        )
      )
      .returning();

    if (!row) {
      return {
        ok: false as const,
        status: 409,
        error: "Induction status changed concurrently; please refresh.",
      };
    }

    if (parsed.data.decision === "INDUCTED" && target.userId) {
      const [existingRole] = await tx
        .select({ id: userRoles.id })
        .from(userRoles)
        .where(
          and(
            eq(userRoles.userId, target.userId),
            eq(userRoles.roleCode, "CLUB_MEMBER"),
            eq(userRoles.clubId, club.id),
            eq(userRoles.active, true)
          )
        )
        .limit(1);
      if (!existingRole) {
        await tx.insert(userRoles).values({
          userId: target.userId,
          roleCode: "CLUB_MEMBER",
          clubId: club.id,
          grantedBy: req.actor!.id,
        });
      }
    }

    if (target.userId) {
      await tx.insert(notifications).values({
        userId: target.userId,
        title: `${club.name} Induction ${parsed.data.decision === "INDUCTED" ? "Approved" : "Update"}`,
        message:
          parsed.data.decision === "INDUCTED"
            ? `Congratulations! You are now an inducted member of ${club.name}.`
            : `Your induction application for ${club.name} was not selected this cycle.`,
        linkUrl: `/clubs/${club.slug}`,
      });
    }

    await recordAuditLog(tx, req.actor!.id, `INDUCTION_${parsed.data.decision}`, "club_memberships", membershipId, {
      clubSlug: club.slug,
    });

    return { ok: true as const, membership: row };
  });

  if (!txResult.ok) {
    res.status(txResult.status).json({ error: txResult.error });
    return;
  }

  if (target.userId) {
    broadcastSse("NOTIFICATION", { clubSlug: club.slug }, [target.userId]);
  }
  res.json({ membership: txResult.membership });
}

router.patch("/:slug/inductions/:membershipId/decision", requireAuth, handleInductionDecision);
router.patch("/:slug/inductions/:membershipId", requireAuth, handleInductionDecision);

router.post("/:slug/coordinators", requireAuth, async (req, res) => {
  const [club] = await db
    .select()
    .from(sportsClubs)
    .where(eq(sportsClubs.slug, String(req.params.slug)))
    .limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }
  if (!(await canActorActAsClubSecretary(req.actor, club.id))) {
    res.status(403).json({
      error: "Only the Club Secretary, Sports Secretary, or Faculty Advisor can appoint batch coordinators.",
    });
    return;
  }

  const schema = z.object({
    userId: z.number().int().positive(),
    batchScope: z.enum(["1ST", "2ND", "3RD", "4TH", "MTECH", "ALL"]),
    scopeLabel: z.string().max(40).nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid coordinator appointment payload." });
    return;
  }

  const candidateErr = await assertStudentCandidate(parsed.data.userId);
  if (candidateErr) {
    res.status(400).json({ error: candidateErr });
    return;
  }

  const cleanLabel = parsed.data.scopeLabel?.trim() || null;

  const outcome = await db.transaction(async (tx) => {
    const result = await appointClubCoordinator(tx, {
      clubId: club.id,
      targetUserId: parsed.data.userId,
      batchScope: parsed.data.batchScope,
      scopeLabel: cleanLabel,
      actorId: req.actor!.id,
    });
    if (!result.ok) return result;

    await tx.insert(notifications).values({
      userId: parsed.data.userId,
      title: `${club.name}: Batch Coordinator Appointed`,
      message: `${parsed.data.batchScope} Year${cleanLabel ? ` (${cleanLabel})` : ""} coordinator access granted.`,
      linkUrl: `/clubs/${club.slug}`,
    });

    await recordAuditLog(
      tx,
      req.actor!.id,
      "APPOINT_CLUB_COORDINATOR",
      "club_memberships",
      result.membership.id,
      {
        clubSlug: club.slug,
        targetUserId: parsed.data.userId,
        batchScope: parsed.data.batchScope,
        scopeLabel: cleanLabel,
      }
    );

    return result;
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  broadcastSse("NOTIFICATION", { clubSlug: club.slug }, [parsed.data.userId]);
  res.status(201).json({ membership: outcome.membership });
});

router.delete("/:slug/coordinators/:membershipId", requireAuth, async (req, res) => {
  const [club] = await db
    .select()
    .from(sportsClubs)
    .where(eq(sportsClubs.slug, String(req.params.slug)))
    .limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }
  if (!(await canActorActAsClubSecretary(req.actor, club.id))) {
    res.status(403).json({
      error: "Only the Club Secretary, Sports Secretary, or Faculty Advisor can remove batch coordinators.",
    });
    return;
  }

  const membershipId = parsePositiveIntId(req.params.membershipId);
  if (!membershipId) {
    res.status(400).json({ error: "Invalid induction record ID." });
    return;
  }
  if (!Number.isInteger(membershipId) || membershipId <= 0) {
    res.status(400).json({ error: "Invalid coordinator membership ID." });
    return;
  }

  const removed = await db.transaction(async (tx) => {
    const resRow = await removeClubCoordinator(tx, { clubId: club.id, membershipId });
    if (!resRow) return null;

    if (resRow.targetUserId) {
      await tx.insert(notifications).values({
        userId: resRow.targetUserId,
        title: `${club.name}: Coordinator Role Updated`,
        message: `You are no longer listed as ${resRow.batchScope ?? ""} batch coordinator for ${club.name}.`,
        linkUrl: `/clubs/${club.slug}`,
      });
    }

    await recordAuditLog(
      tx,
      req.actor!.id,
      "REMOVE_CLUB_COORDINATOR",
      "club_memberships",
      membershipId,
      {
        clubSlug: club.slug,
        targetUserId: resRow.targetUserId,
        batchScope: resRow.batchScope,
      }
    );

    return resRow;
  });

  if (!removed) {
    res.status(404).json({ error: "Coordinator record not found for this club." });
    return;
  }

  if (removed.targetUserId) {
    broadcastSse("NOTIFICATION", { clubSlug: club.slug }, [removed.targetUserId]);
  }
  res.json({ ok: true, removed });
});

router.delete("/:slug/members/:membershipId", requireAuth, async (req, res) => {
  const [club] = await db
    .select()
    .from(sportsClubs)
    .where(eq(sportsClubs.slug, String(req.params.slug)))
    .limit(1);
  if (!club) {
    res.status(404).json({ error: "Club not found." });
    return;
  }
  if (!(await canActorActAsClubSecretary(req.actor, club.id))) {
    res.status(403).json({
      error: "Only the Club Secretary, Sports Secretary, or Faculty Advisor can remove club members.",
    });
    return;
  }

  const membershipId = parsePositiveIntId(req.params.membershipId);
  if (!membershipId) {
    res.status(400).json({ error: "Invalid induction record ID." });
    return;
  }
  if (!Number.isInteger(membershipId) || membershipId <= 0) {
    res.status(400).json({ error: "Invalid membership ID." });
    return;
  }

  const [target] = await db
    .select({
      membership: clubMemberships,
      userId: playerProfiles.userId,
      displayName: playerProfiles.displayName,
    })
    .from(clubMemberships)
    .innerJoin(playerProfiles, eq(clubMemberships.playerProfileId, playerProfiles.id))
    .where(and(eq(clubMemberships.id, membershipId), eq(clubMemberships.clubId, club.id)))
    .limit(1);

  if (!target) {
    res.status(404).json({ error: "Club membership record not found." });
    return;
  }

  if (target.membership.role === "SECRETARY" && !hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({
      error: "Only the Sports Secretary or Faculty Advisor can remove an active Club Secretary.",
    });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.delete(clubMemberships).where(eq(clubMemberships.id, membershipId));

    if (target.userId) {
      const rolesToDeactivate =
        target.membership.role === "SECRETARY"
          ? ["CLUB_MEMBER", "CLUB_COORDINATOR", "CLUB_SECRETARY"]
          : ["CLUB_MEMBER", "CLUB_COORDINATOR"];
      await tx
        .update(userRoles)
        .set({ active: false })
        .where(
          and(
            eq(userRoles.userId, target.userId),
            eq(userRoles.clubId, club.id),
            inArray(userRoles.roleCode, rolesToDeactivate),
            eq(userRoles.active, true)
          )
        );

      await tx.insert(notifications).values({
        userId: target.userId,
        title: `${club.name}: Membership Updated`,
        message: `Your membership in ${club.name} was removed by ${req.actor!.name}.`,
        linkUrl: `/clubs/${club.slug}`,
      });
    }

    await recordAuditLog(
      tx,
      req.actor!.id,
      "REMOVE_CLUB_MEMBER",
      "club_memberships",
      membershipId,
      {
        clubSlug: club.slug,
        removedUserId: target.userId,
        removedName: target.displayName,
        previousRole: target.membership.role,
      }
    );
  });

  if (target.userId) {
    broadcastSse("NOTIFICATION", { clubSlug: club.slug }, [target.userId]);
  }
  res.json({ ok: true, removedMembershipId: membershipId });
});

export default router;
