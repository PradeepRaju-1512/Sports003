import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "../db/index.ts";
import { clubMemberships, playerProfiles, userRoles, users } from "../db/schema.ts";
import type { SessionActor } from "../middleware/auth.ts";
import { canDecideClubInduction, canManageClubActivity } from "../middleware/rbac.ts";

export type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export const NON_STUDENT_ROLES = ["FACULTY_ADVISOR", "EQUIPMENT_STAFF", "SUPER_ADMIN"];

export async function getExcludedNonStudentIds(): Promise<number[]> {
  const nonStudentAccounts = await db
    .select({ id: users.id })
    .from(users)
    .where(notInArray(users.accountType, ["STUDENT"]));

  const nonStudentRoleHolders = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(and(eq(userRoles.active, true), inArray(userRoles.roleCode, NON_STUDENT_ROLES)));

  return Array.from(
    new Set([
      ...nonStudentAccounts.map((u) => u.id),
      ...nonStudentRoleHolders.map((r) => r.userId),
    ])
  );
}

export async function assertStudentCandidate(userId: number): Promise<string | null> {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u || u.accountType !== "STUDENT") {
    return "Selected account is not an eligible student account.";
  }
  const activeRoles = await db
    .select({ roleCode: userRoles.roleCode })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.active, true)));
  if (activeRoles.some((r) => NON_STUDENT_ROLES.includes(r.roleCode))) {
    return "Faculty, ground staff, and system admin accounts cannot be selected for student roles.";
  }
  return null;
}

export async function canActorActAsClubSecretary(
  actor: SessionActor | null,
  clubId: number
): Promise<boolean> {
  if (!actor) return false;
  if (canDecideClubInduction(actor, clubId)) return true;

  const [secMembership] = await db
    .select({ id: clubMemberships.id })
    .from(clubMemberships)
    .innerJoin(playerProfiles, eq(clubMemberships.playerProfileId, playerProfiles.id))
    .where(
      and(
        eq(clubMemberships.clubId, clubId),
        eq(clubMemberships.role, "SECRETARY"),
        eq(clubMemberships.status, "INDUCTED"),
        eq(playerProfiles.userId, actor.id)
      )
    )
    .limit(1);

  if (secMembership) return true;

  if (actor.playerProfileId) {
    const [profileSec] = await db
      .select({ id: clubMemberships.id })
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, clubId),
          eq(clubMemberships.role, "SECRETARY"),
          eq(clubMemberships.status, "INDUCTED"),
          eq(clubMemberships.playerProfileId, actor.playerProfileId)
        )
      )
      .limit(1);
    if (profileSec) return true;
  }

  return false;
}

export async function canActorManageClubBatch(
  actor: SessionActor | null,
  clubId: number,
  targetBatch?: string
): Promise<boolean> {
  if (!actor) return false;
  if (canManageClubActivity(actor, clubId, targetBatch)) return true;
  if (await canActorActAsClubSecretary(actor, clubId)) return true;

  const coordRows = await db
    .select({ batchScope: clubMemberships.batchScope })
    .from(clubMemberships)
    .innerJoin(playerProfiles, eq(clubMemberships.playerProfileId, playerProfiles.id))
    .where(
      and(
        eq(clubMemberships.clubId, clubId),
        eq(clubMemberships.role, "COORDINATOR"),
        eq(clubMemberships.status, "INDUCTED"),
        eq(playerProfiles.userId, actor.id)
      )
    );

  return coordRows.some(
    (c) =>
      !targetBatch ||
      c.batchScope === "ALL" ||
      c.batchScope === targetBatch
  );
}

export async function ensureStudentPlayerProfileId(
  executor: DbOrTx,
  userId: number
): Promise<number | null> {
  const [prof] = await executor
    .select({ id: playerProfiles.id })
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, userId))
    .limit(1);
  if (prof) return prof.id;

  const [u] = await executor.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u || u.accountType !== "STUDENT") return null;

  const [created] = await executor
    .insert(playerProfiles)
    .values({
      userId: u.id,
      displayName: u.name,
      batch: u.batch,
      rollNumber: u.rollNumber,
      avatarUrl: u.avatarUrl,
      visibility: "PUBLIC",
      isClaimed: true,
    })
    .returning({ id: playerProfiles.id });
  return created?.id ?? null;
}

export async function appointClubCoordinator(
  executor: DbOrTx,
  params: {
    clubId: number;
    targetUserId: number;
    batchScope: string;
    scopeLabel?: string | null;
    actorId: number;
  }
): Promise<
  | { ok: true; membership: typeof clubMemberships.$inferSelect }
  | { ok: false; status: number; error: string }
> {
  const profileId = await ensureStudentPlayerProfileId(executor, params.targetUserId);
  if (!profileId) {
    return { ok: false, status: 400, error: "Target user must have a student player profile." };
  }

  const cleanLabel = params.scopeLabel?.trim() || null;

  const [existing] = await executor
    .select()
    .from(clubMemberships)
    .where(
      and(
        eq(clubMemberships.clubId, params.clubId),
        eq(clubMemberships.playerProfileId, profileId)
      )
    )
    .limit(1);

  if (existing && existing.role === "SECRETARY" && existing.status === "INDUCTED") {
    return {
      ok: false,
      status: 409,
      error: "This student is already the Club Secretary for this club.",
    };
  }

  const [membership] = existing
    ? await executor
        .update(clubMemberships)
        .set({
          role: "COORDINATOR",
          batchScope: params.batchScope,
          scopeLabel: cleanLabel,
          status: "INDUCTED",
          approvedBy: params.actorId,
          inductedAt: existing.inductedAt ?? new Date(),
        })
        .where(eq(clubMemberships.id, existing.id))
        .returning()
    : await executor
        .insert(clubMemberships)
        .values({
          clubId: params.clubId,
          playerProfileId: profileId,
          role: "COORDINATOR",
          batchScope: params.batchScope,
          scopeLabel: cleanLabel,
          status: "INDUCTED",
          approvedBy: params.actorId,
          inductedAt: new Date(),
        })
        .returning();

  // Only update this specific student's coordinator role in this club; keep all other batch coordinators untouched
  await executor
    .update(userRoles)
    .set({ active: false })
    .where(
      and(
        eq(userRoles.userId, params.targetUserId),
        eq(userRoles.roleCode, "CLUB_COORDINATOR"),
        eq(userRoles.clubId, params.clubId),
        eq(userRoles.active, true)
      )
    );

  await executor.insert(userRoles).values({
    userId: params.targetUserId,
    roleCode: "CLUB_COORDINATOR",
    clubId: params.clubId,
    batchScope: params.batchScope,
    scopeLabel: cleanLabel,
    grantedBy: params.actorId,
  });

  return { ok: true, membership };
}

export async function removeClubCoordinator(
  executor: DbOrTx,
  params: {
    clubId: number;
    membershipId?: number;
    targetUserId?: number;
    batchScope?: string | null;
  }
): Promise<{
  membershipId: number;
  targetUserId: number | null;
  batchScope: string | null;
  displayName: string;
} | null> {
  let targetRow:
    | {
        membershipId: number;
        userId: number | null;
        batchScope: string | null;
        displayName: string;
      }
    | undefined;

  if (params.membershipId) {
    [targetRow] = await executor
      .select({
        membershipId: clubMemberships.id,
        userId: playerProfiles.userId,
        batchScope: clubMemberships.batchScope,
        displayName: playerProfiles.displayName,
      })
      .from(clubMemberships)
      .innerJoin(playerProfiles, eq(clubMemberships.playerProfileId, playerProfiles.id))
      .where(
        and(
          eq(clubMemberships.id, params.membershipId),
          eq(clubMemberships.clubId, params.clubId),
          eq(clubMemberships.role, "COORDINATOR")
        )
      )
      .limit(1);
  } else if (params.targetUserId) {
    const conditions = [
      eq(clubMemberships.clubId, params.clubId),
      eq(clubMemberships.role, "COORDINATOR"),
      eq(playerProfiles.userId, params.targetUserId),
    ];
    if (params.batchScope) {
      conditions.push(eq(clubMemberships.batchScope, params.batchScope));
    }
    [targetRow] = await executor
      .select({
        membershipId: clubMemberships.id,
        userId: playerProfiles.userId,
        batchScope: clubMemberships.batchScope,
        displayName: playerProfiles.displayName,
      })
      .from(clubMemberships)
      .innerJoin(playerProfiles, eq(clubMemberships.playerProfileId, playerProfiles.id))
      .where(and(...conditions))
      .limit(1);
  }

  if (!targetRow) {
    if (params.targetUserId) {
      const roleConds = [
        eq(userRoles.userId, params.targetUserId),
        eq(userRoles.roleCode, "CLUB_COORDINATOR"),
        eq(userRoles.clubId, params.clubId),
        eq(userRoles.active, true),
      ];
      if (params.batchScope) {
        roleConds.push(eq(userRoles.batchScope, params.batchScope));
      }
      await executor.update(userRoles).set({ active: false }).where(and(...roleConds));
    }
    return null;
  }

  await executor
    .update(clubMemberships)
    .set({ role: "MEMBER", batchScope: null, scopeLabel: null })
    .where(eq(clubMemberships.id, targetRow.membershipId));

  if (targetRow.userId) {
    const roleConds = [
      eq(userRoles.userId, targetRow.userId),
      eq(userRoles.roleCode, "CLUB_COORDINATOR"),
      eq(userRoles.clubId, params.clubId),
      eq(userRoles.active, true),
    ];
    if (targetRow.batchScope) {
      roleConds.push(eq(userRoles.batchScope, targetRow.batchScope));
    }
    await executor.update(userRoles).set({ active: false }).where(and(...roleConds));
  }

  return {
    membershipId: targetRow.membershipId,
    targetUserId: targetRow.userId,
    batchScope: targetRow.batchScope,
    displayName: targetRow.displayName,
  };
}
