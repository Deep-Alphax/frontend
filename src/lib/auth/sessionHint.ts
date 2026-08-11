/**
 * Cookie-dica de sessão (`pt_authed_client=1`, NÃO-httpOnly, setado pelo backend
 * no login/registro/OAuth). Só um sinal de "provavelmente logado" para decidir SE
 * vale consultar o perfil — NÃO é credencial (o token real segue httpOnly).
 *
 * Pura (sem imports) → testável em isolamento. O valor DEVE casar exatamente com
 * o que o backend grava (`sessionHintCookieName('client')` = "pt_authed_client",
 * valor "1"); há teste no backend garantindo esse contrato.
 */
export const SESSION_HINT_COOKIE = "pt_authed_client";

/** true quando o cookie-dica está presente com valor "1". SSR-safe (sem document → false). */
export function hasSessionHint(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((entry) => entry === `${SESSION_HINT_COOKIE}=1`);
}
