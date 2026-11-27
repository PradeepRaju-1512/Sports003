import type { Request, Response } from "express";

export type SseEventType =
  | "CONNECTED"
  | "HEARTBEAT"
  | "MATCH_EVENT"
  | "MATCH_STATUS"
  | "MATCH_CLOCK"
  | "MATCH_LINEUP"
  | "NAV_UPDATED"
  | "NOTICE_UPDATED"
  | "CLUB_ACTIVITY"
  | "NOTIFICATION"
  | "AUCTION_STAGE"
  | "AUCTION_BID"
  | "AUCTION_OUTCOME"
  | "AUCTION_UPDATED"
  | "AUCTION_PROJECTOR";

interface SseClient {
  id: number;
  res: Response;
  userId: number | null;
  ip: string;
  cleanup: () => void;
}

const MAX_SSE_PER_USER = 4;
const MAX_SSE_PER_IP = 10;

const clients = new Set<SseClient>();
let nextClientId = 1;

export function registerSseStream(req: Request, res: Response, userId: number | null) {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";

  // Enforce per-user and per-IP concurrent SSE connection caps by evicting the oldest stale stream
  if (userId !== null) {
    const userClients = Array.from(clients).filter((c) => c.userId === userId);
    while (userClients.length >= MAX_SSE_PER_USER) {
      const oldest = userClients.shift();
      if (oldest) {
        oldest.cleanup();
        try {
          oldest.res.end();
        } catch {
          // ignore
        }
      }
    }
  } else {
    const ipClients = Array.from(clients).filter((c) => c.userId === null && c.ip === ip);
    while (ipClients.length >= MAX_SSE_PER_IP) {
      const oldest = ipClients.shift();
      if (oldest) {
        oldest.cleanup();
        try {
          oldest.res.end();
        } catch {
          // ignore
        }
      }
    }
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  req.socket?.setKeepAlive?.(true);
  req.socket?.setNoDelay?.(true);
  res.flushHeaders?.();

  const heartbeat = setInterval(() => {
    try {
      res.write(`event: HEARTBEAT\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
    } catch {
      cleanup();
    }
  }, 25000);

  const client: SseClient = {
    id: nextClientId++,
    res,
    userId,
    ip,
    cleanup: () => {},
  };

  const cleanup = () => {
    clearInterval(heartbeat);
    clients.delete(client);
  };
  client.cleanup = cleanup;
  clients.add(client);

  res.write(`event: CONNECTED\ndata: ${JSON.stringify({ ok: true, ts: Date.now() })}\n\n`);

  req.on("close", cleanup);
  req.on("error", cleanup);
}

export function broadcastSse(
  eventType: SseEventType,
  payload: Record<string, unknown>,
  targetUserIds?: number[]
) {
  const data = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    if (targetUserIds && (client.userId === null || !targetUserIds.includes(client.userId))) {
      continue;
    }
    try {
      client.res.write(data);
    } catch {
      client.cleanup();
    }
  }
}

export function closeAllSseStreams() {
  for (const client of clients) {
    client.cleanup();
    try {
      client.res.end();
    } catch {
      // ignore stream close errors on shutdown
    }
  }
  clients.clear();
}
