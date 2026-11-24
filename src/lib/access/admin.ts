import type { AccessInvite, UserRole } from "@/lib/api/access";

/*
 * Regras puras da tela /admin/users (cargos, lote por e-mail e convites).
 * Separadas do componente para serem testadas sem render.
 */

export const ROLE_LABEL: Record<UserRole, string> = {
  USER: "User",
  ELIXIR_ALPHA: "Elixir Alpha",
  ADMIN: "Admin",
};

/** Prefixo das listas de usuários — invalidar refaz todas as combinações de filtro. */
export const ADMIN_USERS_KEY = ["admin-users"] as const;
export const ADMIN_INVITES_KEY = ["admin-invites"] as const;

/** 4xx (ex.: 403 sem papel de admin) não melhora tentando de novo. */
export function isClientError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}

export function formatAdminDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Teto do lote — o mesmo do backend (`bulk-role`: 1–1000 e-mails). */
export const MAX_BULK_EMAILS = 1000;

/**
 * Checagem BÁSICA de e-mail: algo@algo.tld, sem espaço. Só para apontar o
 * erro de colagem cedo — quem decide se a conta existe é o servidor
 * (`notFound` no resultado).
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedEmailList {
  /** Válidos, normalizados (trim + minúsculas) e sem repetição, na ordem colada. */
  emails: string[];
  /** Entradas que não parecem e-mail (como foram coladas, sem repetição). */
  invalid: string[];
}

/** Quebra o texto colado em vírgula, ponto e vírgula, espaço ou quebra de linha. */
export function parseEmailList(text: string): ParsedEmailList {
  const emails = new Set<string>();
  const invalid = new Set<string>();
  for (const raw of text.split(/[\s,;]+/)) {
    const entry = raw.trim().toLowerCase();
    if (!entry) continue;
    if (EMAIL_PATTERN.test(entry)) emails.add(entry);
    else invalid.add(raw.trim());
  }
  return { emails: [...emails], invalid: [...invalid] };
}

/**
 * Link compartilhável do convite — `/mentorship` captura o `?invite=` (ver
 * `lib/invite.ts`). A origem pública vem do `NEXT_PUBLIC_APP_URL` (o admin pode
 * estar num host de preview); sem ela, a do navegador.
 */
export function inviteLink(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/mentorship?invite=${encodeURIComponent(code)}`;
}

export type InviteStatus = "ACTIVE" | "DISABLED" | "EXPIRED" | "EXHAUSTED";

/**
 * Status mostrado na lista — derivado, o backend não grava. Mesma ordem do
 * cupom: desativado manda sobre tudo, depois validade, depois esgotamento.
 */
export function inviteStatus(invite: AccessInvite, now: number = Date.now()): InviteStatus {
  if (!invite.active) return "DISABLED";
  if (invite.expiresAt && Date.parse(invite.expiresAt) <= now) return "EXPIRED";
  if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) return "EXHAUSTED";
  return "ACTIVE";
}
