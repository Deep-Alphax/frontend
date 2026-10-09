"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { getApiErrorMessage } from "@/lib/api/client";
import {
  RANKING_ADMIN_KEY,
  RANKING_KEY,
  createRankingSeason,
  deleteRankingSeason,
  listRankingSeasons,
  updateRankingSeason,
  type AdminRankingSeason,
} from "@/lib/api/ranking";
import { cn } from "@/lib/cn";
import { MAX_PRIZES, fmtPrize, formatPrizes, parsePrizes } from "@/lib/ranking/rules";
import { TableSkeleton } from "@/components/ui/Skeleton";

/** ISO → valor de `<input type="datetime-local">` no fuso do navegador. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

interface Draft {
  name: string;
  startsAt: string;
  endsAt: string;
  prizes: string;
}

const EMPTY: Draft = { name: "", startsAt: "", endsAt: "", prizes: "" };

function draftOf(s: AdminRankingSeason): Draft {
  return {
    name: s.name,
    startsAt: toLocalInput(s.startsAt),
    endsAt: toLocalInput(s.endsAt),
    prizes: formatPrizes(s.prizes),
  };
}

const inputCls =
  "h-11 rounded-lg border border-gray-6 bg-gray-2 px-3 text-sm text-gray-12 outline-none transition-colors focus:border-secundaria-11";

/**
 * Temporadas do Deep Ranking. Uma por vez (o servidor recusa sobreposição);
 * datas no fuso do navegador, gravadas em UTC. Prêmio = lista por posição.
 */
export function RankingAdmin() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: RANKING_ADMIN_KEY,
    queryFn: listRankingSeasons,
  });

  const [editing, setEditing] = useState<string | null>(null); // id ou "new"
  const [draft, setDraft] = useState<Draft>(EMPTY);

  const prizes = parsePrizes(draft.prizes);
  const start = draft.startsAt ? new Date(draft.startsAt) : null;
  const end = draft.endsAt ? new Date(draft.endsAt) : null;
  const invalid =
    !draft.name.trim() || !start || !end || end <= start || prizes === null;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: RANKING_ADMIN_KEY });
    void qc.invalidateQueries({ queryKey: RANKING_KEY });
  };

  const save = useMutation({
    mutationFn: async () => {
      const input = {
        name: draft.name.trim(),
        startsAt: start!.toISOString(),
        endsAt: end!.toISOString(),
        prizes: prizes ?? [],
      };
      if (editing === "new") await createRankingSeason(input);
      else if (editing) await updateRankingSeason(editing, input);
    },
    onSuccess: () => {
      toast.success(editing === "new" ? "Season created." : "Season updated.");
      setEditing(null);
      setDraft(EMPTY);
      invalidate();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not save the season.")),
  });

  const remove = useMutation({
    mutationFn: deleteRankingSeason,
    onSuccess: () => {
      toast.success("Season deleted.");
      invalidate();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not delete the season.")),
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-12">Deep Ranking seasons</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-11">
            KOL calls made between the start and the end of a season score points. Seasons can’t
            overlap. The standings refresh every 5 minutes and keep settling for 24h after the
            end, while the last calls close their window.
          </p>
        </div>
        {editing === null && (
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY);
              setEditing("new");
            }}
            className="h-11 rounded-lg bg-principal-9 px-5 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10"
          >
            New season
          </button>
        )}
      </div>

      {editing !== null && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!invalid) save.mutate();
          }}
          className="flex flex-col gap-4 rounded-lg border border-gray-6 bg-gray-2 p-5"
        >
          <h2 className="text-base font-semibold text-gray-12">
            {editing === "new" ? "New season" : "Edit season"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm text-gray-11">
              Name
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                maxLength={60}
                placeholder="Season 1"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-gray-11">
              Starts
              <input
                type="datetime-local"
                value={draft.startsAt}
                onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-gray-11">
              Ends
              <input
                type="datetime-local"
                value={draft.endsAt}
                onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
                className={cn(inputCls, start && end && end <= start && "border-vermelho-9")}
              />
            </label>
          </div>
          <label className="flex flex-col gap-2 text-sm text-gray-11">
            Prizes in USD, one per position (1st, 2nd, 3rd…), up to {MAX_PRIZES}
            <textarea
              value={draft.prizes}
              onChange={(e) => setDraft({ ...draft, prizes: e.target.value })}
              rows={5}
              placeholder={"10000\n5000\n2500\n200\n100"}
              className={cn(
                "rounded-lg border bg-gray-2 px-3 py-2 text-sm text-gray-12 outline-none",
                prizes === null ? "border-vermelho-9" : "border-gray-6 focus:border-secundaria-11",
              )}
            />
            {prizes === null && (
              <span className="text-xs text-vermelho-11">
                Whole dollar amounts only (up to $1,000,000), separated by line breaks or commas.
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={invalid || save.isPending}
              className="h-11 rounded-lg bg-principal-9 px-5 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="h-11 rounded-lg border border-gray-6 bg-gray-3 px-5 text-sm font-semibold text-gray-12 hover:border-gray-8"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <TableSkeleton rows={3} cols={4} />
      ) : isError ? (
        <p className="text-sm text-gray-11">{getApiErrorMessage(error, "Could not load the seasons.")}</p>
      ) : !data?.length ? (
        <p className="rounded-lg border border-gray-6 bg-gray-2 px-6 py-10 text-center text-sm text-gray-11">
          No seasons yet. The Deep Ranking page shows a placeholder until the first one is created.
        </p>
      ) : (
        <ul aria-label="Seasons" className="flex flex-col divide-y divide-gray-6 rounded-lg border border-gray-6 bg-gray-2">
          {data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-12">{s.name}</p>
                <p className="text-xs text-gray-11">
                  {fmtDate(s.startsAt)} → {fmtDate(s.endsAt)} · {s.kols} KOLs ranked
                </p>
                <p className="mt-1 truncate text-xs text-gray-11">
                  {s.prizes.length
                    ? s.prizes.map((p, i) => `#${i + 1} ${fmtPrize(p)}`).join(" · ")
                    : "No prizes"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDraft(draftOf(s));
                  setEditing(s.id);
                }}
                className="rounded-lg border border-gray-6 bg-gray-3 px-3 py-1.5 text-sm text-gray-12 hover:border-gray-8"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(`Delete "${s.name}" and its standings? This can't be undone.`)) {
                    remove.mutate(s.id);
                  }
                }}
                className="rounded-lg border border-gray-6 bg-gray-3 px-3 py-1.5 text-sm text-gray-11 hover:border-vermelho-7 hover:text-vermelho-11"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
