import type {
  DerivedMatchState,
  MatchEventRecord,
  MatchReducerConfig,
  SportId,
} from "../types.ts";
import { reduceCricket } from "./cricket.ts";
import { reduceSetSport } from "./courtAndIndoor.ts";
import {
  reduceCarrom,
  reduceChess,
  reduceFootball,
  reduceKabaddi,
  reduceKhoKho,
} from "./fieldAndBoard.ts";

export function reduceMatchEvents(
  sportId: SportId,
  events: MatchEventRecord[],
  config: MatchReducerConfig = {}
): DerivedMatchState {
  switch (sportId) {
    case "cricket":
      return reduceCricket(events, config);
    case "volleyball":
    case "throwball":
    case "badminton":
    case "table_tennis":
      return reduceSetSport(sportId, events, config);
    case "football":
      return reduceFootball(events, config);
    case "kabaddi":
      return reduceKabaddi(events, config);
    case "kho_kho":
      return reduceKhoKho(events, config);
    case "carrom":
      return reduceCarrom(events, config);
    case "chess":
      return reduceChess(events, config);
  }
}
