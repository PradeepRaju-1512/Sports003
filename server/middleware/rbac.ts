import type { SessionActor } from "./auth.ts";

export function hasRole(actor: SessionActor | null, roleCode: string): boolean {
  if (!actor) return false;
  return actor.roles.some((r) => r.roleCode === roleCode);
}

/**
 * Note: SUPER_ADMIN is platform tech only and intentionally NOT granted institute sports authority.
 */
export function hasGlobalSportsAuthority(actor: SessionActor | null): boolean {
  return hasRole(actor, "FACULTY_ADVISOR") || hasRole(actor, "SPORTS_SECRETARY");
}

export function isFacultyAdvisor(actor: SessionActor | null): boolean {
  return hasRole(actor, "FACULTY_ADVISOR");
}

export function isSportsSecretary(actor: SessionActor | null): boolean {
  return hasRole(actor, "SPORTS_SECRETARY");
}

export function canManageClubActivity(
  actor: SessionActor | null,
  clubId: number,
  targetBatch?: string
): boolean {
  if (!actor) return false;
  if (hasGlobalSportsAuthority(actor)) return true;
  if (actor.roles.some((r) => r.roleCode === "CLUB_SECRETARY" && r.clubId === clubId)) {
    return true;
  }
  return actor.roles.some(
    (r) =>
      r.roleCode === "CLUB_COORDINATOR" &&
      r.clubId === clubId &&
      (!targetBatch || r.batchScope === "ALL" || r.batchScope === targetBatch)
  );
}

export function canEvaluateClubTrial(
  actor: SessionActor | null,
  clubId: number,
  applicantBatch?: string
): boolean {
  return canManageClubActivity(actor, clubId, applicantBatch);
}

export function canDecideClubInduction(actor: SessionActor | null, clubId: number): boolean {
  if (!actor) return false;
  if (hasGlobalSportsAuthority(actor)) return true;
  return actor.roles.some((r) => r.roleCode === "CLUB_SECRETARY" && r.clubId === clubId);
}

export function canScoreMatch(
  actor: SessionActor | null,
  matchScorerUserId: number | null
): boolean {
  if (!actor) return false;
  if (hasGlobalSportsAuthority(actor)) return true;
  return matchScorerUserId !== null && actor.id === matchScorerUserId;
}

export function canOperateAuction(
  actor: SessionActor | null,
  auctionId?: number | null
): boolean {
  if (!actor) return false;
  if (hasGlobalSportsAuthority(actor)) return true;
  return actor.roles.some(
    (r) =>
      (r.roleCode === "AUCTION_OPERATOR" || r.roleCode === "AUCTIONEER") &&
      (r.auctionId === null || !auctionId || r.auctionId === auctionId)
  );
}

export function canManageCampusOps(actor: SessionActor | null): boolean {
  if (!actor) return false;
  return hasGlobalSportsAuthority(actor) || hasRole(actor, "EQUIPMENT_STAFF");
}

export function canPostNotice(actor: SessionActor | null, clubId?: number | null): boolean {
  if (!actor) return false;
  if (hasGlobalSportsAuthority(actor) || hasRole(actor, "EQUIPMENT_STAFF")) return true;
  if (clubId) {
    return actor.roles.some((r) => r.roleCode === "CLUB_SECRETARY" && r.clubId === clubId);
  }
  return false;
}
