import type { IStorage } from "./storage";
import type { InsertGherAuditLog } from "@shared/schema";

export interface AuditContext {
  storage: IStorage;
  userId: string;
  username: string;
}

export async function logGherAudit(
  context: AuditContext,
  actionType: "created" | "updated" | "deleted" | "generated_invoice" | "deleted_invoice",
  entityType: "entry" | "partner" | "tag" | "invoice" | "capital_transaction",
  entityId: string,
  entityLabel: string,
  options?: {
    before?: any;
    after?: any;
    metadata?: Record<string, any>;
  }
) {
  const changeSummary = options?.before && options?.after 
    ? JSON.stringify({
        before: options.before,
        after: options.after,
        changes: getChanges(options.before, options.after)
      })
    : undefined;

  const auditEntry: InsertGherAuditLog = {
    userId: context.userId,
    username: context.username,
    actionType,
    entityType,
    entityId,
    entityLabel,
    changeSummary,
    metadata: options?.metadata ? JSON.stringify(options.metadata) : undefined,
  };

  await context.storage.logGherAuditEntry(auditEntry);
}

function getChanges(before: any, after: any): Record<string, { from: any; to: any }> {
  const changes: Record<string, { from: any; to: any }> = {};
  
  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {})
  ]);

  allKeys.forEach(key => {
    const beforeVal = before?.[key];
    const afterVal = after?.[key];
    
    if (beforeVal instanceof Date && afterVal instanceof Date) {
      if (beforeVal.getTime() !== afterVal.getTime()) {
        changes[key] = {
          from: beforeVal.toISOString(),
          to: afterVal.toISOString()
        };
      }
    } else if (beforeVal !== afterVal) {
      changes[key] = {
        from: beforeVal,
        to: afterVal
      };
    }
  });

  return changes;
}
