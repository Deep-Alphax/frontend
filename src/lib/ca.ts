/**
 * Extração do contract address (CA/mint) do texto/links de uma captura — espelha
 * o `ca-extract.ts` do backend (mesmos regexes). Usado p/ mostrar o CA do token
 * analisado direto no card (ex.: Rick Bot), sem precisar abrir a mensagem.
 */

const EVM_RE = /0x[a-fA-F0-9]{40}/;
const EVM_RE_G = /0x[a-fA-F0-9]{40}/g;
const SOL_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/;

/**
 * Primeiro CA encontrado (EVM `0x…` tem prioridade; senão Solana base58). Varre
 * texto + links; `null` quando não há. Extração tolerante (heurística): pega o 1º
 * candidato, como o backend faz p/ atribuição de calls.
 */
export function extractCa(text: string | null | undefined, links: string[] = []): string | null {
  const hay = [text ?? "", ...(links ?? [])].join("\n");
  const evm = hay.match(EVM_RE);
  if (evm) return evm[0];
  // Remove hex EVM antes de varrer base58 (o hex sem 0x poderia re-casar).
  const sol = hay.replace(EVM_RE_G, " ").match(SOL_RE);
  return sol ? sol[0] : null;
}

/** Encurta o CA para exibição: "Ax3d…k9P" (mantém início e fim). */
export function shortenCa(ca: string): string {
  return ca.length > 12 ? `${ca.slice(0, 5)}…${ca.slice(-4)}` : ca;
}
