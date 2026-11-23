"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

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
  type MentorshipModule,
  type MentorshipOverview,
} from "@/lib/api/mentorship";
import { formatCompleted } from "@/lib/mentorship/format";
import { cn } from "@/lib/cn";

/*
 * Tela de Mentoria (Figma 1011:21678) organizada por CATEGORIA.
 *
 * - Abas de categoria no padrão do site (KOLs / Deep Ranking: sublinhado em
 *   principal). "All" mostra cada categoria com cabeçalho e grade; uma aba
 *   mostra a categoria inteira: cabeçalho com progresso, grade e as esteiras
 *   de aulas SÓ dela — antes a página despejava as esteiras de todos os
 *   módulos, e a categoria sumia no meio.
 * - A aba fica na URL (`?category=<slug>`), como a aba do Copy Trade: sobrevive
 *   ao reload e dá para compartilhar o link. `useSearchParams` pede o
 *   `<Suspense>` da página.
 * - Com UMA categoria só, não há abas: a categoria aparece direto.
 * - Tudo vem de UMA chamada (`/mentorship/overview`), progresso incluso.
 */

const ALL = "all";

export function MentorshipScreen() {
  const { data, isLoading, isError } = useQuery({
    queryKey: MENTORSHIP_OVERVIEW_KEY,
    queryFn: getMentorshipOverview,
  });

  const params = useSearchParams();
  const [selected, setSelected] = useState<string>(
    () => params?.get("category") ?? ALL,
  );
  const select = useCallback((slug: string) => {
    setSelected(slug);
    const qs = new URLSearchParams(window.location.search);
    if (slug === ALL) qs.delete("category");
    else qs.set("category", slug);
    const q = qs.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${q ? `?${q}` : ""}`,
    );
  }, []);

  const sections = data ? groupByCategory(data) : [];
  const withTabs = sections.length > 1;
  // Slug desconhecido (categoria renomeada, link velho) cai em "All".
  const active = withTabs
    ? (sections.find((s) => s.slug === selected) ?? null)
    : (sections[0] ?? null);

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
              {data.continueLesson ? (
                <section className="flex flex-col gap-4">
                  <h2
                    className={cn(
                      "text-2xl font-semibold leading-[1.1] text-gray-12",
                      TEXT_TRIM,
                    )}
                  >
                    Continue where you left off
                  </h2>
                  <ContinueCard
                    lesson={data.continueLesson}
                    href={lessonHref(data, data.continueLesson)}
                  />
                </section>
              ) : null}

              {sections.length > 0 ? (
                <section className="flex flex-col gap-10">
                  <div className="flex flex-col gap-4 border-b border-gray-6 sm:flex-row sm:items-end sm:justify-between">
                    {withTabs ? (
                      <CategoryTabs
                        sections={sections}
                        selected={active?.slug ?? ALL}
                        onSelect={select}
                      />
                    ) : (
                      <h2
                        className={cn(
                          "pb-3 text-2xl font-semibold leading-[1.1] text-gray-12",
                          TEXT_TRIM,
                        )}
                      >
                        Tracks and modules
                      </h2>
                    )}
                    <p
                      className={cn(
                        "shrink-0 pb-3 text-sm leading-[1.3] text-gray-11",
                        TEXT_TRIM,
                      )}
                    >
                      {formatCompleted(
                        data.totals.completed,
                        data.totals.lessons,
                      )}
                    </p>
                  </div>

                  {active ? (
                    <div
                      role={withTabs ? "tabpanel" : undefined}
                      id={withTabs ? `panel-${active.slug}` : undefined}
                      aria-labelledby={withTabs ? `tab-${active.slug}` : undefined}
                      className="flex flex-col gap-12"
                    >
                      <CategoryBlock section={active} />
                      {active.modules.map((m) => (
                        <ModuleRow key={m.id} module={m} />
                      ))}
                    </div>
                  ) : (
                    <div
                      role="tabpanel"
                      id={`panel-${ALL}`}
                      aria-labelledby={`tab-${ALL}`}
                      className="flex flex-col gap-14"
                    >
                      {sections.map((s) => (
                        <CategoryBlock
                          key={s.id}
                          section={s}
                          onOpen={() => select(s.slug)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              ) : (
                <p className="text-base text-gray-11">
                  No tracks published yet. Come back soon.
                </p>
              )}
            </>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ── Abas ─────────────────────────────────────────────────────────────────────

/** Abas no padrão de `KolsTabs`: ativa em principal com sublinhado de 2px. */
function CategoryTabs({
  sections,
  selected,
  onSelect,
}: {
  sections: Section[];
  selected: string;
  onSelect: (slug: string) => void;
}) {
  const tabs = [
    {
      slug: ALL,
      title: "All",
      count: sections.reduce((n, s) => n + s.modules.length, 0),
    },
    ...sections.map((s) => ({
      slug: s.slug,
      title: s.title,
      count: s.modules.length,
    })),
  ];
  return (
    <div
      role="tablist"
      aria-label="Mentorship categories"
      // Rola na horizontal no celular em vez de quebrar linha.
      className="-mb-px flex min-w-0 items-end overflow-x-auto"
    >
      {tabs.map((t) => {
        const isActive = t.slug === selected;
        return (
          <button
            key={t.slug}
            type="button"
            role="tab"
            id={`tab-${t.slug}`}
            aria-selected={isActive}
            aria-controls={`panel-${t.slug}`}
            onClick={() => onSelect(t.slug)}
            className={cn(
              "flex shrink-0 items-center gap-2 px-5 py-3 text-sm font-medium leading-[1.3] whitespace-nowrap transition-colors",
              isActive
                ? "border-b-2 border-principal-11 text-principal-11"
                : "border-b-2 border-transparent text-gray-11 hover:text-gray-12",
            )}
          >
            {t.title}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] leading-none",
                isActive ? "bg-principal-3 text-principal-11" : "bg-gray-3 text-gray-11",
              )}
            >
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Bloco de categoria ───────────────────────────────────────────────────────

function CategoryBlock({
  section: s,
  onOpen,
}: {
  section: Section;
  /** Na aba "All": leva para a aba da categoria (esteiras de aulas). */
  onOpen?: () => void;
}) {
  const lessons = s.modules.reduce((n, m) => n + m.lessonCount, 0);
  const completed = s.modules.reduce((n, m) => n + m.completedCount, 0);
  const percent = lessons > 0 ? Math.round((completed / lessons) * 100) : 0;

  return (
    <section
      aria-label={s.title || "Tracks and modules"}
      className="flex flex-col gap-6"
    >
      {s.title ? (
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-3">
            <h3
              className={cn(
                "font-display text-xl font-semibold leading-[1.1] tracking-[0.5px] text-gray-12 sm:text-2xl",
                TEXT_TRIM,
              )}
            >
              {s.title}
            </h3>
            {s.description ? (
              <p
                className={cn(
                  "max-w-2xl text-base leading-[1.3] text-gray-11",
                  TEXT_TRIM,
                )}
              >
                {s.description}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:w-64">
            <div className="flex items-center justify-between gap-3 text-xs leading-[1.3] text-gray-11">
              <span>
                {s.modules.length} {s.modules.length === 1 ? "module" : "modules"} ·{" "}
                {lessons} {lessons === 1 ? "lesson" : "lessons"}
              </span>
              <span className="font-semibold text-gray-12">{percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-label={`${s.title} progress`}
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.5 w-full overflow-hidden rounded-full bg-gray-4"
            >
              <div
                className="h-full rounded-full bg-principal-9 transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </div>
            {onOpen ? (
              <button
                type="button"
                onClick={onOpen}
                className="flex items-center gap-1 self-end text-xs font-semibold text-principal-11 hover:underline"
              >
                View lessons
                <ArrowRight className="size-3.5" />
              </button>
            ) : null}
          </div>
        </header>
      ) : null}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {s.modules.map((m) => (
          <ModuleCard key={m.id} module={m} />
        ))}
      </div>
    </section>
  );
}

// ── Dados ────────────────────────────────────────────────────────────────────

interface Section {
  id: string;
  /** Identificador da aba na URL, derivado do título. */
  slug: string;
  title: string;
  description: string;
  modules: MentorshipModule[];
}

/**
 * URL da página da aula: o slug vem do MÓDULO dono dela (a aula só traz o id
 * do módulo). Sem o módulo na resposta, cai na lista da mentoria.
 */
export function lessonHref(
  data: MentorshipOverview,
  lesson: { id: string; moduleId: string },
): string {
  const owner = data.modules.find((m) => m.id === lesson.moduleId);
  return owner ? `/mentorship/${owner.slug}/${lesson.id}` : "/mentorship";
}

/** `"On-chain & Risk"` → `"on-chain-risk"` (vai para `?category=`). */
export function categorySlug(title: string): string {
  return (
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "category"
  );
}

/**
 * Monta as seções da tela (Categoria → Módulos) a partir dos ids que cada
 * categoria traz. Sem `categories` (backend anterior a elas) cai numa seção
 * única sem título. Slugs repetidos (dois títulos iguais) ganham sufixo.
 */
export function groupByCategory(data: MentorshipOverview): Section[] {
  const categories = data.categories ?? [];
  if (categories.length === 0) {
    return data.modules.length
      ? [
          {
            id: ALL,
            slug: "tracks",
            title: "",
            description: "",
            modules: data.modules,
          },
        ]
      : [];
  }
  const byId = new Map(data.modules.map((m) => [m.id, m]));
  const used = new Set<string>([ALL]);
  return categories
    .map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      modules: c.moduleIds
        .map((id) => byId.get(id))
        .filter((m): m is MentorshipModule => m !== undefined),
    }))
    .filter((s) => s.modules.length > 0)
    .map((s) => {
      const base = categorySlug(s.title);
      let slug = base;
      for (let i = 2; used.has(slug); i += 1) slug = `${base}-${i}`;
      used.add(slug);
      return { ...s, slug };
    });
}

/** Esqueleto com a MESMA geometria do conteúdo, para a página não pular. */
export function MentorshipSkeleton() {
  return (
    <div className="flex flex-col gap-12" aria-hidden="true">
      <div className="h-[195px] animate-pulse rounded-[18px] border border-gray-6 bg-gray-2" />
      <div className="flex flex-col gap-6">
        <div className="flex gap-2 border-b border-gray-6 pb-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-6 w-24 animate-pulse rounded bg-gray-3" />
          ))}
        </div>
        <div className="h-8 w-64 animate-pulse rounded-lg bg-gray-3" />
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-[428px] animate-pulse rounded-xl border border-gray-6 bg-gray-2"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
