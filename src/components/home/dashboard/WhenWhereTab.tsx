"use client";

import type { WeekdayBlockCell } from "@/lib/api/analytics";
import { formatUsd, formatSignedUsd } from "@/lib/format";

const DAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
const DAY_FULL = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];
const BLOCK_LABELS = ["00–04h", "04–08h", "08–12h", "12–16h", "16–20h", "20–24h"];

/** Faixas do PnL por trade → cor de fundo (espelha a legenda do design). */
const SCALE: { max: number; bg: string }[] = [
  { max: -150, bg: "#5b1a20" },
  { max: -50, bg: "#7d2530" },
  { max: -10, bg: "#3a1f26" },
  { max: 10, bg: "#23252f" },
  { max: 50, bg: "#1c3a2a" },
  { max: 150, bg: "#235e3b" },
  { max: Infinity, bg: "#2c7a4a" },
];

const LEGEND: { bg: string; label: string }[] = [
  { bg: "#5b1a20", label: "−150" },
  { bg: "#7d2530", label: "−150 a −50" },
  { bg: "#3a1f26", label: "−50 a −10" },
  { bg: "#23252f", label: "−10 a +10" },
  { bg: "#1c3a2a", label: "+10 a +50" },
  { bg: "#235e3b", label: "+50 a +150" },
  { bg: "#2c7a4a", label: "+150" },
];

function colorFor(avgPnl: number): string {
  return (SCALE.find((s) => avgPnl <= s.max) ?? SCALE[SCALE.length - 1]).bg;
}

function HeatCell({ cell }: { cell: WeekdayBlockCell }) {
  const avg = Number(cell.avgPnlPerTradeUsd);
  return (
    <div className="group relative">
      <div
        className="flex h-14 items-center justify-center rounded-lg px-1 text-center text-[13px] font-medium text-gray-12"
        style={{ backgroundColor: colorFor(avg) }}
      >
        {formatUsd(avg)}
      </div>

      {/* Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-[220px] -translate-x-1/2 rounded-xl border border-gray-6 bg-gray-3 p-4 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
        <p className="text-[15px] font-semibold text-gray-12">
          {DAY_FULL[cell.weekday]}, {BLOCK_LABELS[cell.block]}
        </p>
        <div className="mt-3 flex flex-col gap-1 border-t border-gray-6 pt-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-11">PnL por trade</span>
            <span className={avg > 0 ? "text-green-11" : avg < 0 ? "text-danger-11" : "text-gray-12"}>
              {formatSignedUsd(cell.avgPnlPerTradeUsd)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-11">Trades</span>
            <span className="text-gray-12">{cell.trades}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-11">PnL da janela</span>
            <span
              className={
                Number(cell.realizedPnlUsd) > 0
                  ? "text-green-11"
                  : Number(cell.realizedPnlUsd) < 0
                    ? "text-danger-11"
                    : "text-gray-12"
              }
            >
              {formatSignedUsd(cell.realizedPnlUsd)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WhenWhereTab({ weekdayBlocks }: { weekdayBlocks: WeekdayBlockCell[] }) {
  // Índice (weekday, block) → célula (o backend emite 42, ordenadas; mapa é defensivo).
  const byKey = new Map(weekdayBlocks.map((c) => [`${c.weekday}-${c.block}`, c]));
  const cellAt = (w: number, b: number): WeekdayBlockCell =>
    byKey.get(`${w}-${b}`) ?? {
      weekday: w,
      block: b,
      trades: 0,
      realizedPnlUsd: "0.00",
      avgPnlPerTradeUsd: "0.00",
    };

  return (
    <section className="rounded-lg border border-gray-6 bg-gray-2">
      <div className="border-b border-gray-6 px-6 py-4">
        <h3 className="text-base font-semibold text-gray-12">Dia da semana × bloco do dia</h3>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-[3rem_repeat(6,minmax(0,1fr))] gap-2">
          {/* Cabeçalho: canto vazio + blocos */}
          <div />
          {BLOCK_LABELS.map((b) => (
            <div key={b} className="pb-1 text-center text-sm text-gray-11">
              {b}
            </div>
          ))}

          {/* Linhas: label do dia + 6 células */}
          {DAY_SHORT.map((day, w) => (
            <div key={day} className="contents">
              <div className="flex items-center text-sm text-gray-11">{day}</div>
              {BLOCK_LABELS.map((_, b) => (
                <HeatCell key={`${w}-${b}`} cell={cellAt(w, b)} />
              ))}
            </div>
          ))}
        </div>

        {/* Legenda */}
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-11">
          <span className="font-medium text-gray-12">US$ por trade</span>
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm" style={{ backgroundColor: l.bg }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
