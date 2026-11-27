import test from "node:test";
import assert from "node:assert/strict";
import { reduceMatchEvents } from "../shared/scoring/reducers/index.ts";
import { computeElapsedClockMs, resolveClockState } from "../shared/scoring/types.ts";
import { computeStandingsForSport } from "../shared/scoring/standings.ts";
import { formatMatchTimeline } from "../shared/scoring/formatEvent.ts";
import { buildCricketScorecard } from "../shared/scoring/scorecard.ts";

test("Cricket reducer computes runs, extras, wickets, overs, and tombstone undo cleanly", () => {
  const events = [
    { seq: 1, occurredAt: 1000, eventType: "BALL", payloadJson: { side: "A", runs: 4, extraType: null, wicket: false, batterId: 1, bowlerId: 10 } },
    { seq: 2, occurredAt: 2000, eventType: "BALL", payloadJson: { side: "A", runs: 0, extraType: "WD", wicket: false, batterId: 1, bowlerId: 10 } },
    { seq: 3, occurredAt: 3000, eventType: "BALL", payloadJson: { side: "A", runs: 6, extraType: null, wicket: false, batterId: 1, bowlerId: 10 } },
    { seq: 4, occurredAt: 4000, eventType: "BALL", payloadJson: { side: "A", runs: 0, extraType: null, wicket: true, wicketType: "BOWLED", batterId: 1, bowlerId: 10 }, voided: true },
  ];

  const derived = reduceMatchEvents("cricket", events, { teamAShort: "TTN", teamBShort: "CCG", oversPerInnings: 10 });
  assert.equal(derived.teamANumeric, 11); // 4 + 1(WD) + 6 = 11 (voided wicket ignored)
  assert.equal(derived.teamAScoreLabel, "11/0 (0.2)");
  assert.deepEqual(derived.detail.oversGroups, [{ overNumber: 1, balls: ["4", "WD", "6"] }]);
});

test("Badminton reducer enforces 21-point win-by-2 and 30-point cap", () => {
  const events: Array<{ seq: number; occurredAt: number; eventType: string; payloadJson: Record<string, unknown> }> = [];
  let seq = 1;
  for (let i = 0; i < 29; i++) {
    events.push({ seq: seq++, occurredAt: seq * 1000, eventType: "POINT", payloadJson: { side: "A" } });
    events.push({ seq: seq++, occurredAt: seq * 1000, eventType: "POINT", payloadJson: { side: "B" } });
  }
  // 29-29, next point by A hits 30 cap and wins Set 1
  events.push({ seq: seq++, occurredAt: seq * 1000, eventType: "POINT", payloadJson: { side: "A" } });
  const derived = reduceMatchEvents("badminton", events);
  assert.equal(derived.teamANumeric, 1);
  assert.equal(derived.teamBNumeric, 0);
});

test("All remaining 7 sports (Football, Volleyball, TT, Kabaddi, Kho Kho, Carrom, Chess) reduce deterministically", () => {
  const fb = reduceMatchEvents("football", [
    { seq: 1, occurredAt: 1000, eventType: "GOAL", payloadJson: { side: "A" } },
    { seq: 2, occurredAt: 2000, eventType: "GOAL", payloadJson: { side: "B" } },
    { seq: 3, occurredAt: 3000, eventType: "GOAL", payloadJson: { side: "A" } },
    { seq: 4, occurredAt: 4000, eventType: "PERIOD", payloadJson: { period: "FT" } },
  ]);
  assert.equal(fb.teamANumeric, 2);
  assert.equal(fb.suggestedWinnerSide, "A");

  const vb = reduceMatchEvents("volleyball", Array.from({ length: 25 }, (_, i) => ({
    seq: i + 1,
    occurredAt: (i + 1) * 1000,
    eventType: "POINT",
    payloadJson: { side: "B" },
  })));
  assert.equal(vb.teamBNumeric, 1);

  const tt = reduceMatchEvents("table_tennis", Array.from({ length: 11 }, (_, i) => ({
    seq: i + 1,
    occurredAt: (i + 1) * 1000,
    eventType: "POINT",
    payloadJson: { side: "A" },
  })));
  assert.equal(tt.teamANumeric, 1);

  const kab = reduceMatchEvents("kabaddi", [
    { seq: 1, occurredAt: 1000, eventType: "RAID", payloadJson: { side: "A", points: 3 } },
    { seq: 2, occurredAt: 2000, eventType: "ALL_OUT", payloadJson: { side: "A" } },
  ]);
  assert.equal(kab.teamANumeric, 5);

  const kk = reduceMatchEvents("kho_kho", [
    { seq: 1, occurredAt: 1000, eventType: "DISMISSAL", payloadJson: { side: "B", method: "POLE_DIVE", points: 1 } },
  ]);
  assert.equal(kk.teamBNumeric, 1);

  const car = reduceMatchEvents("carrom", [
    { seq: 1, occurredAt: 1000, eventType: "BOARD_RESULT", payloadJson: { side: "A", points: 4, queenCovered: true } },
  ]);
  assert.equal(car.teamANumeric, 7);

  const ch = reduceMatchEvents("chess", [
    { seq: 1, occurredAt: 1000, eventType: "MOVE", payloadJson: { san: "e4" } },
    { seq: 2, occurredAt: 2000, eventType: "RESULT", payloadJson: { result: "1-0", termination: "CHECKMATE" } },
  ]);
  assert.equal(ch.teamANumeric, 1);
  assert.equal(ch.suggestedWinnerSide, "A");
});

test("Timestamp-anchored clock computes elapsed ms accurately without tick drift", () => {
  const clock = { running: true, anchorEpochMs: 10000, accumulatedMs: 5000 };
  assert.equal(computeElapsedClockMs(clock, 25000), 20000);
});

test("Standings engine calculates Cricket NRR and Football GD accurately", () => {
  const fbDerived = reduceMatchEvents("football", [
    { seq: 1, occurredAt: 1000, eventType: "GOAL", payloadJson: { side: "A" } },
    { seq: 2, occurredAt: 2000, eventType: "GOAL", payloadJson: { side: "A" } },
    { seq: 3, occurredAt: 3000, eventType: "GOAL", payloadJson: { side: "B" } },
  ]);
  const rows = computeStandingsForSport("football", [1, 2], [
    { teamAId: 1, teamBId: 2, winnerTeamId: 1, sportId: "football", derived: fbDerived },
  ]);
  assert.equal(rows[0].teamId, 1);
  assert.equal(rows[0].points, 3);
  assert.equal(rows[0].goalDiff, 1);
  assert.equal(rows[1].goalDiff, -1);
});

test("Persisted clock config overrides event clock state and formats readable timeline rows", () => {
  const clock = resolveClockState([], {
    clockRunning: true,
    clockAnchorMs: 10000,
    clockAccumulatedMs: 30000,
  });
  assert.equal(clock.running, true);
  assert.equal(computeElapsedClockMs(clock, 25000), 45000);

  const items = formatMatchTimeline(
    [
      {
        seq: 1,
        occurredAt: 1000,
        eventType: "BALL",
        payloadJson: { side: "A", runs: 4, extraType: null, wicket: false, batterId: 2, bowlerId: 7 },
      },
    ],
    {
      sportId: "cricket",
      teamAShort: "TTN",
      teamBShort: "CCG",
      playerNames: { 2: "Aarav Sharma", 7: "Arjun Reddy" },
    }
  );
  assert.equal(items[0].badge, "4");
  assert.equal(items[0].contextLabel, "0.1 ov");
  assert.equal(items[0].headline, "TTN: Boundary Four");
  assert.equal(items[0].subline, "Aarav Sharma • b. Arjun Reddy");
});

test("buildCricketScorecard derives full batting, bowling, extras, maidens, didNotBat, and POTM", () => {
  const card = buildCricketScorecard(
    {
      id: 99,
      status: "COMPLETED",
      venue: "Main Ground",
      scheduledAt: "2026-11-26T10:00:00Z",
      roundLabel: "Final",
    },
    [
      { seq: 1, occurredAt: 1000, eventType: "BALL", payloadJson: { side: "A", runs: 4, extraType: null, wicket: false, batterId: 1, bowlerId: 10 } },
      { seq: 2, occurredAt: 2000, eventType: "BALL", payloadJson: { side: "A", runs: 6, extraType: null, wicket: false, batterId: 1, bowlerId: 10 } },
      { seq: 3, occurredAt: 3000, eventType: "BALL", payloadJson: { side: "A", runs: 0, extraType: "WD", wicket: false, batterId: 1, bowlerId: 10 } },
      { seq: 4, occurredAt: 4000, eventType: "BALL", payloadJson: { side: "A", runs: 0, extraType: null, wicket: true, wicketType: "CAUGHT", batterId: 1, bowlerId: 10, fielderId: 11 } },
      // Maiden over by bowlerId 11 (6 legal dots)
      ...Array.from({ length: 6 }, (_, i) => ({
        seq: 5 + i,
        occurredAt: (5 + i) * 1000,
        eventType: "BALL",
        payloadJson: { side: "A", runs: 0, extraType: null, wicket: false, batterId: 2, bowlerId: 11 },
      })),
    ],
    {
      sideA: {
        id: 1,
        name: "Trichy Titans",
        shortCode: "TTN",
        roster: [
          { playerProfileId: 1, displayName: "Aarav Sharma", playingRole: "Captain" },
          { playerProfileId: 2, displayName: "Kabir Verma", playingRole: "Wicketkeeper" },
          { playerProfileId: 3, displayName: "Vikram Nair", playingRole: "All-Rounder" },
        ],
      },
      sideB: {
        id: 2,
        name: "Cauvery Chargers",
        shortCode: "CCG",
        roster: [
          { playerProfileId: 10, displayName: "Arjun Reddy", playingRole: "Spinner" },
          { playerProfileId: 11, displayName: "Devansh Patel", playingRole: "Pacer" },
        ],
      },
    }
  );

  assert.equal(card.innings.length, 1);
  const inn = card.innings[0];
  assert.equal(inn.totalRuns, 11);
  assert.equal(inn.wickets, 1);
  assert.equal(inn.extrasText, "1 (W 1)");
  assert.equal(inn.battingRows[0].isCaptain, true);
  assert.equal(inn.battingRows[0].dismissalText, "c Devansh Patel b Arjun Reddy");
  assert.equal(inn.battingRows[0].strikeRate, "333.33");
  assert.equal(inn.didNotBat.length, 1);
  assert.equal(inn.didNotBat[0].playerName, "Vikram Nair");
  assert.equal(inn.bowlingRows[1].maidens, 1);
  assert.equal(inn.topBatters[0].playerName, "Aarav Sharma");
  assert.equal(card.playerOfTheMatch?.playerName, "Arjun Reddy");
});

test("Cricket reducer handles strike rotation, over completion, free hit, and Super Over deterministically", () => {
  const baseEvents = [
    { seq: 1, occurredAt: 1000, eventType: "SET_PLAYERS", payloadJson: { strikerId: 1, nonStrikerId: 2, bowlerId: 10 } },
    // Ball 1: 1 run -> swaps strike (2 on strike)
    { seq: 2, occurredAt: 2000, eventType: "BALL", payloadJson: { side: "A", runs: 1, extraType: null, wicket: false } },
    // Ball 2: No Ball + 0 -> freeHit = true, strike stays 2
    { seq: 3, occurredAt: 3000, eventType: "BALL", payloadJson: { side: "A", runs: 0, extraType: "NB", wicket: false } },
    // Balls 2..5 legal dots, Ball 6: 1 run -> oddRunsSwap (true) XOR overCompleted (true) = no swap! (2 stays on strike)
    { seq: 4, occurredAt: 4000, eventType: "BALL", payloadJson: { side: "A", runs: 0, extraType: null, wicket: false } },
    { seq: 5, occurredAt: 5000, eventType: "BALL", payloadJson: { side: "A", runs: 0, extraType: null, wicket: false } },
    { seq: 6, occurredAt: 6000, eventType: "BALL", payloadJson: { side: "A", runs: 0, extraType: null, wicket: false } },
    { seq: 7, occurredAt: 7000, eventType: "BALL", payloadJson: { side: "A", runs: 0, extraType: null, wicket: false } },
    { seq: 8, occurredAt: 8000, eventType: "BALL", payloadJson: { side: "A", runs: 1, extraType: null, wicket: false } },
  ];

  const mid = reduceMatchEvents("cricket", baseEvents, { teamAShort: "TTN", teamBShort: "CCG", oversPerInnings: 1 });
  assert.equal(mid.detail.strikerId, 2);
  assert.equal(mid.detail.nonStrikerId, 1);
  assert.equal(mid.detail.innings1Complete, true);
  assert.equal(mid.teamAScoreLabel, "3/0 (1.0)");

  // 2nd innings ties at 3/0 -> matchTied = true, then Super Over 1
  const tieEvents = [
    ...baseEvents,
    { seq: 9, occurredAt: 9000, eventType: "INNINGS_SWITCH", payloadJson: { battingSide: "B", strikerId: 10, nonStrikerId: 11, bowlerId: 1 } },
    { seq: 10, occurredAt: 10000, eventType: "BALL", payloadJson: { side: "B", runs: 3, extraType: null, wicket: false } },
    { seq: 11, occurredAt: 11000, eventType: "BALL", payloadJson: { side: "B", runs: 0, extraType: null, wicket: false } },
    { seq: 12, occurredAt: 12000, eventType: "BALL", payloadJson: { side: "B", runs: 0, extraType: null, wicket: false } },
    { seq: 13, occurredAt: 13000, eventType: "BALL", payloadJson: { side: "B", runs: 0, extraType: null, wicket: false } },
    { seq: 14, occurredAt: 14000, eventType: "BALL", payloadJson: { side: "B", runs: 0, extraType: null, wicket: false } },
    { seq: 15, occurredAt: 15000, eventType: "BALL", payloadJson: { side: "B", runs: 0, extraType: null, wicket: false } },
  ];
  const tied = reduceMatchEvents("cricket", tieEvents, { teamAShort: "TTN", teamBShort: "CCG", oversPerInnings: 1 });
  assert.equal(tied.detail.matchTied, true);
  assert.equal(tied.suggestedWinnerSide, "DRAW");

  const soEvents = [
    ...tieEvents,
    { seq: 16, occurredAt: 16000, eventType: "SUPER_OVER_START", payloadJson: { superOverIndex: 1, battingSide: "A", strikerId: 1, nonStrikerId: 2, bowlerId: 10 } },
    { seq: 17, occurredAt: 17000, eventType: "BALL", payloadJson: { side: "A", runs: 6, extraType: null, wicket: false } },
    { seq: 18, occurredAt: 18000, eventType: "BALL", payloadJson: { side: "A", runs: 0, extraType: null, wicket: true, wicketType: "BOWLED" } },
    { seq: 19, occurredAt: 19000, eventType: "BALL", payloadJson: { side: "A", runs: 0, extraType: null, wicket: true, wicketType: "CAUGHT" } },
  ];
  const so1 = reduceMatchEvents("cricket", soEvents, { teamAShort: "TTN", teamBShort: "CCG", oversPerInnings: 1 });
  assert.equal(so1.detail.isSuperOver, true);
  assert.equal(so1.detail.superOverRuns, 6);
  assert.equal(so1.detail.superOverWickets, 2);
  assert.equal(so1.detail.superOverHalf1Complete, true);
  // Main match scorelines must remain untouched by Super Over runs
  assert.equal(so1.teamAScoreLabel, "3/0 (1.0)");
  assert.equal(so1.teamBScoreLabel, "3/0 (1.0)");

  const soChaseEvents = [
    ...soEvents,
    { seq: 20, occurredAt: 20000, eventType: "SUPER_OVER_SWITCH", payloadJson: { battingSide: "B", strikerId: 10, nonStrikerId: 11, bowlerId: 1 } },
    { seq: 21, occurredAt: 21000, eventType: "BALL", payloadJson: { side: "B", runs: 4, extraType: null, wicket: false } },
    { seq: 22, occurredAt: 22000, eventType: "BALL", payloadJson: { side: "B", runs: 4, extraType: null, wicket: false } },
  ];
  const soWon = reduceMatchEvents("cricket", soChaseEvents, { teamAShort: "TTN", teamBShort: "CCG", oversPerInnings: 1 });
  assert.equal(soWon.detail.superOverTarget, 7);
  assert.equal(soWon.detail.superOverComplete, true);
  assert.equal(soWon.suggestedWinnerSide, "B");
});
