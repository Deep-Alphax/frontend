/**
 * Extrai um endereço de carteira de um texto colado — que costuma ser uma URL de
 * explorer/ferramenta (GMGN, Solscan, Birdeye, Axiom, Solscan, Etherscan…), não o
 * endereço puro. Ex.: "https://gmgn.ai/sol/address/2fg5QD…" → "2fg5QD…".
 *
 * Estratégia (sem depender do formato da URL):
 *  - EVM: primeiro `0x` + 40 hex.
 *  - Solana: token base58 (exclui 0/O/I/l) de 32–44 chars; pega o MAIS LONGO — numa
 *    URL, os outros segmentos (host/path) são curtos, então o endereço vence.
 * Sem match → devolve o texto original (o backend valida/rejeita).
 */
export function extractWalletAddress(input: string): string {
  const s = input.trim();

  const evm = s.match(/0x[0-9a-fA-F]{40}/);
  if (evm) return evm[0];

  const sol = s.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
  if (sol && sol.length > 0) {
    return sol.reduce((a, b) => (b.length > a.length ? b : a));
  }

  return s;
}
