/**
 * Avatar determinístico de um grupo (servidor Discord) — cor por hash estável do
 * nome + inicial. Compartilhado pela rail de fontes e pelo header do painel de
 * fonte. Guilds não expõem logo na API, então usamos iniciais coloridas (mesmo
 * padrão do antigo GroupsPanel).
 *
 * Classes LITERAIS de propósito (Tailwind v4 só emite o que é estático).
 */
// Fundos vivos (tons -9/-10) para os tiles da rail — letra sempre BRANCA
// (aplicada no componente), como no Figma (P verde, O roxo, F vermelho…).
const GROUP_COLORS = [
  "bg-green-9",
  "bg-violeta-9",
  "bg-amber-10",
  "bg-vermelho-9",
  "bg-secundaria-9",
  "bg-menta-9",
  "bg-azul-9",
] as const;

/** Hash estável → índice de cor (mesmo grupo sempre com a mesma cor). Só o fundo. */
export function groupColorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return GROUP_COLORS[Math.abs(h) % GROUP_COLORS.length];
}

/** Primeira letra (maiúscula) do nome; "?" quando vazio. */
export function groupInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/**
 * Inicial do avatar de uma FONTE (canal): a PRIMEIRA LETRA do nome (maiúscula),
 * ignorando "#", emojis e separadores (ex.: "#💬｜chat" → "C"). Sem nenhuma letra,
 * cai no 1º grafema não-espaço (emoji) ou "?".
 */
export function sourceInitial(name: string): string {
  const letter = name.match(/[a-zA-Z]/);
  if (letter) return letter[0].toUpperCase();
  const cleaned = name.replace(/^[#\s]+/, "").trim();
  return Array.from(cleaned)[0] ?? "?";
}

/** Formata contagens grandes: 1423 → "1.423" (pt-BR). */
export function fmtCount(n: number): string {
  return n.toLocaleString("pt-BR");
}
