import crypto from "crypto";
import type { Response } from "express";
import { Router } from "express";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.ts";
import {
  auctionBids,
  auctionFranchises,
  auctionRegistrations,
  auctionRounds,
  auctionTeamRegistrations,
  auctions,
  captainWatchlists,
  clubMemberships,
  notifications,
  playerProfiles,
  rtmEligibility,
  siteSettings,
  sports,
  sportsClubs,
  standings,
  teamRosters,
  teams,
  tournaments,
  tournamentSports,
  userRoles,
  users,
} from "../db/schema.ts";
import { requireAuth, type SessionActor } from "../middleware/auth.ts";
import { canOperateAuction, hasGlobalSportsAuthority } from "../middleware/rbac.ts";
import { assertStudentCandidate, ensureStudentPlayerProfileId, NON_STUDENT_ROLES } from "../lib/clubLeadership.ts";
import { recordAuditLog } from "../lib/audit.ts";
import { broadcastSse, registerSseStream } from "../lib/sse.ts";
import {
  extractIdempotencyKey,
  findIdempotencyRecord,
  parsePositiveIntId,
  saveIdempotencyRecord,
} from "../lib/http.ts";
import { saveValidatedUpload, uploadMiddleware } from "../lib/storage.ts";
import { computeMaxAllowedBid } from "../../shared/validation.ts";

const router = Router();

function getSportEffectiveBasePrices(
  auction: typeof auctions.$inferSelect,
  sportId: number
): { clubBasePrice: number; nonClubBasePrice: number } {
  const override = auction.sportBasePricesJson?.[String(sportId)];
  return {
    clubBasePrice: override?.clubBasePrice ?? auction.clubBasePrice,
    nonClubBasePrice: override?.nonClubBasePrice ?? auction.nonClubBasePrice,
  };
}

async function getActiveCaptainUserIds(auctionId: number): Promise<Set<number>> {
  const [roleCaps, franchiseCaps, activeTournaments] = await Promise.all([
    db
      .select({
        userId: userRoles.userId,
        auctionId: userRoles.auctionId,
        tournamentId: userRoles.tournamentId,
      })
      .from(userRoles)
      .where(and(eq(userRoles.active, true), eq(userRoles.roleCode, "CAPTAIN"))),
    db
      .select({ captainUserId: auctionFranchises.captainUserId })
      .from(auctionFranchises)
      .where(
        and(
          eq(auctionFranchises.auctionId, auctionId),
          eq(auctionFranchises.status, "APPROVED")
        )
      ),
    db
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(eq(tournaments.isCurrent, true)),
  ]);

  const activeTournamentIds = new Set(activeTournaments.map((t) => t.id));
  const ids = new Set<number>();

  for (const rc of roleCaps) {
    if (
      (rc.auctionId === null || rc.auctionId === auctionId) &&
      (rc.tournamentId === null || activeTournamentIds.has(rc.tournamentId))
    ) {
      ids.add(rc.userId);
    }
  }
  for (const fc of franchiseCaps) {
    if (fc.captainUserId) ids.add(fc.captainUserId);
  }

  if (activeTournaments.length > 0) {
    const teamCaps = await db
      .select({ captainUserId: teams.captainUserId })
      .from(teams)
      .where(
        and(
          inArray(
            teams.tournamentId,
            activeTournaments.map((t) => t.id)
          ),
          inArray(teams.submissionStatus, ["APPROVED", "LOCKED"])
        )
      );
    for (const tc of teamCaps) {
      if (tc.captainUserId) ids.add(tc.captainUserId);
    }
  }

  return ids;
}

function getIncrementalStep(
  auction: typeof auctions.$inferSelect,
  currentAmount: number
): number {
  const slabs = auction.bidSlabsJson ?? [];
  for (const slab of slabs) {
    if (slab.upTo === null || currentAmount < slab.upTo) {
      return slab.increment;
    }
  }
  return auction.defaultIncrement;
}

async function getActiveOrLatestAuction(executor: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0] = db) {
  const all = await executor.select().from(auctions).orderBy(desc(auctions.id)).limit(5);
  return (
    all.find((a) => a.status === "LIVE") ??
    all.find((a) => a.status !== "COMPLETED") ??
    all[0] ??
    null
  );
}

function checkVersionConflict(
  res: Response,
  auction: typeof auctions.$inferSelect,
  expectedVersion?: number
): boolean {
  if (expectedVersion !== undefined && auction.version !== expectedVersion) {
    res.status(409).json({
      error: "Auction state changed concurrently. Synced latest state—please retry.",
      currentVersion: auction.version,
    });
    return true;
  }
  return false;
}

async function computeFranchiseGuardrail(
  executor: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0],
  auction: typeof auctions.$inferSelect,
  franchise: typeof auctionFranchises.$inferSelect,
  candidateClass: "CLUB" | "NON_CLUB"
) {
  const soldRows = await executor
    .select({
      playerClass: auctionRegistrations.playerClass,
    })
    .from(auctionRegistrations)
    .where(
      and(
        eq(auctionRegistrations.auctionId, auction.id),
        eq(auctionRegistrations.sportId, franchise.sportId),
        eq(auctionRegistrations.soldFranchiseId, franchise.id),
        eq(auctionRegistrations.status, "SOLD")
      )
    );

  const squadCount = soldRows.length;
  const clubCount = soldRows.filter((r) => r.playerClass === "CLUB").length;
  const nonClubCount = soldRows.filter((r) => r.playerClass === "NON_CLUB").length;
  const sportPrices = getSportEffectiveBasePrices(auction, franchise.sportId);

  const guardrail = computeMaxAllowedBid({
    remainingPurse: franchise.remainingPurse,
    currentSquadCount: squadCount,
    currentClubCount: clubCount,
    currentNonClubCount: nonClubCount,
    minSquad: franchise.minSquad,
    maxSquad: franchise.maxSquad,
    minClubQuota: franchise.minClubQuota,
    minNonClubQuota: franchise.minNonClubQuota,
    clubBasePrice: sportPrices.clubBasePrice,
    nonClubBasePrice: sportPrices.nonClubBasePrice,
    candidateClass,
  });

  return {
    squadCount,
    clubCount,
    nonClubCount,
    ...guardrail,
  };
}

async function buildAuctionSnapshot(
  actor: SessionActor | null,
  sportIdOverride?: number | null
) {
  const auction = await getActiveOrLatestAuction();
  const allSports = await db.select().from(sports).orderBy(asc(sports.displayOrder));
  const clubRows = await db.select().from(sportsClubs);
  const clubBySportId = Object.fromEntries(clubRows.map((c) => [c.sportId, c]));

  if (!auction) {
    return {
      auction: null,
      sports: allSports,
      rounds: [],
      franchises: [],
      registrations: [],
      teamRegistrations: [],
      activePlayer: null,
      activeBids: [],
      rtmEntries: [],
      myRegistrations: [],
      myWatchlist: [],
      myInductedSportIds: [],
      permissions: {
        canManageConfig: hasGlobalSportsAuthority(actor),
        canOperateStage: canOperateAuction(actor, null),
        canRegister: Boolean(actor && actor.accountType === "STUDENT"),
      },
    };
  }

  const effectiveSportId =
    sportIdOverride && allSports.some((s) => s.id === sportIdOverride)
      ? sportIdOverride
      : auction.activeSportId ?? allSports[0]?.id ?? null;

  const rounds = await db
    .select()
    .from(auctionRounds)
    .where(eq(auctionRounds.auctionId, auction.id))
    .orderBy(asc(auctionRounds.roundOrder), asc(auctionRounds.id));

  const franchiseRows = await db
    .select()
    .from(auctionFranchises)
    .where(
      and(
        eq(auctionFranchises.auctionId, auction.id),
        eq(auctionFranchises.status, "APPROVED")
      )
    )
    .orderBy(asc(auctionFranchises.sportId), asc(auctionFranchises.slotNumber), asc(auctionFranchises.id));

  const captainIds = Array.from(
    new Set(franchiseRows.map((f) => f.captainUserId).filter((id): id is number => id !== null))
  );
  const captainRows =
    captainIds.length > 0
      ? await db
          .select({
            id: users.id,
            name: users.name,
            rollNumber: users.rollNumber,
            batch: users.batch,
          })
          .from(users)
          .where(inArray(users.id, captainIds))
      : [];
  const captainMap = Object.fromEntries(captainRows.map((c) => [c.id, c]));

  const regRows = await db
    .select({
      reg: auctionRegistrations,
      profile: {
        displayName: playerProfiles.displayName,
        batch: playerProfiles.batch,
        branch: playerProfiles.branch,
        rollNumber: playerProfiles.rollNumber,
        userId: playerProfiles.userId,
        avatarUrl: playerProfiles.avatarUrl,
      },
    })
    .from(auctionRegistrations)
    .innerJoin(playerProfiles, eq(auctionRegistrations.playerProfileId, playerProfiles.id))
    .where(eq(auctionRegistrations.auctionId, auction.id))
    .orderBy(asc(auctionRegistrations.id));

  const activeRegRow = auction.activePlayerId
    ? regRows.find((r) => r.reg.id === auction.activePlayerId) ?? null
    : null;

  const activePlayerClass =
    (activeRegRow?.reg.playerClass as "CLUB" | "NON_CLUB" | undefined) ?? "NON_CLUB";

  const hydratedFranchises = franchiseRows.map((f) => {
    const boughtPlayers = regRows
      .filter(
        (r) =>
          r.reg.sportId === f.sportId &&
          r.reg.status === "SOLD" &&
          r.reg.soldFranchiseId === f.id
      )
      .map((r) => ({
        id: r.reg.id,
        playerProfileId: r.reg.playerProfileId,
        name: r.profile.displayName,
        batch: r.profile.batch,
        branch: r.profile.branch,
        rollNumber: actor ? r.profile.rollNumber : null,
        positions: r.reg.positionsJson,
        playerClass: r.reg.playerClass,
        soldPrice: r.reg.soldPrice ?? r.reg.basePrice,
      }));

    const clubCount = boughtPlayers.filter((p) => p.playerClass === "CLUB").length;
    const nonClubCount = boughtPlayers.filter((p) => p.playerClass === "NON_CLUB").length;
    const sportPrices = getSportEffectiveBasePrices(auction, f.sportId);
    const guard = computeMaxAllowedBid({
      remainingPurse: f.remainingPurse,
      currentSquadCount: boughtPlayers.length,
      currentClubCount: clubCount,
      currentNonClubCount: nonClubCount,
      minSquad: f.minSquad,
      maxSquad: f.maxSquad,
      minClubQuota: f.minClubQuota,
      minNonClubQuota: f.minNonClubQuota,
      clubBasePrice: sportPrices.clubBasePrice,
      nonClubBasePrice: sportPrices.nonClubBasePrice,
      candidateClass:
        activeRegRow && activeRegRow.reg.sportId === f.sportId
          ? activePlayerClass
          : "NON_CLUB",
    });

    const rawCaptain = f.captainUserId ? captainMap[f.captainUserId] ?? null : null;
    const captain = rawCaptain
      ? actor
        ? rawCaptain
        : { id: rawCaptain.id, name: rawCaptain.name, batch: rawCaptain.batch, rollNumber: null }
      : null;

    return {
      ...f,
      captain,
      boughtPlayers,
      squadCount: boughtPlayers.length,
      clubCount,
      nonClubCount,
      maxAllowedBid: guard.maxAllowedBid,
      requiredReserve: guard.requiredReserve,
      eligibleToBid: guard.eligible,
      guardReason: guard.reason,
    };
  });

  const activeBids = activeRegRow
    ? await db
        .select()
        .from(auctionBids)
        .where(
          and(
            eq(auctionBids.auctionPlayerId, activeRegRow.reg.id),
            eq(auctionBids.undone, false)
          )
        )
        .orderBy(desc(auctionBids.id))
    : [];

  const rtmEntries = await db
    .select()
    .from(rtmEligibility)
    .where(eq(rtmEligibility.seasonYear, auction.seasonYear));

  const activeCaptainIds = await getActiveCaptainUserIds(auction.id);

  const hydratedRegistrations = regRows
    .filter(({ profile }) => !profile.userId || !activeCaptainIds.has(profile.userId))
    .map(({ reg, profile }) => ({
      ...reg,
      displayName: profile.displayName,
      batch: profile.batch,
      branch: profile.branch,
      rollNumber: actor ? profile.rollNumber : null,
      userId: actor ? profile.userId : null,
      photoUrl: reg.photoUrl ?? profile.avatarUrl,
    }));

  const myRegistrations = actor?.playerProfileId
    ? hydratedRegistrations.filter((r) => r.playerProfileId === actor.playerProfileId)
    : [];

  let myInductedSportIds: number[] = [];
  if (actor?.playerProfileId) {
    const mems = await db
      .select({ clubId: clubMemberships.clubId })
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.playerProfileId, actor.playerProfileId),
          eq(clubMemberships.status, "INDUCTED")
        )
      );
    const inductedClubSet = new Set(mems.map((m) => m.clubId));
    myInductedSportIds = allSports
      .filter((s) => clubBySportId[s.id] && inductedClubSet.has(clubBySportId[s.id].id))
      .map((s) => s.id);
  }

  const myCaptainFranchiseIds = actor
    ? hydratedFranchises.filter((f) => f.captainUserId === actor.id).map((f) => f.id)
    : [];
  const myWatchlist =
    myCaptainFranchiseIds.length > 0
      ? await db
          .select()
          .from(captainWatchlists)
          .where(inArray(captainWatchlists.franchiseId, myCaptainFranchiseIds))
      : [];

  const operatorRows = await db
    .select({
      roleId: userRoles.id,
      userId: userRoles.userId,
      roleCode: userRoles.roleCode,
      auctionId: userRoles.auctionId,
      name: users.name,
      rollNumber: users.rollNumber,
      batch: users.batch,
    })
    .from(userRoles)
    .innerJoin(users, eq(userRoles.userId, users.id))
    .where(
      and(
        eq(userRoles.active, true),
        inArray(userRoles.roleCode, ["AUCTION_OPERATOR", "AUCTIONEER"]),
        or(isNull(userRoles.auctionId), eq(userRoles.auctionId, auction.id))
      )
    )
    .orderBy(asc(users.name));

  const isGlobalAdmin = hasGlobalSportsAuthority(actor);
  const rawTeamRegs = actor
    ? await db
        .select()
        .from(auctionTeamRegistrations)
        .where(
          isGlobalAdmin
            ? eq(auctionTeamRegistrations.auctionId, auction.id)
            : and(
                eq(auctionTeamRegistrations.auctionId, auction.id),
                or(
                  eq(auctionTeamRegistrations.submittedByUserId, actor.id),
                  eq(auctionTeamRegistrations.captainUserId, actor.id)
                )
              )
        )
        .orderBy(desc(auctionTeamRegistrations.createdAt), desc(auctionTeamRegistrations.id))
    : [];

  const regUserIds = Array.from(
    new Set(
      rawTeamRegs
        .flatMap((r) => [r.submittedByUserId, r.captainUserId])
        .filter((id): id is number => id !== null)
    )
  );
  const regUserRows =
    regUserIds.length > 0
      ? await db
          .select({ id: users.id, name: users.name, rollNumber: users.rollNumber, batch: users.batch })
          .from(users)
          .where(inArray(users.id, regUserIds))
      : [];
  const regUserMap = Object.fromEntries(regUserRows.map((u) => [u.id, u]));
  const sportNameMap = Object.fromEntries(allSports.map((s) => [s.id, s.name]));

  const teamRegistrations = rawTeamRegs.map((r) => ({
    ...r,
    sportName: sportNameMap[r.sportId] ?? "Sport",
    submitterName: regUserMap[r.submittedByUserId]?.name ?? "User",
    captainName: r.captainUserId ? regUserMap[r.captainUserId]?.name ?? null : null,
  }));

  return {
    auction,
    effectiveSportId,
    sports: allSports,
    rounds,
    franchises: hydratedFranchises,
    registrations: hydratedRegistrations,
    teamRegistrations,
    operators: actor
      ? operatorRows
      : operatorRows.map(({ userId: _uid, rollNumber: _rn, ...pubOp }) => ({
          ...pubOp,
          userId: null,
          rollNumber: null,
        })),
    activePlayer: activeRegRow
      ? hydratedRegistrations.find((r) => r.id === activeRegRow.reg.id) ?? null
      : null,
    activeBids,
    rtmEntries,
    myRegistrations,
    myWatchlist,
    myInductedSportIds,
    permissions: {
      canManageConfig: hasGlobalSportsAuthority(actor),
      canOperateStage: canOperateAuction(actor, auction.id),
      canRegister:
        Boolean(actor && actor.accountType === "STUDENT") &&
        !actor!.roles.some((r) => NON_STUDENT_ROLES.includes(r.roleCode)) &&
        !activeCaptainIds.has(actor!.id),
      isCaptain: myCaptainFranchiseIds.length > 0 || (actor ? activeCaptainIds.has(actor.id) : false),
      isActiveCaptain: actor ? activeCaptainIds.has(actor.id) : false,
    },
  };
}

const PUBLIC_AUCTION_SNAPSHOT_TTL_MS = 500;
const publicAuctionSnapshotCache = new Map<
  number,
  { expiresAtMs: number; payload: Awaited<ReturnType<typeof buildAuctionSnapshot>> }
>();

function invalidateAuctionSnapshotCache() {
  publicAuctionSnapshotCache.clear();
}

async function broadcastAuctionUpdate(
  eventType: "AUCTION_STAGE" | "AUCTION_BID" | "AUCTION_OUTCOME" | "AUCTION_UPDATED" | "AUCTION_PROJECTOR",
  payload: Record<string, unknown> = {}
) {
  invalidateAuctionSnapshotCache();
  broadcastSse(eventType, { ts: Date.now(), ...payload });
}

router.get("/state", async (req, res) => {
  const rawSportId = req.query.sportId ? Number(req.query.sportId) : null;
  const sportId = rawSportId && Number.isFinite(rawSportId) ? rawSportId : null;
  const cacheKey = sportId ?? 0;
  if (!req.actor) {
    const cached = publicAuctionSnapshotCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAtMs) {
      res.json(cached.payload);
      return;
    }
  }
  const snapshot = await buildAuctionSnapshot(req.actor, sportId);
  if (!req.actor) {
    publicAuctionSnapshotCache.set(cacheKey, {
      expiresAtMs: Date.now() + PUBLIC_AUCTION_SNAPSHOT_TTL_MS,
      payload: snapshot,
    });
  }
  res.json(snapshot);
});

router.get("/live-state", async (req, res) => {
  const rawSportId = req.query.sportId ? Number(req.query.sportId) : null;
  const sportId = rawSportId && Number.isFinite(rawSportId) ? rawSportId : null;
  const cacheKey = sportId ?? 0;
  if (!req.actor) {
    const cached = publicAuctionSnapshotCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAtMs) {
      res.json(cached.payload);
      return;
    }
  }
  const snapshot = await buildAuctionSnapshot(req.actor, sportId);
  if (!req.actor) {
    publicAuctionSnapshotCache.set(cacheKey, {
      expiresAtMs: Date.now() + PUBLIC_AUCTION_SNAPSHOT_TTL_MS,
      payload: snapshot,
    });
  }
  res.json(snapshot);
});

router.get("/stream", (req, res) => {
  registerSseStream(req, res, req.actor?.id ?? null);
});

router.post("/upload-photo", requireAuth, uploadMiddleware.single("file"), async (req, res, next) => {
  if (!req.file || !req.file.buffer) {
    res.status(400).json({ error: "No player portrait file uploaded." });
    return;
  }
  try {
    const saved = await saveValidatedUpload(req.file.buffer, "players");
    res.status(201).json({ photoUrl: saved.url, url: saved.url });
  } catch (err) {
    next(err);
  }
});

// Student Self-Service Registration (1 per sport, multi-position within sport, session-derived identity)
router.post("/registrations", requireAuth, async (req, res) => {
  const studentErr = await assertStudentCandidate(req.actor!.id);
  if (studentErr) {
    res.status(403).json({ error: studentErr });
    return;
  }

  const schema = z.object({
    sportId: z.number().int().positive(),
    track: z.enum(["COMBINED", "BOYS", "GIRLS"]).optional(),
    positionsJson: z.array(z.string().min(1).max(60)).min(1).max(6),
    experience: z.string().max(400).optional().nullable(),
    achievements: z.string().max(400).optional().nullable(),
    photoUrl: z
      .string()
      .max(300)
      .refine((v) => v.startsWith("/uploads/players/") || v.startsWith("/uploads/"), {
        message: "Invalid uploaded photo URL.",
      })
      .optional()
      .nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Select a sport and at least 1 playing position." });
    return;
  }

  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "No auction cycle configured." });
    return;
  }

  const activeCaptainIds = await getActiveCaptainUserIds(auction.id);
  if (activeCaptainIds.has(req.actor!.id)) {
    res.status(403).json({
      error: "Team captains cannot register as biddable auction players.",
    });
    return;
  }

  if (auction.status !== "REGISTRATION_OPEN") {
    res.status(400).json({ error: `Auction registration is closed (status: ${auction.status}).` });
    return;
  }
  if (
    auction.registrationDeadline &&
    Date.now() > new Date(auction.registrationDeadline).getTime()
  ) {
    res.status(400).json({ error: "Auction registration is closed (deadline has passed)." });
    return;
  }

  const [sport] = await db
    .select()
    .from(sports)
    .where(eq(sports.id, parsed.data.sportId))
    .limit(1);
  if (!sport) {
    res.status(404).json({ error: "Selected sport not found." });
    return;
  }

  const profileId = await ensureStudentPlayerProfileId(db, req.actor!.id);
  if (!profileId) {
    res.status(400).json({ error: "Student player profile is required to register." });
    return;
  }

  const [existing] = await db
    .select()
    .from(auctionRegistrations)
    .where(
      and(
        eq(auctionRegistrations.auctionId, auction.id),
        eq(auctionRegistrations.sportId, sport.id),
        eq(auctionRegistrations.playerProfileId, profileId)
      )
    )
    .limit(1);

  if (existing) {
    res.status(409).json({
      error: `You have already registered for ${sport.name} in ${auction.name}.`,
    });
    return;
  }

  // Server-authoritative CLUB vs NON_CLUB classification from club_memberships
  const [club] = await db
    .select()
    .from(sportsClubs)
    .where(eq(sportsClubs.sportId, sport.id))
    .limit(1);

  let isInductedClubMember = false;
  if (club) {
    const [mem] = await db
      .select({ id: clubMemberships.id })
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, club.id),
          eq(clubMemberships.playerProfileId, profileId),
          eq(clubMemberships.status, "INDUCTED")
        )
      )
      .limit(1);
    isInductedClubMember = Boolean(mem);
  }

  const playerClass = isInductedClubMember ? "CLUB" : "NON_CLUB";
  const sportPrices = getSportEffectiveBasePrices(auction, sport.id);
  const basePrice =
    playerClass === "CLUB" ? sportPrices.clubBasePrice : sportPrices.nonClubBasePrice;

  const [defaultRound] = await db
    .select()
    .from(auctionRounds)
    .where(eq(auctionRounds.auctionId, auction.id))
    .orderBy(asc(auctionRounds.roundOrder), asc(auctionRounds.id))
    .limit(1);

  const uniquePositions = Array.from(
    new Set(parsed.data.positionsJson.map((p) => p.trim()).filter(Boolean))
  );

  const effectiveTrack =
    auction.splitMode === "SEPARATE_BOYS_GIRLS"
      ? parsed.data.track === "GIRLS"
        ? "GIRLS"
        : parsed.data.track === "BOYS"
        ? "BOYS"
        : req.actor!.gender === "GIRLS"
        ? "GIRLS"
        : "BOYS"
      : "COMBINED";

  const [created] = await db
    .insert(auctionRegistrations)
    .values({
      auctionId: auction.id,
      sportId: sport.id,
      roundId: auction.activeRoundId ?? defaultRound?.id ?? null,
      track: effectiveTrack,
      playerProfileId: profileId,
      positionsJson: uniquePositions,
      playerClass,
      tier: "STANDARD",
      basePrice,
      experience: parsed.data.experience?.trim() || null,
      achievements: parsed.data.achievements?.trim() || null,
      photoUrl: parsed.data.photoUrl ?? null,
      status: "ELIGIBLE",
    })
    .returning();

  await broadcastAuctionUpdate("AUCTION_UPDATED", { sportId: sport.id });
  res.status(201).json({ registration: created });
});

// Captain Watchlist
router.post("/watchlist", requireAuth, async (req, res) => {
  const schema = z.object({
    franchiseId: z.number().int().positive(),
    auctionPlayerId: z.number().int().positive(),
    priorityNote: z.string().max(200).optional().nullable(),
    maxTargetBid: z.number().int().nonnegative().optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid watchlist payload." });
    return;
  }

  const [franchise] = await db
    .select()
    .from(auctionFranchises)
    .where(eq(auctionFranchises.id, parsed.data.franchiseId))
    .limit(1);
  if (!franchise) {
    res.status(404).json({ error: "Franchise not found." });
    return;
  }

  if (franchise.captainUserId !== req.actor!.id && !hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only the franchise captain can manage this watchlist." });
    return;
  }

  const [entry] = await db
    .insert(captainWatchlists)
    .values({
      franchiseId: franchise.id,
      auctionPlayerId: parsed.data.auctionPlayerId,
      priorityNote: parsed.data.priorityNote?.trim() || null,
      maxTargetBid: parsed.data.maxTargetBid ?? null,
    })
    .onConflictDoUpdate({
      target: [captainWatchlists.franchiseId, captainWatchlists.auctionPlayerId],
      set: {
        priorityNote: parsed.data.priorityNote?.trim() || null,
        maxTargetBid: parsed.data.maxTargetBid ?? null,
      },
    })
    .returning();

  res.status(201).json({ watchlistEntry: entry });
});

router.delete("/watchlist/:id", requireAuth, async (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid watchlist ID." });
    return;
  }
  const [entry] = await db
    .select()
    .from(captainWatchlists)
    .where(eq(captainWatchlists.id, id))
    .limit(1);
  if (!entry) {
    res.status(404).json({ error: "Watchlist entry not found." });
    return;
  }
  const [franchise] = await db
    .select()
    .from(auctionFranchises)
    .where(eq(auctionFranchises.id, entry.franchiseId))
    .limit(1);
  if (
    !franchise ||
    (franchise.captainUserId !== req.actor!.id && !hasGlobalSportsAuthority(req.actor))
  ) {
    res.status(403).json({ error: "Unauthorized to delete watchlist entry." });
    return;
  }
  await db.delete(captainWatchlists).where(eq(captainWatchlists.id, id));
  res.json({ ok: true });
});

// ============================================================================
// SPORTS SECRETARY / FACULTY ADVISOR CONFIGURATION & POOL MANAGEMENT
// ============================================================================

router.patch("/config", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can configure the auction." });
    return;
  }

  const schema = z.object({
    expectedVersion: z.number().int().positive().optional(),
    name: z.string().min(2).max(160).optional(),
    status: z.enum(["DRAFT", "REGISTRATION_OPEN", "FROZEN", "LIVE", "COMPLETED", "PUBLISHED"]).optional(),
    registrationDeadline: z.string().datetime().nullable().optional(),
    clubBasePrice: z.number().int().nonnegative().optional(),
    nonClubBasePrice: z.number().int().nonnegative().optional(),
    sportBasePricesJson: z
      .record(
        z.string(),
        z.object({
          clubBasePrice: z.number().int().nonnegative(),
          nonClubBasePrice: z.number().int().nonnegative(),
        })
      )
      .optional(),
    defaultIncrement: z.number().int().positive().optional(),
    jumpIncrement: z.number().int().positive().optional(),
    bidSlabsJson: z
      .array(
        z.object({
          upTo: z.number().int().positive().nullable(),
          increment: z.number().int().positive(),
        })
      )
      .optional(),
    rtmEnabled: z.boolean().optional(),
    splitMode: z.enum(["COMBINED", "SEPARATE_BOYS_GIRLS"]).optional(),
    activeTrack: z.enum(["COMBINED", "BOYS", "GIRLS"]).optional(),
    showAuctionInNav: z.boolean().optional(),
    showLiveAuctionInNav: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid auction configuration payload." });
    return;
  }

  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "No auction record found." });
    return;
  }
  if (checkVersionConflict(res, auction, parsed.data.expectedVersion)) return;

  const outcome = await db.transaction(async (tx) => {
    const [lockedAuction] = await tx
      .select()
      .from(auctions)
      .where(eq(auctions.id, auction.id))
      .for("update")
      .limit(1);
    if (!lockedAuction) {
      return { ok: false as const, status: 404, error: "No auction record found." };
    }
    if (
      parsed.data.expectedVersion !== undefined &&
      lockedAuction.version !== parsed.data.expectedVersion
    ) {
      return {
        ok: false as const,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state.",
      };
    }

    const [row] = await tx
      .update(auctions)
      .set({
        ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.registrationDeadline !== undefined
          ? {
              registrationDeadline: parsed.data.registrationDeadline
                ? new Date(parsed.data.registrationDeadline)
                : null,
            }
          : {}),
        ...(parsed.data.clubBasePrice !== undefined
          ? { clubBasePrice: parsed.data.clubBasePrice }
          : {}),
        ...(parsed.data.nonClubBasePrice !== undefined
          ? { nonClubBasePrice: parsed.data.nonClubBasePrice }
          : {}),
        ...(parsed.data.sportBasePricesJson !== undefined
          ? { sportBasePricesJson: parsed.data.sportBasePricesJson }
          : {}),
        ...(parsed.data.defaultIncrement !== undefined
          ? { defaultIncrement: parsed.data.defaultIncrement }
          : {}),
        ...(parsed.data.jumpIncrement !== undefined
          ? { jumpIncrement: parsed.data.jumpIncrement }
          : {}),
        ...(parsed.data.bidSlabsJson !== undefined
          ? { bidSlabsJson: parsed.data.bidSlabsJson }
          : {}),
        ...(parsed.data.rtmEnabled !== undefined ? { rtmEnabled: parsed.data.rtmEnabled } : {}),
        ...(parsed.data.splitMode !== undefined ? { splitMode: parsed.data.splitMode } : {}),
        ...(parsed.data.activeTrack !== undefined
          ? { activeTrack: parsed.data.activeTrack }
          : parsed.data.splitMode === "SEPARATE_BOYS_GIRLS" && lockedAuction.activeTrack === "COMBINED"
          ? { activeTrack: "BOYS" }
          : parsed.data.splitMode === "COMBINED"
          ? { activeTrack: "COMBINED" }
          : {}),
        version: lockedAuction.version + 1,
      })
      .where(and(eq(auctions.id, lockedAuction.id), eq(auctions.version, lockedAuction.version)))
      .returning();

    if (!row) {
      return {
        ok: false as const,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state.",
      };
    }

    if (parsed.data.showAuctionInNav !== undefined) {
      await tx
        .insert(siteSettings)
        .values({ key: "showAuctionInNav", valueJson: parsed.data.showAuctionInNav, updatedBy: req.actor!.id })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { valueJson: parsed.data.showAuctionInNav, updatedBy: req.actor!.id, updatedAt: new Date() },
        });
    }
    if (parsed.data.showLiveAuctionInNav !== undefined) {
      await tx
        .insert(siteSettings)
        .values({ key: "showLiveAuctionInNav", valueJson: parsed.data.showLiveAuctionInNav, updatedBy: req.actor!.id })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { valueJson: parsed.data.showLiveAuctionInNav, updatedBy: req.actor!.id, updatedAt: new Date() },
        });
    }

    await recordAuditLog(tx, req.actor!.id, "UPDATE_AUCTION_CONFIG", "auctions", lockedAuction.id, {
      status: parsed.data.status,
    });
    return { ok: true as const, row };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  const updated = outcome.row;

  if (parsed.data.showAuctionInNav !== undefined || parsed.data.showLiveAuctionInNav !== undefined) {
    broadcastSse("NAV_UPDATED", {
      showAuctionInNav: parsed.data.showAuctionInNav,
      showLiveAuctionInNav: parsed.data.showLiveAuctionInNav,
    });
  }
  await broadcastAuctionUpdate("AUCTION_UPDATED");
  res.json({ auction: updated });
});

router.post("/rounds", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can manage auction rounds." });
    return;
  }
  const schema = z.object({
    name: z.string().min(2).max(120),
    sportId: z.number().int().positive().nullable().optional(),
    roundOrder: z.number().int().positive().default(1),
    roundType: z.enum(["MAIN", "ACCELERATED", "UNSOLD", "RTM"]).default("MAIN"),
    active: z.boolean().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid round payload." });
    return;
  }
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }

  const created = await db.transaction(async (tx) => {
    if (parsed.data.active) {
      await tx.update(auctionRounds).set({ active: false }).where(eq(auctionRounds.auctionId, auction.id));
    }
    const [row] = await tx
      .insert(auctionRounds)
      .values({
        auctionId: auction.id,
        sportId: parsed.data.sportId ?? null,
        name: parsed.data.name.trim(),
        roundOrder: parsed.data.roundOrder,
        roundType: parsed.data.roundType,
        active: parsed.data.active,
      })
      .returning();
    if (parsed.data.active) {
      await tx
        .update(auctions)
        .set({ activeRoundId: row.id, version: auction.version + 1 })
        .where(eq(auctions.id, auction.id));
    }
    return row;
  });

  await broadcastAuctionUpdate("AUCTION_UPDATED");
  res.status(201).json({ round: created });
});

router.patch("/rounds/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can manage auction rounds." });
    return;
  }
  const roundId = parsePositiveIntId(req.params.id);
  if (!roundId) {
    res.status(400).json({ error: "Invalid round ID." });
    return;
  }
  const schema = z.object({
    name: z.string().min(2).max(120).optional(),
    roundOrder: z.number().int().positive().optional(),
    roundType: z.enum(["MAIN", "ACCELERATED", "UNSOLD", "RTM"]).optional(),
    active: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid round update payload." });
    return;
  }

  const [existing] = await db.select().from(auctionRounds).where(eq(auctionRounds.id, roundId)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Round not found." });
    return;
  }

  const updated = await db.transaction(async (tx) => {
    if (parsed.data.active) {
      await tx.update(auctionRounds).set({ active: false }).where(eq(auctionRounds.auctionId, existing.auctionId));
    }
    const [row] = await tx
      .update(auctionRounds)
      .set({
        ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.roundOrder !== undefined ? { roundOrder: parsed.data.roundOrder } : {}),
        ...(parsed.data.roundType ? { roundType: parsed.data.roundType } : {}),
        ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      })
      .where(eq(auctionRounds.id, roundId))
      .returning();
    if (parsed.data.active) {
      const [auc] = await tx.select().from(auctions).where(eq(auctions.id, existing.auctionId)).limit(1);
      if (auc) {
        await tx
          .update(auctions)
          .set({ activeRoundId: row.id, version: auc.version + 1 })
          .where(eq(auctions.id, auc.id));
      }
    }
    return row;
  });

  await broadcastAuctionUpdate("AUCTION_UPDATED");
  res.json({ round: updated });
});

router.delete("/rounds/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can delete rounds." });
    return;
  }
  const roundId = parsePositiveIntId(req.params.id);
  if (!roundId) {
    res.status(400).json({ error: "Invalid round ID." });
    return;
  }
  await db.delete(auctionRounds).where(eq(auctionRounds.id, roundId));
  await broadcastAuctionUpdate("AUCTION_UPDATED");
  res.json({ ok: true });
});

router.post("/franchises", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can create franchises." });
    return;
  }
  const schema = z.object({
    sportId: z.number().int().positive(),
    track: z.enum(["COMBINED", "BOYS", "GIRLS"]).optional(),
    name: z.string().min(2).max(100),
    shortCode: z.string().min(2).max(6).transform((s) => s.toUpperCase()),
    accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#D97706"),
    captainUserId: z.number().int().positive().nullable().optional(),
    startingPurse: z.number().int().positive().default(20000),
    minSquad: z.number().int().positive().default(11),
    maxSquad: z.number().int().positive().default(15),
    minClubQuota: z.number().int().nonnegative().default(3),
    minNonClubQuota: z.number().int().nonnegative().default(4),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid franchise payload." });
    return;
  }
  if (parsed.data.captainUserId) {
    const err = await assertStudentCandidate(parsed.data.captainUserId);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
  }
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }

  const existingForSport = await db
    .select()
    .from(auctionFranchises)
    .where(and(eq(auctionFranchises.auctionId, auction.id), eq(auctionFranchises.sportId, parsed.data.sportId)));
  const nextSlot =
    existingForSport.reduce((max, f) => Math.max(max, f.slotNumber), 0) + 1;

  const effectiveFranchiseTrack =
    auction.splitMode === "SEPARATE_BOYS_GIRLS"
      ? parsed.data.track === "GIRLS"
        ? "GIRLS"
        : "BOYS"
      : "COMBINED";

  const [created] = await db
    .insert(auctionFranchises)
    .values({
      auctionId: auction.id,
      sportId: parsed.data.sportId,
      slotNumber: nextSlot,
      track: effectiveFranchiseTrack,
      name: parsed.data.name.trim(),
      shortCode: parsed.data.shortCode.trim().toUpperCase(),
      accentColor: parsed.data.accentColor,
      captainUserId: parsed.data.captainUserId ?? null,
      startingPurse: parsed.data.startingPurse,
      remainingPurse: parsed.data.startingPurse,
      minSquad: parsed.data.minSquad,
      maxSquad: Math.max(parsed.data.minSquad, parsed.data.maxSquad),
      minClubQuota: parsed.data.minClubQuota,
      minNonClubQuota: parsed.data.minNonClubQuota,
    })
    .returning();

  await broadcastAuctionUpdate("AUCTION_UPDATED", { sportId: parsed.data.sportId });
  res.status(201).json({ franchise: created });
});

router.patch("/franchises/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can update franchises." });
    return;
  }
  const franchiseId = parsePositiveIntId(req.params.id);
  if (!franchiseId) {
    res.status(400).json({ error: "Invalid franchise ID." });
    return;
  }
  const schema = z.object({
    name: z.string().min(2).max(100).optional(),
    shortCode: z.string().min(2).max(6).transform((s) => s.toUpperCase()).optional(),
    accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    captainUserId: z.number().int().positive().nullable().optional(),
    sportId: z.number().int().positive().optional(),
    startingPurse: z.number().int().positive().optional(),
    remainingPurse: z.number().int().nonnegative().optional(),
    minSquad: z.number().int().positive().optional(),
    maxSquad: z.number().int().positive().optional(),
    minClubQuota: z.number().int().nonnegative().optional(),
    minNonClubQuota: z.number().int().nonnegative().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid franchise update payload." });
    return;
  }

  const [existing] = await db
    .select()
    .from(auctionFranchises)
    .where(eq(auctionFranchises.id, franchiseId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Franchise not found." });
    return;
  }

  if (parsed.data.captainUserId) {
    const err = await assertStudentCandidate(parsed.data.captainUserId);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
  }

  const spentAmount = Math.max(0, existing.startingPurse - existing.remainingPurse);
  let nextStartingPurse = existing.startingPurse;
  let nextRemainingPurse = existing.remainingPurse;
  if (parsed.data.startingPurse !== undefined) {
    if (parsed.data.startingPurse < spentAmount) {
      res.status(400).json({
        error: `Starting purse cannot be lower than already spent amount (₹${spentAmount}).`,
      });
      return;
    }
    nextStartingPurse = parsed.data.startingPurse;
    nextRemainingPurse =
      parsed.data.remainingPurse ?? parsed.data.startingPurse - spentAmount;
  } else if (parsed.data.remainingPurse !== undefined) {
    nextRemainingPurse = parsed.data.remainingPurse;
  }

  const [updated] = await db
    .update(auctionFranchises)
    .set({
      ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.shortCode ? { shortCode: parsed.data.shortCode.trim().toUpperCase() } : {}),
      ...(parsed.data.accentColor ? { accentColor: parsed.data.accentColor } : {}),
      ...(parsed.data.captainUserId !== undefined ? { captainUserId: parsed.data.captainUserId } : {}),
      ...(parsed.data.sportId ? { sportId: parsed.data.sportId } : {}),
      startingPurse: nextStartingPurse,
      remainingPurse: nextRemainingPurse,
      ...(parsed.data.minSquad !== undefined ? { minSquad: parsed.data.minSquad } : {}),
      ...(parsed.data.maxSquad !== undefined ? { maxSquad: parsed.data.maxSquad } : {}),
      ...(parsed.data.minClubQuota !== undefined ? { minClubQuota: parsed.data.minClubQuota } : {}),
      ...(parsed.data.minNonClubQuota !== undefined
        ? { minNonClubQuota: parsed.data.minNonClubQuota }
        : {}),
    })
    .where(eq(auctionFranchises.id, franchiseId))
    .returning();

  await broadcastAuctionUpdate("AUCTION_UPDATED", { sportId: updated.sportId });
  res.json({ franchise: updated });
});

router.delete("/franchises/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can delete franchises." });
    return;
  }
  const franchiseId = parsePositiveIntId(req.params.id);
  if (!franchiseId) {
    res.status(400).json({ error: "Invalid franchise ID." });
    return;
  }
  const [sold] = await db
    .select({ id: auctionRegistrations.id })
    .from(auctionRegistrations)
    .where(
      and(
        eq(auctionRegistrations.soldFranchiseId, franchiseId),
        eq(auctionRegistrations.status, "SOLD")
      )
    )
    .limit(1);
  if (sold) {
    res.status(409).json({ error: "Cannot delete a franchise that already has SOLD players." });
    return;
  }
  await db.delete(auctionFranchises).where(eq(auctionFranchises.id, franchiseId));
  await broadcastAuctionUpdate("AUCTION_UPDATED");
  res.json({ ok: true });
});

router.patch("/registrations/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can edit auction registrations." });
    return;
  }
  const regId = parsePositiveIntId(req.params.id);
  if (!regId) {
    res.status(400).json({ error: "Invalid registration ID." });
    return;
  }
  const schema = z.object({
    positionsJson: z.array(z.string().min(1).max(60)).min(1).max(6).optional(),
    playerClass: z.enum(["CLUB", "NON_CLUB"]).optional(),
    basePrice: z.number().int().nonnegative().optional(),
    tier: z.enum(["MARQUEE", "TIER_1", "STANDARD"]).optional(),
    roundId: z.number().int().positive().nullable().optional(),
    status: z.enum(["REGISTERED", "ELIGIBLE", "IN_AUCTION", "SOLD", "UNSOLD", "INELIGIBLE"]).optional(),
    experience: z.string().max(400).nullable().optional(),
    achievements: z.string().max(400).nullable().optional(),
    photoUrl: z.string().max(300).nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid registration update payload." });
    return;
  }

  if (
    parsed.data.photoUrl !== undefined &&
    parsed.data.photoUrl !== null &&
    parsed.data.photoUrl !== "" &&
    !parsed.data.photoUrl.startsWith("/uploads/") &&
    !parsed.data.photoUrl.startsWith("/assets/")
  ) {
    res.status(400).json({ error: "photoUrl must be a validated /uploads/ or /assets/ path." });
    return;
  }

  const [existing] = await db
    .select()
    .from(auctionRegistrations)
    .where(eq(auctionRegistrations.id, regId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Auction registration not found." });
    return;
  }

  if (
    parsed.data.status &&
    parsed.data.status !== existing.status &&
    (parsed.data.status === "SOLD" || existing.status === "SOLD")
  ) {
    res.status(400).json({ error: "Use live auction outcome or undo endpoints to change SOLD status." });
    return;
  }

  const [updated] = await db
    .update(auctionRegistrations)
    .set({
      ...(parsed.data.positionsJson ? { positionsJson: parsed.data.positionsJson } : {}),
      ...(parsed.data.playerClass ? { playerClass: parsed.data.playerClass } : {}),
      ...(parsed.data.basePrice !== undefined ? { basePrice: parsed.data.basePrice } : {}),
      ...(parsed.data.tier ? { tier: parsed.data.tier } : {}),
      ...(parsed.data.roundId !== undefined ? { roundId: parsed.data.roundId } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.experience !== undefined ? { experience: parsed.data.experience } : {}),
      ...(parsed.data.achievements !== undefined ? { achievements: parsed.data.achievements } : {}),
      ...(parsed.data.photoUrl !== undefined ? { photoUrl: parsed.data.photoUrl } : {}),
    })
    .where(eq(auctionRegistrations.id, regId))
    .returning();

  await broadcastAuctionUpdate("AUCTION_UPDATED", { sportId: updated.sportId });
  res.json({ registration: updated });
});

router.post("/operators", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({
      error: "Only the Sports Secretary or Faculty Advisor can assign Auction Operators.",
    });
    return;
  }

  const schema = z.object({ userId: z.number().int().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Select a valid student user." });
    return;
  }

  const candidateErr = await assertStudentCandidate(parsed.data.userId);
  if (candidateErr) {
    res.status(400).json({ error: candidateErr });
    return;
  }

  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }

  const [existing] = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, parsed.data.userId),
        inArray(userRoles.roleCode, ["AUCTION_OPERATOR", "AUCTIONEER"]),
        eq(userRoles.active, true),
        or(isNull(userRoles.auctionId), eq(userRoles.auctionId, auction.id))
      )
    )
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "Selected student is already an active Auction Operator." });
    return;
  }

  const [created] = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(userRoles)
      .values({
        userId: parsed.data.userId,
        roleCode: "AUCTION_OPERATOR",
        auctionId: auction.id,
        grantedBy: req.actor!.id,
      })
      .returning();

    await tx.insert(notifications).values({
      userId: parsed.data.userId,
      title: `Auction Operator Assigned: ${auction.name}`,
      message: "You have been granted live stage operator controls on /live-auction.",
      linkUrl: "/live-auction",
    });

    await recordAuditLog(tx, req.actor!.id, "ASSIGN_AUCTION_OPERATOR", "user_roles", row.id, {
      auctionId: auction.id,
      targetUserId: parsed.data.userId,
    });

    return [row];
  });

  broadcastSse("NOTIFICATION", { auctionId: auction.id }, [parsed.data.userId]);
  await broadcastAuctionUpdate("AUCTION_UPDATED", { operatorUserId: parsed.data.userId });
  res.status(201).json({ operator: created });
});

router.delete("/operators/:userId", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({
      error: "Only the Sports Secretary or Faculty Advisor can revoke Auction Operators.",
    });
    return;
  }

  const targetUserId = Number(req.params.userId);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    res.status(400).json({ error: "Invalid user ID." });
    return;
  }

  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }

  const deactivated = await db.transaction(async (tx) => {
    const updatedRows = await tx
      .update(userRoles)
      .set({ active: false })
      .where(
        and(
          eq(userRoles.userId, targetUserId),
          inArray(userRoles.roleCode, ["AUCTION_OPERATOR", "AUCTIONEER"]),
          eq(userRoles.active, true),
          or(isNull(userRoles.auctionId), eq(userRoles.auctionId, auction.id))
        )
      )
      .returning();

    if (updatedRows.length > 0) {
      await tx.insert(notifications).values({
        userId: targetUserId,
        title: `Auction Operator Revoked: ${auction.name}`,
        message: "Your live stage auction operator access has been revoked.",
        linkUrl: "/auction",
      });
      await recordAuditLog(tx, req.actor!.id, "REVOKE_AUCTION_OPERATOR", "users", targetUserId, {
        auctionId: auction.id,
      });
    }
    return updatedRows;
  });

  if (deactivated.length === 0) {
    res.status(404).json({ error: "No active Auction Operator assignment found for this user." });
    return;
  }

  broadcastSse("NOTIFICATION", { auctionId: auction.id }, [targetUserId]);
  await broadcastAuctionUpdate("AUCTION_UPDATED", { revokedUserId: targetUserId });
  res.json({ ok: true });
});

// ============================================================================
// SINGLE-OPERATOR LIVE STAGE COMMANDS (AUCTION_OPERATOR / SPORTS_SECRETARY)
// ============================================================================

router.post("/context", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  if (!canOperateAuction(req.actor, auction.id)) {
    res.status(403).json({ error: "Only the Auction Operator or Sports Secretary can switch stage context." });
    return;
  }
  const schema = z.object({
    sportId: z.number().int().positive().optional(),
    roundId: z.number().int().positive().nullable().optional(),
    track: z.enum(["COMBINED", "BOYS", "GIRLS"]).optional(),
    expectedVersion: z.number().int().positive().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid context payload." });
    return;
  }
  if (checkVersionConflict(res, auction, parsed.data.expectedVersion)) return;

  const outcome = await db.transaction(async (tx) => {
    const [lockedAuction] = await tx
      .select()
      .from(auctions)
      .where(eq(auctions.id, auction.id))
      .for("update")
      .limit(1);
    if (!lockedAuction) {
      return { ok: false as const, status: 404, error: "Auction not found." };
    }
    if (
      parsed.data.expectedVersion !== undefined &&
      lockedAuction.version !== parsed.data.expectedVersion
    ) {
      return {
        ok: false as const,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state.",
      };
    }

    const switchingSport = parsed.data.sportId && parsed.data.sportId !== lockedAuction.activeSportId;

    if (switchingSport && lockedAuction.activePlayerId) {
      await tx
        .update(auctionRegistrations)
        .set({ status: "ELIGIBLE" })
        .where(
          and(
            eq(auctionRegistrations.id, lockedAuction.activePlayerId),
            eq(auctionRegistrations.status, "IN_AUCTION")
          )
        );
    }
    if (parsed.data.roundId) {
      await tx.update(auctionRounds).set({ active: false }).where(eq(auctionRounds.auctionId, lockedAuction.id));
      await tx.update(auctionRounds).set({ active: true }).where(eq(auctionRounds.id, parsed.data.roundId));
    }

    const [updatedAuc] = await tx
      .update(auctions)
      .set({
        ...(parsed.data.sportId ? { activeSportId: parsed.data.sportId } : {}),
        ...(parsed.data.roundId !== undefined ? { activeRoundId: parsed.data.roundId } : {}),
        ...(parsed.data.track ? { activeTrack: parsed.data.track } : {}),
        ...(switchingSport ? { activePlayerId: null, projectorMode: "STAGE" } : {}),
        version: lockedAuction.version + 1,
      })
      .where(and(eq(auctions.id, lockedAuction.id), eq(auctions.version, lockedAuction.version)))
      .returning();

    if (!updatedAuc) {
      return {
        ok: false as const,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state.",
      };
    }
    return { ok: true as const };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }

  await broadcastAuctionUpdate("AUCTION_STAGE", { sportId: parsed.data.sportId ?? auction.activeSportId });
  res.json({ ok: true });
});

router.post("/next-player", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  if (!canOperateAuction(req.actor, auction.id)) {
    res.status(403).json({ error: "Only the Auction Operator or Sports Secretary can stage players." });
    return;
  }

  const schema = z.object({
    auctionPlayerId: z.number().int().positive().optional(),
    sportId: z.number().int().positive().optional(),
    expectedVersion: z.number().int().positive().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid next-player payload." });
    return;
  }
  if (checkVersionConflict(res, auction, parsed.data.expectedVersion)) return;

  const targetSportId = parsed.data.sportId ?? auction.activeSportId;
  if (!targetSportId) {
    res.status(400).json({ error: "Select an active sport first." });
    return;
  }

  const [activeRound] = auction.activeRoundId
    ? await db.select().from(auctionRounds).where(eq(auctionRounds.id, auction.activeRoundId)).limit(1)
    : [];

  const activeCaptainIds = await getActiveCaptainUserIds(auction.id);
  let captainProfileIds = new Set<number>();
  if (activeCaptainIds.size > 0) {
    const capProfs = await db
      .select({ id: playerProfiles.id })
      .from(playerProfiles)
      .where(inArray(playerProfiles.userId, Array.from(activeCaptainIds)));
    captainProfileIds = new Set(capProfs.map((p) => p.id));
  }

  const targetTrack =
    auction.splitMode === "SEPARATE_BOYS_GIRLS"
      ? auction.activeTrack === "GIRLS"
        ? "GIRLS"
        : "BOYS"
      : null;

  let nextReg: typeof auctionRegistrations.$inferSelect | undefined;
  if (parsed.data.auctionPlayerId) {
    [nextReg] = await db
      .select()
      .from(auctionRegistrations)
      .where(
        and(
          eq(auctionRegistrations.id, parsed.data.auctionPlayerId),
          eq(auctionRegistrations.auctionId, auction.id),
          eq(auctionRegistrations.sportId, targetSportId)
        )
      )
      .limit(1);
    if (!nextReg || nextReg.status === "SOLD" || nextReg.status === "INELIGIBLE") {
      res.status(400).json({ error: "Selected player cannot be staged (already SOLD or INELIGIBLE)." });
      return;
    }
    if (targetTrack && nextReg.track !== targetTrack) {
      res.status(400).json({ error: `Selected player is in ${nextReg.track} track (active track: ${targetTrack}).` });
      return;
    }
    if (captainProfileIds.has(nextReg.playerProfileId)) {
      res.status(400).json({ error: "Active team captains cannot be staged onto the auction block." });
      return;
    }
  } else {
    const eligibleStatuses =
      activeRound?.roundType === "UNSOLD" || activeRound?.roundType === "ACCELERATED"
        ? ["UNSOLD", "ELIGIBLE", "REGISTERED"]
        : ["ELIGIBLE", "REGISTERED"];
    const pool = (
      await db
        .select()
        .from(auctionRegistrations)
        .where(
          and(
            eq(auctionRegistrations.auctionId, auction.id),
            eq(auctionRegistrations.sportId, targetSportId),
            inArray(auctionRegistrations.status, eligibleStatuses),
            ...(targetTrack ? [eq(auctionRegistrations.track, targetTrack)] : [])
          )
        )
        .orderBy(asc(auctionRegistrations.id))
    ).filter((p) => !captainProfileIds.has(p.playerProfileId));

    const roundMatched =
      activeRound && pool.some((p) => p.roundId === activeRound.id)
        ? pool.filter((p) => p.roundId === activeRound.id)
        : pool;

    // Prioritize MARQUEE -> TIER_1 -> STANDARD
    const tierOrder: Record<string, number> = { MARQUEE: 0, TIER_1: 1, STANDARD: 2 };
    roundMatched.sort((a, b) => (tierOrder[a.tier] ?? 9) - (tierOrder[b.tier] ?? 9) || a.id - b.id);
    nextReg = roundMatched[0];
  }

  if (!nextReg) {
    res.status(404).json({ error: "No eligible players remaining in this sport pool." });
    return;
  }

  const stageOutcome = await db.transaction(async (tx) => {
    const [lockedAuction] = await tx
      .select()
      .from(auctions)
      .where(eq(auctions.id, auction.id))
      .for("update")
      .limit(1);
    if (!lockedAuction) {
      return { ok: false as const, status: 404, error: "Auction not found." };
    }
    if (
      parsed.data.expectedVersion !== undefined &&
      lockedAuction.version !== parsed.data.expectedVersion
    ) {
      return {
        ok: false as const,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state.",
      };
    }

    if (lockedAuction.activePlayerId && lockedAuction.activePlayerId !== nextReg!.id) {
      await tx
        .update(auctionRegistrations)
        .set({ status: "ELIGIBLE" })
        .where(
          and(
            eq(auctionRegistrations.id, lockedAuction.activePlayerId),
            eq(auctionRegistrations.status, "IN_AUCTION")
          )
        );
    }

    await tx
      .update(auctionRegistrations)
      .set({ status: "IN_AUCTION" })
      .where(eq(auctionRegistrations.id, nextReg!.id));

    const [updatedAuc] = await tx
      .update(auctions)
      .set({
        activeSportId: targetSportId,
        activePlayerId: nextReg!.id,
        projectorMode: "STAGE",
        projectorPaused: false,
        version: lockedAuction.version + 1,
      })
      .where(and(eq(auctions.id, lockedAuction.id), eq(auctions.version, lockedAuction.version)))
      .returning();

    if (!updatedAuc) {
      return {
        ok: false as const,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state.",
      };
    }
    return { ok: true as const };
  });

  if (!stageOutcome.ok) {
    res.status(stageOutcome.status).json({ error: stageOutcome.error });
    return;
  }

  await broadcastAuctionUpdate("AUCTION_STAGE", {
    sportId: targetSportId,
    activePlayerId: nextReg.id,
  });
  res.json({ activePlayer: nextReg });
});

router.post("/bid", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  if (!canOperateAuction(req.actor, auction.id)) {
    res.status(403).json({ error: "Only the Auction Operator or Sports Secretary can place live stage bids." });
    return;
  }
  if (auction.status !== "LIVE") {
    res.status(400).json({ error: "Auction status must be LIVE to record stage bids." });
    return;
  }
  if (!auction.activePlayerId || !auction.activeSportId) {
    res.status(400).json({ error: "No player currently on the live stage." });
    return;
  }

  const schema = z.object({
    franchiseId: z.number().int().positive(),
    bidType: z.enum(["INCREMENT", "JUMP", "CUSTOM"]).default("INCREMENT"),
    amount: z.number().int().positive().optional(),
    expectedVersion: z.number().int().positive().optional(),
    idempotencyKey: z.string().min(4).max(120).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid bid payload." });
    return;
  }
  if (checkVersionConflict(res, auction, parsed.data.expectedVersion)) return;

  const idemKey = extractIdempotencyKey(req);

  const outcome = await db.transaction(async (tx) => {
    if (idemKey) {
      const prior = await findIdempotencyRecord(tx, "AUCTION_BID", idemKey);
      if (prior) {
        return {
          ok: true as const,
          replayed: true as const,
          statusCode: prior.statusCode,
          responseJson: prior.responseJson,
        };
      }
      const [existingBid] = await tx
        .select()
        .from(auctionBids)
        .where(eq(auctionBids.idempotencyKey, idemKey))
        .limit(1);
      if (existingBid) {
        return {
          ok: true as const,
          replayed: true as const,
          statusCode: 201,
          responseJson: { bid: existingBid } as unknown as Record<string, unknown>,
        };
      }
    }

    const [lockedAuction] = await tx
      .select()
      .from(auctions)
      .where(eq(auctions.id, auction.id))
      .for("update")
      .limit(1);

    if (!lockedAuction || lockedAuction.status !== "LIVE") {
      return { ok: false as const, status: 400, error: "Auction status must be LIVE to record stage bids." };
    }
    if (
      parsed.data.expectedVersion !== undefined &&
      lockedAuction.version !== parsed.data.expectedVersion
    ) {
      return {
        ok: false as const,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state.",
      };
    }
    if (!lockedAuction.activePlayerId) {
      return { ok: false as const, status: 400, error: "No player currently on the live stage." };
    }

    const [player] = await tx
      .select()
      .from(auctionRegistrations)
      .where(eq(auctionRegistrations.id, lockedAuction.activePlayerId))
      .for("update")
      .limit(1);
    if (!player || player.status !== "IN_AUCTION") {
      return { ok: false as const, status: 400, error: "Active player is not in live bidding." };
    }

    const [franchise] = await tx
      .select()
      .from(auctionFranchises)
      .where(
        and(
          eq(auctionFranchises.id, parsed.data.franchiseId),
          eq(auctionFranchises.auctionId, lockedAuction.id),
          eq(auctionFranchises.sportId, player.sportId)
        )
      )
      .for("update")
      .limit(1);
    if (!franchise) {
      return { ok: false as const, status: 404, error: "Franchise not found for the active sport." };
    }
    if (lockedAuction.splitMode === "SEPARATE_BOYS_GIRLS" && franchise.track !== player.track) {
      return {
        ok: false as const,
        status: 400,
        error: `Track mismatch: ${franchise.name} (${franchise.track}) cannot bid on ${player.track} player.`,
      };
    }
    if (franchise.status !== "APPROVED") {
      return {
        ok: false as const,
        status: 403,
        error: "Franchise is not approved for live auction bidding.",
      };
    }

    const [latestBid] = await tx
      .select()
      .from(auctionBids)
      .where(
        and(
          eq(auctionBids.auctionPlayerId, player.id),
          eq(auctionBids.undone, false)
        )
      )
      .orderBy(desc(auctionBids.id))
      .limit(1);

    if (latestBid && latestBid.franchiseId === franchise.id) {
      return { ok: false as const, status: 400, error: `${franchise.shortCode} already holds the highest bid.` };
    }

    let bidAmount: number;
    if (!latestBid) {
      if (parsed.data.bidType === "CUSTOM" && parsed.data.amount !== undefined) {
        bidAmount = parsed.data.amount;
      } else if (parsed.data.bidType === "JUMP") {
        bidAmount = player.basePrice + (parsed.data.amount ?? lockedAuction.jumpIncrement);
      } else {
        bidAmount = player.basePrice;
      }
      if (bidAmount < player.basePrice) {
        return {
          ok: false as const,
          status: 400,
          error: `Opening bid must be at least base price (₹${player.basePrice}).`,
        };
      }
    } else {
      const step =
        parsed.data.bidType === "JUMP"
          ? parsed.data.amount ?? lockedAuction.jumpIncrement
          : getIncrementalStep(lockedAuction, latestBid.amount);
      bidAmount =
        parsed.data.bidType === "CUSTOM" && parsed.data.amount !== undefined
          ? parsed.data.amount
          : latestBid.amount + step;
      if (bidAmount <= latestBid.amount) {
        return {
          ok: false as const,
          status: 400,
          error: `Bid must exceed current highest bid (₹${latestBid.amount}).`,
        };
      }
    }

    const guard = await computeFranchiseGuardrail(
      tx,
      lockedAuction,
      franchise,
      player.playerClass === "CLUB" ? "CLUB" : "NON_CLUB"
    );
    if (!guard.eligible || bidAmount > guard.maxAllowedBid) {
      return {
        ok: false as const,
        status: 400,
        error:
          guard.reason && !guard.eligible
            ? `${franchise.shortCode}: ${guard.reason}`
            : `${franchise.shortCode} max legal bid is ₹${guard.maxAllowedBid} (reserve ₹${guard.requiredReserve} required for remaining quota slots).`,
      };
    }

    const [createdBid] = await tx
      .insert(auctionBids)
      .values({
        auctionId: lockedAuction.id,
        sportId: player.sportId,
        auctionPlayerId: player.id,
        franchiseId: franchise.id,
        amount: bidAmount,
        bidType: parsed.data.bidType,
        idempotencyKey:
          idemKey ?? `bid-${player.id}-${franchise.id}-${crypto.randomUUID()}`,
        createdBy: req.actor!.id,
      })
      .returning();

    await tx
      .update(auctions)
      .set({ projectorMode: "STAGE", version: lockedAuction.version + 1 })
      .where(and(eq(auctions.id, lockedAuction.id), eq(auctions.version, lockedAuction.version)));

    const responseJson = { bid: createdBid } as unknown as Record<string, unknown>;
    if (idemKey) {
      await saveIdempotencyRecord(tx, {
        scope: "AUCTION_BID",
        key: idemKey,
        actorUserId: req.actor!.id,
        statusCode: 201,
        responseJson,
      });
    }

    return { ok: true as const, replayed: false as const, bid: createdBid };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  if (outcome.replayed) {
    res.status(outcome.statusCode).json(outcome.responseJson);
    return;
  }

  await broadcastAuctionUpdate("AUCTION_BID", {
    bid: outcome.bid,
    sportId: outcome.bid.sportId,
    auctionPlayerId: outcome.bid.auctionPlayerId,
    franchiseId: outcome.bid.franchiseId,
    amount: outcome.bid.amount,
    bidType: outcome.bid.bidType,
  });
  res.status(201).json({ bid: outcome.bid });
});

router.post("/undo", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  if (!canOperateAuction(req.actor, auction.id)) {
    res.status(403).json({ error: "Only the Auction Operator or Sports Secretary can undo bids." });
    return;
  }
  const schema = z.object({ expectedVersion: z.number().int().positive().optional() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid undo payload." });
    return;
  }
  if (checkVersionConflict(res, auction, parsed.data.expectedVersion)) return;

  if (!auction.activePlayerId) {
    res.status(400).json({ error: "No active player on stage to undo." });
    return;
  }

  const undone = await db.transaction(async (tx) => {
    const [lockedAuction] = await tx
      .select()
      .from(auctions)
      .where(eq(auctions.id, auction.id))
      .for("update")
      .limit(1);

    if (!lockedAuction) {
      return { ok: false as const, status: 404, error: "Auction not found." };
    }
    if (
      parsed.data.expectedVersion !== undefined &&
      lockedAuction.version !== parsed.data.expectedVersion
    ) {
      return {
        ok: false as const,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state.",
      };
    }
    if (!lockedAuction.activePlayerId) {
      return { ok: false as const, status: 400, error: "No active player on stage to undo." };
    }

    const [player] = await tx
      .select()
      .from(auctionRegistrations)
      .where(eq(auctionRegistrations.id, lockedAuction.activePlayerId))
      .for("update")
      .limit(1);

    // If active player was already SOLD/UNSOLD on stage, revert the outcome cleanly
    if (player && (player.status === "SOLD" || player.status === "UNSOLD")) {
      if (player.status === "SOLD" && player.soldFranchiseId && player.soldPrice) {
        const [franchise] = await tx
          .select()
          .from(auctionFranchises)
          .where(eq(auctionFranchises.id, player.soldFranchiseId))
          .for("update")
          .limit(1);
        if (franchise) {
          await tx
            .update(auctionFranchises)
            .set({ remainingPurse: franchise.remainingPurse + player.soldPrice })
            .where(eq(auctionFranchises.id, franchise.id));
          if (franchise.tournamentTeamId) {
            await tx
              .delete(teamRosters)
              .where(
                and(
                  eq(teamRosters.teamId, franchise.tournamentTeamId),
                  eq(teamRosters.playerProfileId, player.playerProfileId)
                )
              );
          }
        }
        // If this sale was acquired via RTM, mark the RTM bid undone and restore RTM eligibility
        const [rtmBid] = await tx
          .select()
          .from(auctionBids)
          .where(
            and(
              eq(auctionBids.auctionPlayerId, player.id),
              eq(auctionBids.franchiseId, player.soldFranchiseId),
              eq(auctionBids.bidType, "RTM"),
              eq(auctionBids.undone, false)
            )
          )
          .orderBy(desc(auctionBids.id))
          .limit(1);
        if (rtmBid) {
          await tx
            .update(auctionBids)
            .set({ undone: true })
            .where(eq(auctionBids.id, rtmBid.id));
          await tx
            .update(rtmEligibility)
            .set({ used: false })
            .where(
              and(
                eq(rtmEligibility.seasonYear, lockedAuction.seasonYear),
                eq(rtmEligibility.sportId, player.sportId),
                eq(rtmEligibility.playerProfileId, player.playerProfileId),
                eq(rtmEligibility.previousFranchiseId, player.soldFranchiseId)
              )
            );
        }
      }
      await tx
        .update(auctionRegistrations)
        .set({ status: "IN_AUCTION", soldFranchiseId: null, soldPrice: null })
        .where(eq(auctionRegistrations.id, player.id));
      await tx
        .update(auctions)
        .set({ projectorMode: "STAGE", version: lockedAuction.version + 1 })
        .where(and(eq(auctions.id, lockedAuction.id), eq(auctions.version, lockedAuction.version)));
      return { ok: true as const, data: { revertedOutcome: player.status } };
    }

    const [latestBid] = await tx
      .select()
      .from(auctionBids)
      .where(
        and(
          eq(auctionBids.auctionPlayerId, lockedAuction.activePlayerId),
          eq(auctionBids.undone, false)
        )
      )
      .orderBy(desc(auctionBids.id))
      .limit(1);

    if (!latestBid) {
      return { ok: false as const, status: 400, error: "No active bid or outcome to undo for the staged player." };
    }

    await tx
      .update(auctionBids)
      .set({ undone: true })
      .where(eq(auctionBids.id, latestBid.id));
    await tx
      .update(auctions)
      .set({ projectorMode: "STAGE", version: lockedAuction.version + 1 })
      .where(and(eq(auctions.id, lockedAuction.id), eq(auctions.version, lockedAuction.version)));

    return { ok: true as const, data: { undoneBidId: latestBid.id } };
  });

  if (!undone.ok) {
    res.status(undone.status).json({ error: undone.error });
    return;
  }

  await broadcastAuctionUpdate("AUCTION_BID", { undone: undone.data });
  res.json({ ok: true, ...undone.data });
});

async function syncSoldPlayerToTournamentTeam(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  auction: typeof auctions.$inferSelect,
  franchise: typeof auctionFranchises.$inferSelect,
  player: typeof auctionRegistrations.$inferSelect,
  soldPrice: number
) {
  let targetTournamentId = auction.tournamentId;
  if (!targetTournamentId) {
    const [curT] = await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.isCurrent, true))
      .limit(1);
    targetTournamentId = curT?.id ?? null;
  }
  if (!targetTournamentId) return;

  let teamId = franchise.tournamentTeamId;
  if (!teamId) {
    const [existingTeam] = await tx
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.tournamentId, targetTournamentId),
          eq(teams.sportId, franchise.sportId),
          eq(teams.shortCode, franchise.shortCode)
        )
      )
      .limit(1);
    if (existingTeam) {
      teamId = existingTeam.id;
    } else {
      const [createdTeam] = await tx
        .insert(teams)
        .values({
          tournamentId: targetTournamentId,
          sportId: franchise.sportId,
          name: franchise.name,
          shortCode: franchise.shortCode,
          accentColor: franchise.accentColor,
          captainUserId: franchise.captainUserId,
          franchiseId: franchise.id,
          submissionStatus: "APPROVED",
          reviewedBy: franchise.captainUserId ?? null,
        })
        .returning();
      teamId = createdTeam.id;
    }
    await tx
      .update(auctionFranchises)
      .set({ tournamentTeamId: teamId })
      .where(eq(auctionFranchises.id, franchise.id));
  }

  await tx
    .insert(teamRosters)
    .values({
      teamId,
      playerProfileId: player.playerProfileId,
      playingRole: player.positionsJson[0] ?? null,
      playerClass: player.playerClass,
      soldPrice,
    })
    .onConflictDoUpdate({
      target: [teamRosters.teamId, teamRosters.playerProfileId],
      set: {
        playingRole: player.positionsJson[0] ?? null,
        playerClass: player.playerClass,
        soldPrice,
      },
    });
}

router.post("/outcome", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  if (!canOperateAuction(req.actor, auction.id)) {
    res.status(403).json({ error: "Only the Auction Operator or Sports Secretary can mark SOLD / UNSOLD." });
    return;
  }
  if (!auction.activePlayerId) {
    res.status(400).json({ error: "No active player on stage." });
    return;
  }

  const schema = z.object({
    outcome: z.enum(["SOLD", "UNSOLD"]),
    expectedVersion: z.number().int().positive().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid outcome payload." });
    return;
  }
  if (checkVersionConflict(res, auction, parsed.data.expectedVersion)) return;

  const idemKey = extractIdempotencyKey(req);

  const result = await db.transaction(async (tx) => {
    if (idemKey) {
      const cached = await findIdempotencyRecord(tx, "AUCTION_OUTCOME", idemKey);
      if (cached) {
        return {
          ok: true as const,
          replayed: true as const,
          statusCode: cached.statusCode,
          responseJson: cached.responseJson,
        };
      }
    }

    const [lockedAuction] = await tx
      .select()
      .from(auctions)
      .where(eq(auctions.id, auction.id))
      .for("update")
      .limit(1);

    if (!lockedAuction) {
      return { ok: false as const, status: 404, error: "Auction not found." };
    }
    if (
      parsed.data.expectedVersion !== undefined &&
      lockedAuction.version !== parsed.data.expectedVersion
    ) {
      return {
        ok: false as const,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state.",
      };
    }
    if (!lockedAuction.activePlayerId) {
      return { ok: false as const, status: 400, error: "No active player on stage." };
    }

    const [player] = await tx
      .select()
      .from(auctionRegistrations)
      .where(eq(auctionRegistrations.id, lockedAuction.activePlayerId))
      .for("update")
      .limit(1);
    if (!player || player.status !== "IN_AUCTION") {
      return { ok: false as const, status: 400, error: "Staged player is not currently IN_AUCTION." };
    }

    if (parsed.data.outcome === "UNSOLD") {
      const [updatedReg] = await tx
        .update(auctionRegistrations)
        .set({ status: "UNSOLD", soldFranchiseId: null, soldPrice: null })
        .where(eq(auctionRegistrations.id, player.id))
        .returning();
      await tx
        .update(auctions)
        .set({ projectorMode: "UNSOLD", version: lockedAuction.version + 1 })
        .where(and(eq(auctions.id, lockedAuction.id), eq(auctions.version, lockedAuction.version)));
      await recordAuditLog(tx, req.actor!.id, "AUCTION_UNSOLD", "auction_registrations", player.id, {});
      const responseJson = { ok: true, registration: updatedReg } as unknown as Record<string, unknown>;
      if (idemKey) {
        await saveIdempotencyRecord(tx, {
          scope: "AUCTION_OUTCOME",
          key: idemKey,
          actorUserId: req.actor!.id,
          statusCode: 200,
          responseJson,
        });
      }
      return { ok: true as const, replayed: false as const, registration: updatedReg, soldToUserId: null };
    }

    const [leadingBid] = await tx
      .select()
      .from(auctionBids)
      .where(and(eq(auctionBids.auctionPlayerId, player.id), eq(auctionBids.undone, false)))
      .orderBy(desc(auctionBids.id))
      .limit(1);

    if (!leadingBid || !leadingBid.franchiseId) {
      return { ok: false as const, status: 400, error: "Cannot mark SOLD without at least one valid bid." };
    }

    const [franchise] = await tx
      .select()
      .from(auctionFranchises)
      .where(eq(auctionFranchises.id, leadingBid.franchiseId))
      .for("update")
      .limit(1);
    if (!franchise) {
      return { ok: false as const, status: 404, error: "Winning franchise not found." };
    }

    const guard = await computeFranchiseGuardrail(
      tx,
      lockedAuction,
      franchise,
      player.playerClass === "CLUB" ? "CLUB" : "NON_CLUB"
    );
    if (!guard.eligible || leadingBid.amount > guard.maxAllowedBid) {
      return { ok: false as const, status: 400, error: "Winning bid exceeds franchise purse/quota guardrail." };
    }

    await tx
      .update(auctionFranchises)
      .set({ remainingPurse: franchise.remainingPurse - leadingBid.amount })
      .where(eq(auctionFranchises.id, franchise.id));

    const [updatedReg] = await tx
      .update(auctionRegistrations)
      .set({
        status: "SOLD",
        soldFranchiseId: franchise.id,
        soldPrice: leadingBid.amount,
      })
      .where(eq(auctionRegistrations.id, player.id))
      .returning();

    await syncSoldPlayerToTournamentTeam(tx, lockedAuction, franchise, player, leadingBid.amount);

    await tx
      .update(auctions)
      .set({ projectorMode: "SOLD", version: lockedAuction.version + 1 })
      .where(and(eq(auctions.id, lockedAuction.id), eq(auctions.version, lockedAuction.version)));

    const [prof] = await tx
      .select({ userId: playerProfiles.userId })
      .from(playerProfiles)
      .where(eq(playerProfiles.id, player.playerProfileId))
      .limit(1);

    if (prof?.userId) {
      await tx.insert(notifications).values({
        userId: prof.userId,
        title: `Auction SOLD: ${franchise.name}`,
        message: `You were signed by ${franchise.name} (${franchise.shortCode}) for ₹${leadingBid.amount}.`,
        linkUrl: "/live-auction",
      });
    }

    await recordAuditLog(tx, req.actor!.id, "AUCTION_SOLD", "auction_registrations", player.id, {
      franchiseId: franchise.id,
      soldPrice: leadingBid.amount,
    });

    const responseJson = { ok: true, registration: updatedReg } as unknown as Record<string, unknown>;
    if (idemKey) {
      await saveIdempotencyRecord(tx, {
        scope: "AUCTION_OUTCOME",
        key: idemKey,
        actorUserId: req.actor!.id,
        statusCode: 200,
        responseJson,
      });
    }

    return { ok: true as const, replayed: false as const, registration: updatedReg, soldToUserId: prof?.userId ?? null };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  if (result.replayed) {
    res.status(result.statusCode).json(result.responseJson);
    return;
  }

  if (result.soldToUserId) {
    broadcastSse("NOTIFICATION", { auctionOutcome: parsed.data.outcome }, [result.soldToUserId]);
  }
  await broadcastAuctionUpdate("AUCTION_OUTCOME", {
    outcome: parsed.data.outcome,
    registration: result.registration,
  });
  res.json({ ok: true, registration: result.registration });
});

router.post("/rtm", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  if (!canOperateAuction(req.actor, auction.id)) {
    res.status(403).json({ error: "Only the Auction Operator or Sports Secretary can exercise RTM." });
    return;
  }
  if (!auction.activePlayerId) {
    res.status(400).json({ error: "No active player on stage." });
    return;
  }

  const schema = z.object({
    franchiseId: z.number().int().positive(),
    expectedVersion: z.number().int().positive().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid RTM payload." });
    return;
  }
  if (checkVersionConflict(res, auction, parsed.data.expectedVersion)) return;

  const idemKey = extractIdempotencyKey(req);

  const outcome = await db.transaction(async (tx) => {
    if (idemKey) {
      const prior = await findIdempotencyRecord(tx, "AUCTION_RTM", idemKey);
      if (prior) {
        return {
          ok: true as const,
          replayed: true as const,
          statusCode: prior.statusCode,
          responseJson: prior.responseJson,
        };
      }
    }

    const [lockedAuction] = await tx
      .select()
      .from(auctions)
      .where(eq(auctions.id, auction.id))
      .for("update")
      .limit(1);
    if (!lockedAuction) {
      return { ok: false as const, status: 404, error: "Auction not found." };
    }
    if (lockedAuction.status !== "LIVE") {
      return { ok: false as const, status: 400, error: "Auction status must be LIVE to exercise RTM." };
    }
    if (!lockedAuction.rtmEnabled) {
      return { ok: false as const, status: 400, error: "RTM is disabled for this auction." };
    }
    if (
      parsed.data.expectedVersion !== undefined &&
      lockedAuction.version !== parsed.data.expectedVersion
    ) {
      return {
        ok: false as const,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state.",
      };
    }
    if (!lockedAuction.activePlayerId) {
      return { ok: false as const, status: 400, error: "No active player on stage." };
    }

    const [player] = await tx
      .select()
      .from(auctionRegistrations)
      .where(eq(auctionRegistrations.id, lockedAuction.activePlayerId))
      .for("update")
      .limit(1);
    if (!player) {
      return { ok: false as const, status: 404, error: "Active player not found." };
    }
    if (player.status !== "IN_AUCTION" && player.status !== "SOLD") {
      return { ok: false as const, status: 400, error: "Player is not eligible for RTM in current state." };
    }

    const [rtm] = await tx
      .select()
      .from(rtmEligibility)
      .where(
        and(
          eq(rtmEligibility.seasonYear, lockedAuction.seasonYear),
          eq(rtmEligibility.sportId, player.sportId),
          eq(rtmEligibility.playerProfileId, player.playerProfileId),
          eq(rtmEligibility.previousFranchiseId, parsed.data.franchiseId),
          eq(rtmEligibility.used, false)
        )
      )
      .for("update")
      .limit(1);
    if (!rtm) {
      return { ok: false as const, status: 400, error: "RTM is not eligible for this franchise and player." };
    }

    // Lock involved franchises in deterministic ascending ID order to prevent deadlocks
    const franchiseIdsToLock = Array.from(
      new Set(
        [parsed.data.franchiseId, player.soldFranchiseId].filter(
          (id): id is number => id !== null && id !== undefined
        )
      )
    ).sort((a, b) => a - b);

    const lockedFranchises = await tx
      .select()
      .from(auctionFranchises)
      .where(inArray(auctionFranchises.id, franchiseIdsToLock))
      .orderBy(asc(auctionFranchises.id))
      .for("update");

    const rtmFranchise = lockedFranchises.find(
      (f) => f.id === parsed.data.franchiseId && f.sportId === player.sportId && f.auctionId === lockedAuction.id
    );
    if (!rtmFranchise) {
      return { ok: false as const, status: 404, error: "RTM franchise not found for this sport." };
    }
    if (rtmFranchise.status !== "APPROVED") {
      return {
        ok: false as const,
        status: 403,
        error: "RTM franchise is not approved for auction participation.",
      };
    }

    const matchPrice =
      player.soldPrice ??
      (
        await tx
          .select()
          .from(auctionBids)
          .where(and(eq(auctionBids.auctionPlayerId, player.id), eq(auctionBids.undone, false)))
          .orderBy(desc(auctionBids.id))
          .limit(1)
      )[0]?.amount ??
      player.basePrice;

    // Refund previous winning franchise if RTM exercised right after SOLD
    if (player.status === "SOLD" && player.soldFranchiseId && player.soldPrice) {
      if (player.soldFranchiseId === rtmFranchise.id) {
        return { ok: false as const, status: 400, error: "Franchise already won the player." };
      }
      const prevF = lockedFranchises.find((f) => f.id === player.soldFranchiseId);
      if (prevF) {
        await tx
          .update(auctionFranchises)
          .set({ remainingPurse: prevF.remainingPurse + player.soldPrice })
          .where(eq(auctionFranchises.id, prevF.id));
        if (prevF.tournamentTeamId) {
          await tx
            .delete(teamRosters)
            .where(
              and(
                eq(teamRosters.teamId, prevF.tournamentTeamId),
                eq(teamRosters.playerProfileId, player.playerProfileId)
              )
            );
        }
      }
    }

    const guard = await computeFranchiseGuardrail(
      tx,
      lockedAuction,
      rtmFranchise,
      player.playerClass === "CLUB" ? "CLUB" : "NON_CLUB"
    );
    if (!guard.eligible || matchPrice > guard.maxAllowedBid) {
      return { ok: false as const, status: 400, error: "RTM franchise exceeds max allowed bid guardrail." };
    }

    await tx
      .update(auctionFranchises)
      .set({ remainingPurse: rtmFranchise.remainingPurse - matchPrice })
      .where(eq(auctionFranchises.id, rtmFranchise.id));

    await tx.insert(auctionBids).values({
      auctionId: lockedAuction.id,
      sportId: player.sportId,
      auctionPlayerId: player.id,
      franchiseId: rtmFranchise.id,
      amount: matchPrice,
      bidType: "RTM",
      idempotencyKey: idemKey ?? `rtm-${player.id}-${rtmFranchise.id}-${crypto.randomUUID()}`,
      createdBy: req.actor!.id,
    });

    const [updatedReg] = await tx
      .update(auctionRegistrations)
      .set({ status: "SOLD", soldFranchiseId: rtmFranchise.id, soldPrice: matchPrice })
      .where(eq(auctionRegistrations.id, player.id))
      .returning();

    await tx.update(rtmEligibility).set({ used: true }).where(eq(rtmEligibility.id, rtm.id));

    await syncSoldPlayerToTournamentTeam(tx, lockedAuction, rtmFranchise, player, matchPrice);

    const [updatedAuc] = await tx
      .update(auctions)
      .set({ projectorMode: "SOLD", version: lockedAuction.version + 1 })
      .where(and(eq(auctions.id, lockedAuction.id), eq(auctions.version, lockedAuction.version)))
      .returning();

    if (!updatedAuc) {
      return {
        ok: false as const,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state.",
      };
    }

    await recordAuditLog(tx, req.actor!.id, "AUCTION_RTM", "auction_registrations", player.id, {
      franchiseId: rtmFranchise.id,
      matchPrice,
      rtmEligibilityId: rtm.id,
    });

    const responseJson = { ok: true, registration: updatedReg } as unknown as Record<string, unknown>;
    if (idemKey) {
      await saveIdempotencyRecord(tx, {
        scope: "AUCTION_RTM",
        key: idemKey,
        actorUserId: req.actor!.id,
        statusCode: 200,
        responseJson,
      });
    }

    return { ok: true as const, replayed: false as const, registration: updatedReg };
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  if (outcome.replayed) {
    res.status(outcome.statusCode).json(outcome.responseJson);
    return;
  }

  await broadcastAuctionUpdate("AUCTION_OUTCOME", {
    outcome: "SOLD",
    rtm: true,
    registration: outcome.registration,
  });
  res.json({ ok: true, registration: outcome.registration });
});

router.post("/projector", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "Auction not found." });
    return;
  }
  if (!canOperateAuction(req.actor, auction.id)) {
    res.status(403).json({ error: "Only the Auction Operator or Sports Secretary can control projector mode." });
    return;
  }

  const schema = z.object({
    mode: z.enum(["STAGE", "SOLD", "UNSOLD", "STANDINGS", "PAUSED"]),
    expectedVersion: z.number().int().positive().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid projector mode payload." });
    return;
  }
  if (checkVersionConflict(res, auction, parsed.data.expectedVersion)) return;

  const projOutcome = await db.transaction(async (tx) => {
    const [lockedAuction] = await tx
      .select()
      .from(auctions)
      .where(eq(auctions.id, auction.id))
      .for("update")
      .limit(1);
    if (!lockedAuction) {
      return { ok: false as const, status: 404, error: "Auction not found." };
    }
    if (
      parsed.data.expectedVersion !== undefined &&
      lockedAuction.version !== parsed.data.expectedVersion
    ) {
      return {
        ok: false as const,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state.",
      };
    }

    const [updatedAuc] = await tx
      .update(auctions)
      .set({
        projectorMode: parsed.data.mode,
        projectorPaused: parsed.data.mode === "PAUSED",
        version: lockedAuction.version + 1,
      })
      .where(and(eq(auctions.id, lockedAuction.id), eq(auctions.version, lockedAuction.version)))
      .returning();

    if (!updatedAuc) {
      return {
        ok: false as const,
        status: 409,
        error: "Auction stage updated concurrently (stale version). Refreshing state.",
      };
    }
    return { ok: true as const };
  });

  if (!projOutcome.ok) {
    res.status(projOutcome.status).json({ error: projOutcome.error });
    return;
  }

  await broadcastAuctionUpdate("AUCTION_PROJECTOR", { mode: parsed.data.mode });
  res.json({ ok: true, projectorMode: parsed.data.mode });
});

router.get("/team-registrations", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.json({ teamRegistrations: [] });
    return;
  }

  const sportId = req.query.sportId ? Number(req.query.sportId) : null;
  const isGlobalAdmin = hasGlobalSportsAuthority(req.actor);
  const conditions = [eq(auctionTeamRegistrations.auctionId, auction.id)];
  if (sportId && Number.isFinite(sportId)) {
    conditions.push(eq(auctionTeamRegistrations.sportId, sportId));
  }
  if (!isGlobalAdmin) {
    conditions.push(
      or(
        eq(auctionTeamRegistrations.submittedByUserId, req.actor!.id),
        eq(auctionTeamRegistrations.captainUserId, req.actor!.id)
      )!
    );
  }

  const rows = await db
    .select()
    .from(auctionTeamRegistrations)
    .where(and(...conditions))
    .orderBy(desc(auctionTeamRegistrations.createdAt), desc(auctionTeamRegistrations.id));

  const userIds = Array.from(
    new Set(
      rows
        .flatMap((r) => [r.submittedByUserId, r.captainUserId])
        .filter((id): id is number => id !== null)
    )
  );
  const [userRows, allSports] = await Promise.all([
    userIds.length > 0
      ? db.select({ id: users.id, name: users.name, rollNumber: users.rollNumber }).from(users).where(inArray(users.id, userIds))
      : Promise.resolve([]),
    db.select({ id: sports.id, name: sports.name }).from(sports),
  ]);
  const userMap = Object.fromEntries(userRows.map((u) => [u.id, u]));
  const sportMap = Object.fromEntries(allSports.map((s) => [s.id, s.name]));

  res.json({
    teamRegistrations: rows.map((r) => ({
      ...r,
      sportName: sportMap[r.sportId] ?? "Sport",
      submitterName: userMap[r.submittedByUserId]?.name ?? "User",
      captainName: r.captainUserId ? userMap[r.captainUserId]?.name ?? null : null,
    })),
  });
});

router.post("/team-registrations", requireAuth, async (req, res) => {
  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "No active Prothymos auction found." });
    return;
  }
  if (auction.status !== "REGISTRATION_OPEN") {
    res.status(400).json({ error: "Team registrations are closed because auction registration is not open." });
    return;
  }
  if (
    auction.registrationDeadline &&
    Date.now() > new Date(auction.registrationDeadline).getTime() &&
    !hasGlobalSportsAuthority(req.actor)
  ) {
    res.status(400).json({ error: "Auction team registration deadline has passed." });
    return;
  }

  const schema = z.object({
    sportId: z.number().int().positive(),
    track: z.enum(["COMBINED", "BOYS", "GIRLS"]).optional(),
    teamName: z.string().trim().min(2).max(80),
    shortCode: z.string().trim().min(2).max(8),
    accentColor: z.string().trim().min(4).max(20).optional(),
    captainUserId: z.number().int().positive().nullable().optional(),
    memberUserIds: z.array(z.number().int().positive()).max(20).optional(),
    rosterNotes: z.string().trim().max(400).nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid team registration payload." });
    return;
  }

  if (parsed.data.memberUserIds && parsed.data.memberUserIds.length > 0) {
    for (const memberUid of Array.from(new Set(parsed.data.memberUserIds))) {
      const memErr = await assertStudentCandidate(memberUid);
      if (memErr) {
        res.status(400).json({ error: memErr });
        return;
      }
    }
  }

  const cleanCode = parsed.data.shortCode.toUpperCase();
  const cleanName = parsed.data.teamName.trim();

  const [dupFranchise] = await db
    .select({ id: auctionFranchises.id })
    .from(auctionFranchises)
    .where(
      and(
        eq(auctionFranchises.auctionId, auction.id),
        eq(auctionFranchises.sportId, parsed.data.sportId),
        or(eq(auctionFranchises.shortCode, cleanCode), eq(auctionFranchises.name, cleanName))
      )
    )
    .limit(1);
  if (dupFranchise) {
    res.status(409).json({ error: "A franchise with that team name or short code already exists for this sport." });
    return;
  }

  const [dupPending] = await db
    .select({ id: auctionTeamRegistrations.id })
    .from(auctionTeamRegistrations)
    .where(
      and(
        eq(auctionTeamRegistrations.auctionId, auction.id),
        eq(auctionTeamRegistrations.sportId, parsed.data.sportId),
        eq(auctionTeamRegistrations.status, "PENDING_APPROVAL"),
        or(
          eq(auctionTeamRegistrations.shortCode, cleanCode),
          eq(auctionTeamRegistrations.teamName, cleanName)
        )
      )
    )
    .limit(1);
  if (dupPending) {
    res.status(409).json({ error: "A pending team registration with that name or code already exists." });
    return;
  }

  const resolvedCaptainId =
    parsed.data.captainUserId !== undefined
      ? parsed.data.captainUserId
      : req.actor!.accountType === "STUDENT"
      ? req.actor!.id
      : null;

  if (resolvedCaptainId) {
    const capErr = await assertStudentCandidate(resolvedCaptainId);
    if (capErr) {
      res.status(400).json({ error: capErr });
      return;
    }
  }

  const effectiveTeamTrack =
    auction.splitMode === "SEPARATE_BOYS_GIRLS"
      ? parsed.data.track === "GIRLS"
        ? "GIRLS"
        : "BOYS"
      : "COMBINED";

  const [created] = await db
    .insert(auctionTeamRegistrations)
    .values({
      auctionId: auction.id,
      sportId: parsed.data.sportId,
      track: effectiveTeamTrack,
      submittedByUserId: req.actor!.id,
      teamName: cleanName,
      shortCode: cleanCode,
      accentColor: parsed.data.accentColor || "#D97706",
      captainUserId: resolvedCaptainId,
      memberUserIdsJson: parsed.data.memberUserIds ?? [],
      rosterNotes: parsed.data.rosterNotes?.trim() || null,
      status: "PENDING_APPROVAL",
    })
    .returning();

  await broadcastAuctionUpdate("AUCTION_UPDATED", { teamRegistrationId: created.id });
  res.status(201).json({ teamRegistration: created });
});

router.patch("/team-registrations/:id/review", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can review auction team registrations." });
    return;
  }

  const regId = parsePositiveIntId(req.params.id);
  if (!regId) {
    res.status(400).json({ error: "Invalid registration ID." });
    return;
  }
  const schema = z.object({
    decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
    reviewNote: z.string().trim().max(400).optional(),
    startingPurse: z.number().int().positive().optional(),
    captainUserId: z.number().int().positive().nullable().optional(),
    minSquad: z.number().int().min(1).max(30).optional(),
    maxSquad: z.number().int().min(1).max(40).optional(),
    minClubQuota: z.number().int().min(0).max(20).optional(),
    minNonClubQuota: z.number().int().min(0).max(20).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid team review payload." });
    return;
  }

  const [existing] = await db
    .select()
    .from(auctionTeamRegistrations)
    .where(eq(auctionTeamRegistrations.id, regId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Team registration not found." });
    return;
  }

  if (parsed.data.captainUserId) {
    const capErr = await assertStudentCandidate(parsed.data.captainUserId);
    if (capErr) {
      res.status(400).json({ error: capErr });
      return;
    }
  }

  const result = await db.transaction(async (tx) => {
    const [lockedExisting] = await tx
      .select()
      .from(auctionTeamRegistrations)
      .where(eq(auctionTeamRegistrations.id, regId))
      .for("update")
      .limit(1);

    if (!lockedExisting) {
      return { ok: false as const, status: 404, error: "Team registration not found." };
    }
    if (lockedExisting.status === "APPROVED" && parsed.data.decision === "APPROVED") {
      return {
        ok: false as const,
        status: 409,
        error: "Team registration has already been approved.",
      };
    }

    let linkedFranchiseId = lockedExisting.franchiseId;
    const finalCaptainId =
      parsed.data.captainUserId !== undefined ? parsed.data.captainUserId : lockedExisting.captainUserId;

    if (parsed.data.decision === "APPROVED") {
      if (linkedFranchiseId) {
        await tx
          .update(auctionFranchises)
          .set({
            status: "APPROVED",
            captainUserId: finalCaptainId,
            ...(parsed.data.startingPurse ? { startingPurse: parsed.data.startingPurse, remainingPurse: parsed.data.startingPurse } : {}),
            ...(parsed.data.minSquad !== undefined ? { minSquad: parsed.data.minSquad } : {}),
            ...(parsed.data.maxSquad !== undefined ? { maxSquad: parsed.data.maxSquad } : {}),
            ...(parsed.data.minClubQuota !== undefined ? { minClubQuota: parsed.data.minClubQuota } : {}),
            ...(parsed.data.minNonClubQuota !== undefined ? { minNonClubQuota: parsed.data.minNonClubQuota } : {}),
          })
          .where(eq(auctionFranchises.id, linkedFranchiseId));
      } else {
        const existingSportFranchises = await tx
          .select({ slotNumber: auctionFranchises.slotNumber })
          .from(auctionFranchises)
          .where(
            and(
              eq(auctionFranchises.auctionId, lockedExisting.auctionId),
              eq(auctionFranchises.sportId, lockedExisting.sportId)
            )
          );
        const nextSlot =
          existingSportFranchises.reduce((max, f) => Math.max(max, f.slotNumber), 0) + 1;
        const purse = parsed.data.startingPurse ?? 20000;

        const [createdFranchise] = await tx
          .insert(auctionFranchises)
          .values({
            auctionId: lockedExisting.auctionId,
            sportId: lockedExisting.sportId,
            slotNumber: nextSlot,
            name: lockedExisting.teamName,
            shortCode: lockedExisting.shortCode,
            accentColor: lockedExisting.accentColor,
            captainUserId: finalCaptainId,
            startingPurse: purse,
            remainingPurse: purse,
            minSquad: parsed.data.minSquad ?? 6,
            maxSquad: parsed.data.maxSquad ?? 15,
            minClubQuota: parsed.data.minClubQuota ?? 1,
            minNonClubQuota: parsed.data.minNonClubQuota ?? 1,
            status: "APPROVED",
          })
          .returning();
        linkedFranchiseId = createdFranchise.id;
      }

      // Withdraw/mark INELIGIBLE any open/un-sold auction registration for the approved franchise's active captain
      if (finalCaptainId) {
        const capProfileId = await ensureStudentPlayerProfileId(tx, finalCaptainId);
        if (capProfileId) {
          await tx
            .update(auctionRegistrations)
            .set({ status: "INELIGIBLE" })
            .where(
              and(
                eq(auctionRegistrations.auctionId, lockedExisting.auctionId),
                eq(auctionRegistrations.playerProfileId, capProfileId),
                inArray(auctionRegistrations.status, ["REGISTERED", "ELIGIBLE", "UNSOLD", "IN_AUCTION"])
              )
            );
        }
      }
    } else if (linkedFranchiseId) {
      await tx
        .update(auctionFranchises)
        .set({ status: parsed.data.decision })
        .where(eq(auctionFranchises.id, linkedFranchiseId));
    }

    const [updatedReg] = await tx
      .update(auctionTeamRegistrations)
      .set({
        status: parsed.data.decision,
        captainUserId: finalCaptainId,
        franchiseId: linkedFranchiseId,
        reviewedByUserId: req.actor!.id,
        reviewNote: parsed.data.reviewNote?.trim() || null,
        reviewedAt: new Date(),
      })
      .where(eq(auctionTeamRegistrations.id, regId))
      .returning();

    const notifyTargets = Array.from(
      new Set(
        [lockedExisting.submittedByUserId, finalCaptainId].filter((id): id is number => id !== null)
      )
    );
    if (notifyTargets.length > 0) {
      await tx.insert(notifications).values(
        notifyTargets.map((uid) => ({
          userId: uid,
          title: `Auction Team ${lockedExisting.teamName}: ${parsed.data.decision}`,
          message:
            parsed.data.reviewNote?.trim() ||
            (parsed.data.decision === "APPROVED"
              ? "Your team is approved and active for Prothymos live auction bidding."
              : "Review update from Sports Secretary."),
          linkUrl: "/auction",
        }))
      );
    }

    await recordAuditLog(
      tx,
      req.actor!.id,
      `AUCTION_TEAM_${parsed.data.decision}`,
      "auction_team_registrations",
      regId,
      { franchiseId: linkedFranchiseId }
    );
    return { ok: true as const, updatedReg };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  await broadcastAuctionUpdate("AUCTION_UPDATED", { teamRegistrationId: regId });
  res.json({ teamRegistration: result.updatedReg });
});

router.post("/publish-rosters", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can publish rosters to a tournament." });
    return;
  }

  const auction = await getActiveOrLatestAuction();
  if (!auction) {
    res.status(404).json({ error: "No Prothymos auction found." });
    return;
  }

  const schema = z.object({ sportId: z.number().int().positive().optional() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid publish rosters payload." });
    return;
  }

  const result = await db.transaction(async (tx) => {
    let currentT: typeof tournaments.$inferSelect | undefined;

    if (auction.tournamentId) {
      const [linked] = await tx
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, auction.tournamentId))
        .limit(1);
      if (linked && linked.status !== "ARCHIVED") {
        if (!linked.isCurrent || linked.status !== "ACTIVE") {
          await tx
            .update(tournaments)
            .set({ isCurrent: false })
            .where(eq(tournaments.isCurrent, true));
          const [activated] = await tx
            .update(tournaments)
            .set({ isCurrent: true, status: "ACTIVE" })
            .where(eq(tournaments.id, linked.id))
            .returning();
          currentT = activated;
        } else {
          currentT = linked;
        }
      }
    }

    if (!currentT) {
      const [activeCurrent] = await tx
        .select()
        .from(tournaments)
        .where(eq(tournaments.isCurrent, true))
        .orderBy(desc(tournaments.id))
        .limit(1);
      currentT = activeCurrent;
    }

    if (!currentT) {
      const [upcomingPro] = await tx
        .select()
        .from(tournaments)
        .where(and(eq(tournaments.status, "UPCOMING"), eq(tournaments.tournamentType, "PROTHYMOS")))
        .orderBy(desc(tournaments.id))
        .limit(1);
      if (upcomingPro) {
        const [activated] = await tx
          .update(tournaments)
          .set({ isCurrent: true, status: "ACTIVE" })
          .where(eq(tournaments.id, upcomingPro.id))
          .returning();
        currentT = activated;
      }
    }

    if (!currentT) {
      const [createdT] = await tx
        .insert(tournaments)
        .values({
          name: `${auction.name} Championship`,
          academicYear: auction.seasonYear,
          semester: "EVEN",
          tournamentType: "PROTHYMOS",
          format: "GROUP_KNOCKOUT",
          rosterMode: "AUCTION",
          status: "ACTIVE",
          isCurrent: true,
          startsAt: new Date(),
          description: "Published from Prothymos final auction squad sheets.",
        })
        .returning();
      currentT = createdT;
    }

    await tx
      .insert(siteSettings)
      .values({ key: "currentTournamentId", valueJson: currentT.id, updatedBy: req.actor!.id })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { valueJson: currentT.id, updatedBy: req.actor!.id, updatedAt: new Date() },
      });

    const franchiseConds = [
      eq(auctionFranchises.auctionId, auction.id),
      eq(auctionFranchises.status, "APPROVED"),
    ];
    if (parsed.data.sportId) {
      franchiseConds.push(eq(auctionFranchises.sportId, parsed.data.sportId));
    }

    const approvedFranchises = await tx
      .select()
      .from(auctionFranchises)
      .where(and(...franchiseConds))
      .orderBy(asc(auctionFranchises.sportId), asc(auctionFranchises.slotNumber));

    const sportIdsToEnsure = Array.from(new Set(approvedFranchises.map((f) => f.sportId)));
    if (sportIdsToEnsure.length > 0) {
      await tx
        .insert(tournamentSports)
        .values(
          sportIdsToEnsure.map((sid) => ({
            tournamentId: currentT!.id,
            sportId: sid,
            format: currentT!.format,
          }))
        )
        .onConflictDoNothing();
    }

    let syncedTeamsCount = 0;
    let syncedPlayersCount = 0;

    for (const f of approvedFranchises) {
      let teamId = f.tournamentTeamId;
      if (teamId) {
        const [checkT] = await tx
          .select({ id: teams.id })
          .from(teams)
          .where(and(eq(teams.id, teamId), eq(teams.tournamentId, currentT.id)))
          .limit(1);
        if (!checkT) teamId = null;
      }
      if (!teamId) {
        const [existingByCode] = await tx
          .select()
          .from(teams)
          .where(
            and(
              eq(teams.tournamentId, currentT.id),
              eq(teams.sportId, f.sportId),
              eq(teams.shortCode, f.shortCode)
            )
          )
          .limit(1);
        if (existingByCode) {
          teamId = existingByCode.id;
          await tx
            .update(teams)
            .set({
              name: f.name,
              accentColor: f.accentColor,
              captainUserId: f.captainUserId,
              franchiseId: f.id,
              submissionStatus: "APPROVED",
              reviewedBy: req.actor!.id,
            })
            .where(eq(teams.id, teamId));
        } else {
          const [createdTeam] = await tx
            .insert(teams)
            .values({
              tournamentId: currentT.id,
              sportId: f.sportId,
              name: f.name,
              shortCode: f.shortCode,
              accentColor: f.accentColor,
              captainUserId: f.captainUserId,
              franchiseId: f.id,
              submissionStatus: "APPROVED",
              reviewedBy: req.actor!.id,
            })
            .returning();
          teamId = createdTeam.id;
        }
        await tx
          .update(auctionFranchises)
          .set({ tournamentTeamId: teamId })
          .where(eq(auctionFranchises.id, f.id));
      }
      syncedTeamsCount += 1;

      await tx
        .insert(standings)
        .values({
          tournamentId: currentT.id,
          sportId: f.sportId,
          teamId,
          rank: f.slotNumber,
        })
        .onConflictDoNothing();

      if (f.captainUserId) {
        const capProfileId = await ensureStudentPlayerProfileId(tx, f.captainUserId);
        if (capProfileId) {
          const [sportClub] = await tx
            .select({ id: sportsClubs.id })
            .from(sportsClubs)
            .where(eq(sportsClubs.sportId, f.sportId))
            .limit(1);
          let capClass: "CLUB" | "NON_CLUB" = "NON_CLUB";
          if (sportClub) {
            const [inductedCap] = await tx
              .select({ id: clubMemberships.id })
              .from(clubMemberships)
              .where(
                and(
                  eq(clubMemberships.clubId, sportClub.id),
                  eq(clubMemberships.playerProfileId, capProfileId),
                  eq(clubMemberships.status, "INDUCTED")
                )
              )
              .limit(1);
            if (inductedCap) capClass = "CLUB";
          }
          await tx
            .insert(teamRosters)
            .values({
              teamId,
              playerProfileId: capProfileId,
              playingRole: "Captain",
              playerClass: capClass,
            })
            .onConflictDoNothing();
          syncedPlayersCount += 1;
        }
        const [existingCapRole] = await tx
          .select({ id: userRoles.id })
          .from(userRoles)
          .where(
            and(
              eq(userRoles.userId, f.captainUserId),
              eq(userRoles.roleCode, "CAPTAIN"),
              eq(userRoles.tournamentId, currentT.id),
              eq(userRoles.active, true)
            )
          )
          .limit(1);
        if (!existingCapRole) {
          await tx.insert(userRoles).values({
            userId: f.captainUserId,
            roleCode: "CAPTAIN",
            tournamentId: currentT.id,
            grantedBy: req.actor!.id,
          });
        }
      }

      const soldRegs = await tx
        .select()
        .from(auctionRegistrations)
        .where(
          and(
            eq(auctionRegistrations.auctionId, auction.id),
            eq(auctionRegistrations.soldFranchiseId, f.id),
            eq(auctionRegistrations.status, "SOLD")
          )
        );
      for (const sr of soldRegs) {
        await tx
          .insert(teamRosters)
          .values({
            teamId,
            playerProfileId: sr.playerProfileId,
            playingRole: sr.positionsJson[0] ?? "Squad",
            playerClass: sr.playerClass,
            soldPrice: sr.soldPrice ?? sr.basePrice,
          })
          .onConflictDoUpdate({
            target: [teamRosters.teamId, teamRosters.playerProfileId],
            set: {
              playingRole: sr.positionsJson[0] ?? "Squad",
              playerClass: sr.playerClass,
              soldPrice: sr.soldPrice ?? sr.basePrice,
            },
          });
        syncedPlayersCount += 1;
      }
    }

    await tx
      .update(auctions)
      .set({
        status: "PUBLISHED",
        tournamentId: currentT.id,
        version: auction.version + 1,
      })
      .where(eq(auctions.id, auction.id));

    await recordAuditLog(tx, req.actor!.id, "PUBLISH_AUCTION_ROSTERS", "tournaments", currentT.id, {
      auctionId: auction.id,
      syncedTeamsCount,
      syncedPlayersCount,
    });

    return {
      tournamentId: currentT.id,
      tournamentName: currentT.name,
      syncedTeamsCount,
      syncedPlayersCount,
    };
  });

  broadcastSse("NAV_UPDATED", { currentTournamentId: result.tournamentId });
  await broadcastAuctionUpdate("AUCTION_UPDATED", { publishedTournamentId: result.tournamentId });
  res.json({ ok: true, ...result });
});

export default router;
