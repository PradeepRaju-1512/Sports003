import type { DerivedMatchState, SportId } from "./types.ts";

export interface CompletedMatchInput {
  teamAId: number;
  teamBId: number;
  winnerTeamId: number | null;
  sportId: SportId;
  derived: DerivedMatchState;
}

export interface ComputedStandingRow {
  teamId: number;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  points: number;
  nrr: number;
  goalDiff: number;
  goalsFor: number;
  goalsAgainst: number;
  setsWon: number;
  setsLost: number;
  rank: number;
}

export function computeStandingsForSport(
  sportId: SportId,
  teamIds: number[],
  completedMatches: CompletedMatchInput[]
): ComputedStandingRow[] {
  const table = new Map<
    number,
    ComputedStandingRow & {
      cricRunsFor: number;
      cricOversFor: number;
      cricRunsAgainst: number;
      cricOversAgainst: number;
    }
  >();

  for (const tid of teamIds) {
    table.set(tid, {
      teamId: tid,
      played: 0,
      won: 0,
      lost: 0,
      drawn: 0,
      points: 0,
      nrr: 0,
      goalDiff: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      setsWon: 0,
      setsLost: 0,
      rank: 1,
      cricRunsFor: 0,
      cricOversFor: 0,
      cricRunsAgainst: 0,
      cricOversAgainst: 0,
    });
  }

  const winPts = sportId === "football" ? 3 : 2;

  for (const m of completedMatches) {
    const a = table.get(m.teamAId);
    const b = table.get(m.teamBId);
    if (!a || !b) continue;

    a.played += 1;
    b.played += 1;

    if (m.winnerTeamId === m.teamAId) {
      a.won += 1;
      a.points += winPts;
      b.lost += 1;
    } else if (m.winnerTeamId === m.teamBId) {
      b.won += 1;
      b.points += winPts;
      a.lost += 1;
    } else {
      a.drawn += 1;
      b.drawn += 1;
      a.points += 1;
      b.points += 1;
    }

    if (sportId === "cricket") {
      const innings = (m.derived.detail.innings as Array<{
        battingSide: "A" | "B";
        runs: number;
        wickets: number;
        oversDecimal: number;
      }>) ?? [];
      const oversLimit = Number(m.derived.detail.oversLimit ?? 10);
      for (const inn of innings) {
        const effOvers = inn.wickets >= 10 ? oversLimit : inn.oversDecimal;
        if (effOvers <= 0) continue;
        if (inn.battingSide === "A") {
          a.cricRunsFor += inn.runs;
          a.cricOversFor += effOvers;
          b.cricRunsAgainst += inn.runs;
          b.cricOversAgainst += effOvers;
        } else {
          b.cricRunsFor += inn.runs;
          b.cricOversFor += effOvers;
          a.cricRunsAgainst += inn.runs;
          a.cricOversAgainst += effOvers;
        }
      }
    } else if (
      sportId === "volleyball" ||
      sportId === "throwball" ||
      sportId === "badminton" ||
      sportId === "table_tennis"
    ) {
      a.setsWon += m.derived.teamANumeric;
      a.setsLost += m.derived.teamBNumeric;
      b.setsWon += m.derived.teamBNumeric;
      b.setsLost += m.derived.teamANumeric;
    } else {
      a.goalsFor += m.derived.teamANumeric;
      a.goalsAgainst += m.derived.teamBNumeric;
      b.goalsFor += m.derived.teamBNumeric;
      b.goalsAgainst += m.derived.teamANumeric;
    }
  }

  const rows = Array.from(table.values()).map((r) => {
    const nrr =
      r.cricOversFor > 0 && r.cricOversAgainst > 0
        ? Number((r.cricRunsFor / r.cricOversFor - r.cricRunsAgainst / r.cricOversAgainst).toFixed(3))
        : 0;
    const goalDiff = r.goalsFor - r.goalsAgainst;
    return {
      teamId: r.teamId,
      played: r.played,
      won: r.won,
      lost: r.lost,
      drawn: r.drawn,
      points: r.points,
      nrr,
      goalDiff,
      goalsFor: r.goalsFor,
      goalsAgainst: r.goalsAgainst,
      setsWon: r.setsWon,
      setsLost: r.setsLost,
      rank: 1,
    };
  });

  rows.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (sportId === "cricket" && y.nrr !== x.nrr) return y.nrr - x.nrr;
    if (
      sportId === "volleyball" ||
      sportId === "throwball" ||
      sportId === "badminton" ||
      sportId === "table_tennis"
    ) {
      const diffY = y.setsWon - y.setsLost;
      const diffX = x.setsWon - x.setsLost;
      if (diffY !== diffX) return diffY - diffX;
    }
    if (y.goalDiff !== x.goalDiff) return y.goalDiff - x.goalDiff;
    return y.won - x.won;
  });

  rows.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  return rows;
}
