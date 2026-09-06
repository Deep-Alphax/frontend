import type { MentorshipAccent } from "@/lib/api/mentorship";

/*
 * Formatação da mentoria. O backend manda SEGUNDOS; os três formatos que a tela
 * usa ("14:20", "75min", "6min left") saem todos daqui, para que o mesmo número
 * nunca apareça arredondado de dois jeitos em cards vizinhos.
 */

/** `860` → `"14:20"`. Badge de duração sobre a thumbnail. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/**
 * Inverso de `formatClock`, para o campo de duração do admin. Aceita `"14:20"`,
 * `"1:02:30"` e também `"860"` (segundos crus).
 *
 * Devolve `null` quando não dá para ler — quem chama decide se isso é erro de
 * formulário ou campo em branco. Nunca chuta 0: um zero silencioso viraria uma
 * aula "sem duração" e a barra de progresso pararia de funcionar sem aviso.
 */
export function parseClock(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  const parts = raw.split(":");
  if (parts.length > 3) return null;
  if (parts.some((p) => !/^\d+$/.test(p.trim()))) return null;

  const numbers = parts.map((p) => Number(p));
  // Só o primeiro campo pode passar de 59 ("90:00" = 90 minutos é escrita válida).
  if (numbers.slice(1).some((n) => n > 59)) return null;

  return numbers.reduce((total, n) => total * 60 + n, 0);
}

/**
 * Duração total de uma trilha na faixa do card: `4500` → `"75min"`;
 * `7200` → `"2h"`; `9000` → `"2h 30min"`.
 *
 * O corte é em DUAS horas, não em uma: o Figma escreve "75min" na faixa, e
 * quebrar em "1h 15min" logo aos 60 minutos contrariaria o design na faixa mais
 * comum. Acima de 120 minutos o número em minutos deixa de ser legível.
 */
const HOURS_THRESHOLD_MIN = 120;

export function formatDurationShort(totalSeconds: number): string {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  if (minutes < HOURS_THRESHOLD_MIN) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

/**
 * O "6min left" do card de continuar. Arredonda para CIMA: dizer "0min left"
 * com 40 segundos restantes seria mentira, e "1min" descreve melhor a espera.
 */
export function formatRemaining(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return "done";
  const minutes = Math.ceil(remainingSeconds / 60);
  if (minutes < 60) return `${minutes}min left`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h left` : `${hours}h ${rest}min left`;
}

/** `6` de `23` → `"6 of 23 completed"`. */
export function formatCompleted(completed: number, total: number): string {
  return `${completed} of ${total} completed`;
}

/** `"EP 04"` — dois dígitos, como no badge do Figma. */
export function formatEpisode(episode: number): string {
  return `EP ${String(Math.max(0, episode)).padStart(2, "0")}`;
}

/**
 * Classes Tailwind do acento de uma trilha.
 *
 * O gradiente `10 → 12` é o mesmo do Figma; o que muda é a paleta, porque o app
 * é dark e o arquivo de design guarda a variante clara nos fallbacks. Mapa
 * literal (e não `` `from-${x}-10` ``) porque o Tailwind varre o código por
 * strings estáticas — classe montada em runtime não é gerada no CSS.
 */
const ACCENT_CLASSES: Record<MentorshipAccent, { fill: string; text: string }> = {
  PRINCIPAL: { fill: "from-principal-10 to-principal-12", text: "text-principal-11" },
  GREEN: { fill: "from-green-10 to-green-12", text: "text-green-11" },
  AZUL: { fill: "from-azul-10 to-azul-12", text: "text-azul-11" },
  VIOLETA: { fill: "from-violeta-10 to-violeta-12", text: "text-violeta-11" },
};

export function accentFill(accent: MentorshipAccent): string {
  return ACCENT_CLASSES[accent]?.fill ?? ACCENT_CLASSES.PRINCIPAL.fill;
}

/**
 * Cor do texto de porcentagem. Em 0% cai para `gray-11`: pintar "0% complete"
 * com a cor de progresso sugere avanço onde não há — é o que o Figma faz no
 * quarto card.
 */
export function accentText(accent: MentorshipAccent, percent: number): string {
  if (percent <= 0) return "text-gray-11";
  return ACCENT_CLASSES[accent]?.text ?? ACCENT_CLASSES.PRINCIPAL.text;
}
