import { cn } from "@/lib/cn";

interface AvatarProps {
  /** URL da foto; ausente → cai no fallback de iniciais. */
  src?: string | null;
  /** Nome usado para iniciais e alt. */
  name: string;
  className?: string;
}

/** Deriva 1–2 iniciais a partir do nome (fallback quando não há foto). */
function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Avatar circular. Renderiza a foto do usuário quando houver `src`; senão,
 * mostra as iniciais sobre uma superfície neutra — o rosto é dado dinâmico do
 * usuário, não um asset do design.
 */
export function Avatar({ src, name, className }: AvatarProps) {
  const base = cn("size-8 shrink-0 overflow-hidden rounded-full", className);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={32}
        height={32}
        // no-referrer: se cair no fallback de URL do Google, evita bloqueio por referer.
        referrerPolicy="no-referrer"
        className={cn(base, "object-cover")}
      />
    );
  }

  return (
    <span
      aria-label={name}
      className={cn(
        base,
        "flex items-center justify-center bg-gray-6 text-xs font-semibold text-gray-12",
      )}
    >
      {initialsFromName(name)}
    </span>
  );
}
