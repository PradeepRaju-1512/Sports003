import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext.tsx";
import { apiFetch } from "../lib/api.ts";

export interface AuctionSport {
  id: number;
  slug: string;
  name: string;
  category: string;
}

export interface AuctionRound {
  id: number;
  auctionId: number;
  sportId: number | null;
  name: string;
  roundOrder: number;
  roundType: "MAIN" | "ACCELERATED" | "UNSOLD" | "RTM";
  active: boolean;
}

export interface BoughtPlayerSummary {
  id: number;
  playerProfileId: number;
  name: string;
  batch: string;
  branch: string | null;
  rollNumber: string | null;
  positions: string[];
  playerClass: "CLUB" | "NON_CLUB";
  soldPrice: number;
}

export interface HydratedFranchise {
  id: number;
  auctionId: number;
  sportId: number;
  slotNumber: number;
  track?: "COMBINED" | "BOYS" | "GIRLS";
  name: string;
  shortCode: string;
  accentColor: string;
  logoUrl: string | null;
  captainUserId: number | null;
  tournamentTeamId: number | null;
  startingPurse: number;
  remainingPurse: number;
  minSquad: number;
  maxSquad: number;
  minClubQuota: number;
  minNonClubQuota: number;
  captain: { id: number; name: string; rollNumber: string | null; batch: string } | null;
  boughtPlayers: BoughtPlayerSummary[];
  squadCount: number;
  clubCount: number;
  nonClubCount: number;
  maxAllowedBid: number;
  requiredReserve: number;
  eligibleToBid: boolean;
  guardReason: string | null;
}

export interface HydratedAuctionPlayer {
  id: number;
  auctionId: number;
  sportId: number;
  roundId: number | null;
  track?: "COMBINED" | "BOYS" | "GIRLS";
  playerProfileId: number;
  positionsJson: string[];
  playerClass: "CLUB" | "NON_CLUB";
  tier: "MARQUEE" | "TIER_1" | "STANDARD";
  basePrice: number;
  experience: string | null;
  achievements: string | null;
  photoUrl: string | null;
  status: "REGISTERED" | "ELIGIBLE" | "IN_AUCTION" | "SOLD" | "UNSOLD" | "INELIGIBLE";
  soldFranchiseId: number | null;
  soldPrice: number | null;
  displayName: string;
  batch: string;
  branch: string | null;
  rollNumber: string | null;
  userId: number | null;
}

export interface AuctionBidRow {
  id: number;
  auctionPlayerId: number;
  franchiseId: number | null;
  amount: number;
  bidType: string;
  createdAt: string;
}

export interface RtmRow {
  id: number;
  seasonYear: number;
  sportId: number;
  playerProfileId: number;
  previousFranchiseId: number | null;
  used: boolean;
}

export interface WatchlistRow {
  id: number;
  franchiseId: number;
  auctionPlayerId: number;
  priorityNote: string | null;
  maxTargetBid: number | null;
}

export interface AuctionConfig {
  id: number;
  tournamentId: number | null;
  name: string;
  seasonYear: number;
  status: "DRAFT" | "REGISTRATION_OPEN" | "FROZEN" | "LIVE" | "COMPLETED" | "PUBLISHED";
  splitMode?: "COMBINED" | "SEPARATE_BOYS_GIRLS";
  activeTrack?: "COMBINED" | "BOYS" | "GIRLS";
  registrationDeadline: string | null;
  clubBasePrice: number;
  nonClubBasePrice: number;
  sportBasePricesJson: Record<string, { clubBasePrice: number; nonClubBasePrice: number }>;
  defaultIncrement: number;
  jumpIncrement: number;
  bidSlabsJson: Array<{ upTo: number | null; increment: number }>;
  activeSportId: number | null;
  activeRoundId: number | null;
  activePlayerId: number | null;
  projectorMode: "STAGE" | "SOLD" | "UNSOLD" | "STANDINGS" | "PAUSED";
  projectorPaused: boolean;
  rtmEnabled: boolean;
  version: number;
}

export interface AuctionOperatorInfo {
  roleId: number;
  userId: number;
  roleCode: string;
  auctionId: number | null;
  name: string;
  rollNumber: string | null;
  batch: string;
}

export interface AuctionTeamRegistration {
  id: number;
  auctionId: number;
  sportId: number;
  sportName?: string;
  submittedByUserId: number;
  submitterName?: string;
  teamName: string;
  shortCode: string;
  accentColor: string;
  captainUserId: number | null;
  captainName?: string | null;
  memberUserIdsJson: number[];
  rosterNotes: string | null;
  status: "PENDING_APPROVAL" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  franchiseId: number | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface AuctionSnapshot {
  auction: AuctionConfig | null;
  effectiveSportId?: number | null;
  sports: AuctionSport[];
  rounds: AuctionRound[];
  franchises: HydratedFranchise[];
  registrations: HydratedAuctionPlayer[];
  teamRegistrations?: AuctionTeamRegistration[];
  operators?: AuctionOperatorInfo[];
  activePlayer: HydratedAuctionPlayer | null;
  activeBids: AuctionBidRow[];
  rtmEntries: RtmRow[];
  myRegistrations: HydratedAuctionPlayer[];
  myWatchlist: WatchlistRow[];
  myInductedSportIds: number[];
  permissions: {
    canManageConfig: boolean;
    canOperateStage: boolean;
    canRegister: boolean;
    isCaptain?: boolean;
    isActiveCaptain?: boolean;
  };
}

function normalizeSnapshot(raw: Partial<AuctionSnapshot> | null | undefined): AuctionSnapshot {
  return {
    auction: raw?.auction ?? null,
    effectiveSportId: raw?.effectiveSportId ?? null,
    sports: Array.isArray(raw?.sports) ? raw.sports : [],
    rounds: Array.isArray(raw?.rounds) ? raw.rounds : [],
    franchises: Array.isArray(raw?.franchises) ? raw.franchises : [],
    registrations: Array.isArray(raw?.registrations) ? raw.registrations : [],
    teamRegistrations: Array.isArray(raw?.teamRegistrations) ? raw.teamRegistrations : [],
    operators: Array.isArray(raw?.operators) ? raw.operators : [],
    activePlayer: raw?.activePlayer ?? null,
    activeBids: Array.isArray(raw?.activeBids) ? raw.activeBids : [],
    rtmEntries: Array.isArray(raw?.rtmEntries) ? raw.rtmEntries : [],
    myRegistrations: Array.isArray(raw?.myRegistrations) ? raw.myRegistrations : [],
    myWatchlist: Array.isArray(raw?.myWatchlist) ? raw.myWatchlist : [],
    myInductedSportIds: Array.isArray(raw?.myInductedSportIds) ? raw.myInductedSportIds : [],
    permissions: {
      canManageConfig: Boolean(raw?.permissions?.canManageConfig),
      canOperateStage: Boolean(raw?.permissions?.canOperateStage),
      canRegister: Boolean(raw?.permissions?.canRegister),
      isCaptain: Boolean(raw?.permissions?.isCaptain),
      isActiveCaptain: Boolean(raw?.permissions?.isActiveCaptain),
    },
  };
}

export function useAuctionSync(sportIdOverride?: number | null) {
  const { sseConnected, subscribeSse } = useApp();
  const [snapshot, setSnapshot] = useState<AuctionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastEventType, setLastEventType] = useState<string | null>(null);
  const sportRef = useRef(sportIdOverride);
  sportRef.current = sportIdOverride;

  const refresh = useCallback(async () => {
    try {
      const qs = sportRef.current ? `?sportId=${sportRef.current}` : "";
      const res = await apiFetch<Partial<AuctionSnapshot>>(`/api/auction/live-state${qs}`);
      setSnapshot(normalizeSnapshot(res));
      setError(null);
    } catch (err) {
      const msg = (err as Error)?.message ?? "Failed to load auction live state.";
      console.error("[useAuctionSync] refresh failed:", err);
      setError(msg);
      setSnapshot((prev) => prev ?? normalizeSnapshot(null));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadDropRef = useRef(false);

  useEffect(() => {
    refresh();
  }, [refresh, sportIdOverride]);

  useEffect(() => {
    if (!sseConnected) {
      hadDropRef.current = true;
    } else if (hadDropRef.current) {
      hadDropRef.current = false;
      const timer = setTimeout(() => {
        refresh().catch(() => {});
      }, 150 + Math.floor(Math.random() * 250));
      return () => clearTimeout(timer);
    }
  }, [sseConnected, refresh]);

  useEffect(() => {
    const scheduleCoalescedRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refresh().catch((err) => {
          console.error("[useAuctionSync] SSE refresh failed:", err);
        });
      }, 120 + Math.floor(Math.random() * 120));
    };

    const unsubscribe = subscribeSse((evtName, payload) => {
      if (
        evtName !== "AUCTION_STAGE" &&
        evtName !== "AUCTION_BID" &&
        evtName !== "AUCTION_OUTCOME" &&
        evtName !== "AUCTION_UPDATED" &&
        evtName !== "AUCTION_PROJECTOR"
      ) {
        return;
      }
      setLastEventType(evtName);

      if (evtName === "AUCTION_PROJECTOR" && typeof payload.mode === "string") {
        setSnapshot((prev) =>
          prev?.auction
            ? {
                ...prev,
                auction: {
                  ...prev.auction,
                  projectorMode: payload.mode as AuctionConfig["projectorMode"],
                  projectorPaused: payload.mode === "PAUSED",
                },
              }
            : prev
        );
        return;
      }

      if (evtName === "AUCTION_BID" && payload.bid && typeof payload.bid === "object") {
        const bid = payload.bid as AuctionSnapshot["activeBids"][number];
        setSnapshot((prev) => {
          if (!prev?.auction) return prev;
          const alreadyExists = prev.activeBids.some((b) => b.id === bid.id);
          return {
            ...prev,
            auction: {
              ...prev.auction,
              projectorMode: "STAGE",
              version: prev.auction.version + 1,
            },
            activeBids: alreadyExists ? prev.activeBids : [bid, ...prev.activeBids],
          };
        });
        return;
      }

      if (
        evtName === "AUCTION_OUTCOME" &&
        payload.registration &&
        typeof payload.registration === "object"
      ) {
        type RegType = AuctionSnapshot["registrations"][number];
        const updatedReg = payload.registration as Partial<RegType> & {
          id: number;
          status: RegType["status"];
          soldFranchiseId?: number | null;
          soldPrice?: number | null;
        };
        setSnapshot((prev) => {
          if (!prev?.auction) return prev;
          const nextMode = updatedReg.status === "SOLD" ? "SOLD" : "UNSOLD";
          const nextRegs = prev.registrations.map((r) =>
            r.id === updatedReg.id
              ? {
                  ...r,
                  status: updatedReg.status,
                  soldFranchiseId: updatedReg.soldFranchiseId ?? r.soldFranchiseId,
                  soldPrice: updatedReg.soldPrice ?? r.soldPrice,
                }
              : r
          );
          const nextActive =
            prev.activePlayer && prev.activePlayer.id === updatedReg.id
              ? {
                  ...prev.activePlayer,
                  status: updatedReg.status,
                  soldFranchiseId: updatedReg.soldFranchiseId ?? prev.activePlayer.soldFranchiseId,
                  soldPrice: updatedReg.soldPrice ?? prev.activePlayer.soldPrice,
                }
              : prev.activePlayer;
          return {
            ...prev,
            auction: {
              ...prev.auction,
              projectorMode: nextMode,
              version: prev.auction.version + 1,
            },
            registrations: nextRegs,
            activePlayer: nextActive,
          };
        });
        scheduleCoalescedRefresh();
        return;
      }

      scheduleCoalescedRefresh();
    });

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      unsubscribe();
    };
  }, [subscribeSse, refresh]);

  // Slow secondary fallback polling ONLY while SSE is disconnected
  useEffect(() => {
    if (sseConnected) return;
    const timer = setInterval(() => {
      refresh().catch(() => {});
    }, 30_000);
    return () => clearInterval(timer);
  }, [sseConnected, refresh]);

  return { snapshot, loading, error, connected: sseConnected, lastEventType, refresh };
}
