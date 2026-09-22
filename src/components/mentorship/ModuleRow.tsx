"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { LessonCard } from "@/components/mentorship/LessonCard";
import { TEXT_TRIM } from "@/components/plans/textTrim";
import type { MentorshipLesson, MentorshipModule } from "@/lib/api/mentorship";
import { cn } from "@/lib/cn";
import { ScrollArea } from "@/components/ui/ScrollArea";

/** Largura do card + gap (292 + 14) — o passo de rolagem da esteira. */
const CARD_STEP = 306;

/**
 * Tolerância em px para decidir que a esteira chegou ao fim. `scrollLeft` é
 * fracionário (zoom, DPI, scroll suave), então comparar com igualdade deixaria
 * a seta "próximo" habilitada para sempre no último card.
 */
const EDGE_SLACK = 2;

/*
 * Uma trilha em faixa horizontal (Figma 1011:25643): cabeçalho com título,
 * rótulo e controles, e a esteira de aulas rolável.
 *
 * A esteira rola de verdade (viewport do `ScrollArea`), então funciona no touch sem
 * depender das setas; elas são o atalho de mouse e desligam nas pontas.
 */
export function ModuleRow({
  module: m,
  onOpenLesson,
  onOpenModule,
}: {
  module: MentorshipModule;
  /** Override do destino. Sem ele, o card navega para a rota da aula. */
  onOpenLesson?: (lesson: MentorshipLesson) => void;
  /** Override do destino. Sem ele, abre a página do módulo. */
  onOpenModule?: (module: MentorshipModule) => void;
}) {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ canPrev: false, canNext: false });

  const syncEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setEdges({
      canPrev: el.scrollLeft > EDGE_SLACK,
      canNext: el.scrollLeft < maxScroll - EDGE_SLACK,
    });
  }, []);

  // Recalcula ao montar, ao rolar e ao redimensionar: a mesma esteira cabe
  // inteira numa janela larga (setas desligadas) e transborda numa estreita.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    syncEdges();
    el.addEventListener("scroll", syncEdges, { passive: true });
    const observer = new ResizeObserver(syncEdges);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", syncEdges);
      observer.disconnect();
    };
  }, [syncEdges, m.lessons.length]);

  const scrollBy = (direction: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    // Rola por cards INTEIROS: parar no meio de um card deixa a esteira com
    // cara de conteúdo cortado por acidente.
    const cards = Math.max(1, Math.floor(el.clientWidth / CARD_STEP));
    el.scrollBy({ left: direction * cards * CARD_STEP, behavior: "smooth" });
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-6">
        <div className="flex min-w-0 max-w-[850px] flex-1 flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2
              className={cn(
                "text-2xl font-semibold leading-[1.1] text-gray-12",
                TEXT_TRIM,
              )}
            >
              {m.title}
            </h2>
            {m.label ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-px w-3 shrink-0 bg-gray-6"
                />
                <span
                  className={cn(
                    "shrink-0 text-sm leading-[1.3] text-gray-11",
                    TEXT_TRIM,
                  )}
                >
                  {m.label}
                </span>
              </>
            ) : null}
          </div>
          {m.subtitle ? (
            <p
              className={cn("text-base leading-[1.3] text-gray-11", TEXT_TRIM)}
            >
              {m.subtitle}
            </p>
          ) : null}
        </div>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <TrackButton
            label={`Previous lessons in ${m.title}`}
            disabled={!edges.canPrev}
            onClick={() => scrollBy(-1)}
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </TrackButton>
          <TrackButton
            label={`More lessons in ${m.title}`}
            disabled={!edges.canNext}
            onClick={() => scrollBy(1)}
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </TrackButton>
          <button
            type="button"
            onClick={() =>
              onOpenModule
                ? onOpenModule(m)
                : router.push(`/mentorship/${m.slug}`)
            }
            className={cn(
              "flex h-9 items-center justify-center rounded-lg border border-gray-6 bg-gray-3 px-4 text-sm font-semibold leading-[1.1] text-gray-12 transition-colors hover:bg-gray-4 focus-visible:ring-2 focus-visible:ring-secundaria-11/60 focus-visible:outline-none",
              TEXT_TRIM,
            )}
          >
            Open module
          </button>
        </div>
      </header>

      {/* O ref aponta para o VIEWPORT (o elemento que rola): é nele que as
          setas medem `clientWidth/scrollWidth` e chamam `scrollBy`. */}
      <ScrollArea orientation="horizontal" viewportRef={trackRef}>
        <div className="flex gap-3.5 pb-3">
          {m.lessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              onOpen={(l) =>
                onOpenLesson
                  ? onOpenLesson(l)
                  : router.push(`/mentorship/${m.slug}/${l.id}`)
              }
            />
          ))}
        </div>
      </ScrollArea>
    </section>
  );
}

/** Botão-ícone 36×36 dos controles da esteira (Figma 1011:25873). */
function TrackButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-lg border-[1.5px] border-gray-6 bg-gray-3 text-gray-12 transition-colors hover:bg-gray-4 focus-visible:ring-2 focus-visible:ring-secundaria-11/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
