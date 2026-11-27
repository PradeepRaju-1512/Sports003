export const FIXED_COLLEGE = "IIITT" as const;
export const FIXED_COLLEGE_FULL = "Indian Institute of Information Technology Tiruchirappalli" as const;

export type ProgramType = "BTECH" | "MTECH";
export type StudentBatch = "1ST" | "2ND" | "3RD" | "4TH" | "MTECH";
export type GenderTrack = "BOYS" | "GIRLS";
export type SplitMode = "COMBINED" | "SEPARATE_BOYS_GIRLS";

export function maxSemesterForProgram(programType: string): number {
  return programType === "MTECH" ? 4 : 8;
}

export function deriveBatchFromSemester(
  programType: ProgramType | string,
  semester: number
): StudentBatch {
  if (programType === "MTECH") return "MTECH";
  if (semester <= 2) return "1ST";
  if (semester <= 4) return "2ND";
  if (semester <= 6) return "3RD";
  return "4TH";
}

export function defaultSemesterForBatch(batch: StudentBatch | string): number {
  switch (batch) {
    case "1ST":
      return 1;
    case "2ND":
      return 3;
    case "3RD":
      return 5;
    case "4TH":
      return 7;
    case "MTECH":
      return 1;
    default:
      return 1;
  }
}

export interface RolloverStudentInput {
  accountType: string;
  programType: string;
  currentSemester: number;
  lastIncrementedTerm: string | null;
  isGraduated: boolean;
}

export type RolloverOutcome =
  | { action: "SKIP"; reason: "NON_STUDENT" | "ALREADY_ROLLED" | "ALREADY_GRADUATED" }
  | {
      action: "GRADUATE";
      nextSemester: number;
      nextBatch: StudentBatch;
      isGraduated: true;
      lastIncrementedTerm: string;
    }
  | {
      action: "ADVANCE";
      nextSemester: number;
      nextBatch: StudentBatch;
      isGraduated: false;
      lastIncrementedTerm: string;
    };

export function computeSemesterRollover(
  student: RolloverStudentInput,
  term: string
): RolloverOutcome {
  if (student.accountType !== "STUDENT") {
    return { action: "SKIP", reason: "NON_STUDENT" };
  }
  if (student.lastIncrementedTerm === term) {
    return { action: "SKIP", reason: "ALREADY_ROLLED" };
  }
  if (student.isGraduated) {
    return { action: "SKIP", reason: "ALREADY_GRADUATED" };
  }

  const prog: ProgramType = student.programType === "MTECH" ? "MTECH" : "BTECH";
  const cap = maxSemesterForProgram(prog);
  const current = Math.max(1, student.currentSemester || 1);

  if (current >= cap) {
    return {
      action: "GRADUATE",
      nextSemester: cap,
      nextBatch: deriveBatchFromSemester(prog, cap),
      isGraduated: true,
      lastIncrementedTerm: term,
    };
  }

  const nextSemester = current + 1;
  return {
    action: "ADVANCE",
    nextSemester,
    nextBatch: deriveBatchFromSemester(prog, nextSemester),
    isGraduated: false,
    lastIncrementedTerm: term,
  };
}
