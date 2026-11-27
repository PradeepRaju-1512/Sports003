import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.ts";
import { users, userRoles, playerProfiles } from "../db/schema.ts";

export interface ScopedRole {
  id: number;
  roleCode: string;
  clubId: number | null;
  batchScope: string | null;
  tournamentId: number | null;
  auctionId: number | null;
  matchId: number | null;
}

export interface SessionActor {
  id: number;
  email: string;
  name: string;
  college: string;
  rollNumber: string | null;
  batch: string;
  programType: string;
  currentSemester: number;
  isGraduated: boolean;
  gender: string;
  hostel: string | null;
  avatarUrl: string | null;
  qrCodeToken: string;
  accountType: string;
  onboardingComplete: boolean;
  playerProfileId: number | null;
  roles: ScopedRole[];
}

declare global {
  namespace Express {
    interface Request {
      actor: SessionActor | null;
    }
  }
}

export const SESSION_COOKIE_NAME = "iiitt_session";
export const OAUTH_STATE_COOKIE_NAME = "iiitt_oauth_state";

// Ephemeral secret used strictly in non-production when SESSION_SECRET is unset
const EPHEMERAL_DEV_SECRET = crypto.randomBytes(32).toString("hex");

export function isDemoSwitcherEnabled(): boolean {
  return (
    process.env.ENABLE_DEMO_SWITCHER === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

export function isTestLoginEnabled(): boolean {
  return (
    process.env.ENABLE_DEMO_SWITCHER === "true" ||
    process.env.NODE_ENV !== "production"
  );
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is missing or weak in production.");
  }
  return configured || EPHEMERAL_DEV_SECRET;
}

export function signSessionToken(userId: number): string {
  return jwt.sign({ uid: userId }, getSessionSecret(), { expiresIn: "7d" });
}

export function setSessionCookie(res: Response, userId: number) {
  const token = signSessionToken(userId);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
}

export function setOAuthStateCookie(res: Response, state: string) {
  res.cookie(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000,
    path: "/api/auth/google",
  });
}

export function clearOAuthStateCookie(res: Response) {
  res.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: "/api/auth/google" });
}

export async function loadActorById(userId: number): Promise<SessionActor | null> {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return null;

  const activeRoles = await db
    .select({
      id: userRoles.id,
      roleCode: userRoles.roleCode,
      clubId: userRoles.clubId,
      batchScope: userRoles.batchScope,
      tournamentId: userRoles.tournamentId,
      auctionId: userRoles.auctionId,
      matchId: userRoles.matchId,
    })
    .from(userRoles)
    .where(and(eq(userRoles.userId, u.id), eq(userRoles.active, true)));

  const [profile] = await db
    .select({ id: playerProfiles.id })
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, u.id))
    .limit(1);

  return {
    id: u.id,
    email: u.email,
    name: u.name,
    college: u.college ?? "IIITT",
    rollNumber: u.rollNumber,
    batch: u.batch,
    programType: u.programType ?? "BTECH",
    currentSemester: u.currentSemester ?? 1,
    isGraduated: Boolean(u.isGraduated),
    gender: u.gender ?? "BOYS",
    hostel: u.hostel,
    avatarUrl: u.avatarUrl,
    qrCodeToken: u.qrCodeToken,
    accountType: u.accountType,
    onboardingComplete: u.onboardingComplete,
    playerProfileId: profile?.id ?? null,
    roles: activeRoles,
  };
}

export async function findOrProvisionGoogleUser(input: {
  email: string;
  name: string;
  avatarUrl?: string | null;
}): Promise<SessionActor | null> {
  const email = input.email.trim().toLowerCase();
  const isIIITT = email.endsWith("@iiitt.ac.in");

  let [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!existing && !isIIITT) {
    return null;
  }

  if (!existing) {
    const localPart = email.split("@")[0];
    const inferredRoll = /^\d{6,}$/.test(localPart) ? localPart : null;
    const qrToken = `IIITT-QR-${inferredRoll ?? crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    existing = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          email,
          name: input.name.trim() || localPart,
          rollNumber: inferredRoll,
          batch: "1ST",
          avatarUrl: input.avatarUrl ?? null,
          qrCodeToken: qrToken,
          accountType: "STUDENT",
          onboardingComplete: false,
        })
        .returning();

      await tx.insert(userRoles).values({
        userId: created.id,
        roleCode: "STUDENT",
        grantedBy: created.id,
      });

      if (inferredRoll) {
        const [unclaimed] = await tx
          .select()
          .from(playerProfiles)
          .where(eq(playerProfiles.rollNumber, inferredRoll))
          .limit(1);
        if (unclaimed && !unclaimed.userId) {
          await tx
            .update(playerProfiles)
            .set({ userId: created.id, isClaimed: true })
            .where(eq(playerProfiles.id, unclaimed.id));
          return created;
        }
      }

      await tx.insert(playerProfiles).values({
        userId: created.id,
        displayName: created.name,
        batch: created.batch,
        rollNumber: inferredRoll,
        avatarUrl: created.avatarUrl,
        visibility: "PUBLIC",
        isClaimed: true,
      });

      return created;
    });
  }

  return loadActorById(existing.id);
}

export async function attachSession(req: Request, _res: Response, next: NextFunction) {
  req.actor = null;
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (!token || typeof token !== "string") {
      return next();
    }
    const decoded = jwt.verify(token, getSessionSecret()) as { uid?: number };
    if (decoded && typeof decoded.uid === "number") {
      req.actor = await loadActorById(decoded.uid);
    }
  } catch {
    req.actor = null;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.actor) {
    res.status(401).json({ error: "Authentication required. Please sign in with your @iiitt.ac.in account." });
    return;
  }
  next();
}
