"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
  ADMIN_STATS_KEY,
  getMentorshipStats,
  type StatsModule,
} from "@/lib/api/mentorship";

/*
 * Uso da mentoria (tela de admin).
 *
 * Formas escolhidas pelo trabalho do dado, não por enfeite:
 *  - quatro números de manchete → KPI row de stat tiles (não um gráfico de
 *    barras com quatro barras);
 *  - "quanto deste módulo foi vencido" é UMA razão contra um teto → meter, com
 *    o trilho na mesma família de cor do preenchimento;
 *  - por aula são muitas linhas com dois números cada → tabela.
 *
 * Uma cor de destaque só (`principal`). Não há séries a distinguir, então
 * paleta categórica não se aplica; e a taxa NÃO é pintada por faixa (verde/
 * vermelho) porque essas cores são reservadas para estado, não para medida.
 * Texto sempre em token de texto — a cor vive na marca, não no número.
 */
export function MentorshipStats() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ADMIN_STATS_KEY,
    queryFn: getMentorshipStats,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-hidden="true">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-[76px] animate-pulse rounded-lg border border-gray-6 bg-gray-2"
            />
          ))}
        </div>
        <div className="h-40 animate-pulse rounded-lg border border-gray-6 bg-gray-2" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-gray-11">
        Could not load the usage stats. Refresh to try again.
      </p>
    );
  }

  const { totals } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Learners" value={totals.learners} />
        <StatTile label="Active (30d)" value={totals.activeLast30d} />
        <StatTile label="Lessons started" value={totals.lessonsStarted} />
        <StatTile label="Lessons completed" value={totals.lessonsCompleted} />
      </div>

      {data.modules.length === 0 ? (
        <p className="text-sm text-gray-11">No tracks yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.modules.map((m) => (
            <ModuleRow key={m.id} module={m} />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-11">
        A learner counts once per track, on the first lesson they open. Track
        rate is completed lessons over what those learners would need to finish
        it; lesson rate is completions over the people who opened that lesson.
      </p>
    </div>
  );
}

/** Um número de manchete. Sem gráfico: uma barra só não diz mais que o número. */
function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-gray-6 bg-gray-2 p-4">
      <span className="text-2xl font-semibold tabular-nums text-gray-12">
        {value.toLocaleString("en-US")}
      </span>
      <span className="text-xs text-gray-11">{label}</span>
    </div>
  );
}

function ModuleRow({ module: m }: { module: StatsModule }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-6 bg-gray-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-secundaria-11/60"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-gray-11" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-gray-11" />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-semibold text-gray-12">
            {m.title}
            {!m.published ? (
              <span className="ml-2 text-xs font-normal text-gray-11">
                draft
              </span>
            ) : null}
          </span>
          <span className="text-xs text-gray-11">
            {m.learners} {m.learners === 1 ? "learner" : "learners"} ·{" "}
            {m.lessonCount} {m.lessonCount === 1 ? "lesson" : "lessons"} ·{" "}
            {m.completions} completed
          </span>
        </div>

        <Meter value={m.completionRate} />
      </button>

      {open ? (
        <div className="border-t border-gray-6 p-3">
          {m.lessons.length === 0 ? (
            <p className="text-xs text-gray-11">No lessons in this track.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="text-gray-11">
                <tr>
                  <th className="pb-2 font-normal">Lesson</th>
                  <th className="pb-2 text-right font-normal">Opened</th>
                  <th className="pb-2 text-right font-normal">Completed</th>
                  <th className="pb-2 text-right font-normal">Rate</th>
                </tr>
              </thead>
              <tbody>
                {m.lessons.map((l) => (
                  <tr key={l.id} className="border-t border-gray-6/60">
                    <td className="py-2 pr-3 text-gray-12">
                      <span className="text-gray-11">
                        EP {String(l.episode).padStart(2, "0")}
                      </span>{" "}
                      {l.title}
                      {!l.published ? (
                        <span className="ml-2 text-gray-11">draft</span>
                      ) : null}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-11">
                      {l.started}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-11">
                      {l.completed}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-12">
                      {l.started > 0 ? `${l.completionRate}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Razão contra um teto. Trilho e preenchimento saem da MESMA família de cor
 * (o trilho é o passo escuro), que é o que faz a barra ser lida como "quanto
 * de um todo" e não como duas categorias.
 */
function Meter({ value }: { value: number }) {
  const safe = Math.min(100, Math.max(0, value));
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div
        className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-6"
        role="img"
        aria-label={`${safe}% completed`}
      >
        {/* `rounded-full` também no preenchimento: a ponta do dado fica
            arredondada, ancorada na base da faixa. */}
        <div
          className="h-full rounded-full bg-principal-9"
          style={{ width: `${safe}%` }}
        />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-gray-12">
        {safe}%
      </span>
    </div>
  );
}
