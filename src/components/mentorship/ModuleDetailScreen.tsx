"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Footer } from "@/components/home/Footer";
import { Topbar } from "@/components/home/Topbar";
import { LessonCard } from "@/components/mentorship/LessonCard";
import { PlayIcon } from "@/components/mentorship/icons";
import { ProgressRing } from "@/components/mentorship/ProgressRing";
import { TEXT_TRIM } from "@/components/plans/textTrim";
import {
  getMentorshipOverview,
  MENTORSHIP_OVERVIEW_KEY,
  type MentorshipLesson,
  type MentorshipModule,
} from "@/lib/api/mentorship";
import { formatDurationShort } from "@/lib/mentorship/format";
import { cn } from "@/lib/cn";

/*
 * Página de DETALHES do módulo (Figma 1036:23317).
 *
 * Duas faixas: a capa com as estatísticas e a grade de todos os episódios.
 *
 * Reusa `/mentorship/overview` em vez de pedir uma rota nova ao backend: aquela
 * resposta já traz `modules[].lessons[]` inteiro, e a MESMA `queryKey` da tela
 * de mentoria significa que chegar aqui por um card não dispara request nenhum
 * — o cache do React Query responde na hora. O custo é trazer os outros módulos
 * junto, aceitável no volume publicado (4 trilhas / 23 aulas) e coerente com a
 * decisão de manter o overview numa chamada só.
 */
export function ModuleDetailScreen({ slug }: { slug: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: MENTORSHIP_OVERVIEW_KEY,
    queryFn: getMentorshipOverview,
  });

  const currentModule = data?.modules.find((m) => m.slug === slug);

  return (
    <div className="flex min-h-dvh flex-col bg-gray-1">
      <Topbar />

      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 pb-[92px] pt-8 md:px-12 lg:px-20">
          {isLoading ? <ModuleDetailSkeleton /> : null}

          {isError ? (
            <p className="text-base text-gray-11">
              We could not load this module. Refresh the page to try again.
            </p>
          ) : null}

          {/* `data && !currentModule`: a resposta chegou e o slug não existe nela. */}
          {data && !currentModule ? (
            <div className="flex flex-col items-start gap-4">
              <h1
                className={cn(
                  "text-2xl font-semibold leading-[1.1] text-gray-12",
                  TEXT_TRIM,
                )}
              >
                Module not found
              </h1>
              <p className="text-base text-gray-11">
                This module may have been unpublished or renamed.
              </p>
              <Link
                href="/mentorship"
                className="text-base font-semibold text-principal-11 underline-offset-4 hover:underline"
              >
                Back to mentorship
              </Link>
            </div>
          ) : null}

          {currentModule ? (
            <>
              <ModuleCover module={currentModule} />
              <EpisodesSection module={currentModule} />
            </>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
}

/** Capa: rótulo, título, descrição e a linha de estatísticas com o CTA. */
function ModuleCover({ module: m }: { module: MentorshipModule }) {
  const router = useRouter();
  const lessonWord = m.lessonCount === 1 ? "LESSON" : "LESSONS";
  // Primeira aula não concluída; `undefined` quando o módulo está fechado.
  const nextLesson = m.lessons.find((l) => !l.completed);

  return (
    <section className="relative flex min-h-[292px] flex-col justify-between gap-8 overflow-hidden rounded-xl border border-gray-6 bg-gradient-to-r from-gray-2 to-gray-3 p-7">
      {/*
       * Arte da capa sangrando à direita. O Figma usa uma máscara exportada;
       * aqui o recorte é um gradiente de transparência, que dá o mesmo
       * desaparecimento para a esquerda e serve QUALQUER `coverUrl` — a máscara
       * do arquivo vale só para a arte daquele módulo.
       */}
      {m.coverUrl ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[556px] max-w-[55%] lg:block"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.65) 38%, #000 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.65) 38%, #000 100%)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.coverUrl} alt="" className="size-full object-cover" />
        </div>
      ) : null}

      <div className="relative flex flex-col gap-4">
        <span
          className={cn(
            "w-fit rounded-[20px] border border-secundaria-9 bg-secundaria-2 px-2.5 py-1",
            "text-[10px] font-bold uppercase text-secundaria-10",
          )}
        >
          {m.label ? `${m.label} · ` : ""}
          {m.lessonCount} {lessonWord}
        </span>

        <div className="flex max-w-[659px] flex-col gap-4">
          <h1 className="font-display text-2xl font-extrabold leading-[1.05] text-gray-12">
            {m.title}
          </h1>
          {m.subtitle ? (
            <p className={cn("text-sm leading-[1.3] text-gray-11", TEXT_TRIM)}>
              {m.subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative flex flex-wrap items-center gap-6">
        <ProgressRing percent={m.percent} accent={m.accent} />

        <Stat
          value={`${m.completedCount}/${m.lessonCount}`}
          label="lessons completed"
        />
        <Stat
          value={formatDurationShort(m.totalDurationSec)}
          label="of content"
        />

        <div className="ml-auto" />

        <button
          type="button"
          // Retoma na primeira aula não concluída — a mesma que o texto promete.
          onClick={() =>
            nextLesson && router.push(`/mentorship/${m.slug}/${nextLesson.id}`)
          }
          disabled={!nextLesson}
          className={cn(
            "flex h-11 items-center justify-center gap-2 rounded-lg px-4",
            "bg-principal-9 text-base font-semibold leading-[1.1] text-gray-1",
            "outline-none focus-visible:ring-2 focus-visible:ring-principal-11",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <PlayIcon className="size-5" />
          {/* Módulo fechado não oferece "continuar" — não há o que retomar. */}
          {nextLesson ? "Continue module" : "Module completed"}
        </button>
      </div>
    </section>
  );
}

/** Par número + rótulo da linha de estatísticas. */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-2 whitespace-nowrap">
      <p
        className={cn(
          "text-base font-semibold leading-[1.1] text-gray-12",
          TEXT_TRIM,
        )}
      >
        {value}
      </p>
      <p className={cn("text-sm leading-[1.3] text-gray-11", TEXT_TRIM)}>
        {label}
      </p>
    </div>
  );
}

/** Grade de todos os episódios do módulo. */
function EpisodesSection({ module: m }: { module: MentorshipModule }) {
  const router = useRouter();

  return (
    <section className="flex flex-col gap-6">
      <h2
        className={cn(
          "text-2xl font-semibold leading-[1.1] text-gray-12",
          TEXT_TRIM,
        )}
      >
        All episodes
      </h2>

      {m.lessons.length === 0 ? (
        <p className="text-base text-gray-11">
          No lessons published in this module yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
          {m.lessons.map((lesson: MentorshipLesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              fluid
              onOpen={(l) => router.push(`/mentorship/${m.slug}/${l.id}`)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Esqueleto com a MESMA geometria do conteúdo, para a página não pular. */
function ModuleDetailSkeleton() {
  return (
    <div className="flex flex-col gap-12" aria-hidden="true">
      <div className="h-[292px] animate-pulse rounded-xl border border-gray-6 bg-gray-2" />
      <div className="flex flex-col gap-6">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-gray-3" />
        <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <div className="aspect-[292/160] w-full animate-pulse rounded-lg bg-gray-3" />
              <div className="h-4 w-full animate-pulse rounded bg-gray-3" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-gray-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
