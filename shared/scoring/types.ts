export type SportId =
  | "football"
  | "cricket"
  | "volleyball"
  | "kho_kho"
  | "kabaddi"
  | "badminton"
  | "table_tennis"
  | "carrom"
  | "chess"
  | "throwball";

export type Side = "A" | "B";

export interface MatchEventRecord {
  id?: number;
  seq: number;
  occurredAt: string | number;
  matchClockMs?: number | null;
  eventType: string;
  payloadJson: Record<string, unknown>;
  voided?: boolean;
}

export interface MatchReducerConfig {
  teamAShort?: string;
  teamBShort?: string;
  teamAName?: string;
  teamBName?: string;
  oversPerInnings?: number;
  bestOfGames?: number;
  targetPoints?: number;
  deciderPoints?: number;
  halfMinutes?: number;
  clockRunning?: boolean;
  clockAnchorMs?: number | null;
  clockAccumulatedMs?: number;
}

export interface ClockState {
  running: boolean;
  anchorEpochMs: number | null;
  accumulatedMs: number;
}

export interface DerivedMatchState {
  sportId: SportId;
  summaryText: string;
  teamAScoreLabel: string;
  teamBScoreLabel: string;
  teamANumeric: number;
  teamBNumeric: number;
  periodLabel: string;
  clock: ClockState;
  suggestedWinnerSide: Side | "DRAW" | null;
  activeEventCount: number;
  detail: Record<string, unknown>;
}

/**
 * Timestamp-anchored clock computation — never suffers from setInterval background throttling.
 */
export function computeElapsedClockMs(clock: ClockState, nowMs: number = Date.now()): number {
  if (!clock.running || clock.anchorEpochMs === null) {
    return Math.max(0, clock.accumulatedMs);
  }
  return Math.max(0, clock.accumulatedMs + (nowMs - clock.anchorEpochMs));
}

export function formatClockMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function resolveClockState(
  events: MatchEventRecord[],
  config: MatchReducerConfig = {}
): ClockState {
  if (
    config.clockRunning !== undefined ||
    config.clockAnchorMs !== undefined ||
    config.clockAccumulatedMs !== undefined
  ) {
    return {
      running: Boolean(config.clockRunning),
      anchorEpochMs: config.clockAnchorMs ?? null,
      accumulatedMs: Math.max(0, Number(config.clockAccumulatedMs ?? 0)),
    };
  }
  return reduceClockFromEvents(events);
}

export function reduceClockFromEvents(events: MatchEventRecord[]): ClockState {
  let running = false;
  let anchorEpochMs: number | null = null;
  let accumulatedMs = 0;

  for (const ev of events) {
    if (ev.voided) continue;
    const t = typeof ev.occurredAt === "number" ? ev.occurredAt : new Date(ev.occurredAt).getTime();
    if (ev.eventType === "CLOCK_START") {
      if (!running) {
        running = true;
        anchorEpochMs = Number(ev.payloadJson.anchorEpochMs ?? t);
      }
    } else if (ev.eventType === "CLOCK_PAUSE") {
      if (running && anchorEpochMs !== null) {
        accumulatedMs += Math.max(0, t - anchorEpochMs);
      }
      running = false;
      anchorEpochMs = null;
    } else if (ev.eventType === "CLOCK_RESET") {
      running = false;
      anchorEpochMs = null;
      accumulatedMs = 0;
    }
  }
  return { running, anchorEpochMs, accumulatedMs };
}
