"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { ArrowUpIcon } from "@/components/copyTrade/icons";

/*
 * Controles do Copy Trade (Figma: "paginação" 1654:39206, "controle -
 * segmentado" 1616:29062, "opção - radio", switch e "kpi - célula").
 */

/** Páginas visíveis: 1 2 3 … última (com a atual sempre incluída). */
export function pageList(page: number, pages: number): Array<number | "…"> {
  if (pages <= 5) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, 2, 3, page - 1, page, page + 1, pages].filter((p) => p >= 1 && p <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function Pagination({
  page,
  pageSize,
  total,
  noun,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  /** "events", "tokens", "copiers". */
  noun: string;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  const nav = "flex size-7 items-center justify-center rounded-lg border border-gray-5 text-gray-11 transition-colors hover:bg-gray-4 disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <nav aria-label="Pagination" className="flex h-[52px] items-center justify-between gap-2 border-t border-gray-5 px-4 py-3">
      <p className="text-xs leading-[1.3] whitespace-nowrap text-gray-11">
        Showing {from}–{to} of {total.toLocaleString("en-US")} {noun}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className={nav}>
          <ArrowUpIcon className="h-[7.9px] w-[5.5px] -rotate-90" />
        </button>
        {pageList(page, pages).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="flex size-7 items-center justify-center text-xs text-gray-11">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPage(p)}
              className={cn(
                "flex size-7 items-center justify-center rounded-lg text-xs leading-[1.3] transition-colors",
                p === page ? "border border-gray-6 bg-gray-4 font-medium text-gray-12" : "text-gray-11 hover:bg-gray-3",
              )}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className={nav}>
          <ArrowUpIcon className="h-[7.9px] w-[5.5px] rotate-90" />
        </button>
      </div>
    </nav>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-[34px] shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-principal-9 disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "bg-principal-9" : "bg-gray-6",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 size-4 rounded-full transition-[left]",
          checked ? "left-4 bg-gray-1" : "left-0.5 bg-gray-12",
        )}
      />
    </button>
  );
}

/** Opção de rádio grande ("Vender junto" / "Minhas metas" / "Não vender"). */
export function RadioCard({
  checked,
  onSelect,
  title,
  detail,
  name,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
  name: string;
}) {
  return (
    <label
      className={cn(
        "flex w-full cursor-pointer items-start gap-2 rounded-lg border p-3 transition-colors",
        checked
          ? "border-principal-7 bg-[linear-gradient(90deg,rgba(249,210,64,0.12)_0%,rgba(249,210,64,0)_80%),linear-gradient(var(--color-gray-2),var(--color-gray-2))]"
          : "border-gray-5 bg-gray-2 hover:border-gray-7",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="peer sr-only" />
      <span
        aria-hidden
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border peer-focus-visible:outline-2 peer-focus-visible:outline-principal-9",
          checked ? "border-principal-9 bg-[#5a4a0a] text-gray-12" : "border-gray-8",
        )}
      >
        {checked && (
          <svg viewBox="0 0 20 20" fill="none" className="size-5">
            <path
              d="M5.33333 10.6667L7.68428 12.5474C8.23582 12.9887 9.03577 12.9232 9.50827 12.3982L14.6667 6.66667"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-2 leading-[1.3]">
        <span className="text-sm font-semibold text-gray-12">{title}</span>
        <span className="text-xs text-gray-11">{detail}</span>
      </span>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full gap-1 rounded-lg border border-gray-5 bg-gray-1 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex flex-1 items-center justify-center rounded border py-1.5 text-sm leading-[1.3] font-medium whitespace-nowrap transition-colors",
            value === o.value ? "border-gray-6 bg-gray-4 text-gray-12" : "border-transparent text-gray-11 hover:text-gray-12",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** "kpi - célula": rótulo 12 em cima, valor 16 (Unbounded nos KPIs do drawer). */
export function KpiCell({
  label,
  value,
  tone = "text-gray-12",
  display = false,
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: string;
  display?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-3 bg-gray-2 px-4 py-3", className)}>
      <p className="text-xs leading-[1.3] whitespace-nowrap text-gray-11">{label}</p>
      <p
        className={cn(
          "text-base leading-[1.1] font-semibold whitespace-nowrap tabular-nums",
          display && "font-display tracking-[1px]",
          tone,
        )}
      >
        {value}
      </p>
    </div>
  );
}
