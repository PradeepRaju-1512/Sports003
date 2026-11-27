import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeftRight,
  Clock,
  Code2,
  Lock,
  Pause,
  Play,
  Radio,
  RotateCcw,
  RotateCw,
  Users,
  X,
} from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { apiFetch } from "../lib/api.ts";
import {
  computeElapsedClockMs,
  formatClockMs,
  type DerivedMatchState,
  type SportId,
} from "../../../shared/scoring/types.ts";
import {
  formatMatchTimeline,
  type FormattedTimelineItem,
} from "../../../shared/scoring/formatEvent.ts";

interface MatchSummary {
  id: number;
  status: string;
  roundLabel: string;
  scoreSummary: string | null;
  sport: { name: string; slug: SportId } | null;
  teamA: { id: number; name: string; shortCode: string } | null;
  teamB: { id: number; name: string; shortCode: string } | null;
}

interface HydratedScorerMatch {
  match: {
    id: number;
    status: "UPCOMING" | "LIVE" | "COMPLETED";
    roundLabel: string;
    venue: string;
    version: number;
    lineupAJson: number[];
    lineupBJson: number[];
  };
  sport: { name: string; slug: SportId };
  teamA: {
    id: number;
    name: string;
    shortCode: string;
    roster: Array<{ playerProfileId: number; displayName: string; playingRole: string | null }>;
  };
  teamB: {
    id: number;
    name: string;
    shortCode: string;
    roster: Array<{ playerProfileId: number; displayName: string; playingRole: string | null }>;
  };
  scorerUser: { id: number; name: string } | null;
  playerNames?: Record<number, string>;
  events: Array<{
    seq: number;
    occurredAt: string;
    matchClockMs?: number | null;
    eventType: string;
    payloadJson: Record<string, unknown>;
    voided: boolean;
  }>;
  derived: DerivedMatchState;
  serverNowMs?: number;
  clock?: {
    clockRunning: boolean;
    clockAnchorMs: number | null;
    clockAccumulatedMs: number;
  };
  permissions: { canScore: boolean; canVerify: boolean };
}

const OFFLINE_QUEUE_KEY = "iiitt_scorer_offline_queue_v1";

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getScopedRoster(
  roster: Array<{ playerProfileId: number; displayName: string; playingRole: string | null }>,
  lineupIds?: number[]
) {
  if (!Array.isArray(lineupIds) || lineupIds.length === 0) return roster;
  const idSet = new Set(lineupIds);
  const inLineup = roster.filter((p) => idSet.has(p.playerProfileId));
  return inLineup.length > 0 ? inLineup : roster;
}

export function ScorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, hasGlobalSportsAuthority, sseVersion, lastSseEvent, notifyToast } = useApp();

  const [allMatches, setAllMatches] = useState<MatchSummary[]>([]);
  const [activeMatch, setActiveMatch] = useState<HydratedScorerMatch | null>(null);
  const [clockDisplay, setClockDisplay] = useState("00:00");
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [mobileDrawer, setMobileDrawer] = useState<"NONE" | "ROSTERS" | "TIMELINE">("NONE");
  const [busy, setBusy] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [inspectItem, setInspectItem] = useState<FormattedTimelineItem | null>(null);

  // Cricket player, dismissal & modal state
  const [batterId, setBatterId] = useState<number>(0);
  const [nonStrikerId, setNonStrikerId] = useState<number>(0);
  const [bowlerId, setBowlerId] = useState<number>(0);
  const [wicketType, setWicketType] = useState<"BOWLED" | "CAUGHT" | "LBW" | "RUN_OUT" | "STUMPED" | "HIT_WICKET" | "RETIRED_HURT">("BOWLED");
  const [fielderId, setFielderId] = useState<number>(0);
  const [activeSide, setActiveSide] = useState<"A" | "B">("A");
  const [extraPanel, setExtraPanel] = useState<"NONE" | "WD" | "NB" | "B" | "LB">("NONE");
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [dismissedSide, setDismissedSide] = useState<"STRIKER" | "NON_STRIKER">("STRIKER");
  const [nextBatterId, setNextBatterId] = useState<number>(0);
  const [showInningsModal, setShowInningsModal] = useState(false);
  const [inn2Batter1, setInn2Batter1] = useState<number>(0);
  const [inn2Batter2, setInn2Batter2] = useState<number>(0);
  const [inn2Bowler, setInn2Bowler] = useState<number>(0);
  const [showSuperOverModal, setShowSuperOverModal] = useState<"NONE" | "START" | "SWITCH">("NONE");
  const [soBattingSide, setSoBattingSide] = useState<"A" | "B">("A");
  const [soBatter1, setSoBatter1] = useState<number>(0);
  const [soBatter2, setSoBatter2] = useState<number>(0);
  const [soBowler, setSoBowler] = useState<number>(0);
  const [chessSan, setChessSan] = useState("e4");
  const oversStripRef = useRef<HTMLDivElement | null>(null);

  const requestedId = Number(searchParams.get("matchId") ?? 0);

  const loadList = useCallback(async () => {
    try {
      const res = await apiFetch<{
        liveMatches: MatchSummary[];
        upcomingMatches: MatchSummary[];
        completedMatches: MatchSummary[];
      }>("/api/matches");
      const combined = [...res.liveMatches, ...res.upcomingMatches, ...res.completedMatches];
      setAllMatches(combined);
      if (!requestedId && combined.length > 0) {
        setSearchParams({ matchId: String(combined[0].id) }, { replace: true });
      }
    } catch {
      // handled
    }
  }, [requestedId, setSearchParams]);

  const loadMatch = useCallback(async () => {
    if (!requestedId) return;
    try {
      const res = await apiFetch<HydratedScorerMatch>(`/api/matches/${requestedId}`);
      setActiveMatch(res);
      if (typeof res.serverNowMs === "number") {
        setClockOffsetMs(res.serverNowMs - Date.now());
      }
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  }, [requestedId, notifyToast]);

  // Cricket derived state helpers
  const isCricket = activeMatch?.sport.slug === "cricket";
  const cricDetail = isCricket
    ? (activeMatch.derived.detail as {
        currentInningsIdx?: number;
        oversLimit?: number;
        crr?: number;
        rrr?: number | null;
        target?: number | null;
        runsNeeded?: number | null;
        ballsRemaining?: number;
        freeHit?: boolean;
        battingSide?: "A" | "B";
        bowlingSide?: "A" | "B";
        strikerId?: number | null;
        nonStrikerId?: number | null;
        bowlerId?: number | null;
        lastCompletedOverBowlerId?: number | null;
        overJustCompleted?: boolean;
        innings1Complete?: boolean;
        innings2Complete?: boolean;
        matchTied?: boolean;
        extras?: { wd: number; nb: number; b: number; lb: number };
        activeBatters?: Array<{ playerId: number; runs: number; balls: number; fours: number; sixes: number; out: boolean; dismissal: string }>;
        activeBowlers?: Array<{ playerId: number; balls: number; maidens: number; runs: number; wickets: number }>;
        oversGroups?: Array<{ overNumber: number; balls: string[]; isSuperOver?: boolean; superOverIndex?: number }>;
        isSuperOver?: boolean;
        superOverIndex?: number;
        superOverHalf?: number;
        superOverTarget?: number | null;
        superOverHalf1Complete?: boolean;
        superOverComplete?: boolean;
      })
    : null;

  const cricBattingSide: "A" | "B" = cricDetail?.battingSide ?? activeSide;
  const cricBowlingSide: "A" | "B" = cricBattingSide === "A" ? "B" : "A";
  const isClockSport = Boolean(
    activeMatch && ["football", "kho_kho", "kabaddi", "chess"].includes(activeMatch.sport.slug)
  );

  const cricBatRoster = useMemo(() => {
    if (!activeMatch || !isCricket) return [];
    const team = cricBattingSide === "A" ? activeMatch.teamA : activeMatch.teamB;
    const lineup = cricBattingSide === "A" ? activeMatch.match.lineupAJson : activeMatch.match.lineupBJson;
    return getScopedRoster(team.roster, lineup);
  }, [activeMatch, isCricket, cricBattingSide]);

  const cricBowlRoster = useMemo(() => {
    if (!activeMatch || !isCricket) return [];
    const team = cricBowlingSide === "A" ? activeMatch.teamA : activeMatch.teamB;
    const lineup = cricBowlingSide === "A" ? activeMatch.match.lineupAJson : activeMatch.match.lineupBJson;
    return getScopedRoster(team.roster, lineup);
  }, [activeMatch, isCricket, cricBowlingSide]);

  const cricBatterMap = useMemo(() => {
    const map: Record<number, { runs: number; balls: number; fours: number; sixes: number; out: boolean; dismissal: string }> = {};
    for (const b of cricDetail?.activeBatters ?? []) {
      map[b.playerId] = b;
    }
    return map;
  }, [cricDetail?.activeBatters]);

  const cricBowlerMap = useMemo(() => {
    const map: Record<number, { balls: number; maidens: number; runs: number; wickets: number }> = {};
    for (const bw of cricDetail?.activeBowlers ?? []) {
      map[bw.playerId] = bw;
    }
    return map;
  }, [cricDetail?.activeBowlers]);

  const availableBatters = useMemo(
    () => cricBatRoster.filter((p) => !cricBatterMap[p.playerProfileId]?.out),
    [cricBatRoster, cricBatterMap]
  );

  // Sync striker, non-striker, and bowler cleanly from reducer + team-scoped rosters
  useEffect(() => {
    if (!activeMatch || !isCricket) return;
    if (cricDetail?.battingSide && cricDetail.battingSide !== activeSide) {
      setActiveSide(cricDetail.battingSide);
    }

    const validBatIds = new Set(availableBatters.map((p) => p.playerProfileId));
    const desiredStriker =
      cricDetail?.strikerId && validBatIds.has(cricDetail.strikerId)
        ? cricDetail.strikerId
        : availableBatters[0]?.playerProfileId ?? 0;

    let desiredNonStriker =
      cricDetail?.nonStrikerId &&
      validBatIds.has(cricDetail.nonStrikerId) &&
      cricDetail.nonStrikerId !== desiredStriker
        ? cricDetail.nonStrikerId
        : availableBatters.find((p) => p.playerProfileId !== desiredStriker)?.playerProfileId ?? 0;

    setBatterId(desiredStriker);
    setNonStrikerId(desiredNonStriker);

    const validBowlIds = new Set(cricBowlRoster.map((p) => p.playerProfileId));
    const desiredBowler =
      cricDetail?.bowlerId && validBowlIds.has(cricDetail.bowlerId)
        ? cricDetail.bowlerId
        : cricBowlRoster[0]?.playerProfileId ?? 0;
    setBowlerId(desiredBowler);
    setFielderId((prev) => (validBowlIds.has(prev) ? prev : 0));
  }, [
    activeMatch?.match.id,
    isCricket,
    cricDetail?.battingSide,
    cricDetail?.strikerId,
    cricDetail?.nonStrikerId,
    cricDetail?.bowlerId,
    availableBatters,
    cricBowlRoster,
    activeSide,
  ]);

  // Auto-scroll chronological over strip to the active over
  useEffect(() => {
    if (oversStripRef.current) {
      oversStripRef.current.scrollLeft = oversStripRef.current.scrollWidth;
    }
  }, [cricDetail?.oversGroups?.length, activeMatch?.events.length]);

  useEffect(() => {
    loadList();
  }, [loadList, sseVersion]);

  useEffect(() => {
    loadMatch();
  }, [loadMatch, sseVersion, user?.id]);

  // Apply real-time clock delta cleanly if MATCH_CLOCK arrives
  useEffect(() => {
    if (!lastSseEvent || lastSseEvent.type !== "MATCH_CLOCK" || !activeMatch) return;
    const d = lastSseEvent.data;
    if (Number(d.matchId) !== activeMatch.match.id) return;
    setActiveMatch((prev) =>
      prev
        ? {
            ...prev,
            derived: {
              ...prev.derived,
              clock: {
                running: Boolean(d.clockRunning),
                anchorEpochMs: d.clockAnchorMs ? Number(d.clockAnchorMs) : null,
                accumulatedMs: Number(d.clockAccumulatedMs ?? 0),
              },
            },
          }
        : prev
    );
  }, [lastSseEvent, activeMatch?.match.id]);

  // Timestamp-anchored clock ticker with server clock skew compensation
  useEffect(() => {
    if (!activeMatch) return;
    const updateClock = () => {
      const ms = computeElapsedClockMs(activeMatch.derived.clock, Date.now() + clockOffsetMs);
      setClockDisplay(formatClockMs(ms));
    };
    updateClock();
    const timer = setInterval(updateClock, 250);
    return () => clearInterval(timer);
  }, [activeMatch, clockOffsetMs]);

  useEffect(() => {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const queued: Array<{ matchId: number; eventType: string; payloadJson: Record<string, unknown> }> = raw
      ? JSON.parse(raw)
      : [];
    setOfflineCount(queued.length);
  }, [sseVersion]);

  const timelineItems = useMemo(() => {
    if (!activeMatch) return [];
    const playerNames: Record<number, string> = { ...(activeMatch.playerNames ?? {}) };
    for (const p of [...activeMatch.teamA.roster, ...activeMatch.teamB.roster]) {
      playerNames[p.playerProfileId] = p.displayName;
    }
    return formatMatchTimeline(activeMatch.events, {
      sportId: activeMatch.sport.slug,
      teamAShort: activeMatch.teamA.shortCode,
      teamBShort: activeMatch.teamB.shortCode,
      playerNames,
    });
  }, [activeMatch]);

  const canActuallyScore = Boolean(
    user &&
      activeMatch &&
      activeMatch.permissions.canScore &&
      (hasGlobalSportsAuthority || activeMatch.scorerUser?.id === user.id)
  );

  // Desktop keyboard shortcuts for live Cricket scoring
  useEffect(() => {
    if (!isCricket || !canActuallyScore || activeMatch?.match.status !== "LIVE" || busy) return;
    if (showWicketModal || showInningsModal || showSuperOverModal !== "NONE" || cricDetail?.overJustCompleted) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (["0", "1", "2", "3", "4", "6"].includes(k)) {
        e.preventDefault();
        sendEvent("BALL", {
          side: cricBattingSide,
          runs: Number(k),
          extraType: null,
          wicket: false,
          batterId,
          nonStrikerId,
          bowlerId,
        });
      } else if (k === "w") {
        e.preventDefault();
        setExtraPanel((p) => (p === "WD" ? "NONE" : "WD"));
      } else if (k === "n") {
        e.preventDefault();
        setExtraPanel((p) => (p === "NB" ? "NONE" : "NB"));
      } else if (k === "x") {
        e.preventDefault();
        setDismissedSide("STRIKER");
        if (cricDetail?.freeHit) setWicketType("RUN_OUT");
        setShowWicketModal(true);
      } else if (k === "s") {
        e.preventDefault();
        sendEvent("SWAP_STRIKE", {});
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const sendClockAction = async (action: "START" | "PAUSE" | "RESET") => {
    if (!activeMatch || !canActuallyScore) return;
    setBusy(true);
    try {
      const res = await apiFetch<{
        clockRunning: boolean;
        clockAnchorMs: number | null;
        clockAccumulatedMs: number;
        version: number;
      }>(`/api/matches/${activeMatch.match.id}/clock`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      setActiveMatch((prev) =>
        prev
          ? {
              ...prev,
              match: { ...prev.match, version: res.version },
              derived: {
                ...prev.derived,
                clock: {
                  running: res.clockRunning,
                  anchorEpochMs: res.clockAnchorMs,
                  accumulatedMs: res.clockAccumulatedMs,
                },
              },
            }
          : prev
      );
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendEvent = async (eventType: string, payloadJson: Record<string, unknown>) => {
    if (!activeMatch || !canActuallyScore) return;
    setBusy(true);
    const idempotencyKey = createIdempotencyKey();
    const elapsed = computeElapsedClockMs(activeMatch.derived.clock, Date.now() + clockOffsetMs);
    const expectedVersion = activeMatch.match.version;
    try {
      const res = await apiFetch<{
        derived: DerivedMatchState;
        version: number;
        clock?: { clockRunning: boolean; clockAnchorMs: number | null; clockAccumulatedMs: number } | null;
      }>(`/api/matches/${activeMatch.match.id}/events`, {
        method: "POST",
        headers: { "X-Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          eventType,
          payloadJson,
          matchClockMs: elapsed,
          expectedVersion,
          idempotencyKey,
        }),
      });
      if (res.clock) {
        setActiveMatch((prev) =>
          prev
            ? {
                ...prev,
                match: { ...prev.match, version: res.version },
                derived: res.derived,
              }
            : prev
        );
      }
      await loadMatch();
    } catch (err) {
      if (err instanceof TypeError) {
        const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
        const q = raw ? JSON.parse(raw) : [];
        q.push({
          matchId: activeMatch.match.id,
          eventType,
          payloadJson,
          matchClockMs: elapsed,
          idempotencyKey,
        });
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
        setOfflineCount(q.length);
        notifyToast("info", "Network offline — event queued in localStorage.");
      } else {
        notifyToast("error", (err as Error).message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async () => {
    if (!activeMatch || !canActuallyScore) return;
    const activeEvs = activeMatch.events.filter((e) => !e.voided);
    const lastEv = activeEvs[activeEvs.length - 1];
    if (!lastEv) return;
    setBusy(true);
    try {
      await apiFetch(`/api/matches/${activeMatch.match.id}/events/${lastEv.seq}/void`, {
        method: "POST",
      });
      await loadMatch();
      notifyToast("info", `Undid event #${lastEv.seq}.`);
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleTransition = async (nextStatus: "LIVE" | "COMPLETED") => {
    if (!activeMatch || !canActuallyScore) return;
    setBusy(true);
    try {
      await apiFetch(`/api/matches/${activeMatch.match.id}/transition`, {
        method: "POST",
        body: JSON.stringify({
          nextStatus,
          expectedVersion: activeMatch.match.version,
        }),
      });
      await loadMatch();
      notifyToast("success", `Match transitioned to ${nextStatus}.`);
    } catch (err) {
      notifyToast("error", (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const flushOfflineQueue = async () => {
    if (!canActuallyScore) return;
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;
    const q: Array<{
      matchId: number;
      eventType: string;
      payloadJson: Record<string, unknown>;
      matchClockMs?: number;
      idempotencyKey?: string;
    }> = JSON.parse(raw);
    const remaining: typeof q = [];
    for (const item of q) {
      const key = item.idempotencyKey ?? createIdempotencyKey();
      try {
        await apiFetch(`/api/matches/${item.matchId}/events`, {
          method: "POST",
          headers: { "X-Idempotency-Key": key },
          body: JSON.stringify({
            eventType: item.eventType,
            payloadJson: item.payloadJson,
            ...(item.matchClockMs !== undefined ? { matchClockMs: item.matchClockMs } : {}),
            idempotencyKey: key,
          }),
        });
      } catch {
        remaining.push({ ...item, idempotencyKey: key });
      }
    }
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    setOfflineCount(remaining.length);
    await loadMatch();
    const syncedCount = q.length - remaining.length;
    if (remaining.length === 0) {
      notifyToast("success", `Synced ${syncedCount} queued offline event(s).`);
    } else if (syncedCount > 0) {
      notifyToast("info", `Synced ${syncedCount} event(s); ${remaining.length} still pending.`);
    } else {
      notifyToast("error", `Failed to sync ${remaining.length} queued offline event(s).`);
    }
  };

  const badgeClass = (tone: FormattedTimelineItem["badgeTone"]) => {
    switch (tone) {
      case "crimson":
        return "bg-[#DC2626] text-white border-[#DC2626]";
      case "ochre":
        return "bg-[#D97706]/25 text-[#F59E0B] border-[#D97706]";
      case "emerald":
        return "bg-[#10B981]/20 text-[#10B981] border-[#10B981]/60";
      default:
        return "bg-[#141418] text-[#D6CFC2] border-white/15";
    }
  };

  const renderTimelineRows = () => (
    <div className="max-h-[440px] overflow-y-auto space-y-2 pr-1">
      {timelineItems.length === 0 ? (
        <p className="text-xs text-[#8B8680] py-4 text-center">No scoring events logged yet.</p>
      ) : (
        timelineItems.map((item) => (
          <div
            key={item.seq}
            className={`p-2.5 rounded border flex items-center justify-between gap-2.5 min-w-0 ${
              item.voided
                ? "bg-[#0D0D0F]/50 border-white/5 opacity-45 line-through"
                : "bg-[#0D0D0F] border-white/10"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="flex flex-col items-center shrink-0 w-11">
                <span className="font-mono text-[10px] text-[#8B8680]">#{item.seq}</span>
                <span className="font-mono text-[10px] text-[#D97706] truncate max-w-full">
                  {item.contextLabel}
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded border font-mono text-[11px] font-bold shrink-0 ${badgeClass(
                  item.badgeTone
                )}`}
              >
                {item.badge}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[#F5F2EB] truncate">
                  {item.headline}
                </div>
                <div className="text-[11px] text-[#8B8680] truncate">{item.subline}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInspectItem(item)}
              title="Inspect Raw Event"
              className="p-1.5 rounded bg-[#161618] border border-white/10 hover:border-[#D97706]/60 text-[#8B8680] hover:text-[#F5F2EB] shrink-0"
            >
              <Code2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))
      )}
    </div>
  );

  const renderSportPad = () => {
    if (!activeMatch || !canActuallyScore || activeMatch.match.status !== "LIVE") {
      return null;
    }

    const sport = activeMatch.sport.slug;

    if (sport === "cricket") {
      const strikerStat = cricBatterMap[batterId] ?? { runs: 0, balls: 0, fours: 0, sixes: 0 };
      const nonStrikerStat = cricBatterMap[nonStrikerId] ?? { runs: 0, balls: 0, fours: 0, sixes: 0 };
      const bowlerStat = cricBowlerMap[bowlerId] ?? { balls: 0, maidens: 0, runs: 0, wickets: 0 };
      const strikerSr = strikerStat.balls > 0 ? ((strikerStat.runs / strikerStat.balls) * 100).toFixed(1) : "0.0";
      const nonStrikerSr = nonStrikerStat.balls > 0 ? ((nonStrikerStat.runs / nonStrikerStat.balls) * 100).toFixed(1) : "0.0";
      const bowlerOvers = `${Math.floor(bowlerStat.balls / 6)}.${bowlerStat.balls % 6}`;
      const bowlerEcon = bowlerStat.balls > 0 ? ((bowlerStat.runs * 6) / bowlerStat.balls).toFixed(2) : "0.00";
      const strikerName = cricBatRoster.find((p) => p.playerProfileId === batterId)?.displayName ?? "Striker";
      const nonStrikerName = cricBatRoster.find((p) => p.playerProfileId === nonStrikerId)?.displayName ?? "Non-Striker";
      const bowlerName = cricBowlRoster.find((p) => p.playerProfileId === bowlerId)?.displayName ?? "Bowler";
      const inningsBlocked = Boolean(
        cricDetail?.innings1Complete ||
          cricDetail?.innings2Complete ||
          cricDetail?.superOverHalf1Complete ||
          cricDetail?.superOverComplete
      );

      return (
        <div className="space-y-3.5">
          {/* Live Crease Mini-Scorecard */}
          <div className="p-3 rounded bg-[#0D0D0F] border border-white/10 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#F59E0B] truncate">* {strikerName}</span>
                  <span className="font-mono text-[#F5F2EB] shrink-0">
                    {strikerStat.runs} ({strikerStat.balls}) · {strikerStat.fours}×4 · {strikerStat.sixes}×6 · SR {strikerSr}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[#D6CFC2]">
                  <span className="truncate">{nonStrikerName}</span>
                  <span className="font-mono text-[#8B8680] shrink-0">
                    {nonStrikerStat.runs} ({nonStrikerStat.balls}) · {nonStrikerStat.fours}×4 · {nonStrikerStat.sixes}×6 · SR {nonStrikerSr}
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={busy || !batterId || !nonStrikerId}
                onClick={() => sendEvent("SWAP_STRIKE", {})}
                title="Swap Strike (S)"
                className="px-2.5 py-1.5 rounded bg-[#161618] border border-white/15 hover:border-[#D97706] text-[11px] font-semibold flex items-center gap-1 shrink-0"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-[#D97706]" /> Swap Strike
              </button>
            </div>
            <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[11px]">
              <span className="text-[#8B8680]">
                Bowler: <span className="text-[#F5F2EB] font-semibold">{bowlerName}</span>
              </span>
              <span className="font-mono text-[#10B981]">
                {bowlerOvers}-{bowlerStat.maidens}-{bowlerStat.runs}-{bowlerStat.wickets} · ECON {bowlerEcon}
              </span>
            </div>
          </div>

          {/* Strict Team-Scoped Player Selectors */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <label className="text-[10px] text-[#8B8680] uppercase block mb-1">Striker</label>
              <select
                value={batterId}
                onChange={(e) => {
                  const nextId = Number(e.target.value);
                  setBatterId(nextId);
                  sendEvent("SET_PLAYERS", { strikerId: nextId, nonStrikerId, bowlerId });
                }}
                className="w-full bg-[#0D0D0F] border border-white/15 rounded px-2 py-1.5"
              >
                {availableBatters
                  .filter((p) => p.playerProfileId !== nonStrikerId)
                  .map((p) => (
                    <option key={p.playerProfileId} value={p.playerProfileId}>{p.displayName}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#8B8680] uppercase block mb-1">Non-Striker</label>
              <select
                value={nonStrikerId}
                onChange={(e) => {
                  const nextId = Number(e.target.value);
                  setNonStrikerId(nextId);
                  sendEvent("SET_PLAYERS", { strikerId: batterId, nonStrikerId: nextId, bowlerId });
                }}
                className="w-full bg-[#0D0D0F] border border-white/15 rounded px-2 py-1.5"
              >
                {availableBatters
                  .filter((p) => p.playerProfileId !== batterId)
                  .map((p) => (
                    <option key={p.playerProfileId} value={p.playerProfileId}>{p.displayName}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#8B8680] uppercase block mb-1">Bowler</label>
              <select
                value={bowlerId}
                onChange={(e) => {
                  const nextId = Number(e.target.value);
                  setBowlerId(nextId);
                  sendEvent("SET_PLAYERS", { strikerId: batterId, nonStrikerId, bowlerId: nextId });
                }}
                className="w-full bg-[#0D0D0F] border border-white/15 rounded px-2 py-1.5"
              >
                {cricBowlRoster.map((p) => (
                  <option key={p.playerProfileId} value={p.playerProfileId}>{p.displayName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Primary Runs + Extras Triggers */}
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3, 4, 6].map((runs) => (
              <button
                key={runs}
                disabled={busy || inningsBlocked}
                onClick={() =>
                  sendEvent("BALL", {
                    side: cricBattingSide,
                    runs,
                    extraType: null,
                    wicket: false,
                    batterId,
                    nonStrikerId,
                    bowlerId,
                  })
                }
                className={`py-3 rounded font-editorial text-2xl border transition ${
                  runs === 4 || runs === 6
                    ? "bg-[#D97706]/25 border-[#D97706] text-[#F59E0B]"
                    : "bg-[#161618] border-white/15 hover:border-[#F5F2EB]"
                }`}
              >
                {runs}
              </button>
            ))}
            <button
              type="button"
              disabled={busy || inningsBlocked}
              onClick={() => setExtraPanel((p) => (p === "WD" ? "NONE" : "WD"))}
              className={`py-3 rounded font-bold text-xs border ${
                extraPanel === "WD"
                  ? "bg-[#D97706] text-[#08080A] border-[#D97706]"
                  : "bg-[#161618] border-white/15 hover:border-[#D97706]"
              }`}
            >
              WIDE
            </button>
            <button
              type="button"
              disabled={busy || inningsBlocked}
              onClick={() => setExtraPanel((p) => (p === "NB" ? "NONE" : "NB"))}
              className={`py-3 rounded font-bold text-xs border ${
                extraPanel === "NB"
                  ? "bg-[#D97706] text-[#08080A] border-[#D97706]"
                  : "bg-[#161618] border-white/15 hover:border-[#D97706]"
              }`}
            >
              NO BALL
            </button>
          </div>

          {/* Variable Extras Sub-Chips */}
          {extraPanel === "WD" && (
            <div className="p-2.5 rounded bg-[#0D0D0F] border border-[#D97706]/50 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[10px] uppercase font-bold text-[#D97706]">Wide (+1 + extra):</span>
              {[0, 1, 2, 4].map((ex) => (
                <button
                  key={ex}
                  disabled={busy}
                  onClick={() => {
                    setExtraPanel("NONE");
                    sendEvent("BALL", {
                      side: cricBattingSide,
                      runs: ex,
                      extraType: "WD",
                      wicket: false,
                      batterId,
                      nonStrikerId,
                      bowlerId,
                    });
                  }}
                  className="px-3 py-1 rounded bg-[#161618] border border-white/15 hover:border-[#D97706] font-mono font-bold"
                >
                  WD +{ex}
                </button>
              ))}
            </div>
          )}

          {extraPanel === "NB" && (
            <div className="p-2.5 rounded bg-[#0D0D0F] border border-[#D97706]/50 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[10px] uppercase font-bold text-[#D97706]">No Ball (+1 + runs):</span>
              {[0, 1, 2, 4, 6].map((ex) => (
                <button
                  key={ex}
                  disabled={busy}
                  onClick={() => {
                    setExtraPanel("NONE");
                    sendEvent("BALL", {
                      side: cricBattingSide,
                      runs: ex,
                      extraType: "NB",
                      wicket: false,
                      batterId,
                      nonStrikerId,
                      bowlerId,
                    });
                  }}
                  className="px-3 py-1 rounded bg-[#161618] border border-white/15 hover:border-[#D97706] font-mono font-bold"
                >
                  NB +{ex}
                </button>
              ))}
            </div>
          )}

          {extraPanel === "B" && (
            <div className="p-2.5 rounded bg-[#0D0D0F] border border-white/20 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[10px] uppercase font-bold text-[#D6CFC2]">Byes:</span>
              {[1, 2, 3, 4].map((ex) => (
                <button
                  key={ex}
                  disabled={busy}
                  onClick={() => {
                    setExtraPanel("NONE");
                    sendEvent("BALL", {
                      side: cricBattingSide,
                      runs: ex,
                      extraType: "B",
                      wicket: false,
                      batterId,
                      nonStrikerId,
                      bowlerId,
                    });
                  }}
                  className="px-3 py-1 rounded bg-[#161618] border border-white/15 hover:border-[#D97706] font-mono font-bold"
                >
                  B {ex}
                </button>
              ))}
            </div>
          )}

          {extraPanel === "LB" && (
            <div className="p-2.5 rounded bg-[#0D0D0F] border border-white/20 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[10px] uppercase font-bold text-[#D6CFC2]">Leg Byes:</span>
              {[1, 2, 3, 4].map((ex) => (
                <button
                  key={ex}
                  disabled={busy}
                  onClick={() => {
                    setExtraPanel("NONE");
                    sendEvent("BALL", {
                      side: cricBattingSide,
                      runs: ex,
                      extraType: "LB",
                      wicket: false,
                      batterId,
                      nonStrikerId,
                      bowlerId,
                    });
                  }}
                  className="px-3 py-1 rounded bg-[#161618] border border-white/15 hover:border-[#D97706] font-mono font-bold"
                >
                  LB {ex}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              disabled={busy || inningsBlocked}
              onClick={() => {
                setDismissedSide("STRIKER");
                setNextBatterId(
                  availableBatters.find(
                    (p) => p.playerProfileId !== batterId && p.playerProfileId !== nonStrikerId
                  )?.playerProfileId ?? 0
                );
                if (cricDetail?.freeHit) setWicketType("RUN_OUT");
                setShowWicketModal(true);
              }}
              className="py-2.5 rounded bg-[#B91C1C] hover:bg-[#DC2626] font-bold text-xs uppercase"
            >
              Wicket
            </button>
            <button
              type="button"
              disabled={busy || inningsBlocked}
              onClick={() => setExtraPanel((p) => (p === "B" ? "NONE" : "B"))}
              className={`py-2.5 rounded border text-xs font-semibold ${
                extraPanel === "B"
                  ? "bg-white/20 border-white/40"
                  : "bg-[#161618] border-white/15"
              }`}
            >
              Bye
            </button>
            <button
              type="button"
              disabled={busy || inningsBlocked}
              onClick={() => setExtraPanel((p) => (p === "LB" ? "NONE" : "LB"))}
              className={`py-2.5 rounded border text-xs font-semibold ${
                extraPanel === "LB"
                  ? "bg-white/20 border-white/40"
                  : "bg-[#161618] border-white/15"
              }`}
            >
              Leg Bye
            </button>
            {cricDetail?.currentInningsIdx === 0 && !cricDetail?.isSuperOver && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const nextSide = cricBattingSide === "A" ? "B" : "A";
                  const nextBatList = getScopedRoster(
                    nextSide === "A" ? activeMatch.teamA.roster : activeMatch.teamB.roster,
                    nextSide === "A" ? activeMatch.match.lineupAJson : activeMatch.match.lineupBJson
                  );
                  const nextBowlList = getScopedRoster(
                    nextSide === "A" ? activeMatch.teamB.roster : activeMatch.teamA.roster,
                    nextSide === "A" ? activeMatch.match.lineupBJson : activeMatch.match.lineupAJson
                  );
                  setInn2Batter1(nextBatList[0]?.playerProfileId ?? 0);
                  setInn2Batter2(nextBatList[1]?.playerProfileId ?? 0);
                  setInn2Bowler(nextBowlList[0]?.playerProfileId ?? 0);
                  setShowInningsModal(true);
                }}
                className="py-2.5 rounded bg-[#161618] border border-[#D97706]/50 text-[#D97706] text-xs font-bold uppercase"
              >
                2nd Inn
              </button>
            )}
          </div>
          <div className="text-[10px] text-[#8B8680] hidden lg:block">
            Shortcuts: <span className="font-mono">0-6</span> runs · <span className="font-mono">W</span> wide · <span className="font-mono">N</span> no ball · <span className="font-mono">X</span> wicket · <span className="font-mono">S</span> swap strike · <span className="font-mono">Ctrl+Z</span> undo
          </div>
        </div>
      );
    }

    if (sport === "volleyball" || sport === "throwball" || sport === "badminton" || sport === "table_tennis") {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={busy}
              onClick={() => sendEvent("POINT", { side: "A" })}
              className="py-5 rounded bg-[#B91C1C] hover:bg-[#DC2626] font-editorial text-2xl"
            >
              +1 {activeMatch.teamA.shortCode}
            </button>
            <button
              disabled={busy}
              onClick={() => sendEvent("POINT", { side: "B" })}
              className="py-5 rounded bg-[#D97706] hover:bg-[#F59E0B] text-[#08080A] font-editorial text-2xl"
            >
              +1 {activeMatch.teamB.shortCode}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={busy}
              onClick={() => sendEvent("TIMEOUT", { side: "A" })}
              className="py-2 rounded bg-[#161618] border border-white/15 text-xs"
            >
              Timeout {activeMatch.teamA.shortCode}
            </button>
            <button
              disabled={busy}
              onClick={() => sendEvent("TIMEOUT", { side: "B" })}
              className="py-2 rounded bg-[#161618] border border-white/15 text-xs"
            >
              Timeout {activeMatch.teamB.shortCode}
            </button>
          </div>
        </div>
      );
    }

    if (sport === "football") {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={busy}
              onClick={() => sendEvent("GOAL", { side: "A" })}
              className="py-4 rounded bg-[#B91C1C] font-editorial text-2xl"
            >
              GOAL {activeMatch.teamA.shortCode}
            </button>
            <button
              disabled={busy}
              onClick={() => sendEvent("GOAL", { side: "B" })}
              className="py-4 rounded bg-[#D97706] text-[#08080A] font-editorial text-2xl"
            >
              GOAL {activeMatch.teamB.shortCode}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <button onClick={() => sendEvent("CARD", { side: "A", card: "YELLOW" })} className="py-2 rounded bg-[#D97706]/20 border border-[#D97706]">YC {activeMatch.teamA.shortCode}</button>
            <button onClick={() => sendEvent("CARD", { side: "B", card: "YELLOW" })} className="py-2 rounded bg-[#D97706]/20 border border-[#D97706]">YC {activeMatch.teamB.shortCode}</button>
            <button onClick={() => sendEvent("PERIOD", { period: "2H" })} className="py-2 rounded bg-[#161618] border border-white/15">2nd Half</button>
            <button onClick={() => sendEvent("PERIOD", { period: "FT" })} className="py-2 rounded bg-[#161618] border border-white/15">Full Time</button>
          </div>
        </div>
      );
    }

    if (sport === "kabaddi") {
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button onClick={() => sendEvent("RAID", { side: "A", points: 1 })} className="py-3 rounded bg-[#B91C1C] font-bold">Raid +1 ({activeMatch.teamA.shortCode})</button>
          <button onClick={() => sendEvent("RAID", { side: "B", points: 1 })} className="py-3 rounded bg-[#D97706] text-[#08080A] font-bold">Raid +1 ({activeMatch.teamB.shortCode})</button>
          <button onClick={() => sendEvent("RAID", { side: "A", points: 3 })} className="py-2 rounded bg-[#161618] border border-[#D97706]">Super Raid +3 ({activeMatch.teamA.shortCode})</button>
          <button onClick={() => sendEvent("RAID", { side: "B", points: 3 })} className="py-2 rounded bg-[#161618] border border-[#D97706]">Super Raid +3 ({activeMatch.teamB.shortCode})</button>
          <button onClick={() => sendEvent("TACKLE", { side: "A", superTackle: true })} className="py-2 rounded bg-[#161618] border border-white/15">Super Tackle +2 ({activeMatch.teamA.shortCode})</button>
          <button onClick={() => sendEvent("TACKLE", { side: "B", superTackle: true })} className="py-2 rounded bg-[#161618] border border-white/15">Super Tackle +2 ({activeMatch.teamB.shortCode})</button>
          <button onClick={() => sendEvent("ALL_OUT", { side: "A" })} className="py-2 rounded bg-[#161618] border border-white/15">All-Out +2 ({activeMatch.teamA.shortCode})</button>
          <button onClick={() => sendEvent("ALL_OUT", { side: "B" })} className="py-2 rounded bg-[#161618] border border-white/15">All-Out +2 ({activeMatch.teamB.shortCode})</button>
        </div>
      );
    }

    if (sport === "kho_kho") {
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button onClick={() => sendEvent("DISMISSAL", { side: "A", method: "TOUCH", points: 1 })} className="py-3 rounded bg-[#B91C1C] font-bold">Touch Out +1 ({activeMatch.teamA.shortCode})</button>
          <button onClick={() => sendEvent("DISMISSAL", { side: "B", method: "TOUCH", points: 1 })} className="py-3 rounded bg-[#D97706] text-[#08080A] font-bold">Touch Out +1 ({activeMatch.teamB.shortCode})</button>
          <button onClick={() => sendEvent("DISMISSAL", { side: "A", method: "POLE_DIVE", points: 1 })} className="py-2.5 rounded bg-[#161618] border border-white/15 font-bold">Pole Dive +1 ({activeMatch.teamA.shortCode})</button>
          <button onClick={() => sendEvent("DISMISSAL", { side: "B", method: "POLE_DIVE", points: 1 })} className="py-2.5 rounded bg-[#161618] border border-white/15 font-bold">Pole Dive +1 ({activeMatch.teamB.shortCode})</button>
          <button onClick={() => sendEvent("TURN_SWITCH", {})} className="col-span-2 py-2 rounded bg-[#161618] border border-white/15">Switch Innings / Turn</button>
        </div>
      );
    }

    if (sport === "carrom") {
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button onClick={() => sendEvent("BOARD_RESULT", { side: "A", points: 4, queenCovered: false })} className="py-3 rounded bg-[#B91C1C] font-bold">Board Win +4 ({activeMatch.teamA.shortCode})</button>
          <button onClick={() => sendEvent("BOARD_RESULT", { side: "B", points: 4, queenCovered: false })} className="py-3 rounded bg-[#D97706] text-[#08080A] font-bold">Board Win +4 ({activeMatch.teamB.shortCode})</button>
          <button onClick={() => sendEvent("BOARD_RESULT", { side: "A", points: 4, queenCovered: true })} className="py-2.5 rounded bg-[#161618] border border-[#D97706] font-bold">Board + Queen (+7) ({activeMatch.teamA.shortCode})</button>
          <button onClick={() => sendEvent("BOARD_RESULT", { side: "B", points: 4, queenCovered: true })} className="py-2.5 rounded bg-[#161618] border border-[#D97706] font-bold">Board + Queen (+7) ({activeMatch.teamB.shortCode})</button>
          <button onClick={() => sendEvent("FOUL", { side: "A" })} className="py-2 rounded bg-[#161618] border border-white/15">Foul -1 ({activeMatch.teamA.shortCode})</button>
          <button onClick={() => sendEvent("FOUL", { side: "B" })} className="py-2 rounded bg-[#161618] border border-white/15">Foul -1 ({activeMatch.teamB.shortCode})</button>
        </div>
      );
    }

    // Chess
    return (
      <div className="space-y-2 text-xs">
        <div className="flex gap-2">
          <input value={chessSan} onChange={(e) => setChessSan(e.target.value)} placeholder="Move SAN (e.g. Nf3)" className="flex-1 bg-[#0D0D0F] border border-white/15 rounded px-2.5 py-2" />
          <button onClick={() => sendEvent("MOVE", { san: chessSan })} className="px-4 py-2 rounded bg-[#161618] border border-[#D97706] font-bold">Log Move</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => sendEvent("RESULT", { result: "1-0", termination: "CHECKMATE" })} className="py-2 rounded bg-[#B91C1C] font-bold">1-0 White</button>
          <button onClick={() => sendEvent("RESULT", { result: "1/2-1/2", termination: "DRAW" })} className="py-2 rounded bg-white/15 font-bold">1/2 Draw</button>
          <button onClick={() => sendEvent("RESULT", { result: "0-1", termination: "RESIGNATION" })} className="py-2 rounded bg-[#D97706] text-[#08080A] font-bold">0-1 Black</button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1440px] mx-auto px-3 sm:px-5 py-6 space-y-4">
      {/* Match Selector Top Bar */}
      <div className="rdr-panel rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Radio className="w-4 h-4 text-[#DC2626]" />
          <select
            value={requestedId || ""}
            onChange={(e) => setSearchParams({ matchId: e.target.value })}
            className="bg-[#0D0D0F] border border-white/15 rounded px-3 py-1.5 text-xs font-semibold"
          >
            {allMatches.map((m) => (
              <option key={m.id} value={m.id}>
                [{m.status}] {m.sport?.name}: {m.teamA?.shortCode} vs {m.teamB?.shortCode} ({m.roundLabel})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {canActuallyScore && offlineCount > 0 && (
            <button onClick={flushOfflineQueue} className="px-2.5 py-1 rounded bg-[#D97706] text-[#08080A] font-bold">
              Sync {offlineCount} Offline Events
            </button>
          )}
          {activeMatch && !canActuallyScore && (
            <span className="px-3 py-1 rounded bg-[#161618] border border-[#D97706]/40 text-[#D97706] font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              {!user
                ? "Read-Only: Sign in as the assigned Match Scorer or Sports Secretary to score."
                : `Read-Only: Assigned to ${activeMatch.scorerUser?.name ?? "Sports Secretary"} only.`}
            </span>
          )}
        </div>
      </div>

      {!activeMatch ? (
        <div className="rdr-panel rounded-lg p-8 text-center text-sm text-[#8B8680]">
          Select a match to open the multi-sport scoring console.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT COLUMN (Desktop): Rosters & Match Context */}
          <aside className="hidden lg:block lg:col-span-3 rdr-panel rounded-lg p-4 space-y-4">
            <h2 className="font-editorial text-xl text-[#D97706] border-b border-white/10 pb-2">
              Lineups &amp; Context
            </h2>
            <div className="text-xs text-[#8B8680]">
              Scorer: <span className="text-[#F5F2EB]">{activeMatch.scorerUser?.name ?? "Unassigned"}</span>
            </div>
            {[
              { team: activeMatch.teamA, side: "A" as const },
              { team: activeMatch.teamB, side: "B" as const },
            ].map(({ team: t, side }) => (
              <div key={t.id} className="space-y-1.5">
                <div className="font-editorial text-sm text-[#F5F2EB] flex items-center justify-between">
                  <span>{t.name}</span>
                  {isCricket && (
                    <span className="text-[10px] font-mono uppercase text-[#D97706]">
                      {cricBattingSide === side ? "Batting" : "Bowling"}
                    </span>
                  )}
                </div>
                {t.roster.map((p) => {
                  const batSt = isCricket && cricBattingSide === side ? cricBatterMap[p.playerProfileId] : null;
                  const bowlSt = isCricket && cricBowlingSide === side ? cricBowlerMap[p.playerProfileId] : null;
                  return (
                    <Link
                      key={p.playerProfileId}
                      to={`/players/${p.playerProfileId}`}
                      className="flex items-center justify-between gap-2 text-xs text-[#D6CFC2] hover:text-[#D97706] py-0.5"
                    >
                      <span className="truncate">&bull; {p.displayName}</span>
                      {isCricket && cricBattingSide === side && (
                        <span className="text-[10px] font-mono shrink-0">
                          {p.playerProfileId === batterId ? (
                            <span className="px-1.5 py-0.5 rounded bg-[#D97706]/25 text-[#F59E0B]">Batting*</span>
                          ) : p.playerProfileId === nonStrikerId ? (
                            <span className="px-1.5 py-0.5 rounded bg-white/10 text-[#F5F2EB]">Not Out</span>
                          ) : batSt?.out ? (
                            <span className="text-[#FCA5A5]">Out · {batSt.runs}({batSt.balls})</span>
                          ) : (
                            <span className="text-[#8B8680]">Yet to Bat</span>
                          )}
                        </span>
                      )}
                      {isCricket && cricBowlingSide === side && bowlSt && (
                        <span className="text-[10px] font-mono shrink-0 text-[#10B981]">
                          {p.playerProfileId === bowlerId ? "Bowling · " : ""}
                          {Math.floor(bowlSt.balls / 6)}.{bowlSt.balls % 6}-{bowlSt.maidens}-{bowlSt.runs}-{bowlSt.wickets}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
            {isCricket && cricDetail?.extras && (
              <div className="pt-2 border-t border-white/10 text-[11px] font-mono text-[#8B8680] flex flex-wrap gap-2">
                <span className="text-[#D97706] font-bold">EXTRAS:</span>
                <span>WD {cricDetail.extras.wd}</span>
                <span>NB {cricDetail.extras.nb}</span>
                <span>B {cricDetail.extras.b}</span>
                <span>LB {cricDetail.extras.lb}</span>
              </div>
            )}
          </aside>

          {/* CENTER COLUMN: Live Scoreboard + Persistent Clocks + Sport Scoring Pad */}
          <section className="lg:col-span-5 rdr-panel rdr-border-crimson rounded-lg p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-editorial text-base text-[#D97706]">
                {activeMatch.sport.name} &bull; {activeMatch.match.roundLabel}
              </span>
              {isCricket ? (
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                  {cricDetail?.isSuperOver && (
                    <span className="px-2 py-0.5 rounded bg-[#B91C1C] text-[#F5F2EB] font-bold uppercase">
                      SUPER OVER {cricDetail.superOverIndex}
                    </span>
                  )}
                  {cricDetail?.freeHit && (
                    <span className="px-2 py-0.5 rounded bg-[#10B981] text-[#08080A] font-bold uppercase animate-pulse">
                      FREE HIT
                    </span>
                  )}
                  {cricDetail?.target ? (
                    <span className="text-[#F59E0B] font-bold">
                      Target {cricDetail.target} · Need {cricDetail.runsNeeded ?? 0} in {cricDetail.ballsRemaining ?? 0}b · RRR {cricDetail.rrr ?? "0.00"}
                    </span>
                  ) : (
                    <span className="text-[#D6CFC2]">
                      CRR: <strong className="text-[#F5F2EB]">{cricDetail?.crr ?? "0.00"}</strong>
                    </span>
                  )}
                </div>
              ) : isClockSport ? (
                <span className="font-mono tabular-score flex items-center gap-1.5 text-sm font-bold text-[#F5F2EB]">
                  <Clock className={`w-3.5 h-3.5 ${activeMatch.derived.clock.running ? "text-[#10B981]" : "text-[#D97706]"}`} />
                  {clockDisplay}
                </span>
              ) : (
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#8B8680]">
                  {activeMatch.derived.periodLabel}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 items-center text-center bg-[#0D0D0F] p-4 rounded border border-white/10">
              <div>
                <div className="font-editorial text-3xl text-[#F5F2EB]">{activeMatch.teamA.shortCode}</div>
                <div className="font-mono tabular-score text-xl text-[#F59E0B] mt-1">
                  {activeMatch.derived.teamAScoreLabel}
                </div>
              </div>
              <div className="text-xs text-[#8B8680] space-y-1">
                <div className="font-bold text-[#F5F2EB] uppercase">{activeMatch.match.status}</div>
                <div>{activeMatch.derived.periodLabel}</div>
              </div>
              <div>
                <div className="font-editorial text-3xl text-[#F5F2EB]">{activeMatch.teamB.shortCode}</div>
                <div className="font-mono tabular-score text-xl text-[#F59E0B] mt-1">
                  {activeMatch.derived.teamBScoreLabel}
                </div>
              </div>
            </div>

            {/* Single-Row Chronological Horizontally Scrollable Cricket Strip Grouped by Over */}
            {activeMatch.sport.slug === "cricket" &&
              Array.isArray(cricDetail?.oversGroups) &&
              cricDetail.oversGroups.length > 0 && (
                <div
                  ref={oversStripRef}
                  className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1"
                >
                  {cricDetail.oversGroups.map((ov, ovIdx, arr) => (
                    <div
                      key={`${ov.isSuperOver ? `so${ov.superOverIndex}` : "reg"}-${ov.overNumber}`}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded border shrink-0 ${
                        ovIdx === arr.length - 1
                          ? "bg-[#161618] border-[#D97706]/50"
                          : "bg-[#0D0D0F] border-white/10 opacity-75"
                      }`}
                    >
                      <span className="font-mono text-[10px] font-bold text-[#D97706] mr-0.5">
                        {ov.isSuperOver ? `SO${ov.superOverIndex} · ` : ""}OV {ov.overNumber}
                      </span>
                      {ov.balls.map((b, i) => (
                        <span
                          key={i}
                          className={`px-1.5 py-0.5 rounded font-mono tabular-score text-[11px] border ${
                            b === "W"
                              ? "bg-[#DC2626] border-[#DC2626] text-white font-bold"
                              : b === "4" || b === "6"
                              ? "bg-[#D97706]/30 border-[#D97706] text-[#F59E0B] font-bold"
                              : "bg-[#111113] border-white/15"
                          }`}
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              )}

            {/* Cricket Innings / Tie / Super Over / Result Prompts */}
            {isCricket && canActuallyScore && activeMatch.match.status === "LIVE" && (
              <>
                {cricDetail?.innings1Complete && !cricDetail?.isSuperOver && (
                  <div className="p-3 rounded bg-[#1B1314] border border-[#D97706] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[#F59E0B]">
                      1st Innings Complete! Ready for 2nd Innings.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextSide = cricBattingSide === "A" ? "B" : "A";
                        const nextBatList = getScopedRoster(
                          nextSide === "A" ? activeMatch.teamA.roster : activeMatch.teamB.roster,
                          nextSide === "A" ? activeMatch.match.lineupAJson : activeMatch.match.lineupBJson
                        );
                        const nextBowlList = getScopedRoster(
                          nextSide === "A" ? activeMatch.teamB.roster : activeMatch.teamA.roster,
                          nextSide === "A" ? activeMatch.match.lineupBJson : activeMatch.match.lineupAJson
                        );
                        setInn2Batter1(nextBatList[0]?.playerProfileId ?? 0);
                        setInn2Batter2(nextBatList[1]?.playerProfileId ?? 0);
                        setInn2Bowler(nextBowlList[0]?.playerProfileId ?? 0);
                        setShowInningsModal(true);
                      }}
                      className="px-3 py-1.5 rounded bg-[#D97706] text-[#08080A] font-bold uppercase"
                    >
                      Start 2nd Innings
                    </button>
                  </div>
                )}

                {cricDetail?.superOverHalf1Complete && (
                  <div className="p-3 rounded bg-[#1B1314] border border-[#D97706] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[#F59E0B]">
                      Super Over {cricDetail.superOverIndex} — 1st Half Complete!
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextSide = cricBattingSide === "A" ? "B" : "A";
                        const nextBatList = getScopedRoster(
                          nextSide === "A" ? activeMatch.teamA.roster : activeMatch.teamB.roster,
                          nextSide === "A" ? activeMatch.match.lineupAJson : activeMatch.match.lineupBJson
                        );
                        const nextBowlList = getScopedRoster(
                          nextSide === "A" ? activeMatch.teamB.roster : activeMatch.teamA.roster,
                          nextSide === "A" ? activeMatch.match.lineupBJson : activeMatch.match.lineupAJson
                        );
                        setSoBattingSide(nextSide);
                        setSoBatter1(nextBatList[0]?.playerProfileId ?? 0);
                        setSoBatter2(nextBatList[1]?.playerProfileId ?? 0);
                        setSoBowler(nextBowlList[0]?.playerProfileId ?? 0);
                        setShowSuperOverModal("SWITCH");
                      }}
                      className="px-3 py-1.5 rounded bg-[#D97706] text-[#08080A] font-bold uppercase"
                    >
                      Start Super Over Chase
                    </button>
                  </div>
                )}

                {cricDetail?.matchTied && (
                  <div className="p-3 rounded bg-[#2A0B0B] border border-[#DC2626] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[#F5F2EB]">
                      Match Tied! Start Super Over{(cricDetail.superOverIndex ?? 0) > 0 ? ` #${(cricDetail.superOverIndex ?? 0) + 1}` : ""} or confirm Tie.
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const firstSide = cricBattingSide;
                          const batList = getScopedRoster(
                            firstSide === "A" ? activeMatch.teamA.roster : activeMatch.teamB.roster,
                            firstSide === "A" ? activeMatch.match.lineupAJson : activeMatch.match.lineupBJson
                          );
                          const bowlList = getScopedRoster(
                            firstSide === "A" ? activeMatch.teamB.roster : activeMatch.teamA.roster,
                            firstSide === "A" ? activeMatch.match.lineupBJson : activeMatch.match.lineupAJson
                          );
                          setSoBattingSide(firstSide);
                          setSoBatter1(batList[0]?.playerProfileId ?? 0);
                          setSoBatter2(batList[1]?.playerProfileId ?? 0);
                          setSoBowler(bowlList[0]?.playerProfileId ?? 0);
                          setShowSuperOverModal("START");
                        }}
                        className="px-3 py-1.5 rounded bg-[#D97706] text-[#08080A] font-bold uppercase"
                      >
                        Start Super Over{(cricDetail.superOverIndex ?? 0) > 0 ? ` #${(cricDetail.superOverIndex ?? 0) + 1}` : ""}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTransition("COMPLETED")}
                        className="px-3 py-1.5 rounded bg-white/15 text-[#F5F2EB] font-bold uppercase"
                      >
                        Confirm Tie
                      </button>
                    </div>
                  </div>
                )}

                {activeMatch.derived.suggestedWinnerSide &&
                  activeMatch.derived.suggestedWinnerSide !== "DRAW" && (
                    <div className="p-3 rounded bg-[#09221A] border border-[#10B981] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-[#10B981]">
                        {activeMatch.derived.suggestedWinnerSide === "A"
                          ? activeMatch.teamA.name
                          : activeMatch.teamB.name}{" "}
                        has won the match!
                      </span>
                      <button
                        type="button"
                        onClick={() => handleTransition("COMPLETED")}
                        className="px-3 py-1.5 rounded bg-[#10B981] text-[#08080A] font-bold uppercase"
                      >
                        Confirm Match Result
                      </button>
                    </div>
                  )}
              </>
            )}

            {/* Authorized Scorer Controls ONLY */}
            {canActuallyScore ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
                  <div className="flex flex-wrap gap-2">
                    {activeMatch.match.status === "UPCOMING" && (
                      <button
                        disabled={busy}
                        onClick={() => handleTransition("LIVE")}
                        className="px-3 py-1.5 rounded bg-[#10B981] text-[#08080A] text-xs font-bold uppercase"
                      >
                        Go Live
                      </button>
                    )}
                    {activeMatch.match.status === "LIVE" && (
                      <>
                        {isClockSport && (
                          <>
                            <button
                              disabled={busy}
                              onClick={() =>
                                sendClockAction(activeMatch.derived.clock.running ? "PAUSE" : "START")
                              }
                              className="px-2.5 py-1.5 rounded bg-[#161618] border border-white/15 hover:border-[#10B981]/60 text-xs flex items-center gap-1"
                            >
                              {activeMatch.derived.clock.running ? (
                                <>
                                  <Pause className="w-3.5 h-3.5 text-[#D97706]" /> Pause Clock
                                </>
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5 text-[#10B981]" /> Start Clock
                                </>
                              )}
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => sendClockAction("RESET")}
                              title="Reset Clock"
                              className="px-2.5 py-1.5 rounded bg-[#161618] border border-white/15 text-xs flex items-center gap-1 text-[#8B8680] hover:text-[#F5F2EB]"
                            >
                              <RotateCw className="w-3 h-3" /> Reset
                            </button>
                          </>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => handleTransition("COMPLETED")}
                          className="px-3 py-1.5 rounded bg-[#D97706] text-[#08080A] text-xs font-bold uppercase"
                        >
                          End Match
                        </button>
                      </>
                    )}
                  </div>
                  {activeMatch.match.status === "LIVE" && (
                    <button
                      disabled={busy}
                      onClick={handleUndo}
                      className="px-2.5 py-1.5 rounded bg-[#161618] border border-[#DC2626]/50 text-[#DC2626] text-xs font-semibold flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Undo Last
                    </button>
                  )}
                </div>

                {renderSportPad()}
              </div>
            ) : null}

            {/* Mobile Drawer Toggles (<= 900px) */}
            <div className="lg:hidden grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setMobileDrawer((d) => (d === "ROSTERS" ? "NONE" : "ROSTERS"))}
                className="py-2 rounded bg-[#161618] border border-white/15 text-xs font-semibold flex items-center justify-center gap-1"
              >
                <Users className="w-3.5 h-3.5" /> Rosters
              </button>
              <button
                type="button"
                onClick={() => setMobileDrawer((d) => (d === "TIMELINE" ? "NONE" : "TIMELINE"))}
                className="py-2 rounded bg-[#161618] border border-white/15 text-xs font-semibold"
              >
                Timeline ({timelineItems.filter((e) => !e.voided).length})
              </button>
            </div>
          </section>

          {/* RIGHT COLUMN (Desktop) or Mobile Drawer: Readable Timeline */}
          <aside
            className={`${
              mobileDrawer === "TIMELINE" ? "block" : "hidden lg:block"
            } lg:col-span-4 rdr-panel rounded-lg p-4 space-y-3 min-w-0`}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h2 className="font-editorial text-xl text-[#F5F2EB]">
                Live Event Timeline
              </h2>
              <span className="font-mono text-[10px] text-[#8B8680]">
                {timelineItems.filter((i) => !i.voided).length} EVENTS
              </span>
            </div>
            {renderTimelineRows()}
          </aside>

          {/* Mobile Rosters Drawer */}
          {mobileDrawer === "ROSTERS" && (
            <div className="lg:hidden rdr-panel rounded-lg p-4 space-y-3">
              <h3 className="font-editorial text-xl text-[#D97706]">Team Rosters</h3>
              {[activeMatch.teamA, activeMatch.teamB].map((t) => (
                <div key={t.id} className="space-y-1">
                  <div className="text-xs font-bold">{t.name}</div>
                  {t.roster.map((p) => (
                    <div key={p.playerProfileId} className="text-xs text-[#D6CFC2]">
                      &bull; {p.displayName}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Over Complete — Select Next Bowler Modal */}
      {isCricket && canActuallyScore && activeMatch?.match.status === "LIVE" && cricDetail?.overJustCompleted && (
        <div className="fixed inset-0 z-[85] bg-black/80 flex items-center justify-center p-4">
          <div className="rdr-panel rdr-border-crimson rounded-lg max-w-md w-full p-5 space-y-4">
            <h3 className="font-editorial text-2xl text-[#D97706]">
              Over Complete — Select Next Bowler
            </h3>
            <p className="text-xs text-[#D6CFC2]">
              A bowler cannot bowl consecutive overs. Pick the next bowler from{" "}
              {cricBowlingSide === "A" ? activeMatch.teamA.name : activeMatch.teamB.name}.
            </p>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {cricBowlRoster.map((p) => {
                const bw = cricBowlerMap[p.playerProfileId] ?? { balls: 0, maidens: 0, runs: 0, wickets: 0 };
                const isLastBowler = p.playerProfileId === cricDetail.lastCompletedOverBowlerId;
                return (
                  <button
                    key={p.playerProfileId}
                    type="button"
                    disabled={busy || isLastBowler}
                    onClick={() => {
                      setBowlerId(p.playerProfileId);
                      sendEvent("SET_PLAYERS", {
                        strikerId: batterId,
                        nonStrikerId,
                        bowlerId: p.playerProfileId,
                      });
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded border text-xs ${
                      isLastBowler
                        ? "bg-[#0D0D0F] border-white/5 text-[#8B8680] opacity-40 cursor-not-allowed"
                        : "bg-[#161618] border-white/15 hover:border-[#D97706] text-[#F5F2EB]"
                    }`}
                  >
                    <span className="font-semibold">
                      {p.displayName} {isLastBowler ? "(Bowled last over)" : ""}
                    </span>
                    <span className="font-mono text-[#10B981]">
                      {Math.floor(bw.balls / 6)}.{bw.balls % 6}-{bw.maidens}-{bw.runs}-{bw.wickets}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Wicket & New Batter Modal */}
      {showWicketModal && isCricket && activeMatch && (
        <div className="fixed inset-0 z-[85] bg-black/80 flex items-center justify-center p-4">
          <div className="rdr-panel rdr-border-crimson rounded-lg max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-editorial text-2xl text-[#DC2626]">Record Wicket</h3>
              <button type="button" onClick={() => setShowWicketModal(false)} className="text-[#8B8680] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            {cricDetail?.freeHit && (
              <div className="px-3 py-1.5 rounded bg-[#10B981]/15 border border-[#10B981]/50 text-[11px] text-[#10B981] font-semibold">
                FREE HIT active — only Run Out or Retired Hurt is permitted.
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] uppercase text-[#8B8680] block mb-1">Dismissal Type</label>
                <select
                  value={wicketType}
                  onChange={(e) => setWicketType(e.target.value as typeof wicketType)}
                  className="w-full bg-[#0D0D0F] border border-white/15 rounded px-2.5 py-2"
                >
                  <option value="BOWLED" disabled={Boolean(cricDetail?.freeHit)}>Bowled</option>
                  <option value="CAUGHT" disabled={Boolean(cricDetail?.freeHit)}>Caught</option>
                  <option value="LBW" disabled={Boolean(cricDetail?.freeHit)}>LBW</option>
                  <option value="RUN_OUT">Run Out</option>
                  <option value="STUMPED" disabled={Boolean(cricDetail?.freeHit)}>Stumped</option>
                  <option value="HIT_WICKET" disabled={Boolean(cricDetail?.freeHit)}>Hit Wicket</option>
                  <option value="RETIRED_HURT">Retired Hurt</option>
                </select>
              </div>
              {wicketType === "RUN_OUT" && (
                <div>
                  <label className="text-[10px] uppercase text-[#8B8680] block mb-1">Dismissed Batter</label>
                  <select
                    value={dismissedSide}
                    onChange={(e) => setDismissedSide(e.target.value as "STRIKER" | "NON_STRIKER")}
                    className="w-full bg-[#0D0D0F] border border-white/15 rounded px-2.5 py-2"
                  >
                    <option value="STRIKER">
                      Striker ({cricBatRoster.find((p) => p.playerProfileId === batterId)?.displayName ?? "Striker"})
                    </option>
                    <option value="NON_STRIKER">
                      Non-Striker ({cricBatRoster.find((p) => p.playerProfileId === nonStrikerId)?.displayName ?? "Non-Striker"})
                    </option>
                  </select>
                </div>
              )}
              {(wicketType === "CAUGHT" || wicketType === "RUN_OUT" || wicketType === "STUMPED") && (
                <div>
                  <label className="text-[10px] uppercase text-[#8B8680] block mb-1">Fielder</label>
                  <select
                    value={fielderId}
                    onChange={(e) => setFielderId(Number(e.target.value))}
                    className="w-full bg-[#0D0D0F] border border-white/15 rounded px-2.5 py-2"
                  >
                    <option value={0}>Select fielder (optional)</option>
                    {cricBowlRoster.map((p) => (
                      <option key={p.playerProfileId} value={p.playerProfileId}>{p.displayName}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-[10px] uppercase text-[#8B8680] block mb-1">Incoming Batter (Yet to Bat)</label>
                <select
                  value={nextBatterId}
                  onChange={(e) => setNextBatterId(Number(e.target.value))}
                  className="w-full bg-[#0D0D0F] border border-white/15 rounded px-2.5 py-2"
                >
                  <option value={0}>All Out / None remaining</option>
                  {availableBatters
                    .filter((p) => p.playerProfileId !== batterId && p.playerProfileId !== nonStrikerId)
                    .map((p) => (
                      <option key={p.playerProfileId} value={p.playerProfileId}>{p.displayName}</option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWicketModal(false)}
                  className="px-3 py-1.5 rounded bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const outId = dismissedSide === "NON_STRIKER" && wicketType === "RUN_OUT" ? nonStrikerId : batterId;
                    setShowWicketModal(false);
                    sendEvent("BALL", {
                      side: cricBattingSide,
                      runs: 0,
                      extraType: null,
                      wicket: true,
                      wicketType,
                      dismissedBatterId: outId,
                      ...(nextBatterId > 0 ? { nextBatterId } : {}),
                      ...(fielderId > 0 ? { fielderId } : {}),
                      batterId,
                      nonStrikerId,
                      bowlerId,
                    });
                  }}
                  className="px-4 py-1.5 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-[#F5F2EB] font-bold uppercase"
                >
                  Confirm Wicket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Innings Break / Start 2nd Innings Modal */}
      {showInningsModal && isCricket && activeMatch && (
        <div className="fixed inset-0 z-[85] bg-black/80 flex items-center justify-center p-4">
          <div className="rdr-panel rdr-border-crimson rounded-lg max-w-md w-full p-5 space-y-4">
            <h3 className="font-editorial text-2xl text-[#D97706]">Start 2nd Innings</h3>
            {(() => {
              const nextSide = cricBattingSide === "A" ? "B" : "A";
              const nextBatList = getScopedRoster(
                nextSide === "A" ? activeMatch.teamA.roster : activeMatch.teamB.roster,
                nextSide === "A" ? activeMatch.match.lineupAJson : activeMatch.match.lineupBJson
              );
              const nextBowlList = getScopedRoster(
                nextSide === "A" ? activeMatch.teamB.roster : activeMatch.teamA.roster,
                nextSide === "A" ? activeMatch.match.lineupBJson : activeMatch.match.lineupAJson
              );
              return (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[10px] uppercase text-[#8B8680] block mb-1">Opening Striker</label>
                    <select
                      value={inn2Batter1}
                      onChange={(e) => setInn2Batter1(Number(e.target.value))}
                      className="w-full bg-[#0D0D0F] border border-white/15 rounded px-2.5 py-2"
                    >
                      {nextBatList.map((p) => (
                        <option key={p.playerProfileId} value={p.playerProfileId}>{p.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-[#8B8680] block mb-1">Opening Non-Striker</label>
                    <select
                      value={inn2Batter2}
                      onChange={(e) => setInn2Batter2(Number(e.target.value))}
                      className="w-full bg-[#0D0D0F] border border-white/15 rounded px-2.5 py-2"
                    >
                      {nextBatList
                        .filter((p) => p.playerProfileId !== inn2Batter1)
                        .map((p) => (
                          <option key={p.playerProfileId} value={p.playerProfileId}>{p.displayName}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-[#8B8680] block mb-1">Opening Bowler</label>
                    <select
                      value={inn2Bowler}
                      onChange={(e) => setInn2Bowler(Number(e.target.value))}
                      className="w-full bg-[#0D0D0F] border border-white/15 rounded px-2.5 py-2"
                    >
                      {nextBowlList.map((p) => (
                        <option key={p.playerProfileId} value={p.playerProfileId}>{p.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setShowInningsModal(false)} className="px-3 py-1.5 rounded bg-white/10">
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setShowInningsModal(false);
                        setActiveSide(nextSide);
                        sendEvent("INNINGS_SWITCH", {
                          battingSide: nextSide,
                          strikerId: inn2Batter1,
                          nonStrikerId: inn2Batter2,
                          bowlerId: inn2Bowler,
                        });
                      }}
                      className="px-4 py-1.5 rounded bg-[#D97706] text-[#08080A] font-bold uppercase"
                    >
                      Begin 2nd Innings
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Super Over Setup Modal */}
      {showSuperOverModal !== "NONE" && isCricket && activeMatch && (
        <div className="fixed inset-0 z-[85] bg-black/80 flex items-center justify-center p-4">
          <div className="rdr-panel rdr-border-crimson rounded-lg max-w-md w-full p-5 space-y-4">
            <h3 className="font-editorial text-2xl text-[#D97706]">
              {showSuperOverModal === "START"
                ? `Super Over ${(cricDetail?.superOverIndex ?? 0) + 1} Setup`
                : `Super Over ${cricDetail?.superOverIndex ?? 1} — 2nd Half`}
            </h3>
            {(() => {
              const batList = getScopedRoster(
                soBattingSide === "A" ? activeMatch.teamA.roster : activeMatch.teamB.roster,
                soBattingSide === "A" ? activeMatch.match.lineupAJson : activeMatch.match.lineupBJson
              );
              const bowlList = getScopedRoster(
                soBattingSide === "A" ? activeMatch.teamB.roster : activeMatch.teamA.roster,
                soBattingSide === "A" ? activeMatch.match.lineupBJson : activeMatch.match.lineupAJson
              );
              return (
                <div className="space-y-3 text-xs">
                  {showSuperOverModal === "START" && (
                    <div>
                      <label className="text-[10px] uppercase text-[#8B8680] block mb-1">Batting First</label>
                      <select
                        value={soBattingSide}
                        onChange={(e) => {
                          const s = e.target.value as "A" | "B";
                          setSoBattingSide(s);
                          const bl = getScopedRoster(
                            s === "A" ? activeMatch.teamA.roster : activeMatch.teamB.roster,
                            s === "A" ? activeMatch.match.lineupAJson : activeMatch.match.lineupBJson
                          );
                          const bwl = getScopedRoster(
                            s === "A" ? activeMatch.teamB.roster : activeMatch.teamA.roster,
                            s === "A" ? activeMatch.match.lineupBJson : activeMatch.match.lineupAJson
                          );
                          setSoBatter1(bl[0]?.playerProfileId ?? 0);
                          setSoBatter2(bl[1]?.playerProfileId ?? 0);
                          setSoBowler(bwl[0]?.playerProfileId ?? 0);
                        }}
                        className="w-full bg-[#0D0D0F] border border-white/15 rounded px-2.5 py-2"
                      >
                        <option value="A">{activeMatch.teamA.name}</option>
                        <option value="B">{activeMatch.teamB.name}</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] uppercase text-[#8B8680] block mb-1">Opening Striker</label>
                    <select
                      value={soBatter1}
                      onChange={(e) => setSoBatter1(Number(e.target.value))}
                      className="w-full bg-[#0D0D0F] border border-white/15 rounded px-2.5 py-2"
                    >
                      {batList.map((p) => (
                        <option key={p.playerProfileId} value={p.playerProfileId}>{p.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-[#8B8680] block mb-1">Opening Non-Striker</label>
                    <select
                      value={soBatter2}
                      onChange={(e) => setSoBatter2(Number(e.target.value))}
                      className="w-full bg-[#0D0D0F] border border-white/15 rounded px-2.5 py-2"
                    >
                      {batList
                        .filter((p) => p.playerProfileId !== soBatter1)
                        .map((p) => (
                          <option key={p.playerProfileId} value={p.playerProfileId}>{p.displayName}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-[#8B8680] block mb-1">Bowler</label>
                    <select
                      value={soBowler}
                      onChange={(e) => setSoBowler(Number(e.target.value))}
                      className="w-full bg-[#0D0D0F] border border-white/15 rounded px-2.5 py-2"
                    >
                      {bowlList.map((p) => (
                        <option key={p.playerProfileId} value={p.playerProfileId}>{p.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setShowSuperOverModal("NONE")} className="px-3 py-1.5 rounded bg-white/10">
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const mode = showSuperOverModal;
                        setShowSuperOverModal("NONE");
                        setActiveSide(soBattingSide);
                        sendEvent(mode === "START" ? "SUPER_OVER_START" : "SUPER_OVER_SWITCH", {
                          battingSide: soBattingSide,
                          strikerId: soBatter1,
                          nonStrikerId: soBatter2,
                          bowlerId: soBowler,
                          ...(mode === "START" ? { superOverIndex: (cricDetail?.superOverIndex ?? 0) + 1 } : {}),
                        });
                      }}
                      className="px-4 py-1.5 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-[#F5F2EB] font-bold uppercase"
                    >
                      Start Super Over
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Optional Raw Event Inspect Modal */}
      {inspectItem && (
        <div className="fixed inset-0 z-[85] bg-black/80 flex items-center justify-center p-4">
          <div className="rdr-panel rdr-border-crimson rounded-lg max-w-md w-full p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-editorial text-xl text-[#F5F2EB]">
                Inspect Event #{inspectItem.seq}
              </h3>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="text-[#8B8680] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-[#D6CFC2]">{inspectItem.headline}</div>
            <pre className="bg-[#0D0D0F] border border-white/10 rounded p-3 text-[11px] font-mono text-[#F59E0B] overflow-x-auto">
              {JSON.stringify(inspectItem.rawEvent, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
