import type { Request, Response, NextFunction } from "express";
import type { CorsOptionsDelegate } from "cors";

const WEAK_SECRET_PATTERNS = [
  "change-me",
  "changeme",
  "replace_with",
  "secret",
  "default",
  "example",
  "password",
  "iiitt",
  "placeholder",
  "12345678",
];

export function isWeakSessionSecret(secret: string | undefined): boolean {
  const trimmed = (secret || "").trim();
  if (trimmed.length < 32) return true;
  const lower = trimmed.toLowerCase();
  if (WEAK_SECRET_PATTERNS.some((p) => lower.includes(p))) return true;
  if (new Set(trimmed.split("")).size < 10) return true;
  return false;
}

export function validateProductionSessionSecret(): void {
  if (process.env.NODE_ENV !== "production") return;
  const configured = process.env.SESSION_SECRET?.trim();
  if (isWeakSessionSecret(configured)) {
    console.error(
      "FATAL: SESSION_SECRET must be set to a strong, high-entropy value of at least 32 characters in production."
    );
    process.exit(1);
  }
}

export function validateProductionDemoConfig(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.ENABLE_DEMO_SWITCHER === "true") {
    console.error(
      "FATAL: ENABLE_DEMO_SWITCHER must not be enabled in production."
    );
    process.exit(1);
  }
}

export function validateProductionDeployConfig(): void {
  if (process.env.NODE_ENV !== "production") return;
  const corsOrigin = (process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGIN || "").trim();
  if (!corsOrigin) {
    console.error(
      "FATAL: CORS_ORIGIN must be explicitly set in production."
    );
    process.exit(1);
  }
  const hasGoogleClient = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
  if (hasGoogleClient && !process.env.GOOGLE_REDIRECT_URI?.trim()) {
    console.error(
      "FATAL: GOOGLE_REDIRECT_URI must be explicitly set when Google OAuth is configured in production."
    );
    process.exit(1);
  }
}

export function parseTrustProxySetting(): boolean | number | string {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw) {
    return process.env.NODE_ENV === "production" ? 1 : false;
  }
  if (raw === "false" || raw === "0") return false;
  if (raw === "true") return true;
  const asNum = Number(raw);
  if (Number.isInteger(asNum) && asNum >= 0) return asNum;
  return raw;
}

/**
 * Explicit CORS policy — zero wildcard domains.
 * Allows same-origin requests, explicit CORS_ORIGIN entries, and localhost in non-production.
 */
export function buildCorsOptions(): CorsOptionsDelegate<Request> {
  const explicitOrigins = new Set(
    (process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGIN || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const isProd = process.env.NODE_ENV === "production";

  return (req, callback) => {
    const origin = req.headers.origin;
    const baseOpts = {
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Idempotency-Key",
        "X-Requested-With",
      ],
    };

    if (!origin) {
      callback(null, { ...baseOpts, origin: true });
      return;
    }

    if (explicitOrigins.has(origin)) {
      callback(null, { ...baseOpts, origin: true });
      return;
    }

    try {
      const parsed = new URL(origin);
      const reqHost = String(req.headers["x-forwarded-host"] || req.headers.host || "")
        .split(",")[0]
        .trim()
        .toLowerCase();

      if (reqHost && parsed.host.toLowerCase() === reqHost) {
        callback(null, { ...baseOpts, origin: true });
        return;
      }

      if (!isProd && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
        callback(null, { ...baseOpts, origin: true });
        return;
      }
    } catch {
      // ignore invalid URL
    }

    callback(null, { ...baseOpts, origin: false });
  };
}

interface RateBucket {
  count: number;
  resetAt: number;
}

const HIGH_BURST_ROLES = new Set([
  "SPORTS_SECRETARY",
  "FACULTY_ADVISOR",
  "AUCTION_OPERATOR",
  "MATCH_SCORER",
]);

/**
 * Campus-NAT-safe rate limiter:
 * Keys authenticated users by `uid:<id>` so 1,200 students behind campus NAT don't share one IP bucket,
 * and grants high burst limits or exemptions to live operators, scorers, and sports admins.
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  privilegedMaxRequests?: number;
  exemptPrivileged?: boolean;
  keyPrefix: string;
}) {
  const buckets = new Map<string, RateBucket>();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, Math.max(options.windowMs, 30_000));
  cleanupTimer.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const actor = req.actor;
    const isPrivileged = Boolean(
      actor && actor.roles.some((r) => HIGH_BURST_ROLES.has(r.roleCode))
    );

    if (isPrivileged && options.exemptPrivileged) {
      next();
      return;
    }

    const limit =
      isPrivileged && options.privilegedMaxRequests
        ? options.privilegedMaxRequests
        : options.maxRequests;

    const identityKey = actor
      ? `uid:${actor.id}`
      : `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;

    const key = `${options.keyPrefix}:${identityKey}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));

    if (bucket.count > limit) {
      res.status(429).json({
        error: "Too many requests. Please wait a moment and try again.",
      });
      return;
    }
    next();
  };
}

/**
 * Validate raster image or PDF buffer using magic bytes (blocks SVG/HTML masquerading).
 */
export function detectImageMimeFromBuffer(
  buf: Buffer
): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return "image/gif";
  }
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function detectAllowedUploadMime(
  buf: Buffer
): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf" | null {
  const img = detectImageMimeFromBuffer(buf);
  if (img) return img;
  if (buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  return null;
}
