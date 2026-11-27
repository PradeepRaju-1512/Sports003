import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  Gavel,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Shield,
  Sliders,
  Sparkles,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { apiFetch } from "../lib/api.ts";
import { FinalRosterView } from "../components/FinalRosterView.tsx";
import { useAuctionSync } from "../hooks/useAuctionSync.ts";

export function LiveAuctionPage({ projectorMode = false }: { projectorMode?: boolean }) {
  const { notifyToast } = useApp();
  const { snapshot, loading, connected, refresh } = useAuctionSync();

  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(!projectorMode);
  const [selectedQueueId, setSelectedQueueId] = useState<number | "">("");
  const [customBidFranchiseId, setCustomBidFranchiseId] = useState<number | "">("");
  const [showFinalRoster, setShowFinalRoster] = useState(false);
  const [finalRosterToggled, setFinalRosterToggled] = useState(false);
  const [rosterSportId, setRosterSportId] = useState<number | null>(null);
  const [publishingRosters, setPublishingRosters] = useState(false);
  const [publishedTournamentName, setPublishedTournamentName] = useState<string | null>(null);

  const latestVersionRef = useRef<number | undefined>(snapshot?.auction?.version);
  latestVersionRef.current = snapshot?.auction?.version;

  const auctionStatus = snapshot?.auction?.status;
  useEffect(() => {
    if (
      !projectorMode &&
      !finalRosterToggled &&
      (auctionStatus === "COMPLETED" || auctionStatus === "PUBLISHED")
    ) {
      setShowFinalRoster(true);
    }
  }, [projectorMode, finalRosterToggled, auctionStatus]);

  useEffect(() => {
    setDrawerOpen(!projectorMode);
  }, [projectorMode]);

  const blurActiveFormControl = () => {
    const el = document.activeElement as HTMLElement | null;
    if (
      el &&
      (el.tagName === "BUTTON" ||
        el.tagName === "SELECT" ||
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA")
    ) {
      el.blur();
    }
  };

  const auction = snapshot?.auction ?? null;
  const activeSportId = auction?.activeSportId ?? snapshot?.sports[0]?.id ?? null;
  const activeSport = snapshot?.sports.find((s) => s.id === activeSportId) ?? null;

  const activeFranchises = useMemo(
    () =>
      (snapshot?.franchises ?? [])
        .filter((f) => f.sportId === activeSportId)
        .sort((a, b) => a.slotNumber - b.slotNumber),
    [snapshot?.franchises, activeSportId]
  );

  const activePlayer = snapshot?.activePlayer ?? null;
  const activeBids = snapshot?.activeBids ?? [];
  const leadingBid = activeBids[0] ?? null;
  const leadingFranchise = leadingBid?.franchiseId
    ? activeFranchises.find((f) => f.id === leadingBid.franchiseId) ?? null
    : null;

  const currentBidAmount = leadingBid ? leadingBid.amount : activePlayer?.basePrice ?? 0;

  const nextStandardIncrement = useMemo(() => {
    if (!auction || !leadingBid) return 0;
    const slabs = auction.bidSlabsJson ?? [];
    for (const s of slabs) {
      if (s.upTo === null || leadingBid.amount < s.upTo) return s.increment;
    }
    return auction.defaultIncrement;
  }, [auction, leadingBid]);

  const nextQuickBidAmount = activePlayer
    ? leadingBid
      ? leadingBid.amount + nextStandardIncrement
      : activePlayer.basePrice
    : 0;

  const sportEligiblePool = useMemo(
    () =>
      (snapshot?.registrations ?? []).filter(
        (r) =>
          r.sportId === activeSportId &&
          (r.status === "ELIGIBLE" || r.status === "REGISTERED" || r.status === "UNSOLD")
      ),
    [snapshot?.registrations, activeSportId]
  );

  const availableRtm = useMemo(() => {
    if (!auction || !activePlayer) return null;
    return (
      snapshot?.rtmEntries.find(
        (r) =>
          r.sportId === activePlayer.sportId &&
          r.playerProfileId === activePlayer.playerProfileId &&
          !r.used &&
          r.previousFranchiseId !== leadingFranchise?.id
      ) ?? null
    );
  }, [auction, activePlayer, snapshot?.rtmEntries, leadingFranchise?.id]);

  const sendCommand = useCallback(
    async (
      endpoint: string,
      body: Record<string, unknown>,
      options?: { method?: "POST" | "PATCH"; successMsg?: string }
    ) => {
      const currentVersion = latestVersionRef.current ?? snapshot?.auction?.version;
      if (!currentVersion || busy) return;
      blurActiveFormControl();
      setBusy(true);
      try {
        await apiFetch(endpoint, {
          method: options?.method ?? "POST",
          body: JSON.stringify({ ...body, expectedVersion: currentVersion }),
        });
        await refresh();
        if (options?.successMsg) notifyToast("success", options.successMsg);
      } catch (err) {
        notifyToast("error", (err as Error).message);
        await refresh().catch(() => {});
      } finally {
        setBusy(false);
      }
    },
    [snapshot?.auction?.version, busy, refresh, notifyToast]
  );

  const handleLifecycleChange = useCallback(
    (nextStatus: "REGISTRATION_OPEN" | "FROZEN" | "LIVE") => {
      sendCommand(
        "/api/auction/config",
        { status: nextStatus },
        {
          method: "PATCH",
          successMsg:
            nextStatus === "LIVE"
              ? "Auction is now LIVE! Hotkeys 1–8 enabled."
              : nextStatus === "FROZEN"
              ? "Registration closed (FROZEN)."
              : "Registration reopened.",
        }
      );
    },
    [sendCommand]
  );

  const handleQuickBid = useCallback(
    (franchiseId: number, bidType: "INCREMENT" | "JUMP" = "INCREMENT") => {
      if (!auction) return;
      if (auction.status !== "LIVE") {
        notifyToast("error", `Bidding is locked while status is ${auction.status}. Set Auction LIVE first.`);
        return;
      }
      if (!activePlayer || activePlayer.status !== "IN_AUCTION") {
        notifyToast("info", "Stage an eligible player with Next [N] before placing bids.");
        return;
      }
      sendCommand("/api/auction/bid", { franchiseId, bidType });
    },
    [activePlayer, auction, sendCommand, notifyToast]
  );

  // Single-operator keyboard shortcuts: [1]-[8], S (SOLD), X (UNSOLD), U (Undo), N (Next), R (RTM), Space (Stage/Pause)
  useEffect(() => {
    if (!snapshot?.permissions.canOperateStage || !auction) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || el?.isContentEditable) return;

      if (e.key >= "1" && e.key <= "8") {
        const slot = Number(e.key);
        const f = activeFranchises.find((fr) => fr.slotNumber === slot) ?? activeFranchises[slot - 1];
        if (f) {
          e.preventDefault();
          handleQuickBid(f.id, "INCREMENT");
        }
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        sendCommand("/api/auction/outcome", { outcome: "SOLD" });
      } else if (e.key === "x" || e.key === "X") {
        e.preventDefault();
        sendCommand("/api/auction/outcome", { outcome: "UNSOLD" });
      } else if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        sendCommand("/api/auction/undo", {});
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        sendCommand("/api/auction/next-player", {
          sportId: activeSportId ?? undefined,
          auctionPlayerId: selectedQueueId === "" ? undefined : Number(selectedQueueId),
        });
      } else if ((e.key === "r" || e.key === "R") && availableRtm?.previousFranchiseId) {
        e.preventDefault();
        sendCommand("/api/auction/rtm", { franchiseId: availableRtm.previousFranchiseId });
      } else if (e.code === "Space") {
        e.preventDefault();
        const nextMode = auction.projectorMode === "PAUSED" ? "STAGE" : "PAUSED";
        sendCommand("/api/auction/projector", { mode: nextMode });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    snapshot?.permissions.canOperateStage,
    auction,
    activeFranchises,
    activeSportId,
    selectedQueueId,
    availableRtm,
    handleQuickBid,
    sendCommand,
  ]);

  const rosterSport =
    (snapshot?.sports ?? []).find((s) => s.id === (rosterSportId ?? activeSportId)) ??
    activeSport ??
    snapshot?.sports?.[0] ??
    null;

  const rosterFranchises = useMemo(
    () =>
      (snapshot?.franchises ?? [])
        .filter((f) => f.sportId === rosterSport?.id)
        .sort((a, b) => a.slotNumber - b.slotNumber),
    [snapshot?.franchises, rosterSport?.id]
  );

  const rosterUnsoldPlayers = useMemo(
    () =>
      (snapshot?.registrations ?? []).filter(
        (r) => r.sportId === rosterSport?.id && r.status === "UNSOLD"
      ),
    [snapshot?.registrations, rosterSport?.id]
  );

  if (loading || !snapshot) {
    return <div className="max-w-7xl mx-auto p-8 text-sm text-[#8B8680]">Connecting to Live Auction Stage...</div>;
  }

  if (!auction) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <div className="rdr-panel rounded-lg p-8 text-center space-y-3 border border-white/10">
          <Gavel className="w-10 h-10 text-[#D97706] mx-auto" />
          <h1 className="font-editorial text-3xl text-[#F5F2EB]">No Active Auction Configured</h1>
          <p className="text-xs text-[#8B8680]">
            No active Prothymos auction is scheduled right now. Check the Auction Hub for setup or upcoming rounds.
          </p>
          <Link
            to="/auction"
            className="inline-block px-4 py-2 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-xs font-bold uppercase tracking-wider text-[#F5F2EB]"
          >
            Go to Auction Hub
          </Link>
        </div>
      </div>
    );
  }

  const canOperate = Boolean(snapshot?.permissions?.canOperateStage);
  const initials = activePlayer?.displayName
    ? activePlayer.displayName
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "II"
    : "II";

  const showSoldOverlay = auction.projectorMode === "SOLD" && activePlayer?.status === "SOLD";
  const showUnsoldOverlay = auction.projectorMode === "UNSOLD" && activePlayer?.status === "UNSOLD";
  const showPausedOverlay = auction.projectorMode === "PAUSED";

  const jumpTargetFranchiseId =
    customBidFranchiseId !== ""
      ? Number(customBidFranchiseId)
      : activeFranchises.find((f) => f.id !== leadingFranchise?.id && f.eligibleToBid)?.id ??
        activeFranchises[0]?.id;

  const isPostAuction = auction.status === "COMPLETED" || auction.status === "PUBLISHED";
  const assignedOperators = snapshot.operators ?? [];
  const activeSportRegs = (snapshot.registrations ?? []).filter((r) => r.sportId === activeSport?.id);
  const stageSoldCount = activeSportRegs.filter((r) => r.status === "SOLD").length;
  const stageUnsoldCount = activeSportRegs.filter((r) => r.status === "UNSOLD").length;
  const stageRemainingCount = activeSportRegs.filter(
    (r) => r.status === "ELIGIBLE" || r.status === "REGISTERED" || r.status === "IN_AUCTION"
  ).length;

  return (
    <div className={`${projectorMode ? "px-4 py-4 max-w-[1600px]" : "px-4 sm:px-6 py-6 max-w-7xl"} mx-auto space-y-5`}>
      {/* Stage Top Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-2.5 py-1 rounded bg-[#DC2626] text-white text-[11px] font-bold uppercase flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            {auction.status}
          </span>
          <h1 className="font-editorial text-3xl sm:text-4xl text-[#F5F2EB]">
            {showFinalRoster
              ? `${rosterSport?.name ?? "Multi-Sport"} Final Roster`
              : `${activeSport?.name ?? "Multi-Sport"} Live Stage`}
          </h1>
          {activeSport && !showFinalRoster && (
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono tabular-nums border border-white/15 bg-[#141418] text-[#D6CFC2]">
              Sold {stageSoldCount} &bull; Unsold {stageUnsoldCount} &bull; Remaining {stageRemainingCount}
            </span>
          )}
          {!projectorMode && (
            <>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  connected
                    ? "border-[#10B981]/50 text-[#10B981] bg-[#10B981]/10"
                    : "border-[#D97706]/50 text-[#D97706] bg-[#D97706]/10"
                }`}
              >
                {connected ? "SSE LIVE" : "SYNCING"} · v{auction.version}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] border border-white/15 bg-[#141418] text-[#D6CFC2] flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-[#D97706]" />
                Operators:{" "}
                {assignedOperators.length > 0
                  ? assignedOperators.map((op) => op.name).join(", ")
                  : "None assigned"}
              </span>
              {!canOperate && (
                <span className="px-2 py-0.5 rounded text-[10px] border border-white/15 bg-white/5 text-[#8B8680] uppercase font-bold">
                  Read-Only Broadcast
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {!projectorMode && (
            <button
              type="button"
              onClick={() => {
                setFinalRosterToggled(true);
                setShowFinalRoster((v) => !v);
              }}
              className={`px-3 py-1.5 rounded font-bold uppercase flex items-center gap-1.5 transition ${
                showFinalRoster
                  ? "bg-[#D97706] text-[#08080A]"
                  : isPostAuction
                  ? "bg-[#10B981] text-[#08080A] ring-2 ring-[#10B981]/50"
                  : "bg-[#141418] border border-[#10B981]/60 text-[#10B981] hover:bg-[#10B981]/10"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              {showFinalRoster ? "Live Stage View" : isPostAuction ? "Final Roster (Ready)" : "Final Roster"}
            </button>
          )}
          <Link
            to={projectorMode ? "/live-auction" : "/live-auction/projector"}
            className={
              projectorMode
                ? "px-2.5 py-1 rounded bg-[#141418]/70 hover:bg-[#141418] border border-white/15 text-[#D6CFC2] opacity-60 hover:opacity-100 text-[11px] font-semibold uppercase flex items-center gap-1 transition"
                : "px-3 py-1.5 rounded bg-[#141418] border border-[#D97706]/60 text-[#F59E0B] font-bold uppercase flex items-center gap-1.5"
            }
          >
            {projectorMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {projectorMode ? "Exit" : "16:9 Projection View"}
          </Link>
          {projectorMode && canOperate && !showFinalRoster && (
            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              className="px-3 py-1.5 rounded bg-[#B91C1C] text-[#F5F2EB] font-bold uppercase flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5" /> {drawerOpen ? "Hide Controls" : "Operator Drawer"}
            </button>
          )}
          {!projectorMode && snapshot?.permissions?.canManageConfig && (
            <Link
              to="/auction"
              className="px-3 py-1.5 rounded bg-[#141418] border border-white/15 hover:border-[#D97706] text-[#F59E0B] font-semibold"
            >
              Manage Operators
            </Link>
          )}
          {!projectorMode && (
            <Link
              to="/auction"
              className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-[#D6CFC2] font-semibold"
            >
              Auction Hub
            </Link>
          )}
        </div>
      </div>

      {showFinalRoster ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
            {snapshot.sports.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setRosterSportId(s.id)}
                className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition ${
                  rosterSport?.id === s.id
                    ? "bg-[#B91C1C] text-[#F5F2EB]"
                    : "bg-[#141418] text-[#D6CFC2] border border-white/10 hover:border-[#D97706]/50"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <FinalRosterView
            auctionName={auction.name}
            seasonYear={auction.seasonYear}
            status={auction.status}
            sportName={rosterSport?.name ?? "Multi-Sport"}
            franchises={rosterFranchises}
            unsoldPlayers={rosterUnsoldPlayers}
            canPublishToTournament={snapshot.permissions.canManageConfig}
            publishingToTournament={publishingRosters}
            publishedTournamentName={publishedTournamentName}
            onPublishToTournament={async () => {
              setPublishingRosters(true);
              try {
                const res = await apiFetch<{
                  tournamentName: string;
                  syncedTeamsCount: number;
                  syncedPlayersCount: number;
                }>("/api/auction/publish-rosters", {
                  method: "POST",
                  body: JSON.stringify({ sportId: rosterSport?.id }),
                });
                setPublishedTournamentName(res.tournamentName);
                await refresh();
                notifyToast(
                  "success",
                  `Synced ${res.syncedTeamsCount} teams & ${res.syncedPlayersCount} roster slots to ${res.tournamentName}.`
                );
              } catch (err) {
                notifyToast("error", (err as Error).message);
              } finally {
                setPublishingRosters(false);
              }
            }}
          />
        </div>
      ) : (
        <>

      {/* TOP ROW (3 Columns): Portrait | Player + Giant Bid | Role-Gated Operator Controls */}
      <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Top-Left (Cols 1-3): Player Portrait, Class & Base Price */}
        <section className="lg:col-span-3 rdr-panel rdr-border-crimson rounded-lg p-5 flex flex-col items-center justify-between gap-4 text-center">
          {activePlayer ? (
            <div key={activePlayer.id} className="w-full space-y-3 animate-auction-slide">
              <div className="mx-auto w-44 h-44 rounded-lg overflow-hidden border-2 border-[#D97706]/70 bg-[#08080A] flex items-center justify-center shadow-2xl">
                {activePlayer.photoUrl ? (
                  <img
                    src={activePlayer.photoUrl}
                    alt={activePlayer.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="font-editorial text-6xl text-[#D97706] tracking-wider">{initials}</div>
                )}
              </div>
              <div className="flex items-center justify-center gap-2">
                <span
                  className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                    activePlayer.playerClass === "CLUB"
                      ? "bg-[#10B981]/20 border border-[#10B981]/60 text-[#10B981]"
                      : "bg-[#D97706]/20 border border-[#D97706]/60 text-[#F59E0B]"
                  }`}
                >
                  {activePlayer.playerClass}
                </span>
                <span className="px-2.5 py-1 rounded bg-white/10 text-[11px] font-mono text-[#D6CFC2]">
                  {activePlayer.tier}
                </span>
              </div>
                <div className="pt-2 border-t border-white/10">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B8680]">Base Price</div>
                <div className="font-mono text-2xl font-bold text-[#F5F2EB]">
                  ₹{(activePlayer.basePrice ?? 0).toLocaleString()}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-xs text-[#8B8680]">No active lot on the block.</div>
          )}
        </section>

        {/* Top-Middle (Cols 4-8 or 4-12 when controls hidden): Player Metadata + Giant Current Bid */}
        <section
          className={`${
            canOperate && drawerOpen ? "lg:col-span-5" : "lg:col-span-9"
          } rdr-panel rounded-lg p-6 relative overflow-hidden flex flex-col justify-between gap-4`}
        >
          {activePlayer ? (
            <div key={`info-${activePlayer.id}`} className="space-y-4 animate-auction-slide">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-mono px-2.5 py-1 rounded bg-[#08080A] border border-white/15 text-[#D97706] font-bold">
                  {activePlayer.rollNumber ?? "IIITT"}
                </span>
                <span className="text-[#D6CFC2] font-semibold uppercase tracking-wider">
                  {activePlayer.batch} Year • {activePlayer.branch ?? "IIITT"}
                </span>
              </div>

              <div>
                <h2 className="font-editorial text-5xl sm:text-6xl text-[#F5F2EB] leading-none">
                  {activePlayer.displayName}
                </h2>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(activePlayer.positionsJson ?? []).map((pos) => (
                    <span
                      key={pos}
                      className="px-2.5 py-1 rounded bg-[#B91C1C]/20 border border-[#B91C1C]/50 text-xs font-semibold text-[#F5F2EB]"
                    >
                      {pos}
                    </span>
                  ))}
                </div>
                {activePlayer.experience && (
                  <p className="text-xs text-[#8B8680] mt-2">{activePlayer.experience}</p>
                )}
              </div>

              {/* Giant Current Bid + Leading Franchise (or non-obscuring SOLD / UNSOLD stamp) */}
              {showSoldOverlay ? (
                <div className="p-4 rounded-lg bg-[#10B981]/10 border-2 border-[#10B981]/70 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-7 h-7 text-[#F59E0B] animate-pulse shrink-0" />
                    <div className="px-4 py-1.5 border-2 border-[#10B981] bg-[#10B981]/20 rounded font-editorial text-3xl sm:text-4xl text-[#10B981] tracking-widest animate-gavel-stamp">
                      SOLD
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-editorial text-2xl text-[#F5F2EB]">
                      &rarr; {activeFranchises.find((f) => f.id === activePlayer.soldFranchiseId)?.name ?? "Franchise"}
                    </div>
                    <div className="font-mono text-3xl font-bold text-[#F59E0B] animate-bid-pop">
                      ₹{(activePlayer.soldPrice ?? currentBidAmount).toLocaleString()}
                    </div>
                  </div>
                </div>
              ) : showUnsoldOverlay ? (
                <div className="p-4 rounded-lg bg-[#DC2626]/10 border-2 border-[#DC2626]/60 flex flex-wrap items-center justify-between gap-4">
                  <div className="px-4 py-1.5 border-2 border-[#DC2626] bg-[#DC2626]/20 rounded font-editorial text-3xl sm:text-4xl text-[#DC2626] tracking-widest animate-gavel-stamp">
                    UNSOLD
                  </div>
                  <div className="text-xs text-[#D6CFC2]">
                    Moves to the Accelerated / Unsold Round pool.
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-lg bg-[#08080A] border border-white/15 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[#8B8680]">
                      {leadingBid ? "Current Highest Bid" : "Opening Base Bid"}
                    </div>
                    <div
                      key={`bid-${activeBids.length}-${currentBidAmount}`}
                      className="font-mono tabular-nums text-5xl sm:text-6xl font-bold text-[#F59E0B] animate-bid-pop"
                    >
                      ₹{currentBidAmount.toLocaleString()}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#8B8680] mb-1">
                      Leading Franchise
                    </div>
                    {leadingFranchise ? (
                      <div
                        className="px-4 py-2 rounded font-editorial text-2xl text-[#F5F2EB] border leading-gold-glow"
                        style={{
                          borderColor: leadingFranchise.accentColor,
                          backgroundColor: `${leadingFranchise.accentColor}22`,
                        }}
                      >
                        {leadingFranchise.name} ({leadingFranchise.shortCode})
                      </div>
                    ) : (
                      <div className="px-3 py-1.5 rounded bg-white/5 text-xs text-[#8B8680]">
                        Awaiting Opening Bid
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-12 text-center space-y-2">
              <Gavel className="w-10 h-10 text-[#D97706]" />
              <div className="font-editorial text-3xl text-[#F5F2EB]">No Active Lot on the Block</div>
              <p className="text-xs text-[#8B8680]">
                {canOperate
                  ? "Select a sport and press Next [N] in the Operator Console to bring a player on stage."
                  : "Waiting for Auction Operator to bring the next player onto the stage."}
              </p>
            </div>
          )}

          {/* Synced PAUSED Overlay */}
          {showPausedOverlay && (
            <div className="absolute inset-0 z-20 bg-[#08080A]/92 backdrop-blur-sm flex flex-col items-center justify-center gap-2 p-6 text-center">
              <Pause className="w-10 h-10 text-[#D97706]" />
              <div className="font-editorial text-4xl text-[#F5F2EB]">AUCTION STAGE PAUSED</div>
            </div>
          )}
        </section>

        {/* Top-Right (Cols 9-12): Role-Gated Single-Operator Console */}
        {canOperate && drawerOpen && (
          <aside className="lg:col-span-4 rdr-panel rdr-border-crimson rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h2 className="font-editorial text-xl text-[#D97706] flex items-center gap-1.5">
                <Shield className="w-4 h-4" /> Operator Stage Console
              </h2>
              <span className="text-[10px] font-mono text-[#8B8680]">KEYS: 1-8 · S · X · U · N</span>
            </div>

            {auction.status !== "LIVE" && (
              <div className="p-3 rounded bg-[#D97706]/15 border border-[#D97706]/60 space-y-2 text-xs">
                <div className="flex items-start gap-2 text-[#F59E0B] font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Bidding and keys <span className="font-mono">1–8</span> are locked while status is{" "}
                    <span className="font-mono text-[#F5F2EB]">{auction.status}</span>.
                  </span>
                </div>
                {snapshot.permissions.canManageConfig && (
                  <div className="flex flex-wrap gap-1.5">
                    {(auction.status === "DRAFT" || auction.status === "FROZEN") && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleLifecycleChange("REGISTRATION_OPEN")}
                        className="px-2.5 py-1 rounded bg-[#10B981] text-[#08080A] text-[11px] font-bold uppercase"
                      >
                        Open Registration
                      </button>
                    )}
                    {auction.status === "REGISTRATION_OPEN" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleLifecycleChange("FROZEN")}
                        className="px-2.5 py-1 rounded bg-[#D97706] text-[#08080A] text-[11px] font-bold uppercase"
                      >
                        Close Registration
                      </button>
                    )}
                    {(auction.status === "REGISTRATION_OPEN" || auction.status === "FROZEN") && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleLifecycleChange("LIVE")}
                        className="px-3 py-1 rounded bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[11px] font-bold uppercase"
                      >
                        Set Auction LIVE
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Sport & Round Switcher */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <select
                value={activeSportId ?? ""}
                onChange={(e) => {
                  sendCommand("/api/auction/context", { sportId: Number(e.target.value) });
                  e.currentTarget.blur();
                }}
                className="bg-[#08080A] border border-white/15 rounded px-2 py-1.5"
              >
                {snapshot.sports.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={auction.activeRoundId ?? ""}
                onChange={(e) => {
                  sendCommand("/api/auction/context", { roundId: Number(e.target.value) });
                  e.currentTarget.blur();
                }}
                className="bg-[#08080A] border border-white/15 rounded px-2 py-1.5"
              >
                {snapshot.rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Stage Queue / Next Player */}
            <div className="flex gap-2 text-xs">
              <select
                value={selectedQueueId}
                onChange={(e) => {
                  setSelectedQueueId(e.target.value ? Number(e.target.value) : "");
                  e.currentTarget.blur();
                }}
                className="flex-1 bg-[#08080A] border border-white/15 rounded px-2 py-1.5"
              >
                <option value="">Auto Next Eligible ({sportEligiblePool.length})</option>
                {sportEligiblePool.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName} ({p.tier} · ₹{p.basePrice})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  sendCommand("/api/auction/next-player", {
                    sportId: activeSportId ?? undefined,
                    auctionPlayerId: selectedQueueId === "" ? undefined : Number(selectedQueueId),
                  })
                }
                className="px-3 py-1.5 rounded bg-[#D97706] text-[#08080A] font-bold uppercase flex items-center gap-1"
              >
                Next [N] <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Franchise Quick-Bid Hotkeys [1]-[8] */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-[#8B8680] font-bold">
                Quick Bid ({leadingBid ? `+₹${nextStandardIncrement}` : `Open ₹${nextQuickBidAmount}`})
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {activeFranchises.map((f, idx) => {
                  const hotkeyNum = f.slotNumber >= 1 && f.slotNumber <= 8 ? f.slotNumber : idx + 1;
                  const isLeading = leadingFranchise?.id === f.id;
                  const illegal =
                    !activePlayer ||
                    activePlayer.status !== "IN_AUCTION" ||
                    auction.status !== "LIVE" ||
                    isLeading ||
                    !f.eligibleToBid ||
                    nextQuickBidAmount > f.maxAllowedBid;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      disabled={busy || illegal}
                      onClick={() => handleQuickBid(f.id, "INCREMENT")}
                      className={`p-2 rounded border text-left text-xs transition ${
                        isLeading
                          ? "border-[#F59E0B] bg-[#F59E0B]/15 text-[#F5F2EB]"
                          : illegal
                          ? "border-white/5 bg-[#08080A] opacity-40 cursor-not-allowed"
                          : "border-white/15 bg-[#08080A] hover:border-[#D97706]"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>
                          [{hotkeyNum}] {f.shortCode}
                        </span>
                        <span className="font-mono text-[#10B981]">₹{f.remainingPurse}</span>
                      </div>
                      <div className="text-[10px] font-mono text-[#8B8680]">
                        Max Legal: ₹{f.maxAllowedBid}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Jump Bid + Outcomes + Undo + RTM + Projector */}
            <div className="flex gap-2 text-xs">
              <select
                value={jumpTargetFranchiseId ?? ""}
                onChange={(e) => {
                  setCustomBidFranchiseId(Number(e.target.value));
                  e.currentTarget.blur();
                }}
                className="flex-1 bg-[#08080A] border border-white/15 rounded px-2 py-1.5"
              >
                {activeFranchises.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.shortCode} (Max ₹{f.maxAllowedBid})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !jumpTargetFranchiseId || !activePlayer || auction.status !== "LIVE"}
                onClick={() =>
                  jumpTargetFranchiseId && handleQuickBid(jumpTargetFranchiseId, "JUMP")
                }
                className="px-3 py-1.5 rounded bg-[#141418] border border-[#D97706]/60 disabled:opacity-40 text-[#F59E0B] font-bold"
              >
                Jump +₹{auction.jumpIncrement}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                disabled={busy || !leadingBid || activePlayer?.status !== "IN_AUCTION"}
                onClick={() => sendCommand("/api/auction/outcome", { outcome: "SOLD" })}
                className="py-2 rounded bg-[#10B981] disabled:opacity-40 text-[#08080A] font-bold uppercase flex items-center justify-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> SOLD [S]
              </button>
              <button
                type="button"
                disabled={busy || activePlayer?.status !== "IN_AUCTION"}
                onClick={() => sendCommand("/api/auction/outcome", { outcome: "UNSOLD" })}
                className="py-2 rounded bg-[#DC2626] disabled:opacity-40 text-white font-bold uppercase flex items-center justify-center gap-1"
              >
                <XCircle className="w-3.5 h-3.5" /> UNSOLD [X]
              </button>
              <button
                type="button"
                disabled={busy || !activePlayer}
                onClick={() => sendCommand("/api/auction/undo", {})}
                className="py-2 rounded bg-[#141418] border border-white/15 disabled:opacity-40 text-[#D6CFC2] font-semibold flex items-center justify-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Undo [U]
              </button>
            </div>

            <div className="flex gap-2 text-xs">
              {availableRtm?.previousFranchiseId && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    sendCommand("/api/auction/rtm", {
                      franchiseId: availableRtm.previousFranchiseId!,
                    })
                  }
                  className="flex-1 py-1.5 rounded bg-[#D97706] text-[#08080A] font-bold uppercase"
                >
                  Exercise RTM [R] (
                  {activeFranchises.find((f) => f.id === availableRtm.previousFranchiseId)?.shortCode})
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  sendCommand("/api/auction/projector", {
                    mode: auction.projectorMode === "PAUSED" ? "STAGE" : "PAUSED",
                  })
                }
                className="flex-1 py-1.5 rounded bg-white/10 text-[#D6CFC2] font-semibold flex items-center justify-center gap-1"
              >
                {auction.projectorMode === "PAUSED" ? (
                  <>
                    <Play className="w-3.5 h-3.5 text-[#10B981]" /> Resume Stage
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 text-[#D97706]" /> Pause [Space]
                  </>
                )}
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* MIDDLE-TO-BOTTOM ZONE: Full-Width Franchise Grid for Active Sport */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-editorial text-2xl text-[#F5F2EB]">
            {activeSport?.name} Franchises — Live Purses &amp; Squads
          </h2>
          <span className="text-xs font-mono text-[#8B8680]">
            {activeFranchises.length} FRANCHISES • PER-SPORT PURSE ISOLATED
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {activeFranchises.map((f) => {
            const isLeading = leadingFranchise?.id === f.id;
            return (
              <div
                key={f.id}
                className={`rdr-panel rounded-lg overflow-hidden flex flex-col transition ${
                  isLeading ? "leading-gold-glow border-[#F59E0B]" : "border-white/10"
                }`}
              >
                <div className="h-1.5 w-full" style={{ backgroundColor: f.accentColor }} />
                <div className="p-4 space-y-3 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-editorial text-2xl text-[#F5F2EB] leading-none">
                        {f.name}
                      </div>
                      <div className="text-[11px] text-[#8B8680] mt-1">
                        Captain: <span className="text-[#D6CFC2]">{f.captain?.name ?? "TBD"}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-white/10 font-mono text-xs font-bold text-[#F5F2EB]">
                      {f.shortCode}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded bg-[#08080A] border border-white/10 text-xs">
                    <div>
                      <div className="text-[10px] text-[#8B8680] uppercase">Remaining Purse</div>
                      <div className="font-mono tabular-nums text-lg font-bold text-[#10B981]">
                        ₹{(f.remainingPurse ?? 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-[#8B8680] uppercase">Max Legal Bid</div>
                      <div className="font-mono tabular-nums text-lg font-bold text-[#F59E0B]">
                        ₹{(f.maxAllowedBid ?? 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-[#D6CFC2]">
                      Squad: {f.squadCount ?? 0} / {f.maxSquad ?? 0}
                    </div>
                    <div className="text-right text-[11px] font-mono tabular-nums text-[#8B8680]">
                      CLUB {f.clubCount ?? 0}/{f.minClubQuota ?? 0} · NON {f.nonClubCount ?? 0}/{f.minNonClubQuota ?? 0}
                    </div>
                  </div>

                  <div className="space-y-1 flex-1">
                    <div className="text-[10px] uppercase tracking-wider text-[#D97706] font-bold">
                      Purchased Players ({(f.boughtPlayers ?? []).length})
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {(f.boughtPlayers ?? []).length === 0 ? (
                        <div className="text-[11px] text-[#8B8680] py-2">No signings yet.</div>
                      ) : (
                        (f.boughtPlayers ?? []).map((bp) => (
                          <div
                            key={bp.id}
                            className="p-2 rounded bg-[#08080A] border border-white/5 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-[#F5F2EB] truncate">{bp.name}</div>
                              <div className="text-[10px] text-[#8B8680] truncate">
                                {(bp.positions ?? []).join(", ")} · {bp.playerClass}
                              </div>
                            </div>
                            <span className="font-mono font-bold text-[#F59E0B] shrink-0">
                              ₹{(bp.soldPrice ?? 0).toLocaleString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
        </>
      )}
    </div>
  );
}
