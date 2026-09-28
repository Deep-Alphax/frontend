"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";


import {
  AFFILIATE_ADMIN_KEY,
  AFFILIATE_SETTINGS_KEY,
  formatBps,
  formatCents,
  getAffiliateSettings,
  listAffiliates,
  setAffiliateRates,
  updateAffiliateSettings,
  type AdminAffiliateRow,
} from "@/lib/api/affiliates";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Skeleton, SkeletonGroup, TableSkeleton } from "@/components/ui/Skeleton";

/**
 * Configuração do programa de afiliados.
 *
 * Duas coisas, na ordem em que se decide: o padrão que vale para todo mundo e,
 * abaixo, a exceção de quem foi contratado com condição própria.
 *
 * Os percentuais são digitados em % e viajam em basis points — a conversão
 * acontece só na borda, porque é em bps que o backend grava e aplica.
 */
export function AffiliatesAdmin() {
  return (
    <div className="flex flex-col gap-10">
      <SettingsCard />
      <AffiliatesTable />
    </div>
  );
}

/** Percentual digitado ("20", "7,5") → basis points; null quando inválido. */
function parsePercent(raw: string): number | null {
  const normalized = raw.trim().replace("%", "").replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return Math.round(value * 100);
}

function SettingsCard() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: AFFILIATE_SETTINGS_KEY,
    queryFn: getAffiliateSettings,
  });

  const [level1, setLevel1] = useState<string | null>(null);
  const [level2, setLevel2] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: updateAffiliateSettings,
    onSuccess: (next) => {
      queryClient.setQueryData(AFFILIATE_SETTINGS_KEY, next);
      setLevel1(null);
      setLevel2(null);
      toast.success("Default rates updated.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  if (isLoading || !data) {
    return (
      <SkeletonGroup className="flex flex-col gap-4 py-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <TableSkeleton rows={4} cols={4} />
      </SkeletonGroup>
    );
  }

  // O campo só assume estado próprio depois que alguém digita; até lá espelha
  // o servidor, então salvar em outra aba aparece aqui sem pisar no rascunho.
  const v1 = level1 ?? (data.level1Bps / 100).toString();
  const v2 = level2 ?? (data.level2Bps / 100).toString();
  const bps1 = parsePercent(v1);
  const bps2 = parsePercent(v2);
  const invalid = bps1 === null || bps2 === null;
  const dirty = bps1 !== data.level1Bps || bps2 !== data.level2Bps;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-12">Default rates</h2>
        <p className="mt-1 text-sm text-gray-11">
          Level 1 is whoever referred the paying customer. Level 2 is whoever
          referred that person. Both come out of the company — a level 2 payout
          never reduces level 1. Changing these only affects future commissions;
          what is already accrued keeps the rate it was booked at.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <PercentField
          id="level1"
          label="Level 1"
          value={v1}
          onChange={setLevel1}
          invalid={bps1 === null}
        />
        <PercentField
          id="level2"
          label="Level 2"
          value={v2}
          onChange={setLevel2}
          invalid={bps2 === null}
        />
        <button
          type="button"
          disabled={invalid || !dirty || save.isPending}
          onClick={() =>
            save.mutate({
              level1Bps: bps1 as number,
              level2Bps: bps2 as number,
            })
          }
          className="h-11 rounded-lg bg-principal-9 px-5 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save defaults"}
        </button>
      </div>
    </section>
  );
}

function PercentField({
  id,
  label,
  value,
  onChange,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm text-gray-11">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          className={cn(
            "h-11 w-24 rounded-lg border bg-gray-2 px-3 text-sm text-gray-12 outline-none transition-colors",
            invalid
              ? "border-danger-11"
              : "border-gray-6 focus:border-secundaria-11",
          )}
        />
        <span className="text-sm text-gray-11">%</span>
      </div>
    </div>
  );
}

function AffiliatesTable() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: AFFILIATE_ADMIN_KEY,
    queryFn: listAffiliates,
  });

  if (isLoading) {
    return (
      <SkeletonGroup className="flex flex-col gap-4 py-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <TableSkeleton rows={4} cols={4} />
      </SkeletonGroup>
    );
  }
  if (isError || !data) {
    return (
      <p className="text-sm text-gray-11">
        {getApiErrorMessage(error, "Could not load the affiliates.")}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-12">Affiliates</h2>
        <p className="mt-1 text-sm text-gray-11">
          Anyone who has opened the affiliate panel appears here. Leave a rate
          empty to follow the default; set it to 0 to pay nothing on that level
          without breaking the link.
        </p>
      </div>

      {data.length === 0 ? (
        <p className="rounded-lg border border-gray-6 bg-gray-2 px-4 py-8 text-center text-sm text-gray-11">
          No affiliates yet.
        </p>
      ) : (
        <ScrollArea orientation="horizontal" className="rounded-lg border border-gray-6">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="bg-gray-3 text-left text-gray-11">
                  {[
                    "Affiliate",
                    "Code",
                    "Referrals",
                    "Earned",
                    "Level 1",
                    "Level 2",
                    "",
                  ].map((h, i) => (
                    <th
                      key={h || i}
                      scope="col"
                      className="border-b border-gray-6 px-4 py-3 font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <AffiliateRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
        </ScrollArea>
      )}
    </section>
  );
}

function AffiliateRow({ row }: { row: AdminAffiliateRow }) {
  const queryClient = useQueryClient();
  const [l1, setL1] = useState<string | null>(null);
  const [l2, setL2] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (input: {
      level1Bps?: number | null;
      level2Bps?: number | null;
    }) => setAffiliateRates(row.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AFFILIATE_ADMIN_KEY });
      setL1(null);
      setL2(null);
      toast.success(`${row.name} updated.`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  // Vazio = "segue o padrão" (null no backend). Distinguir vazio de 0 é o que
  // permite zerar a comissão sem apagar a exceção.
  const shown = (bps: number | null) =>
    bps === null ? "" : (bps / 100).toString();
  const v1 = l1 ?? shown(row.level1Bps);
  const v2 = l2 ?? shown(row.level2Bps);

  const toBps = (raw: string): number | null | undefined => {
    if (raw.trim() === "") return null; // volta ao padrão
    const parsed = parsePercent(raw);
    return parsed === null ? undefined : parsed; // undefined = inválido
  };

  const next1 = toBps(v1);
  const next2 = toBps(v2);
  const invalid = next1 === undefined || next2 === undefined;
  const dirty = next1 !== row.level1Bps || next2 !== row.level2Bps;

  const cell = "border-b border-gray-6 px-4 py-3";
  const input =
    "h-9 w-20 rounded-md border bg-gray-2 px-2 text-sm text-gray-12 outline-none transition-colors";

  return (
    <tr>
      <td className={cell}>
        <span className="block text-gray-12">{row.name}</span>
        <span className="block text-xs text-gray-11">{row.email}</span>
      </td>
      <td className={cn(cell, "font-mono text-gray-11")}>{row.referralCode}</td>
      <td className={cn(cell, "text-gray-11")}>{row.referralCount}</td>
      <td className={cn(cell, "text-gray-12")}>
        {formatCents(row.totalEarnedCents, "usd")}
      </td>
      <td className={cell}>
        <RateInput
          label={`Level 1 rate for ${row.name}`}
          value={v1}
          onChange={setL1}
          invalid={next1 === undefined}
          className={input}
        />
      </td>
      <td className={cell}>
        <RateInput
          label={`Level 2 rate for ${row.name}`}
          value={v2}
          onChange={setL2}
          invalid={next2 === undefined}
          className={input}
        />
      </td>
      <td className={cell}>
        <button
          type="button"
          disabled={invalid || !dirty || save.isPending}
          onClick={() =>
            save.mutate({
              level1Bps: next1 as number | null,
              level2Bps: next2 as number | null,
            })
          }
          className="rounded-md border border-gray-6 bg-gray-3 px-3 py-1.5 text-sm text-gray-12 transition-colors hover:bg-gray-4 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
      </td>
    </tr>
  );
}

function RateInput({
  label,
  value,
  onChange,
  invalid,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  className: string;
}) {
  return (
    <input
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="default"
      inputMode="decimal"
      className={cn(
        className,
        invalid
          ? "border-danger-11"
          : "border-gray-6 focus:border-secundaria-11",
      )}
    />
  );
}

/** Reexportado para os testes lerem o mesmo formato da tela. */
export { formatBps };
