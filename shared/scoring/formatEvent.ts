import { formatClockMs, type MatchEventRecord, type SportId } from "./types.ts";

export interface FormattedTimelineItem {
  seq: number;
  contextLabel: string;
  badge: string;
  badgeTone: "crimson" | "ochre" | "emerald" | "neutral";
  headline: string;
  subline: string;
  voided: boolean;
  rawEvent: MatchEventRecord;
}

export interface TimelineFormatterContext {
  sportId: SportId;
  teamAShort: string;
  teamBShort: string;
  playerNames: Record<number, string>;
}

/**
 * Converts raw match_events into clean, human-readable timeline rows without dumping JSON.
 */
export function formatMatchTimeline(
  events: MatchEventRecord[],
  ctx: TimelineFormatterContext
): FormattedTimelineItem[] {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  let cricketLegalBalls = 0;
  let activeSuperOverIdx = 0;
  let setNumber = 1;

  const teamForSide = (side: unknown) =>
    side === "B" ? ctx.teamBShort : ctx.teamAShort;

  const playerLabel = (id: unknown) => {
    const num = Number(id);
    if (!Number.isFinite(num) || num <= 0) return null;
    return ctx.playerNames[num] ?? `Player #${num}`;
  };

  const items: FormattedTimelineItem[] = ordered.map((ev) => {
    const p = ev.payloadJson ?? {};
    const clockCtx =
      typeof ev.matchClockMs === "number" && ev.matchClockMs > 0
        ? formatClockMs(ev.matchClockMs)
        : null;
    const voided = Boolean(ev.voided);

    if (ev.eventType === "CLOCK_START" || ev.eventType === "CLOCK_PAUSE" || ev.eventType === "CLOCK_RESET") {
      const label =
        ev.eventType === "CLOCK_START"
          ? "Clock Started"
          : ev.eventType === "CLOCK_PAUSE"
          ? "Clock Paused"
          : "Clock Reset";
      return {
        seq: ev.seq,
        contextLabel: clockCtx ?? "Clock",
        badge: "CLK",
        badgeTone: "neutral",
        headline: label,
        subline: "Official match timer event",
        voided,
        rawEvent: ev,
      };
    }

    if (ctx.sportId === "cricket") {
      if (ev.eventType === "INNINGS_SWITCH") {
        if (!voided) cricketLegalBalls = 0;
        const battingTeam = teamForSide(p.battingSide);
        return {
          seq: ev.seq,
          contextLabel: "Innings",
          badge: "SWITCH",
          badgeTone: "ochre",
          headline: `${battingTeam} takes strike for 2nd Innings`,
          subline: "Innings break",
          voided,
          rawEvent: ev,
        };
      }

      if (ev.eventType === "SUPER_OVER_START" || ev.eventType === "SUPER_OVER_SWITCH") {
        if (!voided) {
          cricketLegalBalls = 0;
          if (ev.eventType === "SUPER_OVER_START") {
            activeSuperOverIdx = Number(p.superOverIndex ?? activeSuperOverIdx + 1);
          }
        }
        const battingTeam = teamForSide(p.battingSide);
        return {
          seq: ev.seq,
          contextLabel: `SO${activeSuperOverIdx || 1}`,
          badge: "SO",
          badgeTone: "crimson",
          headline:
            ev.eventType === "SUPER_OVER_START"
              ? `Super Over ${activeSuperOverIdx || 1} — ${battingTeam} batting`
              : `Super Over ${activeSuperOverIdx || 1} — ${battingTeam} chasing`,
          subline: "Super Over",
          voided,
          rawEvent: ev,
        };
      }

      if (ev.eventType === "SWAP_STRIKE" || ev.eventType === "SET_PLAYERS") {
        return {
          seq: ev.seq,
          contextLabel: activeSuperOverIdx > 0 ? `SO${activeSuperOverIdx}` : "Crease",
          badge: ev.eventType === "SWAP_STRIKE" ? "⇄" : "XI",
          badgeTone: "neutral",
          headline:
            ev.eventType === "SWAP_STRIKE"
              ? "Strike swapped manually"
              : "Crease / Bowler updated",
          subline: "Match control",
          voided,
          rawEvent: ev,
        };
      }

      if (ev.eventType === "BALL") {
        const extraType = (p.extraType as string | null) ?? null;
        const isLegal = extraType !== "WD" && extraType !== "NB";
        const soPrefix = activeSuperOverIdx > 0 ? `SO${activeSuperOverIdx} · ` : "";
        let overLabel = `${soPrefix}${Math.floor(cricketLegalBalls / 6)}.${cricketLegalBalls % 6} ov`;
        if (!voided && isLegal) {
          cricketLegalBalls += 1;
          overLabel = `${soPrefix}${Math.floor((cricketLegalBalls - 1) / 6)}.${((cricketLegalBalls - 1) % 6) + 1} ov`;
        }

        const runs = Number(p.runs ?? 0);
        const isWicket = Boolean(p.wicket);
        const batter = playerLabel(p.batterId);
        const bowler = playerLabel(p.bowlerId);
        const team = teamForSide(p.side);

        let badge = `${runs}`;
        let badgeTone: FormattedTimelineItem["badgeTone"] = "neutral";
        let actionDesc = runs === 0 ? "Dot ball" : runs === 1 ? "1 run" : `${runs} runs`;

        if (isWicket) {
          badge = "W";
          badgeTone = "crimson";
          const wType = String(p.wicketType ?? "OUT").replace(/_/g, " ");
          actionDesc = `Wicket (${wType})`;
        } else if (extraType === "WD") {
          badge = runs > 0 ? `${runs}WD` : "WD";
          badgeTone = "ochre";
          actionDesc = `Wide (+${runs + 1})`;
        } else if (extraType === "NB") {
          badge = runs > 0 ? `${runs}NB` : "NB";
          badgeTone = "ochre";
          actionDesc = `No Ball (+${runs + 1})`;
        } else if (extraType === "LB" || extraType === "B") {
          badge = `${runs}${extraType}`;
          actionDesc = `${extraType === "LB" ? "Leg Bye" : "Bye"} (+${runs})`;
        } else if (runs === 4) {
          badge = "4";
          badgeTone = "ochre";
          actionDesc = "Boundary Four";
        } else if (runs === 6) {
          badge = "6";
          badgeTone = "emerald";
          actionDesc = "Maximum Six";
        }

        const actors = [batter, bowler ? `b. ${bowler}` : null].filter(Boolean).join(" • ");
        return {
          seq: ev.seq,
          contextLabel: overLabel,
          badge,
          badgeTone,
          headline: `${team}: ${actionDesc}`,
          subline: actors || `${team} batting`,
          voided,
          rawEvent: ev,
        };
      }
    }

    if (ctx.sportId === "football") {
      const team = teamForSide(p.side);
      if (ev.eventType === "GOAL") {
        const scorer = playerLabel(p.scorerId);
        const assist = playerLabel(p.assistId);
        return {
          seq: ev.seq,
          contextLabel: p.minute ? `${p.minute}'` : clockCtx ?? "Match",
          badge: "GOAL",
          badgeTone: "emerald",
          headline: `Goal — ${team}${scorer ? ` (${scorer})` : ""}`,
          subline: assist ? `Assist: ${assist}` : `${team} finds the net`,
          voided,
          rawEvent: ev,
        };
      }
      if (ev.eventType === "CARD") {
        const card = String(p.card ?? "YELLOW");
        const player = playerLabel(p.playerId);
        return {
          seq: ev.seq,
          contextLabel: p.minute ? `${p.minute}'` : clockCtx ?? "Match",
          badge: card === "RED" ? "RC" : "YC",
          badgeTone: card === "RED" ? "crimson" : "ochre",
          headline: `${card === "RED" ? "Red" : "Yellow"} Card — ${team}`,
          subline: player ?? `${team} disciplinary card`,
          voided,
          rawEvent: ev,
        };
      }
      if (ev.eventType === "PERIOD") {
        return {
          seq: ev.seq,
          contextLabel: clockCtx ?? "Period",
          badge: String(p.period ?? "FT"),
          badgeTone: "ochre",
          headline: `Period switched to ${String(p.period ?? "")}`,
          subline: `${ctx.teamAShort} vs ${ctx.teamBShort}`,
          voided,
          rawEvent: ev,
        };
      }
    }

    if (
      ctx.sportId === "volleyball" ||
      ctx.sportId === "throwball" ||
      ctx.sportId === "badminton" ||
      ctx.sportId === "table_tennis"
    ) {
      const team = teamForSide(p.side);
      if (ev.eventType === "POINT") {
        return {
          seq: ev.seq,
          contextLabel: `Set ${setNumber}`,
          badge: "+1",
          badgeTone: p.side === "B" ? "ochre" : "emerald",
          headline: `Rally Point — ${team}`,
          subline: `${team} wins the rally`,
          voided,
          rawEvent: ev,
        };
      }
      if (ev.eventType === "TIMEOUT") {
        return {
          seq: ev.seq,
          contextLabel: `Set ${setNumber}`,
          badge: "T/O",
          badgeTone: "neutral",
          headline: `Timeout called by ${team}`,
          subline: "Court break",
          voided,
          rawEvent: ev,
        };
      }
    }

    if (ctx.sportId === "kabaddi") {
      const team = teamForSide(p.side);
      const pts = Number(p.points ?? 1) + Number(p.bonus ?? 0);
      if (ev.eventType === "RAID") {
        return {
          seq: ev.seq,
          contextLabel: clockCtx ?? "Raid",
          badge: `+${pts}`,
          badgeTone: pts >= 3 ? "emerald" : "ochre",
          headline: `${pts >= 3 ? "Super Raid" : "Successful Raid"} — ${team}`,
          subline: `${pts} point${pts > 1 ? "s" : ""} awarded`,
          voided,
          rawEvent: ev,
        };
      }
      if (ev.eventType === "TACKLE") {
        const superT = Boolean(p.superTackle);
        return {
          seq: ev.seq,
          contextLabel: clockCtx ?? "Tackle",
          badge: superT ? "+2" : "+1",
          badgeTone: "crimson",
          headline: `${superT ? "Super Tackle" : "Tackle"} — ${team}`,
          subline: `${team} defense holds`,
          voided,
          rawEvent: ev,
        };
      }
      if (ev.eventType === "ALL_OUT") {
        return {
          seq: ev.seq,
          contextLabel: clockCtx ?? "All Out",
          badge: "+2",
          badgeTone: "emerald",
          headline: `All-Out Bonus — ${team}`,
          subline: "Opposing side cleared (+2 pts)",
          voided,
          rawEvent: ev,
        };
      }
    }

    if (ctx.sportId === "kho_kho") {
      const team = teamForSide(p.side);
      if (ev.eventType === "DISMISSAL") {
        return {
          seq: ev.seq,
          contextLabel: clockCtx ?? "Chase",
          badge: "+1",
          badgeTone: "emerald",
          headline: `Defender Out (${String(p.method ?? "TOUCH").replace(/_/g, " ")}) — ${team}`,
          subline: `${team} scores dismissal`,
          voided,
          rawEvent: ev,
        };
      }
      if (ev.eventType === "TURN_SWITCH") {
        return {
          seq: ev.seq,
          contextLabel: "Turn",
          badge: "TURN",
          badgeTone: "ochre",
          headline: "Turn Switched",
          subline: "Chasing & defending sides rotated",
          voided,
          rawEvent: ev,
        };
      }
    }

    if (ctx.sportId === "carrom") {
      const team = teamForSide(p.side);
      if (ev.eventType === "BOARD_RESULT") {
        const queen = Boolean(p.queenCovered);
        const total = Number(p.points ?? 1) + (queen ? 3 : 0);
        return {
          seq: ev.seq,
          contextLabel: "Board",
          badge: `+${total}`,
          badgeTone: queen ? "ochre" : "emerald",
          headline: `Board Won — ${team}${queen ? " (Queen Covered)" : ""}`,
          subline: `${total} points scored`,
          voided,
          rawEvent: ev,
        };
      }
      if (ev.eventType === "FOUL") {
        return {
          seq: ev.seq,
          contextLabel: "Board",
          badge: "-1",
          badgeTone: "crimson",
          headline: `Foul Penalty — ${team}`,
          subline: "1 point deducted",
          voided,
          rawEvent: ev,
        };
      }
    }

    if (ctx.sportId === "chess") {
      if (ev.eventType === "MOVE") {
        return {
          seq: ev.seq,
          contextLabel: clockCtx ?? "Move",
          badge: "MOVE",
          badgeTone: "neutral",
          headline: `Move played: ${String(p.san ?? "")}`,
          subline: `${ctx.teamAShort} vs ${ctx.teamBShort}`,
          voided,
          rawEvent: ev,
        };
      }
      if (ev.eventType === "RESULT") {
        return {
          seq: ev.seq,
          contextLabel: "Final",
          badge: String(p.result ?? "END"),
          badgeTone: "emerald",
          headline: `Game Concluded: ${String(p.result ?? "")}`,
          subline: String(p.termination ?? "COMPLETED"),
          voided,
          rawEvent: ev,
        };
      }
    }

    return {
      seq: ev.seq,
      contextLabel: clockCtx ?? "Event",
      badge: ev.eventType.slice(0, 6),
      badgeTone: "neutral",
      headline: `${ev.eventType.replace(/_/g, " ")}`,
      subline: p.side ? `Side: ${teamForSide(p.side)}` : `${ctx.teamAShort} vs ${ctx.teamBShort}`,
      voided,
      rawEvent: ev,
    };
  });

  return items.reverse();
}
