import type {
  DerivedMatchState,
  MatchEventRecord,
  MatchReducerConfig,
  Side,
  SportId,
} from "../types.ts";
import { resolveClockState } from "../types.ts";

interface SetSpec {
  bestOfGames: number;
  targetPoints: number;
  deciderPoints: number;
  winByTwo: boolean;
  maxCap: number | null;
  serveRotationEvery: number | null; // e.g., 2 for Table Tennis
}

const SPECS: Record<"volleyball" | "throwball" | "badminton" | "table_tennis", SetSpec> = {
  volleyball: {
    bestOfGames: 3,
    targetPoints: 25,
    deciderPoints: 15,
    winByTwo: true,
    maxCap: null,
    serveRotationEvery: null,
  },
  throwball: {
    bestOfGames: 3,
    targetPoints: 25,
    deciderPoints: 15,
    winByTwo: true,
    maxCap: null,
    serveRotationEvery: null,
  },
  badminton: {
    bestOfGames: 3,
    targetPoints: 21,
    deciderPoints: 21,
    winByTwo: true,
    maxCap: 30,
    serveRotationEvery: null,
  },
  table_tennis: {
    bestOfGames: 5,
    targetPoints: 11,
    deciderPoints: 11,
    winByTwo: true,
    maxCap: null,
    serveRotationEvery: 2,
  },
};

export function reduceSetSport(
  sportId: "volleyball" | "throwball" | "badminton" | "table_tennis",
  events: MatchEventRecord[],
  config: MatchReducerConfig = {}
): DerivedMatchState {
  const base = SPECS[sportId];
  const bestOfGames = config.bestOfGames ?? base.bestOfGames;
  const targetPoints = config.targetPoints ?? base.targetPoints;
  const deciderPoints = config.deciderPoints ?? base.deciderPoints;
  const setsNeeded = Math.ceil(bestOfGames / 2);

  const active = events.filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);
  const sets: Array<{ a: number; b: number; winner: Side | null }> = [{ a: 0, b: 0, winner: null }];
  let serverSide: Side = "A";
  let timeoutsA = 0;
  let timeoutsB = 0;

  for (const ev of active) {
    const p = ev.payloadJson;
    if (ev.eventType === "TIMEOUT") {
      if (p.side === "A") timeoutsA += 1;
      else if (p.side === "B") timeoutsB += 1;
      continue;
    }
    if (ev.eventType === "SET_SERVER") {
      if (p.side === "A" || p.side === "B") serverSide = p.side;
      continue;
    }
    if (ev.eventType !== "POINT") continue;

    let currentSet = sets[sets.length - 1];
    if (currentSet.winner !== null) {
      if (sets.length < bestOfGames) {
        currentSet = { a: 0, b: 0, winner: null };
        sets.push(currentSet);
      } else {
        continue;
      }
    }

    const side = (p.side as Side) ?? "A";
    if (side === "A") currentSet.a += 1;
    else currentSet.b += 1;

    // Service tracking
    if (sportId === "table_tennis" && base.serveRotationEvery) {
      const totalPts = currentSet.a + currentSet.b;
      const inDeuce = currentSet.a >= targetPoints - 1 && currentSet.b >= targetPoints - 1;
      if (inDeuce) {
        serverSide = serverSide === "A" ? "B" : "A";
      } else if (totalPts % base.serveRotationEvery === 0) {
        serverSide = serverSide === "A" ? "B" : "A";
      }
    } else {
      serverSide = side;
    }

    const isDecider = sets.length === bestOfGames;
    const goal = isDecider ? deciderPoints : targetPoints;
    const lead = Math.abs(currentSet.a - currentSet.b);
    const maxScore = Math.max(currentSet.a, currentSet.b);

    const hitCap = base.maxCap !== null && maxScore >= base.maxCap;
    const wonNormally = maxScore >= goal && (!base.winByTwo || lead >= 2);
    if (hitCap || wonNormally) {
      currentSet.winner = currentSet.a > currentSet.b ? "A" : "B";
      const setsWonA = sets.filter((s) => s.winner === "A").length;
      const setsWonB = sets.filter((s) => s.winner === "B").length;
      if (setsWonA < setsNeeded && setsWonB < setsNeeded && sets.length < bestOfGames) {
        sets.push({ a: 0, b: 0, winner: null });
      }
    }
  }

  const setsWonA = sets.filter((s) => s.winner === "A").length;
  const setsWonB = sets.filter((s) => s.winner === "B").length;
  const currentSet = sets[sets.length - 1];

  let suggestedWinnerSide: Side | null = null;
  if (setsWonA >= setsNeeded) suggestedWinnerSide = "A";
  else if (setsWonB >= setsNeeded) suggestedWinnerSide = "B";

  const setScoresText = sets.map((s) => `${s.a}-${s.b}`).join(", ");
  const teamAShort = config.teamAShort ?? "TEAM A";
  const teamBShort = config.teamBShort ?? "TEAM B";

  return {
    sportId: sportId as SportId,
    summaryText: `${teamAShort} ${setsWonA}-${setsWonB} ${teamBShort} (${setScoresText})`,
    teamAScoreLabel: `${setsWonA} sets (${currentSet.a})`,
    teamBScoreLabel: `${setsWonB} sets (${currentSet.b})`,
    teamANumeric: setsWonA,
    teamBNumeric: setsWonB,
    periodLabel: `Set ${sets.length} of ${bestOfGames}`,
    clock: resolveClockState(active, config),
    suggestedWinnerSide,
    activeEventCount: active.length,
    detail: {
      bestOfGames,
      targetPoints,
      sets,
      setsWonA,
      setsWonB,
      currentSetNumber: sets.length,
      serverSide,
      timeoutsA,
      timeoutsB,
      badmintonInterval:
        sportId === "badminton" &&
        (currentSet.a === 11 || currentSet.b === 11) &&
        Math.min(currentSet.a, currentSet.b) < 11,
    },
  };
}
