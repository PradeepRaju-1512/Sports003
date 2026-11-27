import test from "node:test";
import assert from "node:assert/strict";
import { computeMaxAllowedBid, validateUrgentBannerWords } from "../shared/validation.ts";
import {
  detectAllowedUploadMime,
  detectImageMimeFromBuffer,
  isWeakSessionSecret,
} from "../server/lib/security.ts";
import { computeSemesterRollover } from "../shared/academic.ts";

test("Urgent alert banner enforces strict <= 5 words", () => {
  assert.equal(validateUrgentBannerWords("CRICKET SEMIS LIVE NOW").valid, true);
  assert.equal(validateUrgentBannerWords("MAIN GROUND CLOSED FOR RAIN TODAY").valid, false);
  assert.equal(validateUrgentBannerWords("   ").valid, false);
});

test("Auction purse guardrail calculates Max Allowed Bid without double-counting overlapping quotas", () => {
  // Franchise needs min 11 players, currently has 8 (needs 3 more total).
  // Already has 2 CLUB (min 3 -> deficit 1) and 3 NON_CLUB (min 4 -> deficit 1).
  // Bidding on a CLUB player: after acquisition -> 9 squad, 3 CLUB (deficit 0), 3 NON_CLUB (deficit 1),
  // 1 more general slot needed beyond non-club deficit -> reserve = 1*200 (non-club) + 1*200 (min base) = 400.
  const res = computeMaxAllowedBid({
    remainingPurse: 5000,
    currentSquadCount: 8,
    currentClubCount: 2,
    currentNonClubCount: 3,
    minSquad: 11,
    maxSquad: 15,
    minClubQuota: 3,
    minNonClubQuota: 4,
    clubBasePrice: 500,
    nonClubBasePrice: 200,
    candidateClass: "CLUB",
  });

  assert.equal(res.eligible, true);
  assert.equal(res.requiredReserve, 400);
  assert.equal(res.maxAllowedBid, 4600);
});

test("Security helpers enforce magic-byte image checks and strong session secrets", () => {
  const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const svgSpoof = Buffer.from("<svg onload=alert(1)></svg>");
  assert.equal(detectImageMimeFromBuffer(pngBuf), "image/png");
  assert.equal(detectImageMimeFromBuffer(svgSpoof), null);
  assert.equal(detectAllowedUploadMime(svgSpoof), null);

  assert.equal(isWeakSessionSecret("short"), true);
  assert.equal(isWeakSessionSecret("iiitt_local_dev_secret_change_in_prod_2026"), true);
  assert.equal(isWeakSessionSecret("a9F!k2Lm#8Qp$4Vz7Xw1Yb6Nc3Rt0Gh5Jk"), false);
});

test("Controlled semester rollover is idempotent per term, caps at graduation, and skips non-students", () => {
  const btech2 = computeSemesterRollover(
    {
      accountType: "STUDENT",
      programType: "BTECH",
      currentSemester: 2,
      lastIncrementedTerm: null,
      isGraduated: false,
    },
    "ODD_2026"
  );
  assert.deepEqual(btech2, {
    action: "ADVANCE",
    nextSemester: 3,
    nextBatch: "2ND",
    isGraduated: false,
    lastIncrementedTerm: "ODD_2026",
  });

  // Same term rollover must be skipped (idempotent)
  const repeat = computeSemesterRollover(
    {
      accountType: "STUDENT",
      programType: "BTECH",
      currentSemester: 3,
      lastIncrementedTerm: "ODD_2026",
      isGraduated: false,
    },
    "ODD_2026"
  );
  assert.deepEqual(repeat, { action: "SKIP", reason: "ALREADY_ROLLED" });

  // B.Tech Sem 8 caps and marks graduated instead of 5th year
  const btechCap = computeSemesterRollover(
    {
      accountType: "STUDENT",
      programType: "BTECH",
      currentSemester: 8,
      lastIncrementedTerm: "ODD_2026",
      isGraduated: false,
    },
    "EVEN_2027"
  );
  assert.deepEqual(btechCap, {
    action: "GRADUATE",
    nextSemester: 8,
    nextBatch: "4TH",
    isGraduated: true,
    lastIncrementedTerm: "EVEN_2027",
  });

  // M.Tech Sem 4 caps and marks graduated
  const mtechCap = computeSemesterRollover(
    {
      accountType: "STUDENT",
      programType: "MTECH",
      currentSemester: 4,
      lastIncrementedTerm: null,
      isGraduated: false,
    },
    "EVEN_2027"
  );
  assert.deepEqual(mtechCap, {
    action: "GRADUATE",
    nextSemester: 4,
    nextBatch: "MTECH",
    isGraduated: true,
    lastIncrementedTerm: "EVEN_2027",
  });

  // Non-student accounts skipped
  const faculty = computeSemesterRollover(
    {
      accountType: "FACULTY",
      programType: "BTECH",
      currentSemester: 1,
      lastIncrementedTerm: null,
      isGraduated: false,
    },
    "ODD_2026"
  );
  assert.deepEqual(faculty, { action: "SKIP", reason: "NON_STUDENT" });
});
