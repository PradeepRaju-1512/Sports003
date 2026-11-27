import type { DerivedMatchState, MatchEventRecord, Side, SportId } from "./types.ts";
import { formatOvers } from "./reducers/cricket.ts";

export interface ScorecardRosterPlayer {
  playerProfileId: number;
  displayName: string;
  playingRole: string | null;
}

export interface ScorecardTeamInput {
  id: number;
  name: string;
  shortCode: string;
  roster: ScorecardRosterPlayer[];
}

export interface ScorecardRostersInput {
  sideA: ScorecardTeamInput;
  sideB: ScorecardTeamInput;
  playerNames?: Record<number, string>;
}

export interface ScorecardMatchInput {
  id: number;
  status: string;
  venue: string;
  scheduledAt: string | Date;
  roundLabel: string;
  scoreSummary?: string | null;
  resultNote?: string | null;
  winnerTeamId?: number | null;
  configJson?: Record<string, unknown>;
  tournamentStatus?: string;
  mvpPlayerProfileId?: number | null;
}

export interface CricketBatterRow {
  playerId: number;
  playerName: string;
  isCaptain: boolean;
  isKeeper: boolean;
  dismissalText: string;
  notOut: boolean;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: string;
}

export interface CricketBowlerRow {
  playerId: number;
  playerName: string;
  oversDisplay: string;
  legalBalls: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  economy: string;
}

export interface CricketInningsScorecard {
  side: Side;
  teamId: number;
  teamName: string;
  shortCode: string;
  battingRows: CricketBatterRow[];
  didNotBat: Array<{ playerId: number; playerName: string; isCaptain: boolean; isKeeper: boolean }>;
  bowlingRows: CricketBowlerRow[];
  extrasTotal: number;
  extrasDetail: { wd: number; nb: number; b: number; lb: number };
  extrasText: string;
  totalRuns: number;
  wickets: number;
  legalBalls: number;
  oversDisplay: string;
  totalText: string;
  topBatters: Array<{ playerId: number; playerName: string; runs: number; balls: number; notOut: boolean }>;
  topBowlers: Array<{ playerId: number; playerName: string; wickets: number; runsConceded: number; oversDisplay: string }>;
}

export interface CricketScorecardResult {
  innings: CricketInningsScorecard[];
  playerOfTheMatch: {
    playerId: number;
    playerName: string;
    teamShort: string;
    impactSummary: string;
  } | null;
  tossSummary: string;
  hasEvents: boolean;
}

function buildNameAndRoleLookup(rosters: ScorecardRostersInput) {
  const nameMap: Record<number, string> = { ...(rosters.playerNames ?? {}) };
  const roleMap: Record<number, { isCaptain: boolean; isKeeper: boolean; teamSide: Side }> = {};

  const indexSide = (team: ScorecardTeamInput, side: Side) => {
    for (const p of team.roster) {
      nameMap[p.playerProfileId] = p.displayName;
      const role = (p.playingRole ?? "").toLowerCase();
      roleMap[p.playerProfileId] = {
        isCaptain: role.includes("captain") || role.includes("(c)"),
        isKeeper: role.includes("keeper") || role.includes("wk"),
        teamSide: side,
      };
    }
  };

  indexSide(rosters.sideA, "A");
  indexSide(rosters.sideB, "B");

  const getName = (id: number | null | undefined) => {
    if (!id || id <= 0) return "Player";
    return nameMap[id] ?? `Player #${id}`;
  };

  return { nameMap, roleMap, getName };
}

function formatDismissalText(
  wicketType: string,
  bowlerName: string | null,
  fielderName: string | null
): string {
  const wt = wicketType.toUpperCase();
  const bw = bowlerName ?? "bowler";
  switch (wt) {
    case "BOWLED":
      return `b ${bw}`;
    case "LBW":
      return `lbw b ${bw}`;
    case "CAUGHT":
      return fielderName ? `c ${fielderName} b ${bw}` : `c & b ${bw}`;
    case "STUMPED":
      return fielderName ? `st ${fielderName} b ${bw}` : `st b ${bw}`;
    case "RUN_OUT":
      return fielderName ? `run out (${fielderName})` : "run out";
    case "HIT_WICKET":
      return `hit wicket b ${bw}`;
    default:
      return `${wt.toLowerCase()} b ${bw}`;
  }
}

export function buildCricketScorecard(
  match: ScorecardMatchInput,
  events: MatchEventRecord[],
  rosters: ScorecardRostersInput
): CricketScorecardResult {
  const { roleMap, getName } = buildNameAndRoleLookup(rosters);
  const active = events.filter((e) => !e.voided).sort((a, b) => a.seq - b.seq);

  interface MutableBatter {
    playerId: number;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    out: boolean;
    dismissalText: string;
  }
  interface MutableBowler {
    playerId: number;
    legalBalls: number;
    runsConceded: number;
    wickets: number;
    maidens: number;
    currentOverBalls: number;
    currentOverRuns: number;
  }
  interface MutableInnings {
    battingSide: Side;
    started: boolean;
    batterOrder: number[];
    batters: Map<number, MutableBatter>;
    bowlerOrder: number[];
    bowlers: Map<number, MutableBowler>;
    extras: { wd: number; nb: number; b: number; lb: number };
    totalRuns: number;
    wickets: number;
    legalBalls: number;
  }

  const createInn = (side: Side): MutableInnings => ({
    battingSide: side,
    started: false,
    batterOrder: [],
    batters: new Map(),
    bowlerOrder: [],
    bowlers: new Map(),
    extras: { wd: 0, nb: 0, b: 0, lb: 0 },
    totalRuns: 0,
    wickets: 0,
    legalBalls: 0,
  });

  const inningsList: [MutableInnings, MutableInnings] = [createInn("A"), createInn("B")];
  let idx = 0;

  const ensureBatter = (inn: MutableInnings, id: number) => {
    if (!inn.batters.has(id)) {
      inn.batterOrder.push(id);
      inn.batters.set(id, {
        playerId: id,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false,
        dismissalText: "not out",
      });
    }
    return inn.batters.get(id)!;
  };

  const ensureBowler = (inn: MutableInnings, id: number) => {
    if (!inn.bowlers.has(id)) {
      inn.bowlerOrder.push(id);
      inn.bowlers.set(id, {
        playerId: id,
        legalBalls: 0,
        runsConceded: 0,
        wickets: 0,
        maidens: 0,
        currentOverBalls: 0,
        currentOverRuns: 0,
      });
    }
    return inn.bowlers.get(id)!;
  };

  let ballEventCount = 0;

  for (const ev of active) {
    const p = ev.payloadJson ?? {};
    if (ev.eventType === "INNINGS_SWITCH") {
      if (idx === 0) {
        const nextSide: Side =
          (p.battingSide as Side) ?? (inningsList[0].battingSide === "A" ? "B" : "A");
        inningsList[1].battingSide = nextSide;
        idx = 1;
      }
      continue;
    }

    if (ev.eventType === "SET_PLAYERS") {
      const inn = inningsList[idx];
      if (p.strikerId) ensureBatter(inn, Number(p.strikerId));
      if (p.nonStrikerId) ensureBatter(inn, Number(p.nonStrikerId));
      if (p.bowlerId) ensureBowler(inn, Number(p.bowlerId));
      continue;
    }

    if (ev.eventType !== "BALL") continue;
    ballEventCount += 1;

    if (idx === 0 && !inningsList[0].started && (p.side === "A" || p.side === "B")) {
      inningsList[0].battingSide = p.side;
      inningsList[1].battingSide = p.side === "A" ? "B" : "A";
    }

    const inn = inningsList[idx];
    inn.started = true;

    const runs = Number(p.runs ?? 0);
    const extraType = (p.extraType as string | null) ?? null;
    const isWicket = Boolean(p.wicket);
    const wicketType = String(p.wicketType ?? "BOWLED");
    const batterId = p.batterId ? Number(p.batterId) : null;
    const nonStrikerId = p.nonStrikerId ? Number(p.nonStrikerId) : null;
    const bowlerId = p.bowlerId ? Number(p.bowlerId) : null;
    const fielderId = p.fielderId ? Number(p.fielderId) : null;

    const isWide = extraType === "WD";
    const isNoBall = extraType === "NB";
    const isBye = extraType === "B";
    const isLegBye = extraType === "LB";
    const isLegal = !isWide && !isNoBall;

    const penaltyRun = isWide || isNoBall ? 1 : 0;
    const totalDeliveryRuns = runs + penaltyRun;
    inn.totalRuns += totalDeliveryRuns;

    if (isWide) inn.extras.wd += totalDeliveryRuns;
    if (isNoBall) inn.extras.nb += 1;
    if (isBye) inn.extras.b += runs;
    if (isLegBye) inn.extras.lb += runs;
    if (isLegal) inn.legalBalls += 1;
    if (isWicket) inn.wickets += 1;

    if (nonStrikerId) ensureBatter(inn, nonStrikerId);
    if (batterId) {
      const b = ensureBatter(inn, batterId);
      if (!isWide) b.balls += 1;
      if (!isWide && !isBye && !isLegBye) {
        b.runs += runs;
        if (runs === 4) b.fours += 1;
        if (runs === 6) b.sixes += 1;
      }
      if (isWicket) {
        b.out = true;
        b.dismissalText = formatDismissalText(
          wicketType,
          bowlerId ? getName(bowlerId) : null,
          fielderId ? getName(fielderId) : null
        );
      }
    }

    if (bowlerId) {
      const bw = ensureBowler(inn, bowlerId);
      const bowlerRuns = !isBye && !isLegBye ? totalDeliveryRuns : 0;
      bw.runsConceded += bowlerRuns;
      bw.currentOverRuns += bowlerRuns;
      if (isLegal) {
        bw.legalBalls += 1;
        bw.currentOverBalls += 1;
        if (bw.currentOverBalls === 6) {
          if (bw.currentOverRuns === 0) bw.maidens += 1;
          bw.currentOverBalls = 0;
          bw.currentOverRuns = 0;
        }
      }
      if (isWicket && wicketType.toUpperCase() !== "RUN_OUT") {
        bw.wickets += 1;
      }
    }
  }

  const builtInnings: CricketInningsScorecard[] = inningsList
    .filter((inn, i) => i === 0 || inn.started || inn.batterOrder.length > 0)
    .map((inn) => {
      const team = inn.battingSide === "A" ? rosters.sideA : rosters.sideB;
      const battingRows: CricketBatterRow[] = inn.batterOrder.map((pid) => {
        const b = inn.batters.get(pid)!;
        const meta = roleMap[pid];
        return {
          playerId: pid,
          playerName: getName(pid),
          isCaptain: Boolean(meta?.isCaptain),
          isKeeper: Boolean(meta?.isKeeper),
          dismissalText: b.dismissalText,
          notOut: !b.out,
          runs: b.runs,
          balls: b.balls,
          fours: b.fours,
          sixes: b.sixes,
          strikeRate: b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : "0.00",
        };
      });

      const battedSet = new Set(inn.batterOrder);
      const didNotBat = team.roster
        .filter((p) => !battedSet.has(p.playerProfileId))
        .map((p) => {
          const meta = roleMap[p.playerProfileId];
          return {
            playerId: p.playerProfileId,
            playerName: p.displayName,
            isCaptain: Boolean(meta?.isCaptain),
            isKeeper: Boolean(meta?.isKeeper),
          };
        });

      const bowlingRows: CricketBowlerRow[] = inn.bowlerOrder.map((pid) => {
        const bw = inn.bowlers.get(pid)!;
        const decOvers = bw.legalBalls / 6;
        return {
          playerId: pid,
          playerName: getName(pid),
          oversDisplay: formatOvers(bw.legalBalls),
          legalBalls: bw.legalBalls,
          maidens: bw.maidens,
          runsConceded: bw.runsConceded,
          wickets: bw.wickets,
          economy: decOvers > 0 ? (bw.runsConceded / decOvers).toFixed(2) : "0.00",
        };
      });

      const extrasTotal = inn.extras.wd + inn.extras.nb + inn.extras.b + inn.extras.lb;
      const parts: string[] = [];
      if (inn.extras.wd > 0) parts.push(`W ${inn.extras.wd}`);
      if (inn.extras.nb > 0) parts.push(`NB ${inn.extras.nb}`);
      if (inn.extras.b > 0) parts.push(`B ${inn.extras.b}`);
      if (inn.extras.lb > 0) parts.push(`LB ${inn.extras.lb}`);
      const extrasText = parts.length > 0 ? `${extrasTotal} (${parts.join(", ")})` : "0";

      const oversDisplay = formatOvers(inn.legalBalls);
      const totalText = `${inn.totalRuns} (${inn.wickets} wkts, ${oversDisplay} ov)`;

      const topBatters = [...battingRows]
        .sort((a, b) => b.runs - a.runs || a.balls - b.balls)
        .slice(0, 3)
        .map((b) => ({
          playerId: b.playerId,
          playerName: b.playerName,
          runs: b.runs,
          balls: b.balls,
          notOut: b.notOut,
        }));

      const topBowlers = [...bowlingRows]
        .sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)
        .slice(0, 3)
        .map((bw) => ({
          playerId: bw.playerId,
          playerName: bw.playerName,
          wickets: bw.wickets,
          runsConceded: bw.runsConceded,
          oversDisplay: bw.oversDisplay,
        }));

      return {
        side: inn.battingSide,
        teamId: team.id,
        teamName: team.name,
        shortCode: team.shortCode,
        battingRows,
        didNotBat,
        bowlingRows,
        extrasTotal,
        extrasDetail: inn.extras,
        extrasText,
        totalRuns: inn.totalRuns,
        wickets: inn.wickets,
        legalBalls: inn.legalBalls,
        oversDisplay,
        totalText,
        topBatters,
        topBowlers,
      };
    });

  // Player of the Match when match is COMPLETED or tournament ARCHIVED
  const isFinished =
    match.status === "COMPLETED" || match.tournamentStatus === "ARCHIVED";

  let playerOfTheMatch: CricketScorecardResult["playerOfTheMatch"] = null;
  if (isFinished && ballEventCount > 0) {
    const impact = new Map<
      number,
      { score: number; runs: number; balls: number; wickets: number; conceded: number; teamShort: string }
    >();

    for (const inn of builtInnings) {
      const oppShort = inn.side === "A" ? rosters.sideB.shortCode : rosters.sideA.shortCode;
      for (const b of inn.battingRows) {
        const cur = impact.get(b.playerId) ?? {
          score: 0,
          runs: 0,
          balls: 0,
          wickets: 0,
          conceded: 0,
          teamShort: inn.shortCode,
        };
        cur.runs += b.runs;
        cur.balls += b.balls;
        cur.score += b.runs + b.fours + b.sixes * 2;
        impact.set(b.playerId, cur);
      }
      for (const bw of inn.bowlingRows) {
        const cur = impact.get(bw.playerId) ?? {
          score: 0,
          runs: 0,
          balls: 0,
          wickets: 0,
          conceded: 0,
          teamShort: oppShort,
        };
        cur.wickets += bw.wickets;
        cur.conceded += bw.runsConceded;
        cur.score += bw.wickets * 22;
        impact.set(bw.playerId, cur);
      }
    }

    const chosenId =
      match.mvpPlayerProfileId && impact.has(match.mvpPlayerProfileId)
        ? match.mvpPlayerProfileId
        : Array.from(impact.entries()).sort((a, b) => b[1].score - a[1].score)[0]?.[0] ?? null;

    if (chosenId) {
      const stat = impact.get(chosenId)!;
      const parts: string[] = [];
      if (stat.runs > 0 || stat.balls > 0) parts.push(`${stat.runs} (${stat.balls})`);
      if (stat.wickets > 0) parts.push(`${stat.wickets}/${stat.conceded}`);
      playerOfTheMatch = {
        playerId: chosenId,
        playerName: getName(chosenId),
        teamShort: stat.teamShort,
        impactSummary: parts.join(" & ") || "Match MVP",
      };
    }
  } else if (isFinished && match.mvpPlayerProfileId) {
    const pid = match.mvpPlayerProfileId;
    const side = roleMap[pid]?.teamSide ?? "A";
    playerOfTheMatch = {
      playerId: pid,
      playerName: getName(pid),
      teamShort: side === "A" ? rosters.sideA.shortCode : rosters.sideB.shortCode,
      impactSummary: "Official Match MVP",
    };
  }

  const tossVal = match.configJson?.tossSummary;
  const tossSummary =
    typeof tossVal === "string" && tossVal.trim()
      ? tossVal
      : `${rosters.sideA.shortCode} vs ${rosters.sideB.shortCode} • ${match.roundLabel}`;

  return {
    innings: builtInnings,
    playerOfTheMatch,
    tossSummary,
    hasEvents: ballEventCount > 0,
  };
}

export interface GenericSportBoxScore {
  sportId: SportId;
  sections: Array<{
    title: string;
    columns: string[];
    rows: Array<string[]>;
  }>;
  leadersLeft: Array<{ label: string; value: string }>;
  leadersRight: Array<{ label: string; value: string }>;
  playerOfTheMatch: {
    playerId: number;
    playerName: string;
    teamShort: string;
    impactSummary: string;
  } | null;
}

export function buildGenericSportBoxScore(
  sportId: SportId,
  match: ScorecardMatchInput,
  derived: DerivedMatchState,
  rosters: ScorecardRostersInput
): GenericSportBoxScore {
  const { roleMap, getName } = buildNameAndRoleLookup(rosters);
  const d = derived.detail ?? {};
  const sections: GenericSportBoxScore["sections"] = [];
  const leadersLeft: GenericSportBoxScore["leadersLeft"] = [];
  const leadersRight: GenericSportBoxScore["leadersRight"] = [];

  if (
    sportId === "volleyball" ||
    sportId === "throwball" ||
    sportId === "badminton" ||
    sportId === "table_tennis"
  ) {
    const sets = (d.sets as Array<{ a: number; b: number; winner: Side | null }>) ?? [];
    sections.push({
      title: "Set-by-Set Breakdown",
      columns: ["Set", rosters.sideA.shortCode, rosters.sideB.shortCode, "Status"],
      rows: sets.map((s, idx) => [
        `Set ${idx + 1}`,
        String(s.a),
        String(s.b),
        s.winner ? `${s.winner === "A" ? rosters.sideA.shortCode : rosters.sideB.shortCode} won` : "In Progress",
      ]),
    });
    sets.forEach((s, idx) => {
      leadersLeft.push({ label: `Set ${idx + 1} (${rosters.sideA.shortCode})`, value: String(s.a) });
      leadersRight.push({ label: `Set ${idx + 1} (${rosters.sideB.shortCode})`, value: String(s.b) });
    });
  } else if (sportId === "football") {
    const goals = (d.goalsList as Array<{ side: Side; scorerId?: number; assistId?: number; minute?: number }>) ?? [];
    const cards = (d.cards as Array<{ side: Side; playerId?: number; card: string; minute?: number }>) ?? [];
    sections.push({
      title: "Goals & Disciplinary Summary",
      columns: ["Team", "Event", "Player", "Time"],
      rows: [
        ...goals.map((g) => [
          g.side === "A" ? rosters.sideA.shortCode : rosters.sideB.shortCode,
          "Goal",
          g.scorerId ? getName(g.scorerId) : "Team Goal",
          g.minute ? `${g.minute}'` : "—",
        ]),
        ...cards.map((c) => [
          c.side === "A" ? rosters.sideA.shortCode : rosters.sideB.shortCode,
          `${c.card} Card`,
          c.playerId ? getName(c.playerId) : "Player",
          c.minute ? `${c.minute}'` : "—",
        ]),
      ],
    });
    leadersLeft.push({ label: `${rosters.sideA.name} Goals`, value: String(d.goalsA ?? 0) });
    leadersRight.push({ label: `${rosters.sideB.name} Goals`, value: String(d.goalsB ?? 0) });
  } else if (sportId === "kabaddi") {
    const stats = d.stats as Record<
      Side,
      { total: number; raid: number; tackle: number; bonus: number; allOut: number }
    > | undefined;
    if (stats) {
      sections.push({
        title: "Points Breakdown",
        columns: ["Category", rosters.sideA.shortCode, rosters.sideB.shortCode],
        rows: [
          ["Raid Points", String(stats.A.raid), String(stats.B.raid)],
          ["Tackle Points", String(stats.A.tackle), String(stats.B.tackle)],
          ["Bonus Points", String(stats.A.bonus), String(stats.B.bonus)],
          ["All-Out Bonus", String(stats.A.allOut), String(stats.B.allOut)],
          ["Total Points", String(stats.A.total), String(stats.B.total)],
        ],
      });
      leadersLeft.push({ label: `${rosters.sideA.shortCode} Raid / Tackle`, value: `${stats.A.raid} / ${stats.A.tackle}` });
      leadersRight.push({ label: `${rosters.sideB.shortCode} Raid / Tackle`, value: `${stats.B.raid} / ${stats.B.tackle}` });
    }
  } else if (sportId === "carrom") {
    const boards = (d.boards as Array<{ boardNumber: number; winner: Side; points: number; queenCovered: boolean }>) ?? [];
    sections.push({
      title: "Board-by-Board Results",
      columns: ["Board", "Winner", "Queen", "Points"],
      rows: boards.map((b) => [
        `Board ${b.boardNumber}`,
        b.winner === "A" ? rosters.sideA.shortCode : rosters.sideB.shortCode,
        b.queenCovered ? "Covered (+3)" : "No",
        String(b.points),
      ]),
    });
  } else if (sportId === "chess") {
    const moves = (d.moves as Array<{ moveNo: number; side: Side; san: string }>) ?? [];
    sections.push({
      title: "Recorded Moves",
      columns: ["#", "Side", "SAN"],
      rows: moves.map((m) => [
        String(m.moveNo),
        m.side === "A" ? rosters.sideA.shortCode : rosters.sideB.shortCode,
        m.san,
      ]),
    });
  } else if (sportId === "kho_kho") {
    const dismissals = (d.dismissals as Array<{ turn: number; side: Side; method: string }>) ?? [];
    sections.push({
      title: "Turn Dismissals",
      columns: ["Turn", "Chasing Team", "Method"],
      rows: dismissals.map((x) => [
        `Turn ${x.turn}`,
        x.side === "A" ? rosters.sideA.shortCode : rosters.sideB.shortCode,
        x.method.replace(/_/g, " "),
      ]),
    });
  }

  let playerOfTheMatch: GenericSportBoxScore["playerOfTheMatch"] = null;
  if ((match.status === "COMPLETED" || match.tournamentStatus === "ARCHIVED") && match.mvpPlayerProfileId) {
    const pid = match.mvpPlayerProfileId;
    const side = roleMap[pid]?.teamSide ?? "A";
    playerOfTheMatch = {
      playerId: pid,
      playerName: getName(pid),
      teamShort: side === "A" ? rosters.sideA.shortCode : rosters.sideB.shortCode,
      impactSummary: "Official Match MVP",
    };
  }

  return {
    sportId,
    sections,
    leadersLeft,
    leadersRight,
    playerOfTheMatch,
  };
}
