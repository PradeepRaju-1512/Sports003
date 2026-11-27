import { Router } from "express";
import { and, asc, desc, eq, ilike, inArray, isNull, ne, notInArray, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.ts";
import {
  auctions,
  auditLogs,
  clubMemberships,
  matches,
  notifications,
  playerProfiles,
  roleRequests,
  sports,
  sportsClubs,
  teams,
  userRoles,
  users,
} from "../db/schema.ts";
import { requireAuth } from "../middleware/auth.ts";
import { hasGlobalSportsAuthority, isFacultyAdvisor } from "../middleware/rbac.ts";
import { recordAuditLog } from "../lib/audit.ts";
import { broadcastSse } from "../lib/sse.ts";
import { parsePositiveIntId } from "../lib/http.ts";
import {
  appointClubCoordinator,
  assertStudentCandidate,
  canActorActAsClubSecretary,
  ensureStudentPlayerProfileId,
  getExcludedNonStudentIds,
  removeClubCoordinator,
} from "../lib/clubLeadership.ts";
import { computeSemesterRollover, FIXED_COLLEGE } from "../../shared/academic.ts";

const router = Router();

router.get("/directory", requireAuth, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const batchFilter = String(req.query.batch ?? "").trim();
  const branchFilter = String(req.query.branch ?? "").trim();
  const excludedIds = await getExcludedNonStudentIds();

  const baseConditions = [eq(users.accountType, "STUDENT")];
  if (excludedIds.length > 0) {
    baseConditions.push(notInArray(users.id, excludedIds));
  }

  const conditions = [...baseConditions];
  if (batchFilter) {
    conditions.push(eq(users.batch, batchFilter));
  }
  if (branchFilter) {
    conditions.push(ilike(playerProfiles.branch, branchFilter));
  }
  if (q) {
    conditions.push(
      or(
        ilike(users.name, `%${q}%`),
        ilike(users.rollNumber, `%${q}%`),
        ilike(users.batch, `%${q}%`),
        ilike(playerProfiles.branch, `%${q}%`),
        ilike(users.email, `%${q}%`)
      )!
    );
  }

  const [rows, facetRows] = await Promise.all([
    db
      .select({
        userId: users.id,
        playerProfileId: playerProfiles.id,
        name: users.name,
        rollNumber: users.rollNumber,
        batch: users.batch,
        branch: playerProfiles.branch,
      })
      .from(users)
      .innerJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .where(and(...conditions))
      .orderBy(asc(users.name))
      .limit(30),
    db
      .select({
        batch: users.batch,
        branch: playerProfiles.branch,
      })
      .from(users)
      .innerJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .where(and(...baseConditions)),
  ]);

  const batches = Array.from(new Set(facetRows.map((f) => f.batch).filter(Boolean))).sort();
  const branches = Array.from(
    new Set(facetRows.map((f) => f.branch).filter((b): b is string => Boolean(b)))
  ).sort();

  res.json({ students: rows, batches, branches });
});

router.get("/requests", requireAuth, async (req, res) => {
  const actor = req.actor!;
  const isGlobal = hasGlobalSportsAuthority(actor);

  let secretaryClubIds: number[] = [];
  if (!isGlobal) {
    const roleClubIds = actor.roles
      .filter((r) => r.roleCode === "CLUB_SECRETARY" && r.clubId !== null)
      .map((r) => r.clubId!);
    const membershipClubs = actor.playerProfileId
      ? await db
          .select({ clubId: clubMemberships.clubId })
          .from(clubMemberships)
          .where(
            and(
              eq(clubMemberships.playerProfileId, actor.playerProfileId),
              eq(clubMemberships.role, "SECRETARY"),
              eq(clubMemberships.status, "INDUCTED")
            )
          )
      : [];
    secretaryClubIds = Array.from(new Set([...roleClubIds, ...membershipClubs.map((m) => m.clubId)]));
  }

  const scopeFilter = isGlobal
    ? undefined
    : secretaryClubIds.length > 0
    ? or(
        inArray(roleRequests.clubId, secretaryClubIds),
        eq(roleRequests.requesterUserId, actor.id),
        eq(roleRequests.targetUserId, actor.id)
      )
    : or(eq(roleRequests.requesterUserId, actor.id), eq(roleRequests.targetUserId, actor.id));

  const rows = await db
    .select({
      id: roleRequests.id,
      requesterUserId: roleRequests.requesterUserId,
      targetUserId: roleRequests.targetUserId,
      requestedRole: roleRequests.requestedRole,
      action: roleRequests.action,
      clubId: roleRequests.clubId,
      batchScope: roleRequests.batchScope,
      scopeLabel: roleRequests.scopeLabel,
      matchId: roleRequests.matchId,
      auctionId: roleRequests.auctionId,
      reason: roleRequests.reason,
      status: roleRequests.status,
      reviewNotes: roleRequests.reviewNotes,
      createdAt: roleRequests.createdAt,
      reviewedAt: roleRequests.reviewedAt,
    })
    .from(roleRequests)
    .where(scopeFilter)
    .orderBy(desc(roleRequests.createdAt));

  const allUsers = await db
    .select({ id: users.id, name: users.name, rollNumber: users.rollNumber, batch: users.batch })
    .from(users);
  const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));

  const allClubs = await db.select({ id: sportsClubs.id, name: sportsClubs.name }).from(sportsClubs);
  const clubMap = Object.fromEntries(allClubs.map((c) => [c.id, c]));

  const matchIds = Array.from(new Set(rows.map((r) => r.matchId).filter((id): id is number => id !== null)));
  const matchLabelMap: Record<number, string> = {};
  if (matchIds.length > 0) {
    const matchRows = await db
      .select({
        id: matches.id,
        status: matches.status,
        roundLabel: matches.roundLabel,
        sportId: matches.sportId,
        teamAId: matches.teamAId,
        teamBId: matches.teamBId,
      })
      .from(matches)
      .where(inArray(matches.id, matchIds));
    const allSports = await db.select({ id: sports.id, name: sports.name }).from(sports);
    const sportNameMap = Object.fromEntries(allSports.map((s) => [s.id, s.name]));
    const teamIds = Array.from(new Set(matchRows.flatMap((m) => [m.teamAId, m.teamBId])));
    const teamRows =
      teamIds.length > 0
        ? await db.select({ id: teams.id, shortCode: teams.shortCode }).from(teams).where(inArray(teams.id, teamIds))
        : [];
    const teamCodeMap = Object.fromEntries(teamRows.map((t) => [t.id, t.shortCode]));
    for (const m of matchRows) {
      matchLabelMap[m.id] = `[${m.status}] ${sportNameMap[m.sportId] ?? "Sport"}: ${teamCodeMap[m.teamAId] ?? "T1"} vs ${teamCodeMap[m.teamBId] ?? "T2"} (${m.roundLabel})`;
    }
  }

  res.json({
    requests: rows.map((r) => ({
      ...r,
      requester: userMap[r.requesterUserId] ?? null,
      target: userMap[r.targetUserId] ?? null,
      clubName: r.clubId ? clubMap[r.clubId]?.name ?? null : null,
      matchLabel: r.matchId ? matchLabelMap[r.matchId] ?? `Match #${r.matchId}` : null,
    })),
  });
});

router.post("/requests", requireAuth, async (req, res) => {
  const schema = z.object({
    targetUserId: z.number().int().positive(),
    requestedRole: z.enum(["CLUB_SECRETARY", "CLUB_COORDINATOR", "MATCH_SCORER", "AUCTION_OPERATOR"]),
    action: z.enum(["APPOINT", "REMOVE"]),
    clubId: z.number().int().positive().nullable().optional(),
    batchScope: z.enum(["1ST", "2ND", "3RD", "4TH", "MTECH", "ALL"]).nullable().optional(),
    scopeLabel: z.string().max(40).nullable().optional(),
    matchId: z.number().int().positive().nullable().optional(),
    auctionId: z.number().int().positive().nullable().optional(),
    reason: z.string().min(3).max(300),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid role request payload." });
    return;
  }

  if (
    (parsed.data.requestedRole === "CLUB_SECRETARY" || parsed.data.requestedRole === "CLUB_COORDINATOR") &&
    !parsed.data.clubId
  ) {
    res.status(400).json({ error: "Club selection is required for Club Secretary / Coordinator requests." });
    return;
  }

  if (parsed.data.requestedRole === "CLUB_COORDINATOR" && !parsed.data.batchScope) {
    res.status(400).json({ error: "Explicit batchScope (1ST, 2ND, 3RD, 4TH, MTECH, or ALL) is required for Club Coordinator requests." });
    return;
  }

  if (parsed.data.clubId) {
    const [clubRow] = await db
      .select({ id: sportsClubs.id })
      .from(sportsClubs)
      .where(eq(sportsClubs.id, parsed.data.clubId))
      .limit(1);
    if (!clubRow) {
      res.status(404).json({ error: "Referenced sports club not found." });
      return;
    }
  }

  if (parsed.data.matchId) {
    const [matchRow] = await db
      .select({ id: matches.id })
      .from(matches)
      .where(eq(matches.id, parsed.data.matchId))
      .limit(1);
    if (!matchRow) {
      res.status(404).json({ error: "Referenced match not found." });
      return;
    }
  }

  let resolvedAuctionId: number | null = parsed.data.auctionId ?? null;
  if (parsed.data.requestedRole === "AUCTION_OPERATOR") {
    if (resolvedAuctionId) {
      const [aucRow] = await db
        .select({ id: auctions.id })
        .from(auctions)
        .where(eq(auctions.id, resolvedAuctionId))
        .limit(1);
      if (!aucRow) {
        res.status(404).json({ error: "Referenced auction not found." });
        return;
      }
    } else {
      const recentAuctions = await db
        .select({ id: auctions.id })
        .from(auctions)
        .orderBy(desc(auctions.id))
        .limit(2);
      if (recentAuctions.length !== 1) {
        res.status(400).json({ error: "Explicit auctionId is required for Auction Operator requests." });
        return;
      }
      resolvedAuctionId = recentAuctions[0].id;
    }
  } else if (resolvedAuctionId) {
    const [aucRow] = await db
      .select({ id: auctions.id })
      .from(auctions)
      .where(eq(auctions.id, resolvedAuctionId))
      .limit(1);
    if (!aucRow) {
      res.status(404).json({ error: "Referenced auction not found." });
      return;
    }
  }

  const candidateErr = await assertStudentCandidate(parsed.data.targetUserId);
  if (candidateErr) {
    res.status(400).json({ error: candidateErr });
    return;
  }

  const [created] = await db
    .insert(roleRequests)
    .values({
      requesterUserId: req.actor!.id,
      targetUserId: parsed.data.targetUserId,
      requestedRole: parsed.data.requestedRole,
      action: parsed.data.action,
      clubId: parsed.data.clubId ?? null,
      batchScope: parsed.data.batchScope ?? null,
      scopeLabel:
        parsed.data.requestedRole === "CLUB_COORDINATOR"
          ? parsed.data.scopeLabel?.trim() || null
          : null,
      matchId: parsed.data.matchId ?? null,
      auctionId: resolvedAuctionId,
      reason: parsed.data.reason.trim(),
      status: "PENDING",
    })
    .returning();

  res.status(201).json({ request: created });
});

router.patch("/requests/:id/review", requireAuth, async (req, res) => {
  const requestId = parsePositiveIntId(req.params.id);
  if (!requestId) {
    res.status(400).json({ error: "Invalid role request ID." });
    return;
  }

  const schema = z.object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    reviewNotes: z.string().max(300).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid review payload." });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [reqRow] = await tx
        .select()
        .from(roleRequests)
        .where(eq(roleRequests.id, requestId))
        .for("update")
        .limit(1);

      if (!reqRow) {
        throw Object.assign(new Error("Role request not found."), { status: 404 });
      }
      if (reqRow.status !== "PENDING") {
        throw Object.assign(new Error("Role request has already been reviewed."), { status: 409 });
      }

      // Authority checks: MATCH_SCORER, AUCTION_OPERATOR, and CLUB_SECRETARY require Sports Secretary or Faculty Advisor!
      const isGlobal = hasGlobalSportsAuthority(req.actor);
      const isClubSecForClub =
        reqRow.requestedRole === "CLUB_COORDINATOR" &&
        reqRow.clubId !== null &&
        (await canActorActAsClubSecretary(req.actor, reqRow.clubId));

      if (reqRow.requestedRole === "MATCH_SCORER" && !isGlobal) {
        throw Object.assign(
          new Error("Match Scorers can only be appointed or removed by the Sports Secretary."),
          { status: 403 }
        );
      }
      if (reqRow.requestedRole === "AUCTION_OPERATOR" && !isGlobal) {
        throw Object.assign(
          new Error("Auction Operators can only be appointed or removed by the Sports Secretary."),
          { status: 403 }
        );
      }
      if (reqRow.requestedRole === "CLUB_SECRETARY" && !isGlobal) {
        throw Object.assign(
          new Error("Club Secretaries can only be appointed or removed by the Sports Secretary."),
          { status: 403 }
        );
      }
      if (reqRow.requestedRole === "CLUB_COORDINATOR" && !isGlobal && !isClubSecForClub) {
        throw Object.assign(
          new Error("Only the Sports Secretary or that Club's Secretary can review Coordinators."),
          { status: 403 }
        );
      }

      const [reviewed] = await tx
        .update(roleRequests)
        .set({
          status: parsed.data.decision,
          reviewedBy: req.actor!.id,
          reviewNotes: parsed.data.reviewNotes?.trim() || null,
          reviewedAt: new Date(),
        })
        .where(and(eq(roleRequests.id, requestId), eq(roleRequests.status, "PENDING")))
        .returning();

      if (!reviewed) {
        throw Object.assign(new Error("Role request has already been reviewed."), { status: 409 });
      }

      if (parsed.data.decision === "APPROVED") {
        if (reqRow.action === "APPOINT") {
          if (reqRow.requestedRole === "CLUB_COORDINATOR" && reqRow.clubId) {
            if (!reqRow.batchScope) {
              throw Object.assign(new Error("Explicit batchScope is required for Club Coordinator."), {
                status: 400,
              });
            }
            const coordRes = await appointClubCoordinator(tx, {
              clubId: reqRow.clubId,
              targetUserId: reqRow.targetUserId,
              batchScope: reqRow.batchScope,
              scopeLabel: reqRow.scopeLabel,
              actorId: req.actor!.id,
            });
            if (!coordRes.ok) {
              throw Object.assign(new Error(coordRes.error), { status: coordRes.status });
            }
          } else {
            let effectiveAuctionId = reqRow.auctionId;
            if (reqRow.requestedRole === "AUCTION_OPERATOR" && !effectiveAuctionId) {
              const recentAuctions = await tx
                .select({ id: auctions.id })
                .from(auctions)
                .orderBy(desc(auctions.id))
                .limit(2);
              if (recentAuctions.length !== 1) {
                throw Object.assign(
                  new Error("Auction Operator appointment requires an explicit auctionId."),
                  { status: 400 }
                );
              }
              effectiveAuctionId = recentAuctions[0].id;
            }

            if (reqRow.clubId && reqRow.requestedRole === "CLUB_SECRETARY") {
              // Atomically deactivate outgoing CLUB_SECRETARY role(s) and demote club_memberships.role
              await tx
                .update(userRoles)
                .set({ active: false })
                .where(
                  and(
                    eq(userRoles.clubId, reqRow.clubId),
                    eq(userRoles.roleCode, "CLUB_SECRETARY"),
                    eq(userRoles.active, true),
                    ne(userRoles.userId, reqRow.targetUserId)
                  )
                );
            }

            const existingSameRole = await tx
              .select({ id: userRoles.id })
              .from(userRoles)
              .where(
                and(
                  eq(userRoles.userId, reqRow.targetUserId),
                  eq(userRoles.roleCode, reqRow.requestedRole),
                  eq(userRoles.active, true),
                  reqRow.clubId !== null ? eq(userRoles.clubId, reqRow.clubId) : isNull(userRoles.clubId),
                  reqRow.matchId !== null ? eq(userRoles.matchId, reqRow.matchId) : isNull(userRoles.matchId),
                  reqRow.batchScope !== null
                    ? eq(userRoles.batchScope, reqRow.batchScope)
                    : isNull(userRoles.batchScope),
                  effectiveAuctionId !== null
                    ? eq(userRoles.auctionId, effectiveAuctionId)
                    : isNull(userRoles.auctionId)
                )
              )
              .limit(1);

            if (existingSameRole.length === 0) {
              await tx.insert(userRoles).values({
                userId: reqRow.targetUserId,
                roleCode: reqRow.requestedRole,
                clubId: reqRow.clubId,
                batchScope: reqRow.batchScope,
                scopeLabel: reqRow.scopeLabel,
                matchId: reqRow.matchId,
                auctionId: effectiveAuctionId,
                grantedBy: req.actor!.id,
              });
            }

            if (reqRow.requestedRole === "MATCH_SCORER" && reqRow.matchId) {
              await tx
                .update(matches)
                .set({ scorerUserId: reqRow.targetUserId })
                .where(eq(matches.id, reqRow.matchId));
            }

            if (reqRow.clubId && reqRow.requestedRole === "CLUB_SECRETARY") {
              const profileId = await ensureStudentPlayerProfileId(tx, reqRow.targetUserId);
              if (profileId) {
                await tx
                  .update(clubMemberships)
                  .set({ role: "MEMBER", batchScope: null, scopeLabel: null })
                  .where(
                    and(
                      eq(clubMemberships.clubId, reqRow.clubId),
                      eq(clubMemberships.role, "SECRETARY"),
                      ne(clubMemberships.playerProfileId, profileId)
                    )
                  );

                await tx
                  .insert(clubMemberships)
                  .values({
                    clubId: reqRow.clubId,
                    playerProfileId: profileId,
                    role: "SECRETARY",
                    batchScope: reqRow.batchScope,
                    status: "INDUCTED",
                    approvedBy: req.actor!.id,
                    inductedAt: new Date(),
                  })
                  .onConflictDoUpdate({
                    target: [clubMemberships.clubId, clubMemberships.playerProfileId],
                    set: {
                      role: "SECRETARY",
                      batchScope: reqRow.batchScope,
                      scopeLabel: null,
                      status: "INDUCTED",
                      approvedBy: req.actor!.id,
                    },
                  });
              }
            }
          }
        } else {
          // REMOVE: demote only the specified role/coordinator entry without touching other coordinators or other clubs
          if (reqRow.requestedRole === "CLUB_COORDINATOR" && reqRow.clubId) {
            await removeClubCoordinator(tx, {
              clubId: reqRow.clubId,
              targetUserId: reqRow.targetUserId,
              batchScope: reqRow.batchScope,
            });
          } else {
            const conditions = [
              eq(userRoles.userId, reqRow.targetUserId),
              eq(userRoles.roleCode, reqRow.requestedRole),
              eq(userRoles.active, true),
            ];
            if (reqRow.clubId) conditions.push(eq(userRoles.clubId, reqRow.clubId));
            if (reqRow.matchId) conditions.push(eq(userRoles.matchId, reqRow.matchId));
            if (reqRow.auctionId) conditions.push(eq(userRoles.auctionId, reqRow.auctionId));
            await tx.update(userRoles).set({ active: false }).where(and(...conditions));

            if (reqRow.requestedRole === "MATCH_SCORER" && reqRow.matchId) {
              await tx
                .update(matches)
                .set({ scorerUserId: null })
                .where(
                  and(
                    eq(matches.id, reqRow.matchId),
                    eq(matches.scorerUserId, reqRow.targetUserId)
                  )
                );
            }

            if (reqRow.clubId && reqRow.requestedRole === "CLUB_SECRETARY") {
              const [prof] = await tx
                .select({ id: playerProfiles.id })
                .from(playerProfiles)
                .where(eq(playerProfiles.userId, reqRow.targetUserId))
                .limit(1);
              if (prof) {
                await tx
                  .update(clubMemberships)
                  .set({ role: "MEMBER", batchScope: null, scopeLabel: null })
                  .where(
                    and(
                      eq(clubMemberships.clubId, reqRow.clubId),
                      eq(clubMemberships.playerProfileId, prof.id),
                      eq(clubMemberships.role, "SECRETARY")
                    )
                  );
              }
            }
          }
        }

        await tx.insert(notifications).values({
          userId: reqRow.targetUserId,
          title: `Role ${reqRow.action === "APPOINT" ? "Appointed" : "Removed"}: ${reqRow.requestedRole}`,
          message: `Approved by ${req.actor!.name}.`,
          linkUrl:
            reqRow.requestedRole === "MATCH_SCORER"
              ? reqRow.matchId
                ? `/scorer?matchId=${reqRow.matchId}`
                : "/scorer"
              : "/roles",
        });
      }

      await recordAuditLog(tx, req.actor!.id, `ROLE_REQUEST_${parsed.data.decision}`, "role_requests", requestId, {
        targetUserId: reqRow.targetUserId,
        role: reqRow.requestedRole,
        action: reqRow.action,
        matchId: reqRow.matchId,
        auctionId: reqRow.auctionId,
      });

      return { reviewed, reqRow };
    });

    if (parsed.data.decision === "APPROVED") {
      broadcastSse("NOTIFICATION", { role: result.reqRow.requestedRole, matchId: result.reqRow.matchId }, [result.reqRow.targetUserId]);
      broadcastSse("NAV_UPDATED", { role: result.reqRow.requestedRole, targetUserId: result.reqRow.targetUserId });
      if (result.reqRow.requestedRole === "MATCH_SCORER" && result.reqRow.matchId) {
        broadcastSse("MATCH_STATUS", { matchId: result.reqRow.matchId });
      }
    }
    res.json({ request: result.reviewed });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status && status < 500) {
      res.status(status).json({ error: (err as Error).message });
      return;
    }
    throw err;
  }
});

router.post("/handover-secretary", requireAuth, async (req, res) => {
  if (!isFacultyAdvisor(req.actor)) {
    res.status(403).json({ error: "Only the Faculty Advisor / PED can hand over Sports Secretary authority." });
    return;
  }

  const schema = z.object({ newSecretaryUserId: z.number().int().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid user selected." });
    return;
  }

  const candidateErr = await assertStudentCandidate(parsed.data.newSecretaryUserId);
  if (candidateErr) {
    res.status(400).json({ error: candidateErr });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(userRoles)
      .set({ active: false })
      .where(and(eq(userRoles.roleCode, "SPORTS_SECRETARY"), eq(userRoles.active, true)));

    await tx.insert(userRoles).values({
      userId: parsed.data.newSecretaryUserId,
      roleCode: "SPORTS_SECRETARY",
      grantedBy: req.actor!.id,
    });

    await tx.insert(notifications).values({
      userId: parsed.data.newSecretaryUserId,
      title: "Sports Secretary Handover Complete",
      message: `${req.actor!.name} has transferred Institute Sports Secretary access to your account.`,
      linkUrl: "/roles",
    });

    await recordAuditLog(tx, req.actor!.id, "HANDOVER_SPORTS_SECRETARY", "users", parsed.data.newSecretaryUserId, {});
  });

  broadcastSse("NOTIFICATION", { role: "SPORTS_SECRETARY" }, [parsed.data.newSecretaryUserId]);
  broadcastSse("NAV_UPDATED", { role: "SPORTS_SECRETARY", targetUserId: parsed.data.newSecretaryUserId });

  res.json({ ok: true });
});

router.get("/holders", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can view active role holders." });
    return;
  }

  const rows = await db
    .select({
      id: userRoles.id,
      userId: userRoles.userId,
      roleCode: userRoles.roleCode,
      clubId: userRoles.clubId,
      batchScope: userRoles.batchScope,
      scopeLabel: userRoles.scopeLabel,
      matchId: userRoles.matchId,
      auctionId: userRoles.auctionId,
      createdAt: userRoles.createdAt,
      userName: users.name,
      rollNumber: users.rollNumber,
      batch: users.batch,
      clubName: sportsClubs.name,
    })
    .from(userRoles)
    .innerJoin(users, eq(userRoles.userId, users.id))
    .leftJoin(sportsClubs, eq(userRoles.clubId, sportsClubs.id))
    .where(
      and(
        eq(userRoles.active, true),
        inArray(userRoles.roleCode, [
          "CLUB_SECRETARY",
          "CLUB_COORDINATOR",
          "MATCH_SCORER",
          "AUCTION_OPERATOR",
        ])
      )
    )
    .orderBy(asc(userRoles.roleCode), asc(users.name));

  res.json({ holders: rows });
});

router.delete("/holders/:roleId", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can revoke active roles." });
    return;
  }

  const roleId = parsePositiveIntId(req.params.roleId);
  if (!roleId) {
    res.status(400).json({ error: "Invalid role assignment ID." });
    return;
  }

  const outcome = await db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.id, roleId), eq(userRoles.active, true)))
      .for("update")
      .limit(1);

    if (!target) {
      return { ok: false as const, status: 404, error: "Active role assignment not found." };
    }

    if (
      !["CLUB_SECRETARY", "CLUB_COORDINATOR", "MATCH_SCORER", "AUCTION_OPERATOR"].includes(
        target.roleCode
      )
    ) {
      return {
        ok: false as const,
        status: 400,
        error: "This role cannot be revoked directly from this endpoint.",
      };
    }

    await tx.update(userRoles).set({ active: false }).where(eq(userRoles.id, roleId));

    if (target.roleCode === "MATCH_SCORER" && target.matchId) {
      await tx
        .update(matches)
        .set({ scorerUserId: null })
        .where(and(eq(matches.id, target.matchId), eq(matches.scorerUserId, target.userId)));
    }

    if (target.clubId && target.roleCode === "CLUB_COORDINATOR") {
      await removeClubCoordinator(tx, {
        clubId: target.clubId,
        targetUserId: target.userId,
        batchScope: target.batchScope,
      });
    } else if (target.clubId && target.roleCode === "CLUB_SECRETARY") {
      const [prof] = await tx
        .select({ id: playerProfiles.id })
        .from(playerProfiles)
        .where(eq(playerProfiles.userId, target.userId))
        .limit(1);
      if (prof) {
        await tx
          .update(clubMemberships)
          .set({ role: "MEMBER", batchScope: null, scopeLabel: null })
          .where(
            and(
              eq(clubMemberships.clubId, target.clubId),
              eq(clubMemberships.playerProfileId, prof.id),
              eq(clubMemberships.role, "SECRETARY")
            )
          );
      }
    }

    await tx.insert(notifications).values({
      userId: target.userId,
      title: `Role Revoked: ${target.roleCode}`,
      message: `Revoked by ${req.actor!.name}.`,
      linkUrl: "/roles",
    });

    await recordAuditLog(tx, req.actor!.id, "REVOKE_ROLE_DIRECT", "user_roles", roleId, {
      targetUserId: target.userId,
      roleCode: target.roleCode,
      clubId: target.clubId,
      matchId: target.matchId,
    });

    return { ok: true as const, target };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  broadcastSse("NOTIFICATION", { role: outcome.target.roleCode }, [outcome.target.userId]);
  broadcastSse("NAV_UPDATED", { role: outcome.target.roleCode, targetUserId: outcome.target.userId });
  if (outcome.target.roleCode === "MATCH_SCORER" && outcome.target.matchId) {
    broadcastSse("MATCH_STATUS", { matchId: outcome.target.matchId });
  }
  res.json({ ok: true });
});

router.post("/semester-rollover", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({
      error: "Only Sports Secretary or Faculty Advisor can run a controlled semester rollover.",
    });
    return;
  }

  const schema = z.object({
    term: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, "Term must be alphanumeric with _ or - (e.g., EVEN_2027)."),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide a valid academic term identifier (e.g., EVEN_2027)." });
    return;
  }

  const term = parsed.data.term.toUpperCase();
  const excludedIds = await getExcludedNonStudentIds();
  const excludedSet = new Set(excludedIds);

  const summary = await db.transaction(async (tx) => {
    const allUsers = await tx.select().from(users);
    let advancedCount = 0;
    let graduatedCount = 0;
    let skippedCount = 0;

    for (const u of allUsers) {
      if (excludedSet.has(u.id) || u.accountType !== "STUDENT") {
        skippedCount += 1;
        continue;
      }

      const outcome = computeSemesterRollover(
        {
          accountType: u.accountType,
          programType: u.programType ?? (u.batch === "MTECH" ? "MTECH" : "BTECH"),
          currentSemester: u.currentSemester ?? 1,
          lastIncrementedTerm: u.lastIncrementedTerm ?? null,
          isGraduated: Boolean(u.isGraduated),
        },
        term
      );

      if (outcome.action === "SKIP") {
        skippedCount += 1;
        continue;
      }

      await tx
        .update(users)
        .set({
          college: FIXED_COLLEGE,
          currentSemester: outcome.nextSemester,
          batch: outcome.nextBatch,
          isGraduated: outcome.isGraduated,
          lastIncrementedTerm: outcome.lastIncrementedTerm,
        })
        .where(eq(users.id, u.id));

      await tx
        .update(playerProfiles)
        .set({
          college: FIXED_COLLEGE,
          currentSemester: outcome.nextSemester,
          batch: outcome.nextBatch,
          isGraduated: outcome.isGraduated,
        })
        .where(eq(playerProfiles.userId, u.id));

      if (outcome.action === "GRADUATE") {
        graduatedCount += 1;
      } else {
        advancedCount += 1;
      }
    }

    await recordAuditLog(tx, req.actor!.id, "SEMESTER_ROLLOVER", "academic_term", term, {
      term,
      advancedCount,
      graduatedCount,
      skippedCount,
    });

    return { term, advancedCount, graduatedCount, skippedCount };
  });

  res.json({ ok: true, ...summary });
});

router.get("/audit-logs", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Audit logs are restricted to Sports Secretary and Faculty Advisor." });
    return;
  }
  const rows = await db
    .select({
      id: auditLogs.id,
      actorUserId: auditLogs.actorUserId,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      metadataJson: auditLogs.metadataJson,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);

  res.json({ logs: rows });
});

export default router;
