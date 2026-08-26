import { cn } from "@/lib/cn";

/**
 * Badges de "papel" do autor no radar (node Figma 655:19206). Cada papel usa uma
 * família de cor do design system, em tons fixos:
 *   • container → fundo `{cor}/4→3` (gradiente) + borda `{cor}/7`
 *   • texto     → `{cor}/11` (Call owner usa gradiente principal→laranja)
 *   • card      → gradiente sutil `{cor}/2 → gray/1` de fundo do card
 *
 * As classes são LITERAIS de propósito: o Tailwind v4 só emite as CSS vars
 * `--color-*` REFERENCIADAS estaticamente (mesma regra de `favoriteColors.ts`).
 * Um `var(--color-...)` inline não seria emitido.
 *
 * O código do papel vem do backend em `CapturedMessage.role`. Papéis desconhecidos
 * caem no estilo neutro (cinza) com o rótulo cru — tolerante à evolução do backend.
 */
export interface RoleSpec {
  /** Rótulo exibido no badge. */
  label: string;
  /** Classes do container do badge (fundo + borda). */
  badge: string;
  /** Classes do texto do badge (cor sólida ou gradiente com bg-clip). */
  text: string;
  /** Gradiente sutil de fundo do card p/ este papel (utility, não inline); "" = sem tint. */
  cardBg: string;
}

const ROLE_SPECS = {
  call_owner: {
    label: "Call owner",
    badge: "bg-principal-4 border-principal-8",
    text: "bg-linear-to-r from-principal-11 to-laranja-11 bg-clip-text text-transparent",
    cardBg: "bg-linear-[160deg] from-laranja-2 to-gray-1",
  },
  scan: {
    label: "Scan",
    badge: "bg-linear-to-r from-green-4 to-green-3 border-green-7",
    text: "text-green-11",
    cardBg: "bg-linear-[160deg] from-green-2 to-gray-1",
  },
  copytrader: {
    label: "Copytrader",
    badge: "bg-linear-to-r from-violeta-4 to-violeta-3 border-violeta-7",
    text: "text-violeta-11",
    cardBg: "bg-linear-[160deg] from-violeta-2 to-gray-1",
  },
  sniper: {
    label: "Sniper",
    badge: "bg-linear-to-r from-vermelho-4 to-vermelho-3 border-vermelho-7",
    text: "text-vermelho-11",
    cardBg: "bg-linear-[160deg] from-vermelho-2 to-gray-1",
  },
} as const satisfies Record<string, RoleSpec>;

export type RoleCode = keyof typeof ROLE_SPECS;

/** Aliases tolerantes (rótulo cru, camelCase, etc.) → código canônico. */
const ROLE_ALIASES: Record<string, RoleCode> = {
  callowner: "call_owner",
  scan: "scan",
  copytrader: "copytrader",
  sniper: "sniper",
};

const NEUTRAL_BADGE = "bg-gray-4 border-gray-7";
const NEUTRAL_TEXT = "text-gray-11";

/**
 * Resolve o papel para seu estilo. Normaliza (minúsculas, só letras) e mapeia por
 * alias; papel não-vazio desconhecido vira badge neutro com o rótulo cru; `null`
 * (ou string vazia) → `null` (sem badge).
 */
export function roleSpec(role: string | null | undefined): RoleSpec | null {
  if (!role) return null;
  const key = role.toLowerCase().replace(/[^a-z]/g, "");
  const code = ROLE_ALIASES[key];
  if (code) return ROLE_SPECS[code];
  return { label: role, badge: NEUTRAL_BADGE, text: NEUTRAL_TEXT, cardBg: "" };
}

/** Gradiente de fundo do card p/ o papel (utility); "" quando sem papel/tint. */
export function cardGradientFor(role: string | null | undefined): string {
  return roleSpec(role)?.cardBg ?? "";
}

/** Pílula do papel do autor ao lado do nome. `null` quando não há papel. */
export function RoleBadge({ role }: { role: string | null | undefined }) {
  const spec = roleSpec(role);
  if (!spec) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5",
        spec.badge,
      )}
    >
      <span className={cn("text-xs font-normal leading-[1.3]", spec.text)}>
        {spec.label}
      </span>
    </span>
  );
}
