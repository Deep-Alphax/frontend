import { CheckCircleIcon } from "@/components/mentorship/icons";
import { TEXT_TRIM } from "@/components/plans/textTrim";
import type { MentorshipLesson } from "@/lib/api/mentorship";
import { formatClock, formatEpisode } from "@/lib/mentorship/format";
import { cn } from "@/lib/cn";

/*
 * Card de AULA da esteira horizontal (Figma 1013:26695).
 *
 * A thumbnail carrega quatro marcas sobrepostas: episódio, duração, o traço de
 * progresso na base e o check de concluída. Todas absolutas dentro do mesmo
 * `relative` — nenhuma delas empurra o layout, então o card mantém a altura com
 * ou sem check.
 */
export function LessonCard({
  lesson,
  onOpen,
  fluid = false,
}: {
  lesson: MentorshipLesson;
  onOpen?: (lesson: MentorshipLesson) => void;
  /**
   * `false` (padrão): largura fixa de 292px, para a esteira horizontal da tela
   * de mentoria, onde os cards não podem encolher.
   * `true`: ocupa a coluna, para a grade da página do módulo — lá o container é
   * quem define a largura e o card precisa acompanhar.
   */
  fluid?: boolean;
}) {
  const episode = formatEpisode(lesson.episode);

  return (
    <button
      type="button"
      onClick={() => onOpen?.(lesson)}
      className={cn(
        "group flex flex-col gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-secundaria-11/60",
        fluid ? "w-full" : "w-[292px] shrink-0",
      )}
    >
      <div className="relative aspect-[292/160] w-full overflow-hidden rounded-lg border border-gray-6 bg-gray-3">
        {lesson.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lesson.coverUrl}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : null}

        <span className="absolute left-[7.5px] top-[7.5px] rounded-full bg-[rgba(10,11,14,0.62)] px-2 py-1 text-[10px] font-semibold text-gray-12 backdrop-blur-[2px]">
          {episode}
        </span>

        {lesson.durationSec > 0 ? (
          <span className="absolute bottom-[7.5px] right-[7.5px] rounded-full bg-[rgba(10,11,14,0.68)] px-1.5 py-0.5 text-[10px] text-gray-11">
            {formatClock(lesson.durationSec)}
          </span>
        ) : null}

        {lesson.completed ? (
          <CheckCircleIcon className="absolute right-[7.5px] top-[7.5px] size-6 text-green-11 drop-shadow-[0_0_6px_rgba(17,18,23,0.9)]" />
        ) : null}

        {lesson.percent > 0 ? (
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-[3px] bg-principal-11"
            style={{ width: `${lesson.percent}%` }}
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <h4
          className={cn(
            "line-clamp-2 text-base font-semibold leading-[1.1] text-gray-12",
            TEXT_TRIM,
          )}
        >
          {lesson.title}
        </h4>
        <p
          className={cn(
            "truncate text-xs leading-[1.3] text-gray-11",
            TEXT_TRIM,
          )}
        >
          {lesson.moduleTitle} · {episode}
        </p>
      </div>
    </button>
  );
}
