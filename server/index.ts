import "dotenv/config";
import path from "path";
import type { Socket } from "net";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { pool, verifyDatabaseConnection } from "./db/index.ts";
import { attachSession } from "./middleware/auth.ts";
import { closeAllSseStreams, registerSseStream } from "./lib/sse.ts";
import { wrapAsyncRouter } from "./lib/http.ts";
import {
  buildCorsOptions,
  createRateLimiter,
  parseTrustProxySetting,
  validateProductionDemoConfig,
  validateProductionDeployConfig,
  validateProductionSessionSecret,
} from "./lib/security.ts";
import { PLAYER_UPLOADS_DIR, UPLOADS_DIR, validateStorageConfig } from "./lib/storage.ts";
import authRoutes from "./routes/auth.ts";
import bootstrapRoutes from "./routes/bootstrap.ts";
import clubRoutes from "./routes/clubs.ts";
import roleRoutes from "./routes/roles.ts";
import tournamentRoutes from "./routes/tournaments.ts";
import matchRoutes from "./routes/matches.ts";
import archiveRoutes from "./routes/archive.ts";
import playerRoutes from "./routes/players.ts";
import auctionRoutes from "./routes/auction.ts";

// Fail fast in production if SESSION_SECRET, CORS_ORIGIN, OAuth redirect, or demo switcher config is unsafe
validateProductionSessionSecret();
validateProductionDemoConfig();
validateProductionDeployConfig();
validateStorageConfig();

const PORT = Number(process.env.PORT ?? 3000);
const isProd = process.env.NODE_ENV === "production";

async function startServer() {
  await verifyDatabaseConnection();

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", parseTrustProxySetting());

  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              fontSrc: ["'self'", "https://fonts.gstatic.com"],
              imgSrc: ["'self'", "data:", "blob:"],
              scriptSrc: ["'self'"],
            },
          }
        : false,
    })
  );

  app.use(cors(buildCorsOptions()));

  app.use(
    compression({
      filter: (req, res) => {
        if (
          req.path.endsWith("/stream") ||
          String(res.getHeader("Content-Type") ?? "").includes("text/event-stream")
        ) {
          return false;
        }
        return compression.filter(req, res);
      },
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));

  // Serve static uploads BEFORE attachSession so asset requests never hit PostgreSQL
  app.use("/uploads/players", express.static(PLAYER_UPLOADS_DIR, { maxAge: "7d" }));
  app.use("/uploads", express.static(UPLOADS_DIR, { maxAge: "7d" }));

  // Scope session loading strictly to /api routes
  app.use("/api", attachSession);

  // Campus-NAT-safe rate limiters (keyed by uid:<id> when signed in, req.ip when anonymous)
  const authLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 30,
    keyPrefix: "auth",
  });
  const writeLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 180,
    exemptPrivileged: true,
    keyPrefix: "write",
  });

  app.use("/api", (req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      writeLimiter(req, res, next);
      return;
    }
    next();
  });

  // SSE Real-time Delta Stream
  app.get("/api/stream", (req, res) => {
    registerSseStream(req, res, req.actor?.id ?? null);
  });

  // API Routes (wrapped for Express 4 async rejection safety)
  app.use("/api/auth", authLimiter, wrapAsyncRouter(authRoutes));
  app.use("/api", wrapAsyncRouter(bootstrapRoutes));
  app.use("/api/clubs", wrapAsyncRouter(clubRoutes));
  app.use("/api/roles", wrapAsyncRouter(roleRoutes));
  app.use("/api/tournaments", wrapAsyncRouter(tournamentRoutes));
  app.use("/api/matches", wrapAsyncRouter(matchRoutes));
  app.use("/api/archive", wrapAsyncRouter(archiveRoutes));
  app.use("/api/players", wrapAsyncRouter(playerRoutes));
  app.use("/api/auction", wrapAsyncRouter(auctionRoutes));

  // Clean API error handler (maps DB constraint/syntax & Multer errors and never leaks raw stack traces)
  app.use("/api", (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[API ERROR]", err);
    if (res.headersSent) return;

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "File exceeds 2 MB limit." });
        return;
      }
      res.status(400).json({ error: err.message || "Invalid file upload." });
      return;
    }

    const e = err as { status?: number; code?: string; type?: string; message?: string };
    if (e?.type === "entity.parse.failed") {
      res.status(400).json({ error: "Malformed JSON request body." });
      return;
    }
    if (e?.code === "23505") {
      res.status(409).json({ error: "Duplicate or conflicting record." });
      return;
    }
    if (e?.code === "22P02" || e?.code === "23503" || e?.code === "23502") {
      res.status(400).json({ error: "Invalid identifier or reference in request." });
      return;
    }

    const status = typeof e?.status === "number" && e.status >= 400 && e.status < 600 ? e.status : 500;
    const message =
      status < 500 && err instanceof Error && err.message
        ? err.message
        : "An internal server error occurred.";
    res.status(status).json({ error: message });
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPublic = path.resolve(process.cwd(), "dist/public");
    app.use(
      express.static(distPublic, {
        maxAge: "7d",
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      })
    );
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPublic, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] IIITT Sports Platform listening on http://0.0.0.0:${PORT} (${isProd ? "production" : "development"})`);
  });

  const activeSockets = new Set<Socket>();
  server.on("connection", (socket: Socket) => {
    activeSockets.add(socket);
    socket.on("close", () => activeSockets.delete(socket));
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[SERVER] Received ${signal}. Closing SSE streams, HTTP server, and PostgreSQL pool...`);
    closeAllSseStreams();
    server.closeIdleConnections?.();
    for (const sock of activeSockets) {
      sock.destroy();
    }
    activeSockets.clear();
    server.close(async () => {
      try {
        await pool.end();
      } catch (err) {
        console.error("[SHUTDOWN] Error closing PostgreSQL pool:", err);
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  console.error("[BOOT ERROR]", err);
  process.exit(1);
});
