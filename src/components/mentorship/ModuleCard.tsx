import { TEXT_TRIM } from "@/components/plans/textTrim";
import type { MentorshipModule } from "@/lib/api/mentorship";
import { accentFill, accentText, formatDurationShort } from "@/lib/mentorship/format";
import { cn } from "@/lib/cn";

/*
 * Card de TRILHA da grade "Tracks and modules" (Figma 1011:26369).
 *
 * Três faixas: rótulo, arte quadrada e corpo com a barra de progresso. A arte é
 * quadrada porque no Figma ela mede 309,5×309,5 — a mesma medida da largura do
 * card —, então `aspect-square` a acompanha em qualquer largura de coluna.
 */
export function ModuleCard({ module: m }: { module: MentorshipModule }) {
  const lessons = `${m.lessonCount} ${m.lessonCount === 1 ? "lesson" : "lessons"}`;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-gray-6 bg-gray-2">
      <header className="flex items-end justify-between px-4 py-3 text-sm leading-[1.3]">
        <span className={cn("font-medium text-gray-12", TEXT_TRIM)}>
          {m.label || m.title}
        </span>
        <span className={cn("text-gray-11", TEXT_TRIM)}>
          {lessons} · {formatDurationShort(m.totalDurationSec)}
        </span>
      </header>

      <div className="relative aspect-square w-full overflow-hidden bg-gray-3">
        {m.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.coverUrl}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="size-full object-cover"
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-4 p-4">
        <h3 className={cn("text-base font-semibold leading-[1.1] text-gray-12", TEXT_TRIM)}>
          {m.title}
        </h3>

        <div className="flex flex-col gap-3">
          {/* `aria-hidden` na barra: o texto logo abaixo já anuncia o mesmo valor. */}
          <div
            aria-hidden="true"
            className="h-1.5 w-full overflow-hidden rounded-sm bg-gray-6"
          >
            <div
              className={cn("h-full rounded-full bg-gradient-to-r", accentFill(m.accent))}
              style={{ width: `${m.percent}%` }}
            />
          </div>
          <p
            className={cn(
              "text-sm font-semibold leading-[1.1]",
              accentText(m.accent, m.percent),
              TEXT_TRIM,
            )}
          >
            {m.percent === 100
              ? "100% track complete"
              : `${m.percent}% complete`}
          </p>
        </div>
      </div>
    </article>
  );
}
