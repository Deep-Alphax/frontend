/**
 * Formatação en-US para os números do dashboard. Valores monetários vêm da API
 * como string decimal (JSON-safe) — convertidos aqui só para exibição.
 *
 * O prefixo é "$" (não "US$") e o separador é o en-US: milhar com vírgula,
 * decimal com ponto.
 */

const toNumber = (value: string | number): number =>
  typeof value === "number" ? value : Number(value);

/** "$8,817" (sem centavos). */
export function formatUsd(value: string | number, fractionDigits = 0): string {
  const n = toNumber(value);
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${n < 0 ? "−" : ""}$${abs}`;
}

/** Compacto: "$214K" / "$1.2M" / "$950" (para volumes grandes). */
export function formatCompactUsd(value: string | number): string {
  const n = toNumber(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const fmt = (x: number, s: string) =>
    `${sign}$${x.toLocaleString("en-US", { maximumFractionDigits: 1 })}${s}`;
  if (abs >= 1e9) return fmt(abs / 1e9, "B");
  if (abs >= 1e6) return fmt(abs / 1e6, "M");
  if (abs >= 1e3) return fmt(abs / 1e3, "K");
  return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** "+$8,817" / "−$1,200" — com sinal explícito (para PnL). */
export function formatSignedUsd(
  value: string | number,
  fractionDigits = 0,
): string {
  const n = toNumber(value);
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}$${abs}`;
}

/** "37.4%" / "−14.7%". */
export function formatPct(value: string | number, fractionDigits = 0): string {
  const n = toNumber(value);
  return `${n.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

/** "+25.7%" / "−14.7%" — com sinal explícito. */
export function formatSignedPct(
  value: string | number,
  fractionDigits = 1,
): string {
  const n = toNumber(value);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

/** "May 9" — rótulo curto de data a partir de "YYYY-MM-DD". */
export function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
    .replace(".", "");
}

/** Sinal de um número dado como string/number (-1, 0, 1). */
export function signOf(value: string | number): -1 | 0 | 1 {
  const n = toNumber(value);
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}
