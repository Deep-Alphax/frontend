/*
 * Erros de carteira → texto para o usuário. Cada carteira/lib embrulha o erro
 * do jeito dela (viem `BaseError` com `cause`, adapter Solana com `error`,
 * EIP-1193 com `code`), então a busca percorre a cadeia inteira.
 */

type ErrorLike = {
  name?: unknown;
  code?: unknown;
  message?: unknown;
  shortMessage?: unknown;
  cause?: unknown;
  error?: unknown;
};

function chain(err: unknown): ErrorLike[] {
  const out: ErrorLike[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 8 && cur && typeof cur === "object"; i++) {
    const e = cur as ErrorLike;
    out.push(e);
    cur = e.cause ?? e.error;
  }
  return out;
}

/** O usuário recusou na carteira (EIP-1193 4001, "User rejected", etc.). */
export function isUserRejection(err: unknown): boolean {
  return chain(err).some(
    (e) =>
      e.code === 4001 ||
      e.code === "ACTION_REJECTED" ||
      (typeof e.name === "string" && /UserRejected/i.test(e.name)) ||
      (typeof e.message === "string" &&
        /user (rejected|denied|cancel)|rejected the request|request rejected/i.test(
          e.message,
        )),
  );
}

/** Mensagem curta do erro da carteira, sem stack nem dump de parâmetros. */
export function walletErrorMessage(err: unknown): string {
  if (isUserRejection(err)) return "You cancelled the request in your wallet.";
  for (const e of chain(err)) {
    const msg =
      typeof e.shortMessage === "string"
        ? e.shortMessage
        : typeof e.message === "string"
          ? e.message
          : "";
    // Primeira linha só: o viem anexa detalhes técnicos nas seguintes.
    const line = msg.split("\n")[0].trim();
    if (line) return `Your wallet could not complete this: ${line.slice(0, 160)}`;
  }
  return "Your wallet could not complete this. Please try again.";
}
