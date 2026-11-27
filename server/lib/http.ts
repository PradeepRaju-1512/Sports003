import type { NextFunction, Request, Response, Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { idempotencyKeys } from "../db/schema.ts";

type AsyncMiddleware = (req: Request, res: Response, next: NextFunction) => unknown;

export function asyncHandler(fn: AsyncMiddleware): AsyncMiddleware {
  return (req, res, next) => {
    try {
      const maybePromise = fn(req, res, next);
      if (maybePromise && typeof (maybePromise as Promise<unknown>).catch === "function") {
        (maybePromise as Promise<unknown>).catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Wraps route handlers on an Express 4 Router so rejected promises from async handlers
 * are always forwarded to the centralized error middleware.
 */
export function wrapAsyncRouter(router: Router): Router {
  const methods = ["get", "post", "put", "patch", "delete"] as const;
  for (const method of methods) {
    const orig = router[method].bind(router) as (...args: unknown[]) => Router;
    (router as unknown as Record<string, (...args: unknown[]) => Router>)[method] = (
      path: unknown,
      ...handlers: unknown[]
    ) => {
      const wrapped = handlers.map((h) =>
        typeof h === "function" && h.length < 4 ? asyncHandler(h as AsyncMiddleware) : h
      );
      return orig(path, ...wrapped);
    };
  }
  return router;
}

export function parsePositiveIntId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function extractIdempotencyKey(req: Request): string | null {
  const headerKey = req.header("X-Idempotency-Key");
  const bodyKey =
    req.body && typeof req.body === "object"
      ? (req.body as { idempotencyKey?: unknown }).idempotencyKey
      : undefined;
  const raw = typeof headerKey === "string" && headerKey.trim()
    ? headerKey.trim()
    : typeof bodyKey === "string" && bodyKey.trim()
    ? bodyKey.trim()
    : null;
  if (!raw || raw.length < 4 || raw.length > 120) return null;
  return raw;
}

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function findIdempotencyRecord(
  tx: DbTx,
  scope: string,
  key: string
): Promise<{ statusCode: number; responseJson: Record<string, unknown> } | null> {
  const [existing] = await tx
    .select({
      statusCode: idempotencyKeys.statusCode,
      responseJson: idempotencyKeys.responseJson,
    })
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)))
    .limit(1);
  return existing ?? null;
}

export async function saveIdempotencyRecord(
  tx: DbTx,
  input: {
    scope: string;
    key: string;
    actorUserId: number | null;
    statusCode: number;
    responseJson: Record<string, unknown>;
  }
): Promise<void> {
  await tx
    .insert(idempotencyKeys)
    .values({
      scope: input.scope,
      key: input.key,
      actorUserId: input.actorUserId,
      statusCode: input.statusCode,
      responseJson: input.responseJson,
    })
    .onConflictDoNothing();
}
