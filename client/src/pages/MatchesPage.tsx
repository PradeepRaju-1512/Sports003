import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Clock, Radio, ShieldCheck } from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { apiFetch, formatIST } from "../lib/api.ts";
import {
  MatchCenterView,
  type HydratedMatchCenterData,
} from "../components/MatchCenterView.tsx";

interface MatchRow {
  id: number;
  roundLabel: string;
  venue: string;
  scheduledAt: string;
  status: "UPCOMING" | "LIVE" | "COMPLETED";
  scoreSummary: string | null;
  resultNote: string | null;
  tournamentName: string;
  sport: { name: string; slug: string } | null;
  teamA: { id: number; name: string; shortCode: string } | null;
  teamB: { id: number; name: string; shortCode: string } | null;
}

export function MatchesListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { sseVersion, notifyToast } = useApp();
  const [liveMatches, setLiveMatches] = useState<MatchRow[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<MatchRow[]>([]);
  const [completedMatches, setCompletedMatches] = useState<MatchRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    apiFetch<{
      liveMatches: MatchRow[];
      upcomingMatches: MatchRow[];
      completedMatches: MatchRow[];
    }>("/api/matches")
      .then((res) => {
        setLiveMatches(res.liveMatches);
        setUpcomingMatches(res.upcomingMatches);
        setCompletedMatches(res.completedMatches);
      })
      .catch((err) => {
        const msg = (err as Error).message || "Failed to load matches.";
        setLoadError(msg);
        notifyToast("error", msg);
      });
  }, [sseVersion, notifyToast]);

  const requestedTab = searchParams.get("tab");
  const activeTab =
    requestedTab === "live" && liveMatches.length > 0
      ? "live"
      : requestedTab === "completed"
      ? "completed"
      : liveMatches.length > 0 && !requestedTab
      ? "live"
      : "upcoming";

  const currentList =
    activeTab === "live"
      ? liveMatches
      : activeTab === "completed"
      ? completedMatches
      : upcomingMatches;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#D97706] font-semibold">
            Match Center
          </div>
          <h1 className="font-editorial text-4xl sm:text-5xl text-[#F5F2EB]">
            Live &amp; Scheduled Fixtures
          </h1>
        </div>
        <div className="flex gap-2">
          {liveMatches.length > 0 && (
            <button
              type="button"
              onClick={() => setSearchParams({ tab: "live" })}
              className={`px-3.5 py-2 rounded text-xs font-bold uppercase flex items-center gap-1.5 ${
                activeTab === "live"
                  ? "bg-[#DC2626] text-[#F5F2EB]"
                  : "bg-[#141418] text-[#D6CFC2] border border-white/15"
              }`}
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" /> Live ({liveMatches.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setSearchParams({ tab: "upcoming" })}
            className={`px-3.5 py-2 rounded text-xs font-bold uppercase ${
              activeTab === "upcoming"
                ? "bg-[#B91C1C] text-[#F5F2EB]"
                : "bg-[#141418] text-[#D6CFC2] border border-white/15"
            }`}
          >
            Upcoming ({upcomingMatches.length})
          </button>
          <button
            type="button"
            onClick={() => setSearchParams({ tab: "completed" })}
            className={`px-3.5 py-2 rounded text-xs font-bold uppercase ${
              activeTab === "completed"
                ? "bg-[#B91C1C] text-[#F5F2EB]"
                : "bg-[#141418] text-[#D6CFC2] border border-white/15"
            }`}
          >
            Completed ({completedMatches.length})
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="rdr-panel rounded-lg p-8 text-center text-sm text-[#FCA5A5]">
          {loadError}
        </div>
      ) : currentList.length === 0 ? (
        <div className="rdr-panel rounded-lg p-8 text-center text-sm text-[#8B8680]">
          No matches in this view right now.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentList.map((m) => {
            const rawSummary = (m.scoreSummary ?? "").trim();
            const isPlaceholder =
              rawSummary.toLowerCase() === "scheduled" ||
              rawSummary.toLowerCase() === "kickoff scheduled";
            const displaySummary =
              m.status === "LIVE"
                ? rawSummary && !isPlaceholder
                  ? rawSummary
                  : "Match In Progress"
                : m.status === "COMPLETED"
                ? rawSummary && !isPlaceholder
                  ? rawSummary
                  : m.resultNote || "Completed — Final Score"
                : rawSummary || null;

            return (
              <Link
                key={m.id}
                to={`/matches/${m.id}`}
                className="rdr-panel rounded-lg p-5 hover:border-[#D97706]/60 transition space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#D97706] font-bold uppercase">
                    {m.sport?.name} &bull; {m.roundLabel}
                  </span>
                  <span className="text-[11px] font-mono text-[#8B8680]">{m.status}</span>
                </div>
                <div className="font-editorial text-2xl text-[#F5F2EB]">
                  {m.teamA?.name} vs {m.teamB?.name}
                </div>
                {displaySummary && (
                  <div className="font-mono tabular-nums text-xs text-[#F59E0B] bg-[#08080A] px-3 py-2 rounded border border-white/10">
                    {displaySummary}
                  </div>
                )}
                <div className="text-[11px] text-[#8B8680] flex items-center justify-between tabular-nums">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {formatIST(m.scheduledAt)}
                  </span>
                  <span>{m.venue}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, hasGlobalSportsAuthority, sseVersion, notifyToast } = useApp();
  const [data, setData] = useState<HydratedMatchCenterData | null>(null);
  const [winnerId, setWinnerId] = useState<number | "">("");
  const [resultNote, setResultNote] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch<HydratedMatchCenterData>(`/api/matches/${id}`);
      setData(res);
      if (res.match.winnerTeamId) setWinnerId(res.match.winnerTeamId);
      if (res.match.resultNote) setResultNote(res.match.resultNote);
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  }, [id, notifyToast]);

  useEffect(() => {
    load();
  }, [load, sseVersion, user?.id]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await apiFetch(`/api/matches/${id}/verify`, {
        method: "POST",
        body: JSON.stringify({
          winnerTeamId: winnerId === "" ? null : Number(winnerId),
          resultNote,
        }),
      });
      await load();
      notifyToast("success", "Match result verified and standings updated!");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto p-8 text-sm text-[#8B8680]">
        Loading match scorecard...
      </div>
    );
  }

  return (
    <MatchCenterView
      data={data}
      extraAdminSlot={
        hasGlobalSportsAuthority && data.permissions.canVerify ? (
          <form
            onSubmit={handleVerify}
            className="rdr-panel rounded-lg p-5 space-y-3 border border-[#D97706]/40"
          >
            <h2 className="font-editorial text-2xl text-[#D97706] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> Sports Secretary Result Verification
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={winnerId}
                onChange={(e) => setWinnerId(e.target.value ? Number(e.target.value) : "")}
                className="bg-[#0D0D0F] border border-white/15 rounded px-3 py-2 text-xs"
              >
                <option value="">Draw / No Result</option>
                <option value={data.teamA.id}>{data.teamA.name}</option>
                <option value={data.teamB.id}>{data.teamB.name}</option>
              </select>
              <input
                required
                value={resultNote}
                onChange={(e) => setResultNote(e.target.value)}
                placeholder="e.g., Trichy Titans won by 14 runs"
                className="sm:col-span-2 bg-[#0D0D0F] border border-white/15 rounded px-3 py-2 text-xs"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-[#10B981] text-[#08080A] text-xs font-bold uppercase"
            >
              Verify &amp; Recompute Points Table
            </button>
          </form>
        ) : null
      }
    />
  );
}
