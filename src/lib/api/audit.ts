import type { UserRole } from "@/lib/api/access";
import { api } from "@/lib/api/client";

/** Tipo de evento do log de auditoria — espelha o enum do backend. */
export type AuditAction =
  | "PAGE_VIEW"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "CREATE_MANY"
  | "UPDATE_MANY"
  | "DELETE_MANY"
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT";

export const AUDIT_ACTIONS: AuditAction[] = [
  "PAGE_VIEW",
  "CREATE",
  "UPDATE",
  "DELETE",
  "CREATE_MANY",
  "UPDATE_MANY",
  "DELETE_MANY",
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
];

export interface AuditActor {
  /** `system`: webhook, cron, varredura on-chain. `anonymous`: sem sessão (ex.: login falho). */
  kind: "user" | "system" | "anonymous";
  id: string | null;
  email: string | null;
  role: UserRole | null;
}

/** Valor antigo e novo de um campo. CREATE: old=null; DELETE: new=null. */
export interface AuditChange {
  old: unknown;
  new: unknown;
}

export interface AuditLogItem {
  id: string;
  createdAt: string;
  actor: AuditActor;
  action: AuditAction;
  entity: string | null;
  entityId: string | null;
  /** Campos sensíveis chegam como "[redacted]". */
  changes: Record<string, AuditChange> | null;
  /** `{ count, where }` em *_MANY; `{ email }` em LOGIN_FAILED; `{ rows }` em *_MANY pequenos. */
  meta: Record<string, unknown> | null;
  path: string | null;
  method: string | null;
  ip: string | null;
  userAgent: string | null;
}

export interface AuditLogPage {
  items: AuditLogItem[];
  nextCursor: string | null;
}

export interface AuditLogFilters {
  action?: AuditAction;
  /** Id exato ou parte do e-mail. */
  actor?: string;
  entity?: string;
  entityId?: string;
  /** ISO. */
  from?: string;
  /** ISO. */
  to?: string;
}

/** Valor que o backend grava no lugar de campos sensíveis. */
export const REDACTED = "[redacted]";

export const AUDIT_LOGS_KEY = ["admin-audit-logs"] as const;
export const AUDIT_ENTITIES_KEY = ["admin-audit-entities"] as const;

/**
 * Registra a visualização de uma página. Só o `pathname`: a query string pode
 * carregar tokens (link de redefinir senha) e nunca deve ir para o log.
 */
export async function sendPageView(path: string): Promise<void> {
  await api.post("/api/v1/audit/page-view", { path });
}

/** Tira do filtro os campos vazios — só vai para a URL o que foi preenchido. */
function cleanFilters(filters: AuditLogFilters): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

/** GET /api/v1/admin/audit-logs — mais recentes primeiro, paginado por cursor. */
export async function getAuditLogs(
  filters: AuditLogFilters,
  cursor?: string | null,
  limit = 50,
): Promise<AuditLogPage> {
  const params: Record<string, string | number> = {
    ...cleanFilters(filters),
    limit,
  };
  if (cursor) params.cursor = cursor;
  const { data } = await api.get<AuditLogPage>("/api/v1/admin/audit-logs", {
    params,
  });
  return data;
}

/** Models auditados — opções do filtro "Entity". */
export async function getAuditEntities(): Promise<string[]> {
  const { data } = await api.get<string[]>(
    "/api/v1/admin/audit-logs/entities",
  );
  return data;
}
