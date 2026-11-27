import { Router } from "express";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../db/index.ts";
import {
  announcements,
  matches,
  notifications,
  siteSettings,
  sports,
  teams,
  tournaments,
  users,
} from "../db/schema.ts";
import { requireAuth } from "../middleware/auth.ts";
import { canPostNotice, hasGlobalSportsAuthority } from "../middleware/rbac.ts";
import { broadcastSse } from "../lib/sse.ts";
import { recordAuditLog } from "../lib/audit.ts";
import { saveValidatedUpload, uploadMiddleware } from "../lib/storage.ts";
import { createRateLimiter } from "../lib/security.ts";
import { parsePositiveIntId } from "../lib/http.ts";
import { validateUrgentBannerWords } from "../../shared/validation.ts";

const router = Router();
const uploadLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 25,
  privilegedMaxRequests: 100,
  keyPrefix: "upload",
});

router.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, uptime: Math.round(process.uptime()), db: "connected" });
  } catch {
    res.status(503).json({ ok: false, uptime: Math.round(process.uptime()), db: "disconnected" });
  }
});

const PUBLIC_BOOTSTRAP_CACHE_TTL_MS = 750;
let publicBootstrapCache: { expiresAtMs: number; payload: Record<string, unknown> } | null = null;

export function invalidateBootstrapCache(): void {
  publicBootstrapCache = null;
}

router.get("/bootstrap", async (req, res) => {
  if (!req.actor && publicBootstrapCache && Date.now() < publicBootstrapCache.expiresAtMs) {
    res.json(publicBootstrapCache.payload);
    return;
  }

  const settingsRows = await db.select().from(siteSettings);
  const settingsMap = Object.fromEntries(settingsRows.map((s) => [s.key, s.valueJson]));

  const now = new Date();
  const activeNotices = await db
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.active, true),
        or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now))
      )
    )
    .orderBy(desc(announcements.isUrgentBanner), desc(announcements.createdAt))
    .limit(12);

  const urgentBanner = activeNotices.find((a) => a.isUrgentBanner) ?? null;
  const briefNotices = activeNotices.filter((a) => !a.isUrgentBanner).slice(0, 5);

  const liveMatches = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.status, "LIVE"));

  // "On This Day in IIITT Sports" — bounded SQL query for historical archived matches matching today's month & day
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const currentYear = now.getFullYear();

  const [exactOnThisDay] = await db
    .select({
      id: matches.id,
      roundLabel: matches.roundLabel,
      scoreSummary: matches.scoreSummary,
      resultNote: matches.resultNote,
      scheduledAt: matches.scheduledAt,
      tournamentName: tournaments.name,
      academicYear: tournaments.academicYear,
      sportName: sports.name,
      teamAId: matches.teamAId,
      teamBId: matches.teamBId,
    })
    .from(matches)
    .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .innerJoin(sports, eq(matches.sportId, sports.id))
    .where(
      and(
        eq(tournaments.status, "ARCHIVED"),
        sql`EXTRACT(MONTH FROM ${matches.scheduledAt}) = ${month}`,
        sql`EXTRACT(DAY FROM ${matches.scheduledAt}) = ${day}`,
        sql`EXTRACT(YEAR FROM ${matches.scheduledAt}) < ${currentYear}`
      )
    )
    .orderBy(desc(tournaments.academicYear))
    .limit(1);

  const onThisDayMatch =
    exactOnThisDay ??
    (
      await db
        .select({
          id: matches.id,
          roundLabel: matches.roundLabel,
          scoreSummary: matches.scoreSummary,
          resultNote: matches.resultNote,
          scheduledAt: matches.scheduledAt,
          tournamentName: tournaments.name,
          academicYear: tournaments.academicYear,
          sportName: sports.name,
          teamAId: matches.teamAId,
          teamBId: matches.teamBId,
        })
        .from(matches)
        .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
        .innerJoin(sports, eq(matches.sportId, sports.id))
        .where(eq(tournaments.status, "ARCHIVED"))
        .orderBy(desc(tournaments.academicYear))
        .limit(1)
    )[0] ??
    null;

  let unreadNotificationsCount = 0;
  if (req.actor) {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, req.actor.id), eq(notifications.isRead, false)));
    unreadNotificationsCount = countRow?.count ?? 0;
  }

  const payload = {
    settings: {
      showAuctionInNav: Boolean(settingsMap.showAuctionInNav),
      showLiveAuctionInNav: Boolean(settingsMap.showLiveAuctionInNav),
      currentTournamentId: settingsMap.currentTournamentId ?? null,
      overviewConfig: settingsMap.overviewConfig ?? {
        headline: "IIITT Sports Calendar",
        summary: "Official campus tournaments and athletics.",
        upcomingTournaments: [],
      },
    },
    urgentBanner,
    briefNotices,
    liveMatchCount: liveMatches.length,
    hasLiveMatches: liveMatches.length > 0,
    onThisDay: onThisDayMatch,
    unreadNotificationsCount,
  };

  if (!req.actor) {
    publicBootstrapCache = {
      expiresAtMs: Date.now() + PUBLIC_BOOTSTRAP_CACHE_TTL_MS,
      payload,
    };
  }

  res.json(payload);
});

router.get("/notifications", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, req.actor!.id))
    .orderBy(desc(notifications.createdAt))
    .limit(40);
  res.json({ notifications: rows });
});

router.post("/notifications/:id/read", requireAuth, async (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid notification ID." });
    return;
  }
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, req.actor!.id)));
  res.json({ ok: true });
});

router.post("/notifications/read-all", requireAuth, async (req, res) => {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.userId, req.actor!.id));
  res.json({ ok: true });
});

router.patch("/settings/overview", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can update Overview." });
    return;
  }

  const schema = z.object({
    headline: z.string().min(3).max(160),
    summary: z.string().min(3).max(500),
    upcomingTournaments: z.array(
      z.object({
        name: z.string().min(2).max(120),
        window: z.string().min(2).max(100),
        mode: z.string().min(2).max(60),
      })
    ),
    notifyEveryone: z.boolean().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid Overview update payload." });
    return;
  }

  const { notifyEveryone, ...config } = parsed.data;
  await db.transaction(async (tx) => {
    await tx
      .insert(siteSettings)
      .values({ key: "overviewConfig", valueJson: config, updatedBy: req.actor!.id })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { valueJson: config, updatedBy: req.actor!.id, updatedAt: new Date() },
      });

    if (notifyEveryone) {
      const allUsers = await tx.select({ id: users.id }).from(users);
      if (allUsers.length > 0) {
        await tx.insert(notifications).values(
          allUsers.map((u) => ({
            userId: u.id,
            title: "Sports Overview Updated",
            message: `${config.headline} — check upcoming tournament dates.`,
            linkUrl: "/overview",
          }))
        );
      }
    }

    await recordAuditLog(tx, req.actor!.id, "UPDATE_OVERVIEW", "site_settings", "overviewConfig", {
      notifyEveryone,
    });
  });

  invalidateBootstrapCache();
  if (notifyEveryone) {
    broadcastSse("NOTIFICATION", { title: "Sports Overview Updated" });
  }
  res.json({ ok: true, overviewConfig: config });
});

router.patch("/settings/nav", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can toggle navigation." });
    return;
  }

  const schema = z.object({
    showAuctionInNav: z.boolean().optional(),
    showLiveAuctionInNav: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid nav toggle payload." });
    return;
  }

  await db.transaction(async (tx) => {
    if (parsed.data.showAuctionInNav !== undefined) {
      await tx
        .insert(siteSettings)
        .values({ key: "showAuctionInNav", valueJson: parsed.data.showAuctionInNav, updatedBy: req.actor!.id })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { valueJson: parsed.data.showAuctionInNav, updatedBy: req.actor!.id, updatedAt: new Date() },
        });
    }
    if (parsed.data.showLiveAuctionInNav !== undefined) {
      await tx
        .insert(siteSettings)
        .values({ key: "showLiveAuctionInNav", valueJson: parsed.data.showLiveAuctionInNav, updatedBy: req.actor!.id })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { valueJson: parsed.data.showLiveAuctionInNav, updatedBy: req.actor!.id, updatedAt: new Date() },
        });
    }
    await recordAuditLog(tx, req.actor!.id, "UPDATE_NAV_FLAGS", "site_settings", "nav", parsed.data);
  });

  invalidateBootstrapCache();
  broadcastSse("NAV_UPDATED", parsed.data);
  res.json({ ok: true });
});

router.post("/announcements", requireAuth, async (req, res) => {
  const schema = z.object({
    title: z.string().min(2).max(160),
    body: z.string().min(2).max(1000),
    isUrgentBanner: z.boolean().default(false),
    clubId: z.number().int().positive().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    notifyEveryone: z.boolean().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid announcement payload." });
    return;
  }

  if (!canPostNotice(req.actor, parsed.data.clubId ?? null)) {
    res.status(403).json({ error: "You are not authorized to publish notices." });
    return;
  }

  if (parsed.data.isUrgentBanner) {
    if (!hasGlobalSportsAuthority(req.actor)) {
      res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can set the top alert banner." });
      return;
    }
    const wordCheck = validateUrgentBannerWords(parsed.data.title);
    if (!wordCheck.valid) {
      res.status(400).json({
        error: `Urgent top alert banner must be 1 to 5 words maximum (received ${wordCheck.wordCount}).`,
      });
      return;
    }
  }

  const created = await db.transaction(async (tx) => {
    if (parsed.data.isUrgentBanner) {
      // Deactivate previous urgent banners so only one crisp <=5-word banner displays
      await tx
        .update(announcements)
        .set({ active: false })
        .where(eq(announcements.isUrgentBanner, true));
    }

    const [row] = await tx
      .insert(announcements)
      .values({
        title: parsed.data.title.trim(),
        body: parsed.data.body.trim(),
        isUrgentBanner: parsed.data.isUrgentBanner,
        clubId: parsed.data.clubId ?? null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        active: true,
        createdBy: req.actor!.id,
      })
      .returning();

    if (parsed.data.notifyEveryone) {
      const allUsers = await tx.select({ id: users.id }).from(users);
      if (allUsers.length > 0) {
        await tx.insert(notifications).values(
          allUsers.map((u) => ({
            userId: u.id,
            title: row.title,
            message: row.body,
            linkUrl: "/",
          }))
        );
      }
    }

    await recordAuditLog(tx, req.actor!.id, "CREATE_ANNOUNCEMENT", "announcements", row.id, {
      isUrgentBanner: row.isUrgentBanner,
    });
    return row;
  });

  invalidateBootstrapCache();
  broadcastSse("NOTICE_UPDATED", { announcement: created });
  res.status(201).json({ announcement: created });
});

router.put("/urgent-banner", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can update the top alert banner." });
    return;
  }

  const schema = z.object({
    title: z.string().min(1).max(160),
    body: z.string().max(1000).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide banner text (1 to 5 words)." });
    return;
  }

  const wordCheck = validateUrgentBannerWords(parsed.data.title);
  if (!wordCheck.valid) {
    res.status(400).json({
      error: `Urgent top alert banner must be 1 to 5 words maximum (received ${wordCheck.wordCount}).`,
    });
    return;
  }

  const title = parsed.data.title.trim();
  const body = parsed.data.body?.trim() || title;

  const created = await db.transaction(async (tx) => {
    await tx
      .update(announcements)
      .set({ active: false })
      .where(eq(announcements.isUrgentBanner, true));

    const [row] = await tx
      .insert(announcements)
      .values({
        title,
        body,
        isUrgentBanner: true,
        clubId: null,
        active: true,
        createdBy: req.actor!.id,
      })
      .returning();

    await recordAuditLog(tx, req.actor!.id, "UPDATE_URGENT_BANNER", "announcements", row.id, {
      title,
    });
    return row;
  });

  invalidateBootstrapCache();
  broadcastSse("NOTICE_UPDATED", { announcement: created });
  res.json({ urgentBanner: created });
});

router.delete("/urgent-banner", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Only Sports Secretary or Faculty Advisor can clear the top alert banner." });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(announcements)
      .set({ active: false })
      .where(and(eq(announcements.isUrgentBanner, true), eq(announcements.active, true)));

    await recordAuditLog(tx, req.actor!.id, "CLEAR_URGENT_BANNER", "announcements", "urgent_banner", {});
  });

  invalidateBootstrapCache();
  broadcastSse("NOTICE_UPDATED", { clearedUrgentBanner: true });
  res.json({ ok: true, urgentBanner: null });
});

router.patch("/announcements/:id", requireAuth, async (req, res) => {
  if (!hasGlobalSportsAuthority(req.actor)) {
    res.status(403).json({ error: "Unauthorized to toggle announcements." });
    return;
  }
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid announcement ID." });
    return;
  }
  const schema = z.object({ active: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }

  const [updated] = await db
    .update(announcements)
    .set({ active: parsed.data.active })
    .where(eq(announcements.id, id))
    .returning();

  invalidateBootstrapCache();
  broadcastSse("NOTICE_UPDATED", { id, active: parsed.data.active });
  res.json({ announcement: updated });
});

router.post("/upload", requireAuth, uploadLimiter, uploadMiddleware.single("file"), async (req, res, next) => {
  if (!req.file || !req.file.buffer) {
    res.status(400).json({ error: "No file uploaded." });
    return;
  }
  try {
    const saved = await saveValidatedUpload(req.file.buffer);
    res.status(201).json({
      url: saved.url,
      mimeType: saved.mimeType,
      size: saved.size,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
