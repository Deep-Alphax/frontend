"use client";

import type { SnipeFire, SnipeOverview, SnipeView } from "@/lib/api/devSnipe";
import { cn } from "@/lib/cn";
import { multipleLabel, pnlTone, signedSol } from "@/lib/copyTrade/format";
import { devInitials, perTokenLabel, waitingProgress } from "@/lib/devSnipe/config";
import { tokenLabel } from "@/lib/tracker/format";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { PlusLargeIcon } from "@/components/copyTrade/icons";

interface Props {
  overview: SnipeOverview | undefined;
  loading: boolean;
  onCreate: () => void;
  onEdit: (snipe: SnipeView) => void;
}

/**
 * Coluna da esquerda do Dev Snipe (Figma 1633:33460): "Create Dev Snipe" fixo
 * no topo e os grupos Aguardando lançamento / Disparados. Clicar num snipe
 * aguardando abre o drawer para ajustar.
 */
export function SnipesColumn({ overview, loading, onCreate, onEdit }: Props) {
  const waiting = overview?.waiting ?? [];
  const fired = overview?.fired ?? [];
  const simulated = overview?.mode === "shadow";

  return (
    <div className="flex flex-col gap-4 px-3 py-4">
      <section
        aria-labelledby="create-snipe-title"
        className="flex flex-col gap-4 rounded-2xl border border-principal-11 bg-[linear-gradient(115.47deg,var(--color-principal-3)_5.57%,var(--color-gray-2)_97.83%)] p-4"
      >
        <div className="flex flex-col gap-3">
          <h2 id="create-snipe-title" className="text-lg leading-[1.1] font-semibold text-gray-12">
            Create Dev Snipe
          </h2>
          <p className="text-sm leading-[1.3] text-gray-11">
            Paste a dev&apos;s wallet. When they launch a new token, you buy in the first block.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-principal-9 px-8 text-base leading-[1.1] font-semibold text-gray-1 transition-colors hover:bg-principal-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-principal-9"
        >
          <PlusLargeIcon className="size-5" />
          Create Dev Snipe
        </button>
      </section>

      {loading ? (
        <SkeletonGroup label="Loading your snipes" className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[60px] rounded-xl" />
          ))}
        </SkeletonGroup>
      ) : waiting.length + fired.length === 0 ? (
        <p className="px-1 text-xs leading-[1.3] text-gray-11">
          No snipes yet. Paste a dev wallet or pick a trending dev on the side.
        </p>
      ) : (
        <>
          {waiting.length > 0 && (
            <Group title="Waiting for launch" hint="snipes" count={waiting.length}>
              {waiting.map((s) => (
                <li key={s.id}>
                  <WaitingItem snipe={s} onOpen={() => onEdit(s)} />
                </li>
              ))}
            </Group>
          )}
          {fired.length > 0 && (
            <Group title="Fired" hint={simulated ? "result · simulated" : "result"} count={fired.length}>
              {fired.map((f) => (
                <li key={`${f.snipeId}:${f.mint}`}>
                  <FiredItem fire={f} />
                </li>
              ))}
            </Group>
          )}
        </>
      )}
    </div>
  );
}

function Group({ title, hint, count, children }: { title: string; hint: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm leading-[1.1] font-semibold text-gray-12">
          {title}
          <span className="flex min-w-5 items-center justify-center rounded-full border border-gray-6 bg-gray-3 px-1 py-0.5 text-xs leading-[1.3] font-medium text-gray-11">
            {count}
          </span>
        </h3>
        <span className="text-xs leading-[1.3] text-gray-9">{hint}</span>
      </div>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

function DevBadge({ dev }: { dev: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-gray-6 bg-gray-4 text-xs leading-[1.3] font-semibold text-gray-12">
      {devInitials(dev)}
    </span>
  );
}

/** "item - dev snipe" aguardando (Figma 1630:33437). */
function WaitingItem({ snipe: s, onOpen }: { snipe: SnipeView; onOpen: () => void }) {
  const p = waitingProgress(s);
  const paused = s.status === "PAUSED";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Adjust snipe on ${s.label}`}
      className="flex h-[60px] w-full items-center gap-3 rounded-xl border border-gray-5 bg-gray-2 p-3 text-left transition-colors hover:border-gray-8"
    >
      <DevBadge dev={s.dev} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1">
          <span className="truncate text-sm leading-[1.3] font-semibold text-gray-12">{s.label}</span>
          <span
            aria-hidden
            className={cn(
              "size-[7px] shrink-0 rounded-full",
              paused ? "bg-laranja-9 shadow-[0_0_0_3px_rgba(247,107,21,0.2)]" : "bg-principal-9 shadow-[0_0_0_3px_rgba(249,210,64,0.35)]",
            )}
          />
        </span>
        <span className="truncate text-xs leading-[1.3] text-gray-11">{perTokenLabel(s.config)}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5 text-right leading-[1.3] whitespace-nowrap">
        <span className="text-sm font-semibold text-gray-12 tabular-nums">{p.count}</span>
        <span className={cn("text-xs", paused ? "text-laranja-11" : "text-gray-11")}>{p.state}</span>
      </span>
    </button>
  );
}

/** "item - dev snipe" disparado: token comprado, resultado e múltiplo. */
function FiredItem({ fire: f }: { fire: SnipeFire }) {
  return (
    <div className="flex h-[60px] w-full items-center gap-3 rounded-xl border border-gray-5 bg-gray-2 p-3">
      <DevBadge dev={f.dev} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm leading-[1.3] font-semibold text-gray-12">{f.label}</span>
        <span className="truncate text-xs leading-[1.3] text-gray-11">Bought {tokenLabel(f)}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5 text-right leading-[1.3] whitespace-nowrap">
        <span className={cn("text-sm font-semibold tabular-nums", pnlTone(f.resultSol))}>
          {f.resultSol == null ? "—" : signedSol(f.resultSol)}
        </span>
        <span className="text-xs text-gray-11">{f.multiple == null ? (f.open ? "open" : "—") : multipleLabel(f.multiple)}</span>
      </span>
    </div>
  );
}
