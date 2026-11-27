import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Award, CheckCircle2, Code2, MapPin, ShieldCheck, Trophy, X } from "lucide-react";
import { formatIST } from "../lib/api.ts";
import { useApp } from "../context/AppContext.tsx";
import type { DerivedMatchState, SportId } from "../../../shared/scoring/types.ts";
import { formatMatchTimeline, type FormattedTimelineItem } from "../../../shared/scoring/formatEvent.ts";
import {
  buildCricketScorecard,
  buildGenericSportBoxScore,
} from "../../../shared/scoring/scorecard.ts";

export interface HydratedMatchCenterData {
  match: {
    id: number;
    status: "UPCOMING" | "LIVE" | "COMPLETED";
    roundLabel: string;
    venue: string;
    scheduledAt: string;
    scoreSummary: string | null;
    resultNote: string | null;
    winnerTeamId: number | null;
    verifiedBy: number | null;
    version: number;
    configJson?: Record<string, unknown>;
  };
  sport: { name: string; slug: string };
  tournament: { id: number; name: string; status?: string; academicYear?: number };
  teamA: {
    id: number;
    name: string;
    shortCode: string;
    roster: Array<{ playerProfileId: number; displayName: string; playingRole: string | null; batch: string }>;
  };
  teamB: {
    id: number;
    name: string;
    shortCode: string;
    roster: Array<{ playerProfileId: number; displayName: string; playingRole: string | null; batch: string }>;
  };
  events: Array<{
    seq: number;
    eventType: string;
    payloadJson: Record<string, unknown>;
    voided: boolean;
    occurredAt: string;
    matchClockMs?: number | null;
  }>;
  playerNames?: Record<number, string>;
  mvpPlayerProfileId?: number | null;
  scorerUser?: { id: number; name: string } | null;
  derived: DerivedMatchState;
  permissions: { canScore: boolean; canVerify: boolean };
}

type MatchTab = "SUMMARY" | "SCORECARD" | "COMMENTARY";

export function MatchCenterView({
  data,
  extraAdminSlot,
}: {
  data: HydratedMatchCenterData;
  extraAdminSlot?: React.ReactNode;
}) {
  const { user, hasGlobalSportsAuthority } = useApp();
  const [activeTab, setActiveTab] = useState<MatchTab>("SUMMARY");
  const [selectedInningsIdx, setSelectedInningsIdx] = useState<number>(0);
  const [inspectItem, setInspectItem] = useState<FormattedTimelineItem | null>(null);

  const { match, sport, tournament, teamA, teamB, events, derived, permissions, scorerUser } = data;
  const canOpenScorer = Boolean(
    user &&
      permissions.canScore &&
      (hasGlobalSportsAuthority || scorerUser?.id === user.id)
  );
  const sportId = (sport.slug as SportId) ?? "cricket";
  const isCricket = sportId === "cricket";

  const cricketCard = useMemo(() => {
    if (!isCricket) return null;
    return buildCricketScorecard(
      {
        ...match,
        tournamentStatus: tournament.status,
        mvpPlayerProfileId: data.mvpPlayerProfileId ?? null,
      },
      events,
      {
        sideA: teamA,
        sideB: teamB,
        playerNames: data.playerNames,
      }
    );
  }, [isCricket, match, tournament.status, data.mvpPlayerProfileId, data.playerNames, events, teamA, teamB]);

  const genericBox = useMemo(() => {
    if (isCricket) return null;
    return buildGenericSportBoxScore(
      sportId,
      {
        ...match,
        tournamentStatus: tournament.status,
        mvpPlayerProfileId: data.mvpPlayerProfileId ?? null,
      },
      derived,
      {
        sideA: teamA,
        sideB: teamB,
        playerNames: data.playerNames,
      }
    );
  }, [isCricket, sportId, match, tournament.status, data.mvpPlayerProfileId, data.playerNames, derived, teamA, teamB]);

  const timelineItems = useMemo(() => {
    const playerNames: Record<number, string> = { ...(data.playerNames ?? {}) };
    for (const p of [...teamA.roster, ...teamB.roster]) {
      playerNames[p.playerProfileId] = p.displayName;
    }
    return formatMatchTimeline(events, {
      sportId,
      teamAShort: teamA.shortCode,
      teamBShort: teamB.shortCode,
      playerNames,
    }).filter((i) => !i.voided);
  }, [data.playerNames, teamA, teamB, events, sportId]);

  const statusOrResultLine =
    match.status === "LIVE"
      ? "LIVE"
      : match.resultNote
      ? match.resultNote
      : match.winnerTeamId === teamA.id
      ? `${teamA.name} won`
      : match.winnerTeamId === teamB.id
      ? `${teamB.name} won`
      : match.status;

  const rawSummary = (match.scoreSummary ?? "").trim();
  const isPlaceholderSummary =
    rawSummary.toLowerCase() === "scheduled" || rawSummary.toLowerCase() === "kickoff scheduled";
  const effectiveLegacySummary =
    match.status !== "UPCOMING" && isPlaceholderSummary
      ? match.resultNote || (match.status === "LIVE" ? "Match In Progress" : "Completed — Final Score")
      : rawSummary;
  const isLegacySummaryOnly = events.filter((e) => !e.voided).length === 0 && Boolean(effectiveLegacySummary);

  const cricketSideAScore =
    cricketCard?.innings.find((i) => i.side === "A")
      ? `${cricketCard.innings.find((i) => i.side === "A")!.totalRuns}/${
          cricketCard.innings.find((i) => i.side === "A")!.wickets
        } (${cricketCard.innings.find((i) => i.side === "A")!.oversDisplay})`
      : derived.teamAScoreLabel;

  const cricketSideBScore =
    cricketCard?.innings.find((i) => i.side === "B")
      ? `${cricketCard.innings.find((i) => i.side === "B")!.totalRuns}/${
          cricketCard.innings.find((i) => i.side === "B")!.wickets
        } (${cricketCard.innings.find((i) => i.side === "B")!.oversDisplay})`
      : derived.teamBScoreLabel;

  const potm = isCricket ? cricketCard?.playerOfTheMatch : genericBox?.playerOfTheMatch;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Match Header Card */}
      <div className="rdr-panel rdr-border-crimson rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {tournament.status === "ARCHIVED" && tournament.academicYear && (
              <Link
                to={`/archive/${tournament.academicYear}`}
                className="text-[#8B8680] hover:text-[#F5F2EB]"
              >
                Archive {tournament.academicYear} &rarr;
              </Link>
            )}
            <span className="text-[#D97706] font-bold uppercase">
              {tournament.name} &bull; {sport.name} &bull; {match.roundLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {match.verifiedBy && (
              <span className="px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified
              </span>
            )}
            {match.status === "LIVE" && (
              <span className="px-2.5 py-0.5 rounded bg-[#DC2626] text-white font-bold animate-pulse">
                LIVE
              </span>
            )}
            {canOpenScorer && (
              <Link
                to={`/scorer?matchId=${match.id}`}
                className="px-3 py-1 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-[#F5F2EB] font-bold uppercase"
              >
                Open Live Scorer
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 items-center gap-4 text-center py-2">
          <div>
            <div className="font-editorial text-2xl sm:text-4xl text-[#F5F2EB]">{teamA.name}</div>
            <div className="font-mono tabular-score text-lg sm:text-2xl text-[#D97706] mt-1">
              {isLegacySummaryOnly
                ? teamA.shortCode
                : isCricket
                ? cricketSideAScore
                : derived.teamAScoreLabel}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase text-[#8B8680]">{match.status}</div>
            <div className="text-xs text-[#D6CFC2]">
              {isLegacySummaryOnly ? match.roundLabel : derived.periodLabel}
            </div>
          </div>
          <div>
            <div className="font-editorial text-2xl sm:text-4xl text-[#F5F2EB]">{teamB.name}</div>
            <div className="font-mono tabular-score text-lg sm:text-2xl text-[#D97706] mt-1">
              {isLegacySummaryOnly
                ? teamB.shortCode
                : isCricket
                ? cricketSideBScore
                : derived.teamBScoreLabel}
            </div>
          </div>
        </div>

        <div className="text-center text-sm font-semibold text-[#10B981] bg-[#0D0D0F] py-2 px-3 rounded border border-white/10">
          {match.status !== "LIVE" && <Trophy className="w-4 h-4 inline mr-1.5" />}
          {isLegacySummaryOnly && effectiveLegacySummary
            ? `${effectiveLegacySummary}${match.resultNote && match.resultNote !== effectiveLegacySummary ? ` — ${match.resultNote}` : ""}`
            : statusOrResultLine}
        </div>

        {/* 3 Match Center Tabs */}
        <div className="flex border-b border-white/10 pt-2 gap-1">
          {(["SUMMARY", "SCORECARD", "COMMENTARY"] as MatchTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
                activeTab === tab
                  ? "border-[#DC2626] text-[#F5F2EB] bg-white/5"
                  : "border-transparent text-[#8B8680] hover:text-[#D6CFC2]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {extraAdminSlot}

      {/* TAB 1: SUMMARY */}
      {activeTab === "SUMMARY" && (
        <div className="space-y-5">
          {/* Player of the Match (when COMPLETED / ARCHIVED) */}
          {potm && (
            <div className="rdr-panel rounded-lg p-4 border border-[#D97706]/50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-[#D97706]/20 border border-[#D97706] flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[#D97706] font-bold">
                    Player of the Match
                  </div>
                  <Link
                    to={`/players/${potm.playerId}`}
                    className="font-editorial text-xl text-[#F5F2EB] hover:text-[#D97706]"
                  >
                    {potm.playerName} ({potm.teamShort})
                  </Link>
                </div>
              </div>
              <div className="font-mono tabular-score text-sm font-bold text-[#F59E0B]">
                {potm.impactSummary}
              </div>
            </div>
          )}

          {isCricket && cricketCard && cricketCard.hasEvents ? (
            <div className="space-y-4">
              {cricketCard.innings.map((inn) => (
                <div key={inn.side} className="rdr-panel rounded-lg p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h3 className="font-editorial text-xl text-[#F5F2EB]">
                      {inn.teamName} Innings
                    </h3>
                    <span className="font-mono tabular-score text-sm font-bold text-[#D97706]">
                      {inn.totalRuns}/{inn.wickets} ({inn.oversDisplay} ov)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Top 3 Batters */}
                    <div className="space-y-2 bg-[#0D0D0F] p-3.5 rounded border border-white/10">
                      <div className="text-[10px] uppercase tracking-wider text-[#8B8680] font-bold">
                        Top Batters
                      </div>
                      {inn.topBatters.length === 0 ? (
                        <div className="text-xs text-[#8B8680]">No batters recorded</div>
                      ) : (
                        inn.topBatters.map((b) => (
                          <div key={b.playerId} className="flex items-center justify-between text-xs">
                            <Link
                              to={`/players/${b.playerId}`}
                              className="font-semibold text-[#F5F2EB] hover:text-[#D97706]"
                            >
                              {b.playerName}
                              {b.notOut ? "*" : ""}
                            </Link>
                            <span className="font-mono tabular-score text-[#F59E0B]">
                              {b.runs} ({b.balls})
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Top 3 Bowlers */}
                    <div className="space-y-2 bg-[#0D0D0F] p-3.5 rounded border border-white/10">
                      <div className="text-[10px] uppercase tracking-wider text-[#8B8680] font-bold">
                        Top Bowlers
                      </div>
                      {inn.topBowlers.length === 0 ? (
                        <div className="text-xs text-[#8B8680]">No bowlers recorded</div>
                      ) : (
                        inn.topBowlers.map((bw) => (
                          <div key={bw.playerId} className="flex items-center justify-between text-xs">
                            <Link
                              to={`/players/${bw.playerId}`}
                              className="font-semibold text-[#F5F2EB] hover:text-[#D97706]"
                            >
                              {bw.playerName}
                            </Link>
                            <span className="font-mono tabular-score text-[#10B981]">
                              {bw.wickets}/{bw.runsConceded} ({bw.oversDisplay})
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : !isCricket && genericBox && genericBox.sections.length > 0 ? (
            <div className="rdr-panel rounded-lg p-5 space-y-4">
              <h3 className="font-editorial text-xl text-[#F5F2EB]">Match Summary Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0D0D0F] p-3.5 rounded border border-white/10 space-y-1.5">
                  <div className="text-[10px] uppercase text-[#D97706] font-bold">{teamA.name}</div>
                  {genericBox.leadersLeft.map((x, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-[#D6CFC2]">{x.label}</span>
                      <span className="font-mono tabular-score font-bold">{x.value}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-[#0D0D0F] p-3.5 rounded border border-white/10 space-y-1.5">
                  <div className="text-[10px] uppercase text-[#D97706] font-bold">{teamB.name}</div>
                  {genericBox.leadersRight.map((x, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-[#D6CFC2]">{x.label}</span>
                      <span className="font-mono tabular-score font-bold">{x.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rdr-panel rounded-lg p-5 space-y-2">
              <h3 className="font-editorial text-xl text-[#F5F2EB]">Official Summary Record</h3>
              <p className="text-xs text-[#D6CFC2]">
                {match.scoreSummary || "Detailed ball-by-ball event logs were not recorded for this legacy match."}
              </p>
              {match.resultNote && (
                <p className="text-xs text-[#10B981] font-semibold">{match.resultNote}</p>
              )}
            </div>
          )}

          {/* Toss & Venue Metadata Footer */}
          <div className="rdr-panel rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#8B8680]">
            <span>
              <strong className="text-[#D6CFC2]">Fixture:</strong>{" "}
              {cricketCard?.tossSummary ?? `${teamA.shortCode} vs ${teamB.shortCode} • ${match.roundLabel}`}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#B91C1C]" />
              <strong className="text-[#D6CFC2]">Venue:</strong> {match.venue}
            </span>
            <span>
              <strong className="text-[#D6CFC2]">Date:</strong> {formatIST(match.scheduledAt)}
            </span>
          </div>
        </div>
      )}

      {/* TAB 2: SCORECARD */}
      {activeTab === "SCORECARD" && (
        <div className="space-y-5">
          {isCricket && cricketCard && cricketCard.hasEvents ? (
            <>
              {/* Innings / Team Selector Tabs */}
              <div className="flex flex-wrap gap-2">
                {cricketCard.innings.map((inn, idx) => (
                  <button
                    key={inn.side}
                    type="button"
                    onClick={() => setSelectedInningsIdx(idx)}
                    className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider border transition ${
                      selectedInningsIdx === idx
                        ? "bg-[#B91C1C] border-[#B91C1C] text-[#F5F2EB]"
                        : "bg-[#161618] border-white/15 text-[#D6CFC2]"
                    }`}
                  >
                    {inn.teamName} ({inn.totalRuns}/{inn.wickets})
                  </button>
                ))}
              </div>

              {(() => {
                const inn =
                  cricketCard.innings[selectedInningsIdx] ?? cricketCard.innings[0];
                if (!inn) return null;
                return (
                  <div className="space-y-5">
                    {/* Batting Table */}
                    <div className="rdr-panel rounded-lg p-5 space-y-3">
                      <h3 className="font-editorial text-xl text-[#F5F2EB] border-b border-white/10 pb-2">
                        {inn.teamName} Batting
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="text-[#8B8680] border-b border-white/10 uppercase">
                            <tr>
                              <th className="py-2 pr-3">Batting</th>
                              <th className="py-2 px-2 text-right">R</th>
                              <th className="py-2 px-2 text-right">B</th>
                              <th className="py-2 px-2 text-right">4s</th>
                              <th className="py-2 px-2 text-right">6s</th>
                              <th className="py-2 pl-2 text-right">S/R</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {inn.battingRows.map((b) => (
                              <tr key={b.playerId} className="hover:bg-white/5">
                                <td className="py-2.5 pr-3">
                                  <Link
                                    to={`/players/${b.playerId}`}
                                    className="font-semibold text-[#F5F2EB] hover:text-[#D97706]"
                                  >
                                    {b.playerName}
                                    {b.isCaptain ? " (c)" : ""}
                                    {b.isKeeper ? " (wk)" : ""}
                                  </Link>
                                  <div className="text-[11px] text-[#8B8680] mt-0.5">
                                    {b.dismissalText}
                                  </div>
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono tabular-score font-bold text-[#F5F2EB]">
                                  {b.runs}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono tabular-score">
                                  {b.balls}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono tabular-score">
                                  {b.fours}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono tabular-score">
                                  {b.sixes}
                                </td>
                                <td className="py-2.5 pl-2 text-right font-mono tabular-score text-[#D97706]">
                                  {b.strikeRate}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-[#0D0D0F]">
                              <td className="py-2.5 pr-3 font-semibold text-[#D6CFC2]">Extras</td>
                              <td colSpan={5} className="py-2.5 pl-2 text-right font-mono tabular-score text-[#D6CFC2]">
                                {inn.extrasText}
                              </td>
                            </tr>
                            <tr className="bg-[#111113] font-bold">
                              <td className="py-2.5 pr-3 text-[#F5F2EB]">Total runs</td>
                              <td colSpan={5} className="py-2.5 pl-2 text-right font-mono tabular-score text-[#F59E0B]">
                                {inn.totalText}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {inn.didNotBat.length > 0 && (
                        <div className="pt-2 border-t border-white/10 text-xs text-[#8B8680]">
                          <span className="font-semibold text-[#D6CFC2] mr-1.5">Did not bat:</span>
                          {inn.didNotBat.map((p, i) => (
                            <React.Fragment key={p.playerId}>
                              <Link
                                to={`/players/${p.playerId}`}
                                className="hover:text-[#D97706]"
                              >
                                {p.playerName}
                                {p.isCaptain ? " (c)" : ""}
                                {p.isKeeper ? " (wk)" : ""}
                              </Link>
                              {i < inn.didNotBat.length - 1 ? ", " : ""}
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bowling Table */}
                    <div className="rdr-panel rounded-lg p-5 space-y-3">
                      <h3 className="font-editorial text-xl text-[#F5F2EB] border-b border-white/10 pb-2">
                        Bowling
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="text-[#8B8680] border-b border-white/10 uppercase">
                            <tr>
                              <th className="py-2 pr-3">Bowler</th>
                              <th className="py-2 px-2 text-right">O</th>
                              <th className="py-2 px-2 text-right">M</th>
                              <th className="py-2 px-2 text-right">R</th>
                              <th className="py-2 px-2 text-right">W</th>
                              <th className="py-2 pl-2 text-right">ECON</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {inn.bowlingRows.map((bw) => (
                              <tr key={bw.playerId} className="hover:bg-white/5">
                                <td className="py-2.5 pr-3">
                                  <Link
                                    to={`/players/${bw.playerId}`}
                                    className="font-semibold text-[#F5F2EB] hover:text-[#D97706]"
                                  >
                                    {bw.playerName}
                                  </Link>
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono tabular-score">
                                  {bw.oversDisplay}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono tabular-score">
                                  {bw.maidens}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono tabular-score">
                                  {bw.runsConceded}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono tabular-score font-bold text-[#10B981]">
                                  {bw.wickets}
                                </td>
                                <td className="py-2.5 pl-2 text-right font-mono tabular-score text-[#D97706]">
                                  {bw.economy}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          ) : !isCricket && genericBox && genericBox.sections.some((s) => s.rows.length > 0) ? (
            <div className="space-y-4">
              {genericBox.sections.map((sec, idx) => (
                <div key={idx} className="rdr-panel rounded-lg p-5 space-y-3">
                  <h3 className="font-editorial text-xl text-[#F5F2EB] border-b border-white/10 pb-2">
                    {sec.title}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[#8B8680] border-b border-white/10 uppercase">
                        <tr>
                          {sec.columns.map((c) => (
                            <th key={c} className="py-2 px-2">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {sec.rows.map((r, rIdx) => (
                          <tr key={rIdx}>
                            {r.map((cell, cIdx) => (
                              <td key={cIdx} className="py-2 px-2 font-mono tabular-score">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Squad Rosters Always Visible in Scorecard */}
          <div className="rdr-panel rounded-lg p-5 space-y-4">
            <h3 className="font-editorial text-xl text-[#F5F2EB] border-b border-white/10 pb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#D97706]" /> Team Squads
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[teamA, teamB].map((t) => (
                <div key={t.id} className="space-y-1.5">
                  <div className="text-xs font-bold uppercase text-[#D97706]">{t.name}</div>
                  {t.roster.length === 0 ? (
                    <div className="text-xs text-[#8B8680]">No squad players linked</div>
                  ) : (
                    t.roster.map((p) => (
                      <Link
                        key={p.playerProfileId}
                        to={`/players/${p.playerProfileId}`}
                        className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded bg-[#0D0D0F] hover:border-[#D97706]/50 border border-white/5"
                      >
                        <span>{p.displayName}</span>
                        <span className="text-[10px] text-[#8B8680]">{p.playingRole ?? p.batch}</span>
                      </Link>
                    ))
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COMMENTARY */}
      {activeTab === "COMMENTARY" && (
        <div className="rdr-panel rounded-lg p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="font-editorial text-xl text-[#F5F2EB]">
              Ball-by-Ball / Point-by-Point Commentary
            </h3>
            <span className="font-mono text-[10px] text-[#8B8680]">
              {timelineItems.length} EVENTS
            </span>
          </div>

          {timelineItems.length === 0 ? (
            <p className="text-xs text-[#8B8680] py-4">
              No live event commentary recorded for this match.
            </p>
          ) : (
            <div className="max-h-[520px] overflow-y-auto space-y-2">
              {timelineItems.map((item) => (
                <div
                  key={item.seq}
                  className="p-2.5 rounded bg-[#0D0D0F] border border-white/10 flex items-center justify-between gap-2.5 min-w-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-11 shrink-0 text-center">
                      <div className="font-mono text-[10px] text-[#8B8680]">#{item.seq}</div>
                      <div className="font-mono text-[10px] text-[#D97706]">{item.contextLabel}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#161618] border border-white/15 font-mono text-[11px] font-bold text-[#F59E0B] shrink-0">
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
              ))}
            </div>
          )}
        </div>
      )}

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
