import { db } from "./db";

/**
 * Creates an entry in the AuditLog database table to track user-driven changes.
 */
export async function logAudit(
  companyId: string,
  userId: string | null,
  entity: string,
  entityId: string,
  action: string,
  changes?: { before?: unknown; after?: unknown }
) {
  const oldValue = changes?.before ? JSON.stringify(changes.before) : null;
  const newValue = changes?.after ? JSON.stringify(changes.after) : null;

  try {
    return await db.auditLog.create({
      data: {
        entity,
        entityId,
        action,
        oldValue,
        newValue,
        userId,
        companyId,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
    // Return null or rethrow based on preference, but auditing failures should not crash user requests
    return null;
  }
}
