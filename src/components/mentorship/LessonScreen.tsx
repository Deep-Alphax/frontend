"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { Footer } from "@/components/home/Footer";
import { Topbar } from "@/components/home/Topbar";
import toast from "react-hot-toast";

import { CompletionModal } from "@/components/mentorship/CompletionModal";
import { LessonPlayer } from "@/components/mentorship/LessonPlayer";
import { MaterialCard } from "@/components/mentorship/MaterialCard";
import { ProgressRing } from "@/components/mentorship/ProgressRing";
import { CheckCircleIcon } from "@/components/mentorship/icons";
import { TEXT_TRIM } from "@/components/plans/textTrim";
import {
  getMentorshipOverview,
  MENTORSHIP_OVERVIEW_KEY,
  saveLessonProgress,
  type MentorshipLesson,
  type MentorshipModule,
  type MentorshipOverview,
} from "@/lib/api/mentorship";
import { formatClock, formatEpisode } from "@/lib/mentorship/format";
import { toVideoEmbed } from "@/lib/mentorship/video";
import { cn } from "@/lib/cn";

/*
 * Tela do EPISÓDIO (Figma 1039:25421) + modal de conclusão (1044:26434).
 *
 * Duas colunas: player/descrição/materiais à esquerda, progresso e próximos
 * episódios à direita. Como as outras telas da mentoria, lê o overview inteiro
 * pela MESMA `queryKey` — chegar aqui por um card não dispara request novo, e
 * o "próximos episódios" atravessa módulos porque a lista completa já está em
 * mãos.
 */
export function LessonScreen({
  slug,
  lessonId,
}: {
  slug: string;
  lessonId: string;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: MENTORSHIP_OVERVIEW_KEY,
    queryFn: getMentorshipOverview,
  });

  const found = useMemo(() => {
    if (!data) return null;
    const currentModule = data.modules.find((m) => m.slug === slug);
    const lesson = currentModule?.lessons.find((l) => l.id === lessonId);
    return currentModule && lesson ? { currentModule, lesson } : null;
  }, [data, slug, lessonId]);

  return (
    <div className="flex min-h-dvh flex-col bg-gray-1">
      <Topbar />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-6 pb-[92px] pt-8 md:px-12 lg:px-20">
          {isLoading ? <LessonSkeleton /> : null}

          {isError ? (
            <p className="text-base text-gray-11">
              We could not load this lesson. Refresh the page to try again.
            </p>
          ) : null}

          {data && !found ? (
            <div className="flex flex-col items-start gap-4">
              <h1
                className={cn(
                  "text-2xl font-semibold leading-[1.1] text-gray-12",
                  TEXT_TRIM,
                )}
              >
                Lesson not found
              </h1>
              <p className="text-base text-gray-11">
                It may have been unpublished, or the link is out of date.
              </p>
              <Link
                href={`/mentorship/${slug}`}
                className="text-base font-semibold text-principal-11 underline-offset-4 hover:underline"
              >
                Back to the module
              </Link>
            </div>
          ) : null}

          {data && found ? (
            <LessonWorkspace
              overview={data}
              currentModule={found.currentModule}
              lesson={found.lesson}
            />
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function LessonWorkspace({
  overview,
  currentModule: m,
  lesson,
}: {
  overview: MentorshipOverview;
  currentModule: MentorshipModule;
  lesson: MentorshipLesson;
}) {
  const queryClient = useQueryClient();
  const [celebration, setCelebration] = useState<{
    scope: "module" | "course";
    name: string;
    href: string;
    label: string;
  } | null>(null);

  const embed = toVideoEmbed(lesson.videoUrl);
  const episode = formatEpisode(lesson.episode);

  /** Ordem real do curso: todas as aulas de todos os módulos, achatadas. */
  const flat = useMemo(
    () =>
      overview.modules.flatMap((mod) =>
        mod.lessons.map((l) => ({ lesson: l, moduleSlug: mod.slug })),
      ),
    [overview],
  );
  const index = flat.findIndex((item) => item.lesson.id === lesson.id);
  // Atravessa o fim do módulo de propósito: é o que faz "avançar no curso"
  // funcionar sem o usuário ter de voltar para a lista.
  const upNext = index >= 0 ? flat.slice(index + 1, index + 5) : [];

  const nextModule = useMemo(() => {
    const i = overview.modules.findIndex((mod) => mod.id === m.id);
    return i >= 0 ? (overview.modules[i + 1] ?? null) : null;
  }, [overview, m.id]);

  const markCompleted = useMutation({
    mutationFn: ({ positionSec }: { positionSec?: number; celebrate: boolean }) =>
      saveLessonProgress(lesson.id, {
        completed: true,
        ...(positionSec !== undefined ? { positionSec } : {}),
      }),
    onSuccess: (_result, { celebrate }) => {
      if (!celebrate) {
        // Conclusão automática (passou de 90%): sem modal por cima do vídeo
        // que ainda está tocando — só o aviso e o botão virando "Completed".
        void queryClient.invalidateQueries({ queryKey: MENTORSHIP_OVERVIEW_KEY });
        toast.success("Lesson completed");
        return;
      }
      // Decide o marco ANTES do refetch, com o estado que a tela já tem: esta
      // aula passa a contar como concluída e o resto vem do overview atual.
      const moduleDone = m.lessons.every(
        (l) => l.id === lesson.id || l.completed,
      );
      const courseDone =
        moduleDone &&
        overview.modules.every((mod) => mod.id === m.id || mod.percent === 100);

      void queryClient.invalidateQueries({ queryKey: MENTORSHIP_OVERVIEW_KEY });

      if (courseDone) {
        setCelebration({
          scope: "course",
          name: "the mentorship",
          href: "/mentorship",
          label: "Back to start",
        });
      } else if (moduleDone) {
        setCelebration({
          scope: "module",
          name: m.title,
          href: nextModule ? `/mentorship/${nextModule.slug}` : "/mentorship",
          label: nextModule ? "Next module" : "Back to start",
        });
      }
    },
  });

  return (
    <>
      <div className="flex flex-col items-start gap-[22px] lg:flex-row">
        {/* ── Coluna esquerda ── */}
        <div className="flex w-full min-w-0 flex-1 flex-col gap-11">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-gray-6 bg-gray-2">
            {embed ? (
              <LessonPlayer
                // Remonta (novo iframe, novo rastreio) só ao trocar de aula.
                key={lesson.id}
                lesson={lesson}
                title={lesson.title}
                onAutoComplete={(positionSec) => {
                  if (!lesson.completed && !markCompleted.isPending) {
                    markCompleted.mutate({ positionSec, celebrate: false });
                  }
                }}
              />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-2 px-6 text-center">
                <p
                  className={cn(
                    "text-base font-semibold text-gray-12",
                    TEXT_TRIM,
                  )}
                >
                  Video coming soon
                </p>
                <p className="text-sm text-gray-11">
                  This lesson does not have a video linked yet.
                </p>
              </div>
            )}

            {/* Badge sobre o player, como no Figma. `pointer-events-none` para
                não roubar o clique do play do provedor. */}
            <span className="pointer-events-none absolute left-[18px] top-[18px] rounded-full bg-gray-2/80 px-3 py-1.5 font-display text-[10px] font-bold text-principal-11">
              {m.label ? `${m.label.toUpperCase()} · ` : ""}
              {episode}
            </span>
          </div>

          <div className="flex w-full flex-col gap-6">
            <div className="flex w-full flex-col gap-5">
              <p
                className={cn(
                  "text-sm font-medium uppercase leading-[1.3] text-principal-11",
                  TEXT_TRIM,
                )}
              >
                {m.title}
              </p>
              <div className="flex w-full flex-col gap-4">
                <h1 className="font-display text-xl font-bold leading-[1.2] text-gray-12">
                  {lesson.title}
                </h1>
                {lesson.description ? (
                  <p
                    className={cn(
                      "text-base leading-[1.3] text-gray-11",
                      TEXT_TRIM,
                    )}
                  >
                    {lesson.description}
                  </p>
                ) : null}
              </div>
            </div>

            {lesson.durationSec > 0 ? (
              <div className="flex flex-wrap items-start gap-2">
                <span className="rounded border border-gray-6 bg-gray-2 px-3 py-1.5 text-xs font-medium text-gray-11">
                  {formatClock(lesson.durationSec)} · {episode}
                </span>
              </div>
            ) : null}
          </div>

          {lesson.materials.length > 0 ? (
            <section className="flex w-full flex-col gap-3">
              <h2
                className={cn(
                  "text-lg font-semibold leading-[1.1] text-gray-12",
                  TEXT_TRIM,
                )}
              >
                Lesson materials
              </h2>
              <div className="flex w-full flex-col gap-2.5">
                {lesson.materials.map((material) => (
                  <MaterialCard key={material.id} material={material} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* ── Coluna direita ── */}
        <aside className="flex w-full shrink-0 flex-col gap-9 lg:w-[350px]">
          <div className="flex w-full flex-col gap-4">
            <div className="flex w-full items-center gap-3 rounded-xl border border-gray-6 bg-gray-2 p-4">
              <ProgressRing percent={m.percent} accent={m.accent} size={56} />
              <div className="flex flex-col gap-3">
                <p
                  className={cn(
                    "text-base font-semibold leading-[1.1] text-gray-12",
                    TEXT_TRIM,
                  )}
                >
                  Your progress
                </p>
                <p
                  className={cn(
                    "text-sm leading-[1.3] text-gray-11",
                    TEXT_TRIM,
                  )}
                >
                  {m.completedCount} of {m.lessonCount} lessons in this module
                </p>
              </div>
            </div>

            {lesson.completed ? (
              <div className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-6 bg-gray-2 text-base font-semibold leading-[1.1] text-gray-11">
                <CheckCircleIcon className="size-5 text-green-11" />
                Completed
              </div>
            ) : (
              <button
                type="button"
                onClick={() => markCompleted.mutate({ celebrate: true })}
                disabled={markCompleted.isPending}
                className={cn(
                  "flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4",
                  "bg-principal-9 text-base font-semibold leading-[1.1] text-gray-1",
                  "outline-none focus-visible:ring-2 focus-visible:ring-principal-11",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                {markCompleted.isPending ? "Saving…" : "Mark as completed"}
              </button>
            )}

            {markCompleted.isError ? (
              <p className="text-sm text-vermelho-11">
                We could not save it. Try again.
              </p>
            ) : null}
          </div>

          {upNext.length > 0 ? (
            <section className="flex w-full flex-col gap-3">
              <h2
                className={cn(
                  "text-lg font-semibold leading-[1.1] text-gray-12",
                  TEXT_TRIM,
                )}
              >
                Up next
              </h2>
              <div className="flex w-full flex-col gap-2.5">
                {upNext.map((item) => (
                  <UpNextCard
                    key={item.lesson.id}
                    lesson={item.lesson}
                    moduleSlug={item.moduleSlug}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      <CompletionModal
        open={celebration !== null}
        scope={celebration?.scope ?? "module"}
        name={celebration?.name ?? ""}
        primaryHref={celebration?.href ?? "/mentorship"}
        primaryLabel={celebration?.label ?? "Back to start"}
        onClose={() => setCelebration(null)}
      />
    </>
  );
}

/** Card da lista "Up next" — leva direto para a aula, inclusive de outro módulo. */
function UpNextCard({
  lesson,
  moduleSlug,
}: {
  lesson: MentorshipLesson;
  moduleSlug: string;
}) {
  return (
    <Link
      href={`/mentorship/${moduleSlug}/${lesson.id}`}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-gray-6 bg-gray-2 p-2",
        "outline-none transition-colors hover:border-gray-8 focus-visible:ring-2 focus-visible:ring-secundaria-11/60",
      )}
    >
      <span className="relative flex h-[54px] w-[74px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-5">
        {lesson.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lesson.coverUrl}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <>
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-principal-9/15"
            />
            <span className="relative font-display text-sm font-bold text-principal-11 opacity-30">
              {String(lesson.episode).padStart(2, "0")}
            </span>
          </>
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-2 text-sm">
        <span
          className={cn(
            "truncate font-semibold leading-[1.1] text-gray-12",
            TEXT_TRIM,
          )}
        >
          {lesson.title}
        </span>
        <span className={cn("leading-[1.3] text-gray-11", TEXT_TRIM)}>
          {lesson.durationSec > 0
            ? `Duration · ${formatClock(lesson.durationSec)}`
            : formatEpisode(lesson.episode)}
        </span>
      </span>
    </Link>
  );
}

/** Esqueleto com a MESMA geometria, para a página não pular ao carregar. */
function LessonSkeleton() {
  return (
    <div className="flex flex-col gap-[22px] lg:flex-row" aria-hidden="true">
      <div className="flex w-full min-w-0 flex-1 flex-col gap-11">
        <div className="aspect-video w-full animate-pulse rounded-xl border border-gray-6 bg-gray-2" />
        <div className="flex flex-col gap-4">
          <div className="h-4 w-40 animate-pulse rounded bg-gray-3" />
          <div className="h-6 w-2/3 animate-pulse rounded bg-gray-3" />
          <div className="h-4 w-full animate-pulse rounded bg-gray-3" />
        </div>
      </div>
      <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[350px]">
        <div className="h-[88px] animate-pulse rounded-xl border border-gray-6 bg-gray-2" />
        <div className="h-11 animate-pulse rounded-lg bg-gray-3" />
      </div>
    </div>
  );
}
