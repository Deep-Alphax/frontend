import { couponErrorMessage, isDeadCouponError, normalizeCoupon } from "@/lib/coupon";

/**
 * Convite do Elixir Alpha vindo do link (`/mentorship?invite=CODE`, contrato em
 * `lib/api/access.ts`).
 *
 * Mesmo desenho do cupom (`coupon.ts`): fica no `localStorage` e não só na URL
 * porque `/mentorship` é protegida — quem chega deslogado cai em
 * `/login?next=/mentorship%3Finvite%3DCODE` e muitas vezes ainda passa por
 * cadastro e verificação de e-mail; no caminho o `next` se perde e, com ele, o
 * convite.
 *
 * Não é credencial nem PII: é um código de campanha. Guardar NÃO resgata nada —
 * o `InviteRedeemer` PERGUNTA antes (aceitar troca o cargo da conta), e quem
 * decide se vale é o servidor. Storage bloqueado = "sem convite".
 */

const KEY = "da_invite";

/**
 * Mesmo formato do cupom no backend (A–Z, 0–9 e "-", 3 a 32). O que não casa é
 * descartado, não consertado — ver `normalizeCoupon`.
 */
export function normalizeInvite(raw: string | null | undefined): string | undefined {
  return normalizeCoupon(raw);
}

/** `invite` da query da página OU de dentro do `next` do login. */
function inviteFromSearch(search: string): string | undefined {
  const params = new URLSearchParams(search);
  const direct = normalizeInvite(params.get("invite"));
  if (direct) return direct;

  const next = params.get("next");
  if (!next) return undefined;
  try {
    // Base fictícia só para o parser aceitar caminho relativo; o host é ignorado.
    return normalizeInvite(new URL(next, "http://localhost").searchParams.get("invite"));
  } catch {
    return undefined;
  }
}

// O evento `storage` do navegador só dispara em OUTRAS abas; quem está nesta
// (o `InviteRedeemer`) é avisado por aqui.
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Para `useSyncExternalStore`: reage a captura/limpeza nesta aba e em outras. */
export function subscribeInvite(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Lê o convite da URL atual e guarda. Chamar mais de uma vez é seguro; o
 * ÚLTIMO link vence (é o que a pessoa acabou de clicar).
 */
export function captureInviteFromUrl(search: string): void {
  const code = inviteFromSearch(search);
  if (!code) return;
  try {
    if (window.localStorage.getItem(KEY) === code) return;
    window.localStorage.setItem(KEY, code);
  } catch {
    // Storage bloqueado (modo privado / cookies de terceiros) — segue sem.
    return;
  }
  notify();
}

/** Código guardado, ou undefined. */
export function storedInvite(): string | undefined {
  try {
    return window.localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Descarta o código: depois de aceitar, ao recusar ("Not now") ou quando o
 * servidor diz que ele não serve mais (inexistente, vencido, esgotado, conta
 * inelegível). Sem isso a pergunta voltaria a cada página.
 */
export function clearInvite(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    return;
  }
  notify();
}

/**
 * Erro definitivo para este código nesta conta (404/409/410) — limpar. 429,
 * rede e 5xx são transitórios: o código fica para a próxima tentativa.
 */
export function isDeadInviteError(error: unknown): boolean {
  return isDeadCouponError(error);
}

/**
 * Mensagem do resgate: nos 4xx de regra vale a `message` do backend (em
 * inglês) — o `getApiErrorMessage` genérico chamaria todo 409 de "e-mail já
 * cadastrado". Mesma regra do cupom.
 */
export function inviteErrorMessage(error: unknown, fallback: string): string {
  return couponErrorMessage(error, fallback);
}
