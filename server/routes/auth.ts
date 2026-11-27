import crypto from "crypto";
import { Router } from "express";
import { eq, asc, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.ts";
import { users, playerProfiles, userRoles, sportsClubs } from "../db/schema.ts";
import {
  clearOAuthStateCookie,
  clearSessionCookie,
  findOrProvisionGoogleUser,
  isDemoSwitcherEnabled,
  isGoogleOAuthConfigured,
  isTestLoginEnabled,
  loadActorById,
  OAUTH_STATE_COOKIE_NAME,
  requireAuth,
  setOAuthStateCookie,
  setSessionCookie,
} from "../middleware/auth.ts";
import {
  FIXED_COLLEGE,
  defaultSemesterForBatch,
  deriveBatchFromSemester,
  maxSemesterForProgram,
} from "../../shared/academic.ts";

const router = Router();

router.get("/me", async (req, res) => {
  const demoEnabled = isDemoSwitcherEnabled();
  let demoPersonas: Array<{
    id: number;
    name: string;
    email: string;
    batch: string;
    roles: string[];
  }> = [];

  if (demoEnabled) {
    const ROLE_PRIORITY: Record<string, number> = {
      FACULTY_ADVISOR: 1,
      SPORTS_SECRETARY: 2,
      SUPER_ADMIN: 3,
      CLUB_SECRETARY: 4,
      CLUB_COORDINATOR: 5,
      MATCH_SCORER: 6,
      AUCTION_OPERATOR: 7,
      AUCTIONEER: 8,
      CAPTAIN: 9,
      EQUIPMENT_STAFF: 10,
      TOURNAMENT_MANAGER: 11,
      CLUB_MEMBER: 12,
      STUDENT: 99,
    };
    const allUsers = await db.select().from(users).orderBy(asc(users.id));
    const allRoles = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.active, true));
    demoPersonas = allUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      batch: u.batch,
      roles: Array.from(
        new Set(
          allRoles
            .filter((r) => r.userId === u.id)
            .sort((a, b) => (ROLE_PRIORITY[a.roleCode] ?? 50) - (ROLE_PRIORITY[b.roleCode] ?? 50))
            .map((r) => r.roleCode)
        )
      ),
    }));
  }

  res.json({
    user: req.actor,
    demoSwitcherEnabled: demoEnabled,
    testLoginEnabled: isTestLoginEnabled(),
    googleOAuthEnabled: isGoogleOAuthConfigured(),
    demoPersonas,
  });
});

// Flexible test login accepting any username/email + any non-empty password in demo/non-prod mode
router.post("/login", async (req, res) => {
  if (!isTestLoginEnabled()) {
    res.status(403).json({
      error: "Test username/password login is disabled in this environment.",
    });
    return;
  }

  const schema = z.object({
    username: z.string().trim().min(1, "Username or email is required.").max(160),
    password: z.string().min(1, "Password cannot be empty.").max(200),
    roleCode: z
      .enum([
        "STUDENT",
        "SPORTS_SECRETARY",
        "FACULTY_ADVISOR",
        "CLUB_SECRETARY",
        "CLUB_COORDINATOR",
        "MATCH_SCORER",
        "AUCTION_OPERATOR",
        "CAPTAIN",
      ])
      .optional(),
  });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const normalizedInput = {
    username: body.username ?? body.email ?? body.identifier ?? "",
    password: body.password ?? "",
    roleCode: body.roleCode || undefined,
  };
  const parsed = schema.safeParse(normalizedInput);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid login credentials." });
    return;
  }

  const raw = parsed.data.username.trim();
  const lower = raw.toLowerCase();
  const candidateEmails = raw.includes("@") ? [lower] : [lower, `${lower}@iiitt.ac.in`];

  const [existing] = await db
    .select()
    .from(users)
    .where(
      or(
        ...candidateEmails.map((em) => sql`lower(${users.email}) = ${em}`),
        sql`lower(coalesce(${users.rollNumber}, '')) = ${lower}`,
        sql`lower(${users.name}) = ${lower}`
      )
    )
    .limit(1);

  if (existing) {
    const actor = await loadActorById(existing.id);
    if (!actor) {
      res.status(404).json({ error: "Matched user account could not be loaded." });
      return;
    }
    setSessionCookie(res, actor.id);
    res.json({ user: actor, created: false });
    return;
  }

  const localPart = (raw.includes("@") ? lower.split("@")[0] : lower)
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/^_+|_+$/g, "") || `user_${crypto.randomBytes(3).toString("hex")}`;
  const email = raw.includes("@") ? lower : `${localPart}@iiitt.ac.in`;
  const displayName = raw.includes("@") ? raw.split("@")[0] : raw;
  const inferredRoll = /^\d{6,}$/.test(localPart)
    ? localPart
    : localPart.toUpperCase().slice(0, 16);
  const selectedRole = parsed.data.roleCode ?? "STUDENT";
  const isFaculty = selectedRole === "FACULTY_ADVISOR";
  const batchValue = isFaculty ? "FACULTY" : "2ND";
  const accountType = isFaculty ? "FACULTY" : "STUDENT";
  const qrToken = `IIITT-QR-${inferredRoll}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

  const created = await db.transaction(async (tx) => {
    const [newUser] = await tx
      .insert(users)
      .values({
        email,
        name: displayName,
        rollNumber: inferredRoll,
        batch: batchValue,
        hostel: isFaculty ? "Faculty Quarters" : "Bhavani Hostel",
        qrCodeToken: qrToken,
        accountType,
        onboardingComplete: true,
      })
      .returning();

    await tx.insert(userRoles).values({
      userId: newUser.id,
      roleCode: isFaculty ? "FACULTY_ADVISOR" : "STUDENT",
      grantedBy: newUser.id,
    });

    if (selectedRole !== "STUDENT" && !isFaculty) {
      let scopedClubId: number | null = null;
      let scopedBatch: string | null = null;
      if (selectedRole === "CLUB_SECRETARY" || selectedRole === "CLUB_COORDINATOR") {
        const [cricketClub] = await tx
          .select({ id: sportsClubs.id })
          .from(sportsClubs)
          .where(eq(sportsClubs.slug, "cricket"))
          .limit(1);
        const [fallbackClub] = cricketClub
          ? [cricketClub]
          : await tx.select({ id: sportsClubs.id }).from(sportsClubs).limit(1);
        scopedClubId = fallbackClub?.id ?? null;
        if (selectedRole === "CLUB_COORDINATOR") {
          scopedBatch = "2ND";
        }
      }

      await tx.insert(userRoles).values({
        userId: newUser.id,
        roleCode: selectedRole,
        clubId: scopedClubId,
        batchScope: scopedBatch,
        grantedBy: newUser.id,
      });
    }

    await tx.insert(playerProfiles).values({
      userId: newUser.id,
      displayName: newUser.name,
      batch: batchValue,
      branch: isFaculty ? "PED" : "CSE",
      rollNumber: inferredRoll,
      bio: `Test account (${selectedRole})`,
      visibility: "PUBLIC",
      isClaimed: true,
      preferredSports: ["cricket", "football"],
    });

    return newUser;
  });

  const actor = await loadActorById(created.id);
  setSessionCookie(res, created.id);
  res.status(201).json({ user: actor, created: true });
});

router.post("/demo-switch", async (req, res) => {
  if (!isDemoSwitcherEnabled()) {
    res.status(403).json({ error: "Demo switcher is disabled in this environment." });
    return;
  }

  const parsed = z.object({ userId: z.number().int().positive().nullable() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid demo switch payload." });
    return;
  }

  if (parsed.data.userId === null) {
    clearSessionCookie(res);
    res.json({ user: null });
    return;
  }

  const actor = await loadActorById(parsed.data.userId);
  if (!actor) {
    res.status(404).json({ error: "Persona user not found." });
    return;
  }

  setSessionCookie(res, actor.id);
  res.json({ user: actor });
});

// Optional Google OAuth2 server-side flow when GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET are set
router.get("/google", (req, res) => {
  if (!isGoogleOAuthConfigured()) {
    res.redirect("/?authError=oauth_unconfigured");
    return;
  }
  const state = crypto.randomBytes(24).toString("hex");
  setOAuthStateCookie(res, state);
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    (process.env.NODE_ENV === "production"
      ? ""
      : `${req.protocol}://${req.get("host")}/api/auth/google/callback`);
  if (!redirectUri) {
    res.redirect("/?authError=oauth_unconfigured");
    return;
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/google/callback", async (req, res) => {
  if (!isGoogleOAuthConfigured()) {
    res.redirect("/?authError=oauth_unconfigured");
    return;
  }

  const code = String(req.query.code ?? "");
  const state = String(req.query.state ?? "");
  const expectedState = req.cookies?.[OAUTH_STATE_COOKIE_NAME];
  clearOAuthStateCookie(res);

  if (!code || !state || !expectedState || state !== expectedState) {
    res.redirect("/?authError=invalid_state");
    return;
  }

  try {
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI?.trim() ||
      `${req.protocol}://${req.get("host")}/api/auth/google/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
        client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      res.redirect("/?authError=token_exchange_failed");
      return;
    }

    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      res.redirect("/?authError=token_exchange_failed");
      return;
    }

    const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!infoRes.ok) {
      res.redirect("/?authError=userinfo_failed");
      return;
    }

    const info = (await infoRes.json()) as {
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };

    if (!info.email || info.email_verified === false) {
      res.redirect("/?authError=userinfo_failed");
      return;
    }

    const actor = await findOrProvisionGoogleUser({
      email: info.email,
      name: info.name || info.email.split("@")[0],
      avatarUrl: info.picture ?? null,
    });
    if (!actor) {
      res.redirect("/?authError=domain_not_allowed");
      return;
    }

    setSessionCookie(res, actor.id);
    res.redirect("/");
  } catch {
    res.redirect("/?authError=oauth_failed");
  }
});

// Local/dev convenience sign-in; disabled in production so @iiitt.ac.in cannot be spoofed
router.post("/google", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({
      error: "Direct email sign-in is disabled in production. Use Google OAuth.",
    });
    return;
  }

  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(2).max(120),
    avatarUrl: z.string().url().optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid Google auth payload." });
    return;
  }

  const actor = await findOrProvisionGoogleUser(parsed.data);
  if (!actor) {
    res.status(403).json({
      error: "Access restricted to @iiitt.ac.in Google accounts or provisioned campus staff.",
    });
    return;
  }

  setSessionCookie(res, actor.id);
  res.json({ user: actor });
});

router.post("/onboarding", requireAuth, async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).max(120),
    rollNumber: z.string().min(2).max(32).optional().nullable(),
    batch: z.enum(["1ST", "2ND", "3RD", "4TH", "MTECH"]),
    branch: z.string().trim().min(2).max(40).default("CSE"),
    currentSemester: z.number().int().min(1).max(8).optional(),
    gender: z.enum(["BOYS", "GIRLS"]).default("BOYS"),
    hostel: z.string().max(80).optional().nullable(),
    avatarUrl: z.string().max(400).optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide valid onboarding fields (Name, Batch, Branch, and Semester)." });
    return;
  }

  const programType = parsed.data.batch === "MTECH" ? "MTECH" : "BTECH";
  const cap = maxSemesterForProgram(programType);
  const semester = parsed.data.currentSemester ?? defaultSemesterForBatch(parsed.data.batch);
  if (semester < 1 || semester > cap) {
    res.status(400).json({
      error: `${programType === "MTECH" ? "M.Tech" : "B.Tech"} semester must be between 1 and ${cap}.`,
    });
    return;
  }
  const consistentBatch = deriveBatchFromSemester(programType, semester);

  const actor = req.actor!;
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        name: parsed.data.name.trim(),
        college: FIXED_COLLEGE,
        rollNumber: parsed.data.rollNumber?.trim() || actor.rollNumber,
        batch: consistentBatch,
        programType,
        currentSemester: semester,
        isGraduated: false,
        gender: parsed.data.gender,
        hostel: parsed.data.hostel?.trim() || null,
        avatarUrl: parsed.data.avatarUrl || actor.avatarUrl,
        onboardingComplete: true,
      })
      .where(eq(users.id, actor.id));

    await tx
      .update(playerProfiles)
      .set({
        displayName: parsed.data.name.trim(),
        college: FIXED_COLLEGE,
        batch: consistentBatch,
        programType,
        currentSemester: semester,
        isGraduated: false,
        gender: parsed.data.gender,
        branch: parsed.data.branch.trim().toUpperCase(),
        rollNumber: parsed.data.rollNumber?.trim() || actor.rollNumber,
        avatarUrl: parsed.data.avatarUrl || actor.avatarUrl,
      })
      .where(eq(playerProfiles.userId, actor.id));
  });

  const updated = await loadActorById(actor.id);
  res.json({ user: updated });
});

router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

export default router;
