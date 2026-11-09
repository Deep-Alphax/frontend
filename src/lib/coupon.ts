import { AxiosError } from "axios";

import { getApiErrorMessage } from "@/lib/api/client";

/**
 * Cupom de PRO grátis vindo do link compartilhável (`/plans?coupon=CODE`).
 *
 * Fica no `localStorage` e não só na URL pelo mesmo motivo do `?ref=` (ver
 * `referral.ts`): `/plans` é protegida, então quem chega deslogado cai em
 * `/login?next=/plans%3Fcoupon%3DCODE` e muitas vezes ainda passa por cadastro
 * e verificação de e-mail — no caminho o `next` se perde e, com ele, o cupom.
 *
 * Não é credencial nem PII: é um código público de campanha. Guardar NÃO
 * resgata nada — o usuário ainda clica em "Redeem" na tela de planos, e quem
 * decide se vale é o servidor. Se o storage estiver bloqueado, tudo degrada
 * para "sem cupom" (o campo continua aceitando digitação).
 */

const KEY = "da_coupon";

/**
 * Mesmo formato do backend: A–Z, 0–9 e "-", de 3 a 32 caracteres. Código fora
 * disso não existe — e cortar/limpar fabricaria OUTRO código, que por azar
 * poderia existir. Então o que não casa é descartado, não consertado.
 */
const CODE_PATTERN = /^[A-Z0-9-]{3,32}$/;

/** Código normalizado (trim + maiúsculas) ou undefined se não é um código possível. */
export function normalizeCoupon(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : undefined;
}

/**
 * `coupon` da query da página OU de dentro do `next` (a URL de retorno que o
 * proxy monta ao mandar para o login: `?next=/plans?coupon=X`).
 */
function couponFromSearch(search: string): string | undefined {
  const params = new URLSearchParams(search);
  const direct = normalizeCoupon(params.get("coupon"));
  if (direct) return direct;

  const next = params.get("next");
  if (!next) return undefined;
  try {
    // Base fictícia só para o parser aceitar caminho relativo; o host é ignorado.
    return normalizeCoupon(new URL(next, "http://localhost").searchParams.get("coupon"));
  } catch {
    return undefined;
  }
}

// Avisa quem está na tela (o campo de cupom) que o código guardado mudou. O
// evento `storage` do navegador só dispara em OUTRAS abas, não nesta.
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Para `useSyncExternalStore`: reage a captura/limpeza nesta aba e em outras. */
export function subscribeCoupon(listener: () => void): () => void {
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
 * Lê o cupom da URL atual e guarda. Chamar mais de uma vez é seguro.
 *
 * Ao contrário da indicação, o ÚLTIMO link vence: o cupom não atribui venda a
 * ninguém, e o link mais recente é o que a pessoa acabou de clicar — inclusive
 * para trocar um código vencido por um novo.
 */
export function captureCouponFromUrl(search: string): void {
  const code = couponFromSearch(search);
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
export function storedCoupon(): string | undefined {
  try {
    return window.localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Descarta o código depois do resgate — ou quando o servidor diz que ele não
 * serve mais para esta conta (inexistente, vencido, esgotado, conta
 * inelegível). Sem isso, um código morto ficaria preenchido para sempre.
 */
export function clearCoupon(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nada a limpar se nem dá para ler.
    return;
  }
  notify();
}

/**
 * Respostas que dizem "este código não serve para esta conta" de forma
 * definitiva — 404 inexistente/desativado, 410 vencido/esgotado, 409 conta
 * inelegível. 429, rede e 5xx são transitórios: o código continua guardado.
 */
export function isDeadCouponError(error: unknown): boolean {
  const status = error instanceof AxiosError ? error.response?.status : undefined;
  return status === 404 || status === 409 || status === 410;
}

/**
 * Mensagem de erro das rotas de cupom (resgate e admin).
 *
 * Nos 4xx de regra (400/404/409/410) o backend já manda a `message` em inglês,
 * pronta para a tela — e ela tem precedência porque o `getApiErrorMessage`
 * genérico traduz QUALQUER 409 como "e-mail já cadastrado" (fluxo de auth).
 * O resto (429, rede, 5xx) segue o mapeamento padrão.
 */
export function couponErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (status === 400 || status === 404 || status === 409 || status === 410) {
      const body = error.response?.data as { message?: string | string[] } | undefined;
      const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
      if (typeof message === "string" && message.trim()) return message;
      return fallback;
    }
  }
  return getApiErrorMessage(error, fallback);
}
