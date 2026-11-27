import type {
  DerivedMatchState,
  MatchEventRecord,
  MatchReducerConfig,
  Side,
} from "../types.ts";
import { resolveClockState } from "../types.ts";

export function reduceFootball(
  events: MatchEventRecord[],
  config: MatchReducerConfig = {}
): DerivedMatchState {
  const active = events.filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);
  let goalsA = 0;
  let goalsB = 0;
  let penA = 0;
  let penB = 0;
  let period = "1H";
  const goalsList: Array<{ side: Side; scorerId?: number; assistId?: number; minute?: number }> = [];
  const cards: Array<{ side: Side; playerId?: number; card: "YELLOW" | "RED"; minute?: number }> = [];
  const subs: Array<{ side: Side; outId?: number; inId?: number; minute?: number }> = [];

  for (const ev of active) {
    const p = ev.payloadJson;
    if (ev.eventType === "PERIOD") {
      period = String(p.period ?? period);
    } else if (ev.eventType === "GOAL") {
      const side = (p.side as Side) ?? "A";
      if (side === "A") goalsA += 1;
      else goalsB += 1;
      goalsList.push({
        side,
        scorerId: p.scorerId ? Number(p.scorerId) : undefined,
        assistId: p.assistId ? Number(p.assistId) : undefined,
        minute: p.minute ? Number(p.minute) : undefined,
      });
    } else if (ev.eventType === "CARD") {
      cards.push({
        side: (p.side as Side) ?? "A",
        playerId: p.playerId ? Number(p.playerId) : undefined,
        card: (p.card as "YELLOW" | "RED") ?? "YELLOW",
        minute: p.minute ? Number(p.minute) : undefined,
      });
    } else if (ev.eventType === "SUB") {
      subs.push({
        side: (p.side as Side) ?? "A",
        outId: p.outId ? Number(p.outId) : undefined,
        inId: p.inId ? Number(p.inId) : undefined,
        minute: p.minute ? Number(p.minute) : undefined,
      });
    } else if (ev.eventType === "PENALTY_SHOOTOUT") {
      const side = (p.side as Side) ?? "A";
      if (p.scored) {
        if (side === "A") penA += 1;
        else penB += 1;
      }
    }
  }

  const teamAShort = config.teamAShort ?? "TEAM A";
  const teamBShort = config.teamBShort ?? "TEAM B";
  const penText = penA > 0 || penB > 0 ? ` (PEN ${penA}-${penB})` : "";

  let suggestedWinnerSide: Side | "DRAW" | null = null;
  if (period === "FT" || period === "PEN") {
    if (goalsA > goalsB || (goalsA === goalsB && penA > penB)) suggestedWinnerSide = "A";
    else if (goalsB > goalsA || (goalsA === goalsB && penB > penA)) suggestedWinnerSide = "B";
    else suggestedWinnerSide = "DRAW";
  }

  return {
    sportId: "football",
    summaryText: `${teamAShort} ${goalsA} - ${goalsB} ${teamBShort}${penText}`,
    teamAScoreLabel: String(goalsA),
    teamBScoreLabel: String(goalsB),
    teamANumeric: goalsA,
    teamBNumeric: goalsB,
    periodLabel: period,
    clock: resolveClockState(active, config),
    suggestedWinnerSide,
    activeEventCount: active.length,
    detail: {
      goalsA,
      goalsB,
      penA,
      penB,
      period,
      goalsList,
      cards,
      subs,
    },
  };
}

export function reduceKabaddi(
  events: MatchEventRecord[],
  config: MatchReducerConfig = {}
): DerivedMatchState {
  const active = events.filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);
  const stats = {
    A: { total: 0, raid: 0, tackle: 0, bonus: 0, allOut: 0, superRaid: 0, superTackle: 0 },
    B: { total: 0, raid: 0, tackle: 0, bonus: 0, allOut: 0, superRaid: 0, superTackle: 0 },
  };
  let period = "1st Half";
  let doOrDieA = 0;
  let doOrDieB = 0;

  for (const ev of active) {
    const p = ev.payloadJson;
    if (ev.eventType === "PERIOD") {
      period = String(p.period ?? period);
      continue;
    }
    const side = (p.side as Side) ?? "A";
    const s = stats[side];
    if (ev.eventType === "RAID") {
      const pts = Number(p.points ?? 1);
      const bonus = Number(p.bonus ?? 0);
      s.raid += pts;
      s.bonus += bonus;
      s.total += pts + bonus;
      if (pts + bonus >= 3) s.superRaid += 1;
      if (side === "A") doOrDieA = 0;
      else doOrDieB = 0;
    } else if (ev.eventType === "EMPTY_RAID") {
      if (side === "A") doOrDieA = Math.min(2, doOrDieA + 1);
      else doOrDieB = Math.min(2, doOrDieB + 1);
    } else if (ev.eventType === "TACKLE") {
      const isSuper = Boolean(p.superTackle);
      const pts = isSuper ? 2 : Number(p.points ?? 1);
      s.tackle += pts;
      s.total += pts;
      if (isSuper) s.superTackle += 1;
    } else if (ev.eventType === "ALL_OUT") {
      s.allOut += 2;
      s.total += 2;
    }
  }

  const teamAShort = config.teamAShort ?? "TEAM A";
  const teamBShort = config.teamBShort ?? "TEAM B";

  return {
    sportId: "kabaddi",
    summaryText: `${teamAShort} ${stats.A.total} - ${stats.B.total} ${teamBShort}`,
    teamAScoreLabel: String(stats.A.total),
    teamBScoreLabel: String(stats.B.total),
    teamANumeric: stats.A.total,
    teamBNumeric: stats.B.total,
    periodLabel: period,
    clock: resolveClockState(active, config),
    suggestedWinnerSide:
      stats.A.total > stats.B.total ? "A" : stats.B.total > stats.A.total ? "B" : null,
    activeEventCount: active.length,
    detail: {
      stats,
      doOrDieA,
      doOrDieB,
      period,
    },
  };
}

export function reduceKhoKho(
  events: MatchEventRecord[],
  config: MatchReducerConfig = {}
): DerivedMatchState {
  const active = events.filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);
  let scoreA = 0;
  let scoreB = 0;
  let turn = 1;
  let chasingSide: Side = "A";
  const dismissals: Array<{ turn: number; side: Side; method: string; defenderId?: number }> = [];

  for (const ev of active) {
    const p = ev.payloadJson;
    if (ev.eventType === "TURN_SWITCH") {
      turn = Number(p.turn ?? turn + 1);
      chasingSide = (p.chasingSide as Side) ?? (chasingSide === "A" ? "B" : "A");
    } else if (ev.eventType === "DISMISSAL") {
      const side = (p.side as Side) ?? chasingSide;
      const pts = Number(p.points ?? 1);
      if (side === "A") scoreA += pts;
      else scoreB += pts;
      dismissals.push({
        turn,
        side,
        method: String(p.method ?? "TOUCH"),
        defenderId: p.defenderId ? Number(p.defenderId) : undefined,
      });
    }
  }

  const teamAShort = config.teamAShort ?? "TEAM A";
  const teamBShort = config.teamBShort ?? "TEAM B";

  return {
    sportId: "kho_kho",
    summaryText: `${teamAShort} ${scoreA} - ${scoreB} ${teamBShort} (Turn ${turn})`,
    teamAScoreLabel: String(scoreA),
    teamBScoreLabel: String(scoreB),
    teamANumeric: scoreA,
    teamBNumeric: scoreB,
    periodLabel: `Turn ${turn} of 4 • Chasing: ${chasingSide === "A" ? teamAShort : teamBShort}`,
    clock: resolveClockState(active, config),
    suggestedWinnerSide: scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : null,
    activeEventCount: active.length,
    detail: { turn, chasingSide, dismissals },
  };
}

export function reduceCarrom(
  events: MatchEventRecord[],
  config: MatchReducerConfig = {}
): DerivedMatchState {
  const active = events.filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);
  let pointsA = 0;
  let pointsB = 0;
  const boards: Array<{ boardNumber: number; winner: Side; points: number; queenCovered: boolean }> = [];

  for (const ev of active) {
    const p = ev.payloadJson;
    if (ev.eventType === "BOARD_RESULT") {
      const winner = (p.side as Side) ?? "A";
      const pts = Number(p.points ?? 1);
      const queenCovered = Boolean(p.queenCovered);
      const total = pts + (queenCovered ? 3 : 0);
      if (winner === "A") pointsA += total;
      else pointsB += total;
      boards.push({
        boardNumber: boards.length + 1,
        winner,
        points: total,
        queenCovered,
      });
    } else if (ev.eventType === "FOUL") {
      const side = (p.side as Side) ?? "A";
      if (side === "A") pointsA = Math.max(0, pointsA - 1);
      else pointsB = Math.max(0, pointsB - 1);
    }
  }

  const teamAShort = config.teamAShort ?? "PLAYER A";
  const teamBShort = config.teamBShort ?? "PLAYER B";

  return {
    sportId: "carrom",
    summaryText: `${teamAShort} ${pointsA} - ${pointsB} ${teamBShort}`,
    teamAScoreLabel: String(pointsA),
    teamBScoreLabel: String(pointsB),
    teamANumeric: pointsA,
    teamBNumeric: pointsB,
    periodLabel: `Board ${boards.length + 1}`,
    clock: resolveClockState(active, config),
    suggestedWinnerSide: pointsA > pointsB ? "A" : pointsB > pointsA ? "B" : null,
    activeEventCount: active.length,
    detail: { boards, pointsA, pointsB },
  };
}

export function reduceChess(
  events: MatchEventRecord[],
  config: MatchReducerConfig = {}
): DerivedMatchState {
  const active = events.filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);
  let scoreA = 0;
  let scoreB = 0;
  let termination: string | null = null;
  const moves: Array<{ moveNo: number; side: Side; san: string }> = [];

  for (const ev of active) {
    const p = ev.payloadJson;
    if (ev.eventType === "MOVE") {
      moves.push({
        moveNo: Math.floor(moves.length / 2) + 1,
        side: (p.side as Side) ?? (moves.length % 2 === 0 ? "A" : "B"),
        san: String(p.san ?? ""),
      });
    } else if (ev.eventType === "RESULT") {
      const res = String(p.result ?? "1/2-1/2");
      termination = String(p.termination ?? "COMPLETED");
      if (res === "1-0") {
        scoreA = 1;
        scoreB = 0;
      } else if (res === "0-1") {
        scoreA = 0;
        scoreB = 1;
      } else {
        scoreA = 0.5;
        scoreB = 0.5;
      }
    }
  }

  const teamAShort = config.teamAShort ?? "WHITE";
  const teamBShort = config.teamBShort ?? "BLACK";
  const scoreLabel = termination ? `${scoreA} - ${scoreB} (${termination})` : `Move ${Math.floor(moves.length / 2) + 1}`;

  return {
    sportId: "chess",
    summaryText: `${teamAShort} vs ${teamBShort} • ${scoreLabel}`,
    teamAScoreLabel: String(scoreA),
    teamBScoreLabel: String(scoreB),
    teamANumeric: scoreA,
    teamBNumeric: scoreB,
    periodLabel: termination ? `Finished: ${termination}` : `In Progress (Ply ${moves.length})`,
    clock: resolveClockState(active, config),
    suggestedWinnerSide:
      termination === null ? null : scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "DRAW",
    activeEventCount: active.length,
    detail: { moves, termination, scoreA, scoreB },
  };
}
