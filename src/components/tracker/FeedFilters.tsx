"use client";

import { useMemo, useState, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";

import type { TrackerEvent, TrackerFeedFilters, TrackerFilterOptions } from "@/lib/api/tracker";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/tracker/format";
import { useBuyTerminal } from "@/lib/tracker/useBuyTerminal";

/*
 * Filtros do SocialFi Wallet Tracker (Figma 1333:57022 + 1333:56940). Cada
 * chip é um gatilho de 32px (borda gray-6, raio 8) que abre um menu Radix —
 * teclado, foco e ESC de graça.
 */

const NETWORKS: Array<{ value: TrackerFeedFilters["chain"]; label: string }> = [
  { value: undefined, label: "All networks" },
  { value: "SOLANA", label: "Solana" },
  { value: "ETHEREUM", label: "Ethereum" },
  { value: "BASE", label: "Base" },
  { value: "BSC", label: "BNB Chain" },
];

const EVENTS: Array<{ value: TrackerEvent; label: string }> = [
  { value: "all", label: "All" },
  { value: "buys", label: "Buys" },
  { value: "sells", label: "Sells" },
  { value: "calls", label: "Calls" },
  { value: "strikes", label: "Strikes" },
];

const VALUES: Array<{ value: number; label: string }> = [
  { value: 0, label: "Any" },
  { value: 1_000, label: "≥ $1k" },
  { value: 5_000, label: "≥ $5k" },
  { value: 10_000, label: "≥ $10k" },
  { value: 50_000, label: "≥ $50k" },
];

/** Cores da pilha de avatares do chip de carteiras (Figma 1335:1400). */
const STACK = ["bg-[#c96cae]", "bg-[#4a9e6b]", "bg-[#2e3040]"];

const contentCls =
  "z-50 min-w-[180px] overflow-hidden rounded-lg border border-gray-6 bg-gray-2 p-1 shadow-lg";
const itemCls =
  "flex h-9 cursor-pointer select-none items-center justify-between gap-3 rounded-md px-3 text-sm font-medium text-gray-12 outline-none data-[highlighted]:bg-gray-4";

function Chevron() {
  // eslint-disable-next-line @next/next/no-img-element -- ícone SVG do Figma
  return <img src="/tracker/chevron-down.svg" alt="" className="size-3 shrink-0" />;
}

function Trigger({ children, label }: { children: ReactNode; label: string }) {
  return (
    <DropdownMenu.Trigger
      aria-label={label}
      className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-gray-6 bg-gray-1 px-2 text-xs font-medium leading-[1.3] text-gray-12 outline-none transition-colors hover:border-gray-8 focus-visible:ring-2 focus-visible:ring-secundaria-11/40 data-[state=open]:border-gray-8"
    >
      {children}
    </DropdownMenu.Trigger>
  );
}

function Option({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <DropdownMenu.Item className={itemCls} onSelect={onSelect}>
      <span className="truncate">{children}</span>
      {selected && <Check className="size-4 shrink-0 text-principal-11" aria-hidden />}
    </DropdownMenu.Item>
  );
}

/** Chip "All wallets (n)" — escolhe KOLs (multi) com busca. */
export function WalletsFilter({
  options,
  selected,
  onChange,
}: {
  options: TrackerFilterOptions | undefined;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const kols = useMemo(() => options?.kols ?? [], [options]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (term ? kols.filter((k) => k.name.toLowerCase().includes(term)) : kols).slice(0, 80);
  }, [kols, q]);
  const sel = new Set(selected);
  const stack = (selected.length ? kols.filter((k) => sel.has(k.id)) : kols).slice(0, 3);
  const count = selected.length || options?.totalKols || 0;

  const toggle = (id: string) =>
    onChange(sel.has(id) ? selected.filter((x) => x !== id) : [...selected, id].slice(0, 100));

  return (
    <DropdownMenu.Root onOpenChange={(o) => !o && setQ("")}>
      <Trigger label="Filter by wallet">
        <span className="flex items-center">
          {stack.map((k, i) => (
            <span
              key={k.id}
              className={cn(
                "flex size-[18px] items-center justify-center rounded-full border border-[#1e1f25] font-bold text-white",
                i < stack.length - 1 && "-mr-1.5",
                STACK[i],
                initials(k.name).length > 1 && i === 2 ? "text-[7px]" : "text-[8px]",
              )}
            >
              {i === 2 ? initials(k.name) : initials(k.name).charAt(0)}
            </span>
          ))}
        </span>
        <span className="text-gray-12">{selected.length ? "Selected wallets" : "All wallets"}</span>
        <span className="rounded-full bg-[#2a2b33] px-[5px] py-0.5 text-[11px] font-medium text-[#8a8c9a]">{count}</span>
        <Chevron />
      </Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={8} className={cn(contentCls, "w-64")}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Search KOL"
            aria-label="Search KOL"
            className="mb-1 h-9 w-full rounded-md border border-gray-6 bg-gray-1 px-3 text-sm text-gray-12 outline-none placeholder:text-gray-9 focus:border-gray-8"
          />
          <Option selected={!selected.length} onSelect={() => onChange([])}>
            All wallets
          </Option>
          <div className="max-h-72 overflow-y-auto">
            {shown.map((k) => (
              <DropdownMenu.CheckboxItem
                key={k.id}
                checked={sel.has(k.id)}
                onSelect={(e) => {
                  e.preventDefault(); // multi-seleção: o menu fica aberto
                  toggle(k.id);
                }}
                className={itemCls}
              >
                <span className="truncate">{k.name}</span>
                <DropdownMenu.ItemIndicator>
                  <Check className="size-4 text-principal-11" aria-hidden />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.CheckboxItem>
            ))}
            {!shown.length && <p className="px-3 py-2 text-sm text-gray-11">No KOL found</p>}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function NetworkFilter({
  value,
  onChange,
}: {
  value: TrackerFeedFilters["chain"];
  onChange: (v: TrackerFeedFilters["chain"]) => void;
}) {
  const current = NETWORKS.find((n) => n.value === value) ?? NETWORKS[0];
  return (
    <DropdownMenu.Root>
      <Trigger label="Filter by network">
        <span className="text-gray-12">{current.label}</span>
        <Chevron />
      </Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={8} className={contentCls}>
          {NETWORKS.map((n) => (
            <Option key={n.label} selected={n.value === value} onSelect={() => onChange(n.value)}>
              {n.label}
            </Option>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Chip "Rótulo Valor" (Event All / Value Any). */
function LabeledSelect<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <DropdownMenu.Root>
      <Trigger label={`Filter by ${label.toLowerCase()}`}>
        <span className="text-[#8a8c9a]">{label}</span>
        <span className="text-gray-12">{current.label}</span>
        <Chevron />
      </Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={8} className={contentCls}>
          {options.map((o) => (
            <Option key={String(o.value)} selected={o.value === value} onSelect={() => onChange(o.value)}>
              {o.label}
            </Option>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function EventFilter({ value, onChange }: { value: TrackerEvent; onChange: (v: TrackerEvent) => void }) {
  return <LabeledSelect label="Event" options={EVENTS} value={value} onChange={onChange} />;
}

export function ValueFilter({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <LabeledSelect label="Value" options={VALUES} value={value} onChange={onChange} />;
}

/** "Quick buy ◎ ›" — onde o Buy abre tokens Solana (Axiom padrão; GMGN). */
export function QuickBuyMenu() {
  const [terminal, setTerminal] = useBuyTerminal();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="Quick buy settings"
        className="flex h-8 items-center gap-1 rounded-lg border border-gray-6 bg-gray-1 px-2 outline-none transition-colors hover:border-gray-8 focus-visible:ring-2 focus-visible:ring-secundaria-11/40"
      >
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-medium leading-[1.3] text-gray-11">Quick buy</span>
          <span className="relative size-4 rounded-full bg-[linear-gradient(59deg,#9945ff_11%,#14f195_91%)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- marca SVG do Figma */}
            <img src="/tracker/solana-mark.svg" alt="" className="absolute left-[3.2px] top-[3.82px] h-[8.364px] w-[9.6px]" />
          </span>
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element -- ícone SVG do Figma */}
        <img src="/tracker/arrow-right.svg" alt="" className="size-6 -scale-y-100" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className={cn(contentCls, "w-60")}>
          <DropdownMenu.Label className="px-3 py-2 text-xs leading-[1.4] text-gray-11">
            Open Solana tokens in… (EVM tokens always open in GMGN)
          </DropdownMenu.Label>
          <Option selected={terminal === "axiom"} onSelect={() => setTerminal("axiom")}>
            Axiom
          </Option>
          <Option selected={terminal === "gmgn"} onSelect={() => setTerminal("gmgn")}>
            GMGN
          </Option>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
