import "server-only";
import { db } from "@/db";
import { activityLog } from "@/db/schema";
import { auth } from "@/lib/auth";

export type ActivityAction =
  | "create" | "update" | "delete"
  | "login" | "logout" | "view" | "export" | "send" | "pay";

export type Change = { field: string; before: unknown; after: unknown };

type AnyRecord = Record<string, unknown>;

// Resolve the acting user from the session (works inside server actions & route handlers).
export async function getActor() {
  try {
    const s = await auth();
    if (s?.user) {
      const id = (s.user as { id?: string }).id;
      return {
        userId: id ? Number(id) : null,
        userName: s.user.name ?? null,
        userEmail: s.user.email ?? null,
      };
    }
  } catch { /* no session available */ }
  return { userId: null, userName: null, userEmail: null };
}

// Field-level diff. Compares `after` values against `before`; only changed fields are returned.
export function diffRecords(
  before: AnyRecord | null | undefined,
  after: AnyRecord,
  fields?: string[],
): Change[] {
  const changes: Change[] = [];
  const keys = fields ?? Object.keys(after);
  for (const k of keys) {
    if (!(k in after)) continue;
    const a = after[k];
    if (a === undefined) continue;
    const b = before ? before[k] : undefined;
    const norm = (v: unknown) => (v === null || v === undefined ? "" : String(v));
    if (norm(b) !== norm(a)) changes.push({ field: k, before: b ?? null, after: a ?? null });
  }
  return changes;
}

// Central logger. Never throws — auditing must not break a mutation.
export async function logActivity(params: {
  action: ActivityAction;
  entity: string;
  entityId?: number | string | null;
  entityLabel?: string | null;
  changes?: Change[] | null;
  meta?: AnyRecord | null;
  actor?: { userId: number | null; userName: string | null; userEmail: string | null };
}) {
  try {
    const actor = params.actor ?? (await getActor());
    await db.insert(activityLog).values({
      userId: actor.userId,
      userName: actor.userName,
      userEmail: actor.userEmail,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId != null ? String(params.entityId) : null,
      entityLabel: params.entityLabel ?? null,
      changes: params.changes && params.changes.length ? JSON.stringify(params.changes) : null,
      meta: params.meta ? JSON.stringify(params.meta) : null,
    });
  } catch (e) {
    console.error("[activity] failed to log", e);
  }
}
