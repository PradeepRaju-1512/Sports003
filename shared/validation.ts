/**
 * Validates that the conditional top urgent alert banner strictly contains <= 5 words.
 */
export function validateUrgentBannerWords(text: string): { valid: boolean; wordCount: number } {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  return {
    valid: words.length > 0 && words.length <= 5,
    wordCount: words.length,
  };
}

export interface PurseGuardrailInput {
  remainingPurse: number;
  currentSquadCount: number;
  currentClubCount: number;
  currentNonClubCount: number;
  minSquad: number;
  maxSquad: number;
  minClubQuota: number;
  minNonClubQuota: number;
  clubBasePrice: number;
  nonClubBasePrice: number;
  candidateClass: "CLUB" | "NON_CLUB";
}

/**
 * Computes Max Allowed Bid for a franchise in a single sport without double-counting
 * overlapping mandatory squad & class quotas.
 */
export function computeMaxAllowedBid(input: PurseGuardrailInput): {
  eligible: boolean;
  reason: string | null;
  maxAllowedBid: number;
  requiredReserve: number;
} {
  if (input.currentSquadCount >= input.maxSquad) {
    return {
      eligible: false,
      reason: "Max squad size reached",
      maxAllowedBid: 0,
      requiredReserve: 0,
    };
  }

  // Remaining squad count AFTER acquiring this candidate player
  const afterSquad = input.currentSquadCount + 1;
  const afterClub = input.currentClubCount + (input.candidateClass === "CLUB" ? 1 : 0);
  const afterNonClub = input.currentNonClubCount + (input.candidateClass === "NON_CLUB" ? 1 : 0);

  const slotsStillNeeded = Math.max(0, input.minSquad - afterSquad);
  const clubDeficit = Math.max(0, input.minClubQuota - afterClub);
  const nonClubDeficit = Math.max(0, input.minNonClubQuota - afterNonClub);

  // Check if remaining open slots up to maxSquad can even satisfy class deficits
  const maxRemainingSlots = input.maxSquad - afterSquad;
  if (clubDeficit + nonClubDeficit > maxRemainingSlots) {
    return {
      eligible: false,
      reason: "Would violate mandatory CLUB / NON_CLUB quota",
      maxAllowedBid: 0,
      requiredReserve: 0,
    };
  }

  // Reserve minimum base price for mandatory club deficit + non-club deficit,
  // plus cheapest base price for any extra required general slots beyond those deficits.
  const generalExtraSlots = Math.max(0, slotsStillNeeded - (clubDeficit + nonClubDeficit));
  const minAnyBase = Math.min(input.clubBasePrice, input.nonClubBasePrice);

  const requiredReserve =
    clubDeficit * input.clubBasePrice +
    nonClubDeficit * input.nonClubBasePrice +
    generalExtraSlots * minAnyBase;

  const maxAllowedBid = Math.max(0, input.remainingPurse - requiredReserve);

  return {
    eligible: maxAllowedBid > 0,
    reason: maxAllowedBid <= 0 ? "Insufficient purse after mandatory reserves" : null,
    maxAllowedBid,
    requiredReserve,
  };
}
