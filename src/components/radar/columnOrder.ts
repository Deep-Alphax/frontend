/**
 * Ordem das colunas do Radar, escolhida pelo usuário (drag-and-drop no header
 * de cada painel) e persistida no navegador. A rail de fontes NÃO entra aqui:
 * ela é fixa na primeira posição. Só preferência de UI — nada de PII.
 *
 * Módulo puro (sem imports/DOM fora dos guards) → testável direto.
 */

/** Colunas reordenáveis. `favorites` cobre também o painel de perfil. */
export type RadarColumnKey = "rick" | "feed" | "favorites";

export const COLUMN_ORDER_KEY = "radar:columnOrder";

/** Ordem padrão — Rick Bot · feed principal · favoritos/perfil. */
export const DEFAULT_COLUMN_ORDER: RadarColumnKey[] = ["rick", "feed", "favorites"];

const isColumnKey = (v: unknown): v is RadarColumnKey =>
  v === "rick" || v === "feed" || v === "favorites";

/**
 * Normaliza uma ordem vinda do storage: descarta chave desconhecida/duplicada e
 * completa o que faltar com a ordem padrão (tolera adicionar coluna nova depois).
 */
export function normalizeOrder(value: unknown): RadarColumnKey[] {
  const out: RadarColumnKey[] = [];
  if (Array.isArray(value)) {
    for (const k of value) if (isColumnKey(k) && !out.includes(k)) out.push(k);
  }
  for (const k of DEFAULT_COLUMN_ORDER) if (!out.includes(k)) out.push(k);
  return out;
}

/** Lê a ordem persistida (guardado p/ SSR e localStorage bloqueado). */
export function readColumnOrder(): RadarColumnKey[] {
  if (typeof window === "undefined") return DEFAULT_COLUMN_ORDER;
  try {
    const raw = window.localStorage.getItem(COLUMN_ORDER_KEY);
    return normalizeOrder(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_COLUMN_ORDER;
  }
}

/** Move `key` para a posição de `target` (sem mutar; devolve o mesmo array se nada muda). */
export function moveColumn(
  order: RadarColumnKey[],
  key: RadarColumnKey,
  target: RadarColumnKey,
): RadarColumnKey[] {
  if (key === target || !order.includes(key) || !order.includes(target)) return order;
  const next = order.filter((k) => k !== key);
  next.splice(next.indexOf(target), 0, key);
  return next;
}

/** Desloca `key` em `delta` posições (teclado ←/→); clampa nas bordas. */
export function shiftColumn(
  order: RadarColumnKey[],
  key: RadarColumnKey,
  delta: number,
): RadarColumnKey[] {
  const from = order.indexOf(key);
  if (from < 0) return order;
  const to = Math.min(order.length - 1, Math.max(0, from + delta));
  if (to === from) return order;
  const next = [...order];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}
