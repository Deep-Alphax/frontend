/**
 * Formatação pt-BR para os números do dashboard. Valores monetários vêm da API
 * como string decimal (JSON-safe) — convertidos aqui só para exibição.
 */

const toNumber = (value: string | number): number =>
  typeof value === "number" ? value : Number(value);

/** "US$ 8.817" (sem centavos, separador de milhar pt-BR). */
export function formatUsd(value: string | number, fractionDigits = 0): string {
  const n = toNumber(value);
  const abs = Math.abs(n).toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${n < 0 ? "−" : ""}US$ ${abs}`;
}

/** Compacto: "US$ 214K" / "US$ 1,2M" / "US$ 950" (para volumes grandes). */
export function formatCompactUsd(value: string | number): string {
  const n = toNumber(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const fmt = (x: number, s: string) =>
    `${sign}US$ ${x.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${s}`;
  if (abs >= 1e9) return fmt(abs / 1e9, "B");
  if (abs >= 1e6) return fmt(abs / 1e6, "M");
  if (abs >= 1e3) return fmt(abs / 1e3, "K");
  return `${sign}US$ ${abs.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

/** "+US$ 8.817" / "−US$ 1.200" — com sinal explícito (para PnL). */
export function formatSignedUsd(value: string | number, fractionDigits = 0): string {
  const n = toNumber(value);
  const abs = Math.abs(n).toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}US$ ${abs}`;
}

/** "37,4%" / "−14,7%". */
export function formatPct(value: string | number, fractionDigits = 0): string {
  const n = toNumber(value);
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

/** "+25,7%" / "−14,7%" — com sinal explícito. */
export function formatSignedPct(value: string | number, fractionDigits = 1): string {
  const n = toNumber(value);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

/** "9 mai" — rótulo curto de data a partir de "YYYY-MM-DD". */
export function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date
    .toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" })
    .replace(".", "");
}

/** Sinal de um número dado como string/number (-1, 0, 1). */
export function signOf(value: string | number): -1 | 0 | 1 {
  const n = toNumber(value);
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}
