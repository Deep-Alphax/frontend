import { api } from "@/lib/api/client";

/*
 * Cargo "Elixir Alpha" (decisão 2026-11-24).
 *
 * Elixir Alpha é um PAPEL (`User.role = ELIXIR_ALPHA`), não um plano: dá acesso
 * à Mentoria e às telas que não custam nada para nós (Planos, Afiliados, índice
 * e ranking de KOLs). Tudo que gera custo (Radar, grupos, Tracker, Copy Trade,
 * carteiras do perfil, alertas) fica bloqueado. Se o usuário assinar o PRO (ou
 * resgatar cupom), o PRO libera tudo — o cargo só restringe enquanto ele é FREE.
 *
 * A Mentoria passa a ser de PRO + Elixir Alpha (+ ADMIN, que conta como PRO).
 * FREE comum recebe 403 `PLAN_REQUIRED` nas rotas da mentoria.
 *
 * Contrato escrito ANTES do back e do front: os dois lados seguem estes tipos.
 * Todas as rotas respondem com o corpo INTACTO (`@RawResponse`).
 */

export type UserRole = "USER" | "ELIXIR_ALPHA" | "ADMIN";

// ─── Acesso do usuário logado ───────────────────────────────────────────────

/**
 * Vem em `GET /api/v1/billing/me` → `{ plan, billing, access }`.
 *
 *  - `restricted`: true quando role = ELIXIR_ALPHA e plano efetivo = FREE. O
 *    backend responde 403 `ACCESS_RESTRICTED` em toda rota fora da allowlist.
 *  - `mentorship`: true para PRO, ADMIN e ELIXIR_ALPHA.
 */
export interface MyAccess {
  role: UserRole;
  restricted: boolean;
  mentorship: boolean;
}

/**
 * Corpo do 403 que o backend manda quando um usuário restrito chama uma rota
 * que custa (`JwtAuthGuard`):
 *   `{ code: "ACCESS_RESTRICTED", message: "This feature isn't included in your access." }`
 */
export const ACCESS_RESTRICTED = "ACCESS_RESTRICTED" as const;

// ─── Convite (link) ─────────────────────────────────────────────────────────

/**
 * Link de convite: `${APP_URL}/mentorship?invite=CODE`. O front captura o
 * `?invite=` (inclusive de dentro do `?next=` do login), guarda no
 * localStorage e, já logado, PERGUNTA antes de resgatar (aceitar o convite
 * troca o cargo; nunca resgatar sozinho).
 *
 * Código: A–Z, 0–9 e "-", 3 a 32 caracteres (mesmo formato do cupom);
 * normalizado no servidor (trim + maiúsculas).
 */
export interface InviteRedemptionResult {
  role: UserRole;
  /** false quando a conta já era ELIXIR_ALPHA (nada mudou, uso não contado). */
  changed: boolean;
}

/**
 * POST /api/v1/access/invites/redeem — aceita o convite para o usuário logado.
 * Limite: 5 por minuto (429).
 *
 * Erros (`message` em inglês, pronta para a tela):
 *  - 404 código inexistente ou desativado;
 *  - 410 convite vencido ou esgotado;
 *  - 409 conta não elegível (ADMIN).
 */
export async function redeemInvite(code: string): Promise<InviteRedemptionResult> {
  const { data } = await api.post<InviteRedemptionResult>(
    "/api/v1/access/invites/redeem",
    { code },
  );
  return data;
}

// ─── Admin · usuários ───────────────────────────────────────────────────────

export interface AdminUserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  /** Plano efetivo agora (ADMIN = PRO). */
  plan: "FREE" | "PRO";
  /** ISO. */
  createdAt: string;
  /** ISO ou null. */
  lastLoginAt: string | null;
}

export interface AdminUserPage {
  items: AdminUserRow[];
  /** Passar em `cursor` para a próxima página; null = acabou. */
  nextCursor: string | null;
}

/**
 * GET /api/v1/users/admin?search=&role=&cursor=&limit= — usuários, mais
 * recentes primeiro. `search` casa e-mail ou nome (contém, sem caixa).
 * `limit` 1–100 (padrão 25). Contas excluídas não aparecem.
 */
export async function listAdminUsers(params: {
  search?: string;
  role?: UserRole;
  cursor?: string;
  limit?: number;
}): Promise<AdminUserPage> {
  const { data } = await api.get<AdminUserPage>("/api/v1/users/admin", { params });
  return data;
}

/**
 * PATCH /api/v1/users/admin/:id/role — troca o cargo de um usuário.
 * 400 ao tentar mudar o PRÓPRIO cargo; 404 usuário inexistente.
 */
export async function setAdminUserRole(id: string, role: UserRole): Promise<AdminUserRow> {
  const { data } = await api.patch<AdminUserRow>(`/api/v1/users/admin/${id}/role`, { role });
  return data;
}

export interface BulkRoleResult {
  /** E-mails cujo cargo mudou. */
  updated: string[];
  /** Já tinham o cargo pedido. */
  unchanged: string[];
  /** ADMIN nunca é rebaixado em lote. */
  skippedAdmins: string[];
  /** Sem conta com esse e-mail. */
  notFound: string[];
}

/**
 * POST /api/v1/users/admin/bulk-role — aplica um cargo a vários e-mails.
 * `emails`: 1–1000 (o front deduplica e normaliza para minúsculas).
 * `role`: só USER ou ELIXIR_ALPHA (ADMIN em lote é recusado com 400).
 */
export async function bulkSetRole(
  emails: string[],
  role: Exclude<UserRole, "ADMIN">,
): Promise<BulkRoleResult> {
  const { data } = await api.post<BulkRoleResult>("/api/v1/users/admin/bulk-role", {
    emails,
    role,
  });
  return data;
}

// ─── Admin · convites ───────────────────────────────────────────────────────

export interface AccessInvite {
  id: string;
  code: string;
  role: "ELIXIR_ALPHA";
  /** null = sem teto. */
  maxUses: number | null;
  usedCount: number;
  /** ISO ou null. */
  expiresAt: string | null;
  active: boolean;
  note: string | null;
  /** ISO. */
  createdAt: string;
}

/** GET /api/v1/access/invites/admin — mais recentes primeiro. */
export async function listInvites(): Promise<AccessInvite[]> {
  const { data } = await api.get<AccessInvite[]>("/api/v1/access/invites/admin");
  return data;
}

export interface CreateInviteInput {
  /** Opcional: sem código, o servidor gera um aleatório (ex.: ELIXIR-7KQ2M9XA). */
  code?: string;
  /** 1–100000 ou null (sem teto). */
  maxUses?: number | null;
  /** ISO futuro ou null. */
  expiresAt?: string | null;
  /** Até 200 caracteres. */
  note?: string | null;
}

/** POST /api/v1/access/invites/admin — 409 se o código já existe. */
export async function createInvite(input: CreateInviteInput): Promise<AccessInvite> {
  const { data } = await api.post<AccessInvite>("/api/v1/access/invites/admin", input);
  return data;
}

export type UpdateInviteInput = Partial<Pick<AccessInvite, "active" | "maxUses" | "expiresAt" | "note">>;

/** PATCH /api/v1/access/invites/admin/:id — 404 se não existe. */
export async function updateInvite(id: string, input: UpdateInviteInput): Promise<AccessInvite> {
  const { data } = await api.patch<AccessInvite>(`/api/v1/access/invites/admin/${id}`, input);
  return data;
}
