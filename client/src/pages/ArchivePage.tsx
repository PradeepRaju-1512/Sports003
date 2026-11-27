import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Award, ChevronRight, Medal, Plus, Search, Trophy, Users } from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { apiFetch, formatIST } from "../lib/api.ts";

interface ArchiveYearTournament {
  id: number;
  name: string;
  academicYear: number;
  semester: string;
  tournamentType: string;
  format: string;
  completenessStatus: string;
  description: string | null;
  sports: Array<{ sportId: number; slug: string; name: string }>;
  matches?: Array<{
    id: number;
    roundLabel: string;
    scoreSummary: string | null;
    resultNote: string | null;
    sportName: string;
    teamA: { name: string; shortCode: string } | null;
    teamB: { name: string; shortCode: string } | null;
  }>;
}

export function ArchiveHomePage() {
  const { year: paramYear } = useParams<{ year?: string }>();
  const { hasGlobalSportsAuthority, notifyToast, refreshAll } = useApp();

  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(paramYear ? Number(paramYear) : 0);
  const [tournaments, setTournaments] = useState<ArchiveYearTournament[]>([]);
  const [yearLoading, setYearLoading] = useState(false);
  const [yearError, setYearError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");

  // Legacy Entry Modal
  const [showLegacy, setShowLegacy] = useState(false);
  const [sportsList, setSportsList] = useState<Array<{ id: number; name: string }>>([]);
  const [legName, setLegName] = useState("");
  const [legYear, setLegYear] = useState(2023);
  const [legSportId, setLegSportId] = useState(0);
  const [legWinner, setLegWinner] = useState("");
  const [legRu1, setLegRu1] = useState("");
  const [legRu2, setLegRu2] = useState("");
  const [legSummary, setLegSummary] = useState("");

  useEffect(() => {
    apiFetch<{ years: number[] }>("/api/archive/years")
      .then((res) => {
        setYears(res.years);
        if (!paramYear && res.years.length > 0 && selectedYear === 0) {
          setSelectedYear(res.years[0]);
        }
      })
      .catch((err) => {
        notifyToast("error", (err as Error).message || "Failed to load archive years.");
      });
  }, [paramYear, selectedYear, notifyToast]);

  useEffect(() => {
    if (paramYear) setSelectedYear(Number(paramYear));
  }, [paramYear]);

  const loadYearTournaments = useCallback(async () => {
    if (!selectedYear) return;
    setYearLoading(true);
    setYearError(null);
    const params = new URLSearchParams();
    if (searchQ) params.set("q", searchQ);
    if (typeFilter) params.set("tournamentType", typeFilter);
    if (formatFilter) params.set("format", formatFilter);
    try {
      const res = await apiFetch<{ tournaments: ArchiveYearTournament[] }>(
        `/api/archive/${selectedYear}?${params.toString()}`
      );
      setTournaments(res.tournaments);
    } catch (err) {
      const msg = (err as Error).message || "Failed to load archived tournaments.";
      setYearError(msg);
      notifyToast("error", msg);
    } finally {
      setYearLoading(false);
    }
  }, [selectedYear, searchQ, typeFilter, formatFilter, notifyToast]);

  useEffect(() => {
    loadYearTournaments();
  }, [loadYearTournaments]);

  useEffect(() => {
    if (!showLegacy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowLegacy(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showLegacy]);

  const openLegacyModal = async () => {
    setShowLegacy(true);
    try {
      const res = await apiFetch<{ sports: Array<{ id: number; name: string }> }>("/api/tournaments/sports");
      setSportsList(res.sports);
      if (res.sports.length > 0 && legSportId === 0) setLegSportId(res.sports[0].id);
    } catch (err) {
      notifyToast("error", (err as Error).message || "Failed to load sports list.");
    }
  };

  const submitLegacy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/api/archive/legacy", {
        method: "POST",
        body: JSON.stringify({
          name: legName,
          academicYear: Number(legYear),
          tournamentType: "FLAGSHIP",
          format: "KNOCKOUT",
          completenessStatus: "VERIFIED",
          sportId: legSportId,
          winnerName: legWinner,
          runnerUp1Name: legRu1,
          runnerUp2Name: legRu2 || null,
          finalSummary: legSummary,
        }),
      });
      setShowLegacy(false);
      await refreshAll();
      setSelectedYear(Number(legYear));
      await loadYearTournaments();
      notifyToast("success", "Legacy historical tournament added to Archive.");
    } catch (err) {
      notifyToast("error", (err as Error).message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#D97706] font-semibold">
            Permanent Institutional Records
          </div>
          <h1 className="font-editorial text-4xl sm:text-5xl text-[#F5F2EB]">
            IIITT Sports Archive {selectedYear ? `— ${selectedYear}` : ""}
          </h1>
        </div>
        {hasGlobalSportsAuthority && (
          <button
            type="button"
            onClick={openLegacyModal}
            className="px-3.5 py-2 rounded bg-[#141418] border border-[#D97706]/60 text-xs font-bold uppercase tracking-wider text-[#D97706] flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Historical Record
          </button>
        )}
      </div>

      {/* Year Pills + Search & Filters */}
      <div className="rdr-panel rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {years.map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => setSelectedYear(yr)}
              className={`px-4 py-1.5 rounded text-xs font-bold font-mono transition ${
                selectedYear === yr
                  ? "bg-[#B91C1C] text-[#F5F2EB]"
                  : "bg-[#08080A] border border-white/15 text-[#D6CFC2]"
              }`}
            >
              {yr}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8B8680] absolute left-3 top-2.5" />
            <input
              value={searchQ}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQ(val);
                const trimmed = val.trim();
                if (/^\d{4}$/.test(trimmed) && years.includes(Number(trimmed))) {
                  setSelectedYear(Number(trimmed));
                }
              }}
              placeholder="Search by tournament, sport, team, player, or year..."
              className="w-full bg-[#08080A] border border-white/15 rounded pl-9 pr-3 py-2 text-xs"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#08080A] border border-white/15 rounded px-3 py-2 text-xs"
          >
            <option value="">All Tournament Types</option>
            <option value="FLAGSHIP">Flagship</option>
            <option value="PROTHYMOS">Prothymos</option>
            <option value="INTER_HOSTEL">Inter-Hostel</option>
            <option value="OPEN">Open</option>
          </select>
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            className="bg-[#08080A] border border-white/15 rounded px-3 py-2 text-xs"
          >
            <option value="">All Formats</option>
            <option value="GROUP_KNOCKOUT">Group + Knockout</option>
            <option value="ROUND_ROBIN">Round Robin</option>
            <option value="KNOCKOUT">Knockout</option>
            <option value="LEAGUE">League</option>
          </select>
        </div>
      </div>

      {/* Tournament Cards with Sport Drill-Down */}
      {yearLoading ? (
        <div className="rdr-panel rounded-lg p-8 text-center text-sm text-[#8B8680]">
          Loading {selectedYear} archive records...
        </div>
      ) : yearError ? (
        <div className="rdr-panel rounded-lg p-6 border border-[#DC2626]/50 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-[#FCA5A5]">{yearError}</span>
          <button
            type="button"
            onClick={loadYearTournaments}
            className="px-3.5 py-1.5 rounded bg-[#B91C1C] text-xs font-bold uppercase text-[#F5F2EB]"
          >
            Retry
          </button>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="rdr-panel rounded-lg p-8 text-center text-sm text-[#8B8680]">
          No archived tournaments match this filter.
        </div>
      ) : (
        <div className="space-y-4">
          {tournaments.map((t) => (
            <div key={t.id} className="rdr-panel rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-[#D97706]">
                    <span>{t.academicYear}</span>
                    <span>•</span>
                    <span>{t.tournamentType}</span>
                    <span>•</span>
                    <span>{t.format}</span>
                  </div>
                  <h2 className="font-editorial text-3xl text-[#F5F2EB] mt-0.5">{t.name}</h2>
                  {t.description && <p className="text-xs text-[#D6CFC2] mt-1">{t.description}</p>}
                </div>
                <span className="px-2.5 py-1 rounded bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-[10px] font-bold uppercase">
                  {t.completenessStatus}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                {t.sports.map((s) => (
                  <Link
                    key={s.sportId}
                    to={`/archive/${t.academicYear}/${t.id}/${s.slug}`}
                    className="px-3.5 py-2 rounded bg-[#08080A] border border-[#B91C1C]/50 hover:bg-[#B91C1C] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition"
                  >
                    {s.name} Archive <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                ))}
              </div>

              {t.matches && t.matches.length > 0 && (
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-[#8B8680] font-bold">
                    Official Match Scorecards (Click to Open Match Center)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {t.matches.map((m) => (
                      <Link
                        key={m.id}
                        to={`/matches/${m.id}`}
                        className="p-2.5 rounded bg-[#08080A] border border-white/10 hover:border-[#D97706]/60 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-[#F5F2EB] truncate">
                            {m.sportName} • {m.roundLabel}: {m.teamA?.shortCode} vs {m.teamB?.shortCode}
                          </div>
                          {m.scoreSummary && (
                            <div className="font-mono tabular-score text-[11px] text-[#D97706] truncate">
                              {m.scoreSummary}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#8B8680] shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Legacy Record Modal */}
      {showLegacy && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4">
          <div className="rdr-panel rdr-border-crimson rounded-lg max-w-md w-full p-5 space-y-3">
            <h3 className="font-editorial text-2xl">Add Legacy Tournament</h3>
            <form onSubmit={submitLegacy} className="space-y-3 text-xs">
              <input required value={legName} onChange={(e) => setLegName(e.target.value)} placeholder="Tournament Name" className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" required value={legYear} onChange={(e) => setLegYear(Number(e.target.value))} className="bg-[#08080A] border border-white/15 rounded px-3 py-2" />
                <select value={legSportId} onChange={(e) => setLegSportId(Number(e.target.value))} className="bg-[#08080A] border border-white/15 rounded px-2.5 py-2">
                  {sportsList.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <input required value={legWinner} onChange={(e) => setLegWinner(e.target.value)} placeholder="Winner Team Name" className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2" />
              <input required value={legRu1} onChange={(e) => setLegRu1(e.target.value)} placeholder="1st Runner-Up Team Name" className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2" />
              <input value={legRu2} onChange={(e) => setLegRu2(e.target.value)} placeholder="2nd Runner-Up (Optional)" className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2" />
              <input required value={legSummary} onChange={(e) => setLegSummary(e.target.value)} placeholder="Final Score Summary" className="w-full bg-[#08080A] border border-white/15 rounded px-3 py-2" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowLegacy(false)} className="px-3 py-1.5 rounded bg-white/10">Cancel</button>
                <button type="submit" className="px-4 py-1.5 rounded bg-[#B91C1C] font-bold uppercase">Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface ArchiveSportDetail {
  tournament: { id: number; name: string; academicYear: number; completenessStatus: string };
  sport: { id: number; name: string; slug: string };
  podium: {
    winner: { id: number; name: string; shortCode: string } | null;
    runnerUp1: { id: number; name: string; shortCode: string } | null;
    runnerUp2: { id: number; name: string; shortCode: string } | null;
  };
  standings: Array<{
    teamId: number;
    rank: number;
    played: number;
    won: number;
    lost: number;
    drawn: number;
    points: number;
    nrr: number;
    goalDiff: number;
    setsWon: number;
    setsLost: number;
    team: { name: string } | null;
  }>;
  matches: Array<{
    id: number;
    roundLabel: string;
    scoreSummary: string | null;
    resultNote: string | null;
    scheduledAt: string;
    teamA: { name: string; shortCode: string } | null;
    teamB: { name: string; shortCode: string } | null;
  }>;
  teams: Array<{
    id: number;
    name: string;
    shortCode: string;
    roster: Array<{
      playerProfileId: number;
      displayName: string;
      playingRole: string | null;
      batch: string;
      branch: string | null;
    }>;
  }>;
}

export function ArchiveSportPage() {
  const { year, tournamentId, sportSlug } = useParams<{
    year: string;
    tournamentId: string;
    sportSlug: string;
  }>();
  const { notifyToast } = useApp();
  const [data, setData] = useState<ArchiveSportDetail | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number>(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    apiFetch<ArchiveSportDetail>(`/api/archive/${year}/${tournamentId}/${sportSlug}`)
      .then((res) => {
        setData(res);
        if (res.teams.length > 0) setSelectedTeamId(res.teams[0].id);
      })
      .catch((err) => {
        const msg = (err as Error).message || "Failed to load archive sport record.";
        setLoadError(msg);
        notifyToast("error", msg);
      });
  }, [year, tournamentId, sportSlug, notifyToast]);

  if (loadError) {
    return (
      <div className="max-w-6xl mx-auto p-8 text-center space-y-3">
        <div className="text-sm text-[#FCA5A5]">{loadError}</div>
        <Link to="/archive" className="inline-block text-xs text-[#D97706] hover:underline">
          &larr; Return to Archive
        </Link>
      </div>
    );
  }

  if (!data) {
    return <div className="max-w-6xl mx-auto p-8 text-sm text-[#8B8680]">Loading Archive Sport Record...</div>;
  }

  const { tournament, sport, podium, standings, matches, teams } = data;
  const activeTeam = teams.find((t) => t.id === selectedTeamId) ?? teams[0];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="border-b border-white/10 pb-4">
        <Link to={`/archive/${year}`} className="text-xs text-[#D97706] hover:underline">
          ← Back to {year} Archive
        </Link>
        <h1 className="font-editorial text-4xl sm:text-5xl text-[#F5F2EB] mt-1">
          {tournament.name} — {sport.name}
        </h1>
      </div>

      {/* 1. TOP PODIUM: Winners + 2 Runners-Up */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rdr-panel rdr-border-crimson rounded-lg p-5 space-y-1">
          <div className="text-xs uppercase tracking-widest text-[#F59E0B] font-bold flex items-center gap-1.5">
            <Trophy className="w-4 h-4" /> Champions / Winners
          </div>
          <div className="font-editorial text-3xl text-[#F5F2EB]">
            {podium.winner?.name ?? "TBD"}
          </div>
        </div>
        <div className="rdr-panel rounded-lg p-5 space-y-1 border border-[#D6CFC2]/25">
          <div className="text-xs uppercase tracking-widest text-[#D6CFC2] font-bold flex items-center gap-1.5">
            <Medal className="w-4 h-4 text-[#D6CFC2]" /> 1st Runner-Up
          </div>
          <div className="font-editorial text-3xl text-[#F5F2EB]">
            {podium.runnerUp1?.name ?? "—"}
          </div>
        </div>
        <div className="rdr-panel rounded-lg p-5 space-y-1 border border-[#D97706]/25">
          <div className="text-xs uppercase tracking-widest text-[#D97706] font-bold flex items-center gap-1.5">
            <Award className="w-4 h-4" /> 2nd Runner-Up
          </div>
          <div className="font-editorial text-3xl text-[#F5F2EB]">
            {podium.runnerUp2?.name ?? "—"}
          </div>
        </div>
      </section>

      {/* 2. MIDDLE: Full Points Table */}
      <section className="rdr-panel rounded-lg p-5 space-y-3">
        <h2 className="font-editorial text-2xl text-[#F5F2EB]">Final Points Table</h2>
        {standings.length === 0 ? (
          <p className="text-xs text-[#8B8680]">Knockout-only record (no league standings table).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[#8B8680] border-b border-white/10 uppercase">
                <tr>
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Team</th>
                  <th className="py-2 px-2 text-center">P</th>
                  <th className="py-2 px-2 text-center">W</th>
                  <th className="py-2 px-2 text-center">L</th>
                  <th className="py-2 px-2 text-center">D</th>
                  <th className="py-2 px-2 text-right">
                    {sport.slug === "cricket" ? "NRR" : sport.slug === "football" ? "GD" : "Sets"}
                  </th>
                  <th className="py-2 pl-2 text-right text-[#D97706]">PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {standings.map((s) => (
                  <tr key={s.teamId} className="tabular-nums">
                    <td className="py-2.5 pr-3 font-mono text-[#D97706]">{s.rank}</td>
                    <td className="py-2.5 pr-3 font-semibold">{s.team?.name}</td>
                    <td className="py-2.5 px-2 text-center font-mono">{s.played}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-[#10B981]">{s.won}</td>
                    <td className="py-2.5 px-2 text-center font-mono text-[#DC2626]">{s.lost}</td>
                    <td className="py-2.5 px-2 text-center font-mono">{s.drawn}</td>
                    <td className="py-2.5 px-2 text-right font-mono">
                      {sport.slug === "cricket"
                        ? s.nrr.toFixed(3)
                        : sport.slug === "football"
                        ? s.goalDiff
                        : `${s.setsWon}-${s.setsLost}`}
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono font-bold text-[#F59E0B]">
                      {s.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. BOTTOM SPLIT VIEW: Left = Final down to Opening Match | Right = Teams Dropdown */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rdr-panel rounded-lg p-5 space-y-3">
          <h2 className="font-editorial text-2xl text-[#F5F2EB]">
            Matches (Final → Opening Match)
          </h2>
          <div className="space-y-2.5">
            {matches.map((m) => (
              <Link
                key={m.id}
                to={`/matches/${m.id}`}
                className="block p-3.5 rounded bg-[#08080A] border border-white/10 hover:border-[#D97706]/60 space-y-1"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold uppercase text-[#D97706]">{m.roundLabel}</span>
                  <span className="text-[#8B8680] tabular-nums">{formatIST(m.scheduledAt)}</span>
                </div>
                <div className="text-sm font-bold text-[#F5F2EB]">
                  {m.teamA?.name} vs {m.teamB?.name}
                </div>
                {m.scoreSummary && (
                  <div className="text-xs font-mono text-[#F59E0B]">{m.scoreSummary}</div>
                )}
                {m.resultNote && <div className="text-xs text-[#10B981]">{m.resultNote}</div>}
              </Link>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 rdr-panel rounded-lg p-5 space-y-4">
          <h2 className="font-editorial text-2xl text-[#F5F2EB] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#D97706]" /> Teams &amp; Squads
          </h2>
          <select
            value={activeTeam?.id ?? ""}
            onChange={(e) => setSelectedTeamId(Number(e.target.value))}
            className="w-full bg-[#08080A] border border-[#D97706]/50 rounded px-3 py-2 text-xs font-semibold"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.shortCode})
              </option>
            ))}
          </select>

          {activeTeam && (
            <div className="space-y-2">
              {activeTeam.roster.length === 0 ? (
                <p className="text-xs text-[#8B8680]">No individual squad members recorded.</p>
              ) : (
                activeTeam.roster.map((p) => (
                  <Link
                    key={p.playerProfileId}
                    to={`/players/${p.playerProfileId}`}
                    className="block p-3 rounded bg-[#08080A] border border-white/10 hover:border-[#D97706]/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#F5F2EB]">{p.displayName}</span>
                      <span className="text-[11px] font-mono text-[#D97706]">
                        {p.batch} • {p.branch ?? "IIITT"}
                      </span>
                    </div>
                    {p.playingRole && (
                      <div className="text-xs text-[#8B8680] mt-0.5">Role: {p.playingRole}</div>
                    )}
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
