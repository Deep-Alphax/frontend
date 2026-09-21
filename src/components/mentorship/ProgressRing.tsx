import { accentText } from "@/lib/mentorship/format";
import type { MentorshipAccent } from "@/lib/api/mentorship";
import { TEXT_TRIM } from "@/components/plans/textTrim";
import { cn } from "@/lib/cn";

/*
 * Anel de progresso do topo da página do módulo (Figma 1036:23849).
 *
 * SVG calculado, não asset exportado: o arco depende do percentual, então uma
 * imagem só serviria para um valor. O trilho é um círculo completo e o arco é o
 * MESMO círculo com `strokeDasharray` cortado — os dois compartilham raio e
 * espessura, então não há como desalinharem.
 *
 * `rotate(-90)` põe o zero às 12h (o padrão do SVG é às 3h).
 */
const STROKE = 4;

export function ProgressRing({
  percent,
  accent,
  size = 64,
  className,
}: {
  percent: number;
  accent: MentorshipAccent;
  /** 64px na capa do módulo, 56px na barra lateral da aula. */
  size?: number;
  className?: string;
}) {
  const SIZE = size;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  // O servidor já manda 0–100, mas o clamp é barato e evita um arco maior que a
  // volta (ou negativo) caso o valor chegue torto de um cache antigo.
  const safe = Math.min(100, Math.max(0, Math.round(percent)));
  const dash = (safe / 100) * CIRCUMFERENCE;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: SIZE, height: SIZE }}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={cn("-rotate-90", accentText(accent, safe))}
        aria-hidden="true"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-gray-6"
        />
        {safe > 0 ? (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
            className="stroke-current transition-[stroke-dasharray] duration-500"
          />
        ) : null}
      </svg>

      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-semibold leading-[1.1] text-gray-12",
          // Anel menor não comporta 16px sem encostar no traço.
          SIZE >= 64 ? "text-base" : "text-sm",
          TEXT_TRIM,
        )}
      >
        {safe}%
      </span>
    </div>
  );
}
