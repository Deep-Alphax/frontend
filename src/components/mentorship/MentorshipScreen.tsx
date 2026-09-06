"use client";

import { useQuery } from "@tanstack/react-query";

import { Footer } from "@/components/home/Footer";
import { Topbar } from "@/components/home/Topbar";
import { ContinueCard } from "@/components/mentorship/ContinueCard";
import { HeroBanner } from "@/components/mentorship/HeroBanner";
import { ModuleCard } from "@/components/mentorship/ModuleCard";
import { ModuleRow } from "@/components/mentorship/ModuleRow";
import { TEXT_TRIM } from "@/components/plans/textTrim";
import {
  getMentorshipOverview,
  MENTORSHIP_OVERVIEW_KEY,
} from "@/lib/api/mentorship";
import { formatCompleted } from "@/lib/mentorship/format";
import { cn } from "@/lib/cn";

/*
 * Tela de Mentoria (Figma 1011:21678).
 *
 * Quatro blocos, na ordem do arquivo: faixa de abertura, grade de trilhas,
 * "continue de onde parou" e uma esteira por trilha. Tudo vem de UMA chamada
 * (`/mentorship/overview`) — o progresso do usuário já chega junto, então não
 * há uma segunda ida ao servidor por card.
 */
export function MentorshipScreen() {
  const { data, isLoading, isError } = useQuery({
    queryKey: MENTORSHIP_OVERVIEW_KEY,
    queryFn: getMentorshipOverview,
  });

  return (
    <div className="flex min-h-dvh flex-col bg-gray-1">
      <Topbar />

      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 pb-[92px] pt-8 md:px-12 lg:px-20">
          <HeroBanner />

          {isLoading ? <MentorshipSkeleton /> : null}

          {isError ? (
            <p className="text-base text-gray-11">
              We could not load the mentorship content. Refresh the page to try
              again.
            </p>
          ) : null}

          {data ? (
            <>
              <section className="flex flex-col gap-6">
                <header className="flex items-end justify-between gap-6">
                  <div className="flex flex-col gap-3">
                    <h2 className={cn("text-2xl font-semibold leading-[1.1] text-gray-12", TEXT_TRIM)}>
                      Tracks and modules
                    </h2>
                    <p className={cn("text-base leading-[1.3] text-gray-11", TEXT_TRIM)}>
                      {data.totals.modules} modules, {data.totals.lessons} lessons.
                      Start wherever it makes sense for you.
                    </p>
                  </div>
                  <p className={cn("shrink-0 text-sm leading-[1.3] text-gray-11", TEXT_TRIM)}>
                    {formatCompleted(data.totals.completed, data.totals.lessons)}
                  </p>
                </header>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
                  {data.modules.map((m) => (
                    <ModuleCard key={m.id} module={m} />
                  ))}
                </div>
              </section>

              {data.continueLesson ? (
                <section className="flex flex-col gap-4">
                  <h2 className={cn("text-2xl font-semibold leading-[1.1] text-gray-12", TEXT_TRIM)}>
                    Continue where you left off
                  </h2>
                  <ContinueCard lesson={data.continueLesson} />
                </section>
              ) : null}

              {data.modules.map((m) => (
                <ModuleRow key={m.id} module={m} />
              ))}

              {data.modules.length === 0 ? (
                <p className="text-base text-gray-11">
                  No tracks published yet. Come back soon.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
}

/** Esqueleto com a MESMA geometria do conteúdo, para a página não pular. */
function MentorshipSkeleton() {
  return (
    <div className="flex flex-col gap-12" aria-hidden="true">
      <div className="flex flex-col gap-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-gray-3" />
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-[428px] animate-pulse rounded-xl border border-gray-6 bg-gray-2"
            />
          ))}
        </div>
      </div>
      <div className="h-[195px] animate-pulse rounded-[18px] border border-gray-6 bg-gray-2" />
    </div>
  );
}
