"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/cn";
import type { RadarGroup } from "@/components/radar/useRadarFeed";

/** Paleta determinística p/ o avatar do grupo (tokens do design system). */
const GROUP_COLORS = [
  "bg-secundaria-11 text-gray-1",
  "bg-purple-10 text-gray-1",
  "bg-green-10 text-gray-1",
  "bg-amber-10 text-gray-1",
  "bg-danger-10 text-gray-12",
  "bg-blue-10 text-gray-1",
  "bg-mint-10 text-gray-1",
] as const;

/** Hash estável → índice de cor (mesmo grupo sempre com a mesma cor). */
function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return GROUP_COLORS[Math.abs(h) % GROUP_COLORS.length];
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/** Formata contagens grandes: 1423 → "1.423" (pt-BR). */
function fmtCount(n: number): string {
  return n.toLocaleString("pt-BR");
}

interface GroupsPanelProps {
  groups: RadarGroup[];
  /** Total de mensagens carregadas (badge de "Todos os grupos"). */
  loaded: number;
  /** `null` = "Todos os grupos" selecionado (default). */
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}

/** Pílula de contagem à direita da linha (variante ativa = dourada). */
function CountBadge({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-xl border px-2 py-1.5 text-xs font-normal leading-none tabular-nums",
        active
          ? "border-principal-8 bg-principal-3 text-principal-11"
          : "border-gray-6 bg-gray-3 text-gray-11",
      )}
    >
      {children}
    </span>
  );
}

/** Barra de acento à esquerda da linha ativa (espelha o node do Figma). */
function ActiveBar() {
  return (
    <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-xl bg-principal-9" />
  );
}

/**
 * Coluna esquerda: servidores (grupos) do Discord. Lista dividida por bordas
 * (node Figma 492:9721). "Todos os grupos" limpa o filtro; cada grupo filtra o
 * feed. A busca filtra a lista localmente.
 */
export function GroupsPanel({ groups, loaded, selectedKey, onSelect }: GroupsPanelProps) {
  const [term, setTerm] = useState("");

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, term]);

  const allActive = selectedKey === null;

  return (
    <aside className="flex flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-2">
      {/* Título */}
      <div className="border-b border-gray-6 px-3 py-3">
        <h2 className="text-base font-semibold leading-tight text-gray-12">Grupos</h2>
      </div>

      {/* Busca */}
      <div className="p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-11"
            strokeWidth={1.75}
          />
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Busque um grupo aqui..."
            aria-label="Buscar grupo"
            className={cn(
              "h-10 w-full rounded-lg border border-gray-6 bg-gray-2 pl-10 pr-3",
              "text-sm text-gray-12 placeholder:text-gray-11 outline-none",
              "focus-visible:border-secundaria-11/60 focus-visible:ring-2 focus-visible:ring-secundaria-11/30",
            )}
          />
        </div>
      </div>

      {/* Lista dividida por bordas */}
      <nav className="flex flex-col">
        {/* Todos os grupos */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-current={allActive ? "true" : undefined}
          className={cn(
            "relative flex items-center justify-between gap-2 border-t border-gray-6 px-3 py-2 text-left transition-colors",
            allActive ? " bg-gray-3" : "hover:bg-gray-3/50",
          )}
        >
          {allActive && <ActiveBar />}
          <span className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/deep-alpha-logomark.svg"
              alt=""
              width={28}
              height={28}
              className="size-7 shrink-0"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-gray-12">
                Todos os grupos
              </span>
              <span className="block truncate text-xs text-gray-11">
                {groups.length} {groups.length === 1 ? "Fonte ativa" : "Fontes ativas"}
              </span>
            </span>
          </span>
          <CountBadge active={allActive}>{fmtCount(loaded)}</CountBadge>
        </button>

        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm text-gray-11">Nenhum grupo encontrado.</p>
        ) : (
          filtered.map((g) => {
            const active = g.key === selectedKey;
            return (
              <button
                key={g.key ?? "__none__"}
                type="button"
                onClick={() => onSelect(g.key)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "relative flex items-center justify-between border-t gap-2 border-gray-6 px-3 py-2 text-left transition-colors",
                  active ? " bg-gray-3" : "hover:bg-gray-3/50",
                )}
              >
                {active && <ActiveBar />}
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      colorFor(g.name),
                    )}
                  >
                    {initial(g.name)}
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium text-gray-12">
                    {g.name}
                  </span>
                </span>
                <CountBadge active={active}>{fmtCount(g.count)}</CountBadge>
              </button>
            );
          })
        )}
      </nav>
    </aside>
  );
}
