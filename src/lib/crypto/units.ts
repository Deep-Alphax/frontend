/**
 * "50.012345" → unidades inteiras do token (6 casas → 50012345n).
 *
 * Estrito de propósito: dinheiro não arredonda. Mais casas do que o token
 * suporta, sinal, expoente ou qualquer coisa fora de `123` / `123.45` lança —
 * o `parseUnits` do viem arredondaria em silêncio, e o valor exato é o que
 * identifica a cobrança no servidor.
 */
export function toBaseUnits(amount: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error(`Invalid token decimals: ${decimals}`);
  }
  const match = /^(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!match) throw new Error(`Invalid amount: "${amount}"`);
  const [, whole, frac = ""] = match;
  if (frac.length > decimals) {
    throw new Error(`Amount "${amount}" has more than ${decimals} decimals`);
  }
  return BigInt(whole + frac.padEnd(decimals, "0"));
}
