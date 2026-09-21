import { PlayIcon } from "@/components/mentorship/icons";
import { TEXT_TRIM } from "@/components/plans/textTrim";
import type { MentorshipLesson } from "@/lib/api/mentorship";
import { formatEpisode, formatRemaining } from "@/lib/mentorship/format";
import { cn } from "@/lib/cn";

/*
 * "Continue where you left off" (Figma 1011:25626).
 *
 * Card horizontal: thumbnail fixa de 372px com o anel de play, e os detalhes
 * ocupando o resto. O rodapé usa `justify-between` na coluna para a barra ficar
 * colada na base independentemente de quantas linhas a descrição tomar.
 */
export function ContinueCard({
  lesson,
  onOpen,
}: {
  lesson: MentorshipLesson & { remainingSec: number };
  onOpen?: (lesson: MentorshipLesson) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(lesson)}
      className="group flex w-full items-stretch overflow-hidden rounded-[18px] border border-gray-6 bg-gray-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-secundaria-11/60"
    >
      <div className="relative hidden h-[195px] w-[372px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-6 sm:flex">
        {lesson.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lesson.coverUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover"
          />
        ) : null}
        {/* Véu escuro: o anel de play precisa de contraste sobre qualquer arte. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,18,28,0.15)_0%,rgba(11,18,28,0.65)_100%)]"
        />
        <span className="relative flex size-16 items-center justify-center rounded-full border border-secundaria-10 bg-[rgba(16,44,67,0.9)] shadow-[0_0_12px_0_var(--color-gray-1)] transition-transform duration-200 group-hover:scale-105">
          <PlayIcon className="size-10 text-gray-12" />
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-6 self-stretch p-6">
        <div className="flex flex-col gap-4">
          <p
            className={cn(
              "text-sm font-medium leading-[1.3] text-principal-9",
              TEXT_TRIM,
            )}
          >
            {lesson.moduleTitle.toUpperCase()} · {formatEpisode(lesson.episode)}
          </p>
          <div className="flex flex-col gap-3">
            <h3
              className={cn(
                "text-xl font-semibold leading-[1.1] text-gray-12",
                TEXT_TRIM,
              )}
            >
              {lesson.title}
            </h3>
            <p
              className={cn("text-base leading-[1.3] text-gray-11", TEXT_TRIM)}
            >
              {lesson.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-6"
          >
            <div
              className="h-full rounded-full bg-principal-11"
              style={{ width: `${lesson.percent}%` }}
            />
          </div>
          <span
            className={cn(
              "shrink-0 text-base leading-[1.3] text-gray-11",
              TEXT_TRIM,
            )}
          >
            {lesson.percent}% · {formatRemaining(lesson.remainingSec)}
          </span>
        </div>
      </div>
    </button>
  );
}
