import { auditLogs } from "../db/schema.ts";
import { db } from "../db/index.ts";

type DbOrTx = Pick<typeof db, "insert">;

export async function recordAuditLog(
  tx: DbOrTx,
  actorUserId: number | null,
  action: string,
  entityType: string,
  entityId: string | number,
  metadataJson: Record<string, unknown> = {}
) {
  await tx.insert(auditLogs).values({
    actorUserId,
    action,
    entityType,
    entityId: String(entityId),
    metadataJson,
  });
}
