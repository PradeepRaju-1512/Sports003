import type {
  DerivedMatchState,
  MatchEventRecord,
  MatchReducerConfig,
  Side,
} from "../types.ts";
import { resolveClockState } from "../types.ts";

export interface BatterStat {
  playerId: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  dismissal: string;
}

export interface BowlerStat {
  playerId: number;
  balls: number;
  maidens: number;
  runs: number;
  wickets: number;
  currentOverBalls: number;
  currentOverRuns: number;
}

export interface InningsState {
  battingSide: Side;
  runs: number;
  wickets: number;
  legalBalls: number;
  extras: { wd: number; nb: number; b: number; lb: number };
  freeHit: boolean;
  strikerId: number | null;
  nonStrikerId: number | null;
  bowlerId: number | null;
  lastCompletedOverBowlerId: number | null;
  bowlerSelectedForNewOver: boolean;
  batters: Record<number, BatterStat>;
  bowlers: Record<number, BowlerStat>;
  recentBalls: string[];
  oversGroups: Array<{ overNumber: number; balls: string[]; isSuperOver?: boolean; superOverIndex?: number }>;
}

interface SuperOverRecord {
  index: number;
  halves: [InningsState, InningsState];
  activeHalf: 0 | 1;
  target: number | null;
}

function createInnings(battingSide: Side): InningsState {
  return {
    battingSide,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    extras: { wd: 0, nb: 0, b: 0, lb: 0 },
    freeHit: false,
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    lastCompletedOverBowlerId: null,
    bowlerSelectedForNewOver: false,
    batters: {},
    bowlers: {},
    recentBalls: [],
    oversGroups: [],
  };
}

export function formatOvers(legalBalls: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

export function ballsToOversDecimal(legalBalls: number): number {
  return Math.floor(legalBalls / 6) + (legalBalls % 6) / 6;
}

function ensureBatter(inn: InningsState, id: number): BatterStat {
  if (!inn.batters[id]) {
    inn.batters[id] = {
      playerId: id,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
      dismissal: "not out",
    };
  }
  return inn.batters[id];
}

function ensureBowler(inn: InningsState, id: number): BowlerStat {
  if (!inn.bowlers[id]) {
    inn.bowlers[id] = {
      playerId: id,
      balls: 0,
      maidens: 0,
      runs: 0,
      wickets: 0,
      currentOverBalls: 0,
      currentOverRuns: 0,
    };
  }
  return inn.bowlers[id];
}

function swapCrease(inn: InningsState) {
  if (inn.strikerId && inn.nonStrikerId) {
    const tmp = inn.strikerId;
    inn.strikerId = inn.nonStrikerId;
    inn.nonStrikerId = tmp;
  }
}

export function reduceCricket(
  events: MatchEventRecord[],
  config: MatchReducerConfig = {}
): DerivedMatchState {
  const oversLimit = config.oversPerInnings ?? 10;
  const teamAShort = config.teamAShort ?? "TEAM A";
  const teamBShort = config.teamBShort ?? "TEAM B";
  const superOverMaxBalls = 6;
  const superOverMaxWickets = 2;

  const active = events.filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);
  const inningsList: [InningsState, InningsState] = [createInnings("A"), createInnings("B")];
  let currentInningsIdx = 0;

  let isSuperOver = false;
  let superOverIndex = 0;
  const superOvers: SuperOverRecord[] = [];

  const getActiveInnings = (): InningsState => {
    if (isSuperOver && superOvers.length > 0) {
      const so = superOvers[superOvers.length - 1];
      return so.halves[so.activeHalf];
    }
    return inningsList[currentInningsIdx];
  };

  for (const ev of active) {
    const p = ev.payloadJson ?? {};

    if (ev.eventType === "INNINGS_SWITCH") {
      if (!isSuperOver && currentInningsIdx === 0) {
        const nextSide: Side =
          (p.battingSide as Side) ?? (inningsList[0].battingSide === "A" ? "B" : "A");
        inningsList[1].battingSide = nextSide;
        currentInningsIdx = 1;
        if (p.strikerId) {
          inningsList[1].strikerId = Number(p.strikerId);
          ensureBatter(inningsList[1], Number(p.strikerId));
        }
        if (p.nonStrikerId) {
          inningsList[1].nonStrikerId = Number(p.nonStrikerId);
          ensureBatter(inningsList[1], Number(p.nonStrikerId));
        }
        if (p.bowlerId) {
          inningsList[1].bowlerId = Number(p.bowlerId);
          ensureBowler(inningsList[1], Number(p.bowlerId));
        }
      }
      continue;
    }

    if (ev.eventType === "SUPER_OVER_START") {
      const nextIdx = p.superOverIndex ? Number(p.superOverIndex) : superOverIndex + 1;
      const firstSide: Side = (p.battingSide as Side) ?? inningsList[1].battingSide;
      const secondSide: Side = firstSide === "A" ? "B" : "A";
      const h1 = createInnings(firstSide);
      const h2 = createInnings(secondSide);
      if (p.strikerId) {
        h1.strikerId = Number(p.strikerId);
        ensureBatter(h1, Number(p.strikerId));
      }
      if (p.nonStrikerId) {
        h1.nonStrikerId = Number(p.nonStrikerId);
        ensureBatter(h1, Number(p.nonStrikerId));
      }
      if (p.bowlerId) {
        h1.bowlerId = Number(p.bowlerId);
        ensureBowler(h1, Number(p.bowlerId));
      }
      superOvers.push({
        index: nextIdx,
        halves: [h1, h2],
        activeHalf: 0,
        target: null,
      });
      isSuperOver = true;
      superOverIndex = nextIdx;
      continue;
    }

    if (ev.eventType === "SUPER_OVER_SWITCH") {
      const so = superOvers[superOvers.length - 1];
      if (so && so.activeHalf === 0) {
        so.target = so.halves[0].runs + 1;
        so.activeHalf = 1;
        const h2 = so.halves[1];
        if (p.battingSide === "A" || p.battingSide === "B") {
          h2.battingSide = p.battingSide;
        }
        if (p.strikerId) {
          h2.strikerId = Number(p.strikerId);
          ensureBatter(h2, Number(p.strikerId));
        }
        if (p.nonStrikerId) {
          h2.nonStrikerId = Number(p.nonStrikerId);
          ensureBatter(h2, Number(p.nonStrikerId));
        }
        if (p.bowlerId) {
          h2.bowlerId = Number(p.bowlerId);
          ensureBowler(h2, Number(p.bowlerId));
        }
      }
      continue;
    }

    if (ev.eventType === "SWAP_STRIKE") {
      swapCrease(getActiveInnings());
      continue;
    }

    if (ev.eventType === "SET_PLAYERS") {
      const inn = getActiveInnings();
      if (p.strikerId) {
        inn.strikerId = Number(p.strikerId);
        ensureBatter(inn, inn.strikerId);
      }
      if (p.nonStrikerId) {
        inn.nonStrikerId = Number(p.nonStrikerId);
        ensureBatter(inn, inn.nonStrikerId);
      }
      if (p.bowlerId) {
        inn.bowlerId = Number(p.bowlerId);
        ensureBowler(inn, inn.bowlerId);
        inn.bowlerSelectedForNewOver = true;
      }
      continue;
    }

    if (ev.eventType !== "BALL") continue;

    if (
      !isSuperOver &&
      currentInningsIdx === 0 &&
      p.side &&
      p.side !== inningsList[0].battingSide &&
      inningsList[0].legalBalls === 0 &&
      inningsList[0].runs === 0
    ) {
      inningsList[0].battingSide = p.side as Side;
      inningsList[1].battingSide = p.side === "A" ? "B" : "A";
    }

    const inn = getActiveInnings();
    const runs = Number(p.runs ?? 0);
    const extraType = (p.extraType as string | null) ?? null;
    const isWicket = Boolean(p.wicket);
    const wicketType = (p.wicketType as string | undefined) ?? "OUT";
    const batterId = p.batterId ? Number(p.batterId) : inn.strikerId;
    const nonStrikerParam = p.nonStrikerId ? Number(p.nonStrikerId) : inn.nonStrikerId;
    const bowlerId = p.bowlerId ? Number(p.bowlerId) : inn.bowlerId;

    if (batterId) inn.strikerId = batterId;
    if (nonStrikerParam && nonStrikerParam !== inn.strikerId) inn.nonStrikerId = nonStrikerParam;
    if (bowlerId) inn.bowlerId = bowlerId;

    const isWide = extraType === "WD";
    const isNoBall = extraType === "NB";
    const isBye = extraType === "B";
    const isLegBye = extraType === "LB";
    const isLegal = !isWide && !isNoBall;

    // Total runs scored on this delivery
    const penaltyRun = isWide || isNoBall ? 1 : 0;
    const totalDeliveryRuns = runs + penaltyRun;
    inn.runs += totalDeliveryRuns;

    if (isWide) inn.extras.wd += totalDeliveryRuns;
    if (isNoBall) inn.extras.nb += 1;
    if (isBye) inn.extras.b += runs;
    if (isLegBye) inn.extras.lb += runs;

    if (isLegal) {
      inn.legalBalls += 1;
      inn.bowlerSelectedForNewOver = false;
    }

    // Batter attribution
    if (batterId) {
      const bStat = ensureBatter(inn, batterId);
      if (!isWide) bStat.balls += 1;
      if (!isWide && !isBye && !isLegBye) {
        bStat.runs += runs;
        if (runs === 4) bStat.fours += 1;
        if (runs === 6) bStat.sixes += 1;
      }
    }
    if (inn.nonStrikerId) {
      ensureBatter(inn, inn.nonStrikerId);
    }

    // Wicket attribution (supports non-striker run out & retired hurt)
    const dismissedBatterId = p.dismissedBatterId ? Number(p.dismissedBatterId) : batterId;
    const isRetiredHurt = wicketType.toUpperCase() === "RETIRED_HURT";
    if (isWicket && dismissedBatterId) {
      const dStat = ensureBatter(inn, dismissedBatterId);
      dStat.out = true;
      dStat.dismissal = wicketType.toLowerCase().replace(/_/g, " ");
      if (!isRetiredHurt) {
        inn.wickets += 1;
      }
    } else if (isWicket) {
      inn.wickets += 1;
    }

    // Bowler attribution + maiden tracking
    const bowlerConceded = !isBye && !isLegBye ? totalDeliveryRuns : 0;
    if (bowlerId) {
      const bw = ensureBowler(inn, bowlerId);
      if (isLegal) {
        bw.balls += 1;
        bw.currentOverBalls += 1;
      }
      bw.runs += bowlerConceded;
      bw.currentOverRuns += bowlerConceded;
      if (isWicket && wicketType.toUpperCase() !== "RUN_OUT" && !isRetiredHurt) {
        bw.wickets += 1;
      }
      if (isLegal && bw.currentOverBalls === 6) {
        if (bw.currentOverRuns === 0) {
          bw.maidens += 1;
        }
        bw.currentOverBalls = 0;
        bw.currentOverRuns = 0;
      }
    }

    // Ball label for recent balls strip
    const tag = isWicket
      ? "W"
      : isWide
      ? `${runs > 0 ? runs : ""}WD`
      : isNoBall
      ? `${runs > 0 ? runs : ""}NB`
      : isBye
      ? `${runs}B`
      : isLegBye
      ? `${runs}LB`
      : `${runs}`;
    inn.recentBalls.push(tag);
    if (inn.recentBalls.length > 18) inn.recentBalls.shift();

    const overNumber = isLegal
      ? Math.max(1, Math.ceil(inn.legalBalls / 6))
      : Math.floor(inn.legalBalls / 6) + 1;
    let group = inn.oversGroups.find((g) => g.overNumber === overNumber);
    if (!group) {
      group = {
        overNumber,
        balls: [],
        ...(isSuperOver ? { isSuperOver: true, superOverIndex } : {}),
      };
      inn.oversGroups.push(group);
    }
    group.balls.push(tag);

    // Free hit state
    inn.freeHit = isNoBall;

    // Strike rotation: odd runs XOR end-of-over swap so combined swaps cancel out accurately
    const oddRunsSwap = runs % 2 === 1;
    const overCompleted = isLegal && inn.legalBalls > 0 && inn.legalBalls % 6 === 0;
    if (overCompleted) {
      inn.lastCompletedOverBowlerId = bowlerId ?? null;
    }
    if (oddRunsSwap !== overCompleted) {
      swapCrease(inn);
    }

    // Handle incoming batter if provided on wicket event, or clear dismissed slot
    if (isWicket && dismissedBatterId) {
      const nextBatterId = p.nextBatterId ? Number(p.nextBatterId) : null;
      if (inn.strikerId === dismissedBatterId) {
        inn.strikerId = nextBatterId;
      } else if (inn.nonStrikerId === dismissedBatterId) {
        inn.nonStrikerId = nextBatterId;
      }
      if (nextBatterId) {
        ensureBatter(inn, nextBatterId);
      }
    }
  }

  const inn1 = inningsList[0];
  const inn2 = inningsList[1];
  const activeInn = getActiveInnings();
  const activeSO = isSuperOver && superOvers.length > 0 ? superOvers[superOvers.length - 1] : null;

  const sideAScore = inn1.battingSide === "A" ? inn1 : inn2;
  const sideBScore = inn1.battingSide === "B" ? inn1 : inn2;

  const labelFor = (inn: InningsState) => `${inn.runs}/${inn.wickets} (${formatOvers(inn.legalBalls)})`;

  let crr = 0;
  let target: number | null = null;
  let ballsRemaining = 0;
  let runsNeeded: number | null = null;
  let rrr: number | null = null;

  if (isSuperOver && activeSO) {
    const soInn = activeSO.halves[activeSO.activeHalf];
    crr =
      soInn.legalBalls > 0
        ? Number((soInn.runs / ballsToOversDecimal(soInn.legalBalls)).toFixed(2))
        : 0;
    target = activeSO.activeHalf === 1 ? activeSO.target : null;
    ballsRemaining = Math.max(0, superOverMaxBalls - soInn.legalBalls);
    runsNeeded = target !== null ? Math.max(0, target - soInn.runs) : null;
    rrr =
      target !== null && ballsRemaining > 0
        ? Number(((Math.max(0, target - soInn.runs) * 6) / ballsRemaining).toFixed(2))
        : null;
  } else {
    crr =
      activeInn.legalBalls > 0
        ? Number((activeInn.runs / ballsToOversDecimal(activeInn.legalBalls)).toFixed(2))
        : 0;
    target = currentInningsIdx === 1 ? inn1.runs + 1 : null;
    ballsRemaining = Math.max(0, oversLimit * 6 - inn2.legalBalls);
    runsNeeded = target !== null ? Math.max(0, target - inn2.runs) : null;
    rrr =
      target !== null && ballsRemaining > 0
        ? Number(((Math.max(0, target - inn2.runs) * 6) / ballsRemaining).toFixed(2))
        : null;
  }

  const innings1Complete =
    !isSuperOver &&
    currentInningsIdx === 0 &&
    (inn1.legalBalls >= oversLimit * 6 || inn1.wickets >= 10);

  const innings2Complete =
    !isSuperOver &&
    currentInningsIdx === 1 &&
    (inn2.runs >= inn1.runs + 1 || inn2.legalBalls >= oversLimit * 6 || inn2.wickets >= 10);

  let superOverHalf1Complete = false;
  let superOverComplete = false;
  let matchTied = false;
  let suggestedWinnerSide: Side | "DRAW" | null = null;

  if (isSuperOver && activeSO) {
    const h1 = activeSO.halves[0];
    const h2 = activeSO.halves[1];
    if (activeSO.activeHalf === 0) {
      superOverHalf1Complete =
        h1.legalBalls >= superOverMaxBalls || h1.wickets >= superOverMaxWickets;
    } else {
      const chased = activeSO.target !== null && h2.runs >= activeSO.target;
      const exhausted =
        h2.legalBalls >= superOverMaxBalls || h2.wickets >= superOverMaxWickets;
      superOverComplete = chased || exhausted;
      if (chased) {
        suggestedWinnerSide = h2.battingSide;
      } else if (exhausted) {
        if (h1.runs > h2.runs) suggestedWinnerSide = h1.battingSide;
        else if (h2.runs > h1.runs) suggestedWinnerSide = h2.battingSide;
        else {
          suggestedWinnerSide = "DRAW";
          matchTied = true;
        }
      }
    }
  } else if (currentInningsIdx === 1) {
    if (inn2.runs >= inn1.runs + 1) {
      suggestedWinnerSide = inn2.battingSide;
    } else if (inn2.legalBalls >= oversLimit * 6 || inn2.wickets >= 10) {
      if (inn1.runs > inn2.runs) suggestedWinnerSide = inn1.battingSide;
      else if (inn2.runs > inn1.runs) suggestedWinnerSide = inn2.battingSide;
      else {
        suggestedWinnerSide = "DRAW";
        matchTied = true;
      }
    }
  }

  const isCurrentInningsOver = isSuperOver
    ? activeSO?.activeHalf === 0
      ? superOverHalf1Complete
      : superOverComplete
    : currentInningsIdx === 0
    ? innings1Complete
    : innings2Complete;

  const overJustCompleted =
    !isSuperOver &&
    !isCurrentInningsOver &&
    activeInn.legalBalls > 0 &&
    activeInn.legalBalls % 6 === 0 &&
    !activeInn.bowlerSelectedForNewOver;

  const activeSideShort = activeInn.battingSide === "A" ? teamAShort : teamBShort;
  const summaryText = isSuperOver
    ? activeSO?.activeHalf === 1 && target !== null
      ? `SO${superOverIndex} • ${activeSideShort} ${labelFor(activeInn)} • Target ${target}`
      : `SO${superOverIndex} • ${activeSideShort} ${labelFor(activeInn)}`
    : currentInningsIdx === 0
    ? `${activeSideShort} ${labelFor(activeInn)}`
    : `${activeSideShort} ${labelFor(activeInn)} • Target ${target}`;

  const periodLabel = isSuperOver
    ? activeSO?.activeHalf === 1 && target !== null
      ? `Super Over ${superOverIndex} (Target ${target})`
      : `Super Over ${superOverIndex}`
    : currentInningsIdx === 0
    ? `1st Innings (${oversLimit} ov)`
    : `2nd Innings (Target ${target})`;

  const bowlingSide: Side = activeInn.battingSide === "A" ? "B" : "A";

  return {
    sportId: "cricket",
    summaryText,
    teamAScoreLabel: labelFor(sideAScore),
    teamBScoreLabel: labelFor(sideBScore),
    teamANumeric: sideAScore.runs,
    teamBNumeric: sideBScore.runs,
    periodLabel,
    clock: resolveClockState(active, config),
    suggestedWinnerSide,
    activeEventCount: active.length,
    detail: {
      currentInningsIdx,
      oversLimit,
      crr,
      rrr,
      target,
      runsNeeded,
      ballsRemaining,
      freeHit: activeInn.freeHit,
      battingSide: activeInn.battingSide,
      bowlingSide,
      strikerId: activeInn.strikerId,
      nonStrikerId: activeInn.nonStrikerId,
      bowlerId: activeInn.bowlerId,
      lastCompletedOverBowlerId: activeInn.lastCompletedOverBowlerId,
      overJustCompleted,
      innings1Complete,
      innings2Complete,
      matchTied,
      extras: activeInn.extras,
      activeBatters: Object.values(activeInn.batters),
      activeBowlers: Object.values(activeInn.bowlers),
      recentBalls: activeInn.recentBalls,
      oversGroups: activeInn.oversGroups,
      currentOverBalls:
        activeInn.oversGroups[activeInn.oversGroups.length - 1]?.balls ?? [],
      // Super Over state
      isSuperOver,
      superOverIndex,
      superOverHalf: activeSO?.activeHalf ?? 0,
      superOverMaxBalls,
      superOverMaxWickets,
      superOverRuns: activeInn.runs,
      superOverWickets: activeInn.wickets,
      superOverLegalBalls: activeInn.legalBalls,
      superOverTarget: activeSO?.target ?? null,
      superOverHalf1Complete,
      superOverComplete,
      superOvers: superOvers.map((so) => ({
        index: so.index,
        target: so.target,
        activeHalf: so.activeHalf,
        halves: so.halves.map((h) => ({
          battingSide: h.battingSide,
          runs: h.runs,
          wickets: h.wickets,
          legalBalls: h.legalBalls,
          oversText: formatOvers(h.legalBalls),
        })),
      })),
      innings: inningsList.map((inn) => ({
        battingSide: inn.battingSide,
        runs: inn.runs,
        wickets: inn.wickets,
        legalBalls: inn.legalBalls,
        oversText: formatOvers(inn.legalBalls),
        oversDecimal: ballsToOversDecimal(inn.legalBalls),
        extras: inn.extras,
        batters: Object.values(inn.batters),
        bowlers: Object.values(inn.bowlers),
      })),
    },
  };
}
