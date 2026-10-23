"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import {
  resolveCopyAddress,
  type CopyConfig,
  type CopyTarget,
  type CopyView,
  type ExecMode,
  type KolRef,
  type ResolvedWallet,
} from "@/lib/api/copyTrade";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import {
  AMOUNT_PRESETS,
  DEFAULT_COPY_CONFIG,
  buyHint,
  configErrors,
  exceedsBalance,
  executionSummary,
  filtersSummary,
  protectionSummary,
} from "@/lib/copyTrade/config";
import { hitLabel, pnlTone, signedSol, sol, walletInitials, walletShort } from "@/lib/copyTrade/format";
import { useCopyMutations } from "@/lib/copyTrade/useCopies";
import { useCopyKol } from "@/lib/copyTrade/useCopyTrade";
import { tierFor, type TierSpec } from "@/lib/walletReader/types";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { BoltIcon, FilterIcon, RemoveIcon, ShieldIcon, TrashIcon } from "@/components/copyTrade/icons";
import { KpiCell, RadioCard, Segmented } from "@/components/copyTrade/controls";
import {
  Accordion,
  AddressField,
  AmountField,
  BlockTitle,
  FoundCard,
  FoundCardSkeleton,
  InitialsAvatar,
  NumberField,
  PendingButton,
  PrimaryButton,
  SOLANA_ADDRESS,
  TargetField,
  ToggleRow,
  useEscapeClose,
} from "@/components/copyTrade/drawerParts";
import { KolAvatar, RankTag, tierVars } from "@/components/copyTrade/parts";

export interface DrawerTarget {
  /** KOL escolhido (card/3ª coluna). Sem ele, o drawer pede um endereço. */
  kol: KolRef | null;
  /** Ajustar copy existente (ou "Copiar de novo" a partir de um encerrado). */
  copy?: CopyView;
}

interface Props {
  target: DrawerTarget;
  mode: ExecMode;
  /** Saldo da W1 (SOL); null = ainda sem W1 (é criada no 1º copy). */
  balanceSol: number | null;
  enabled: boolean;
  onClose: () => void;
  /** Copy salvo — a tela abre a carteira dele na 3ª coluna. */
  onSaved: (kol: KolRef) => void;
}

/**
 * Drawer "Configurar copy" (Figma 1618:29802 e variantes Padrão, Minhas
 * metas, Ajustes abertos e Saldo insuficiente). Três seções: quanto por
 * compra, quando vender e proteção/filtros/execução (recolhidos).
 *
 * Sem KOL escolhido vira o "Novo Wallet Copy" (1646:34851 vazio, 1646:35765
 * carteira encontrada): a seção 1 pede o endereço de QUALQUER carteira Solana
 * e as demais ficam travadas até a prévia chegar.
 *
 * Divergências: sem "≈ US$" sob o valor (o front não tem preço do SOL sem
 * abrir a CSP a outra origem); "dev vendeu" e "bundle" desabilitados — o
 * Tracker não tem fonte para esses sinais (decisão 2026-10-20).
 */
export function CopyConfigDrawer({ target, mode, balanceSol, enabled, onClose, onSaved }: Props) {
  const editing = target.copy && target.copy.status !== "ENDED" ? target.copy : null;
  const byAddress = !target.kol;
  const [cfg, setCfg] = useState<CopyConfig>(() => structuredClone(target.copy?.config ?? DEFAULT_COPY_CONFIG));
  const [address, setAddress] = useState("");
  const [open, setOpen] = useState<"protection" | "filters" | "execution" | null>(null);
  const { create, update } = useCopyMutations();
  const typed = address.trim();
  const validAddr = SOLANA_ADDRESS.test(typed);
  const resolved = useQuery({
    queryKey: ["copy-trade", "resolve", typed],
    queryFn: () => resolveCopyAddress(typed),
    enabled: enabled && byAddress && validAddr,
    staleTime: 60_000,
    retry: false,
  });
  // Prévia só vale para o endereço que está no campo agora.
  const found = byAddress && validAddr && resolved.data?.address === typed ? resolved.data : null;
  const kol: KolRef | null = target.kol ?? found?.kol ?? null;
  const resolving = byAddress && validAddr && resolved.isFetching && !found;
  const addrError =
    !byAddress || !typed
      ? null
      : !validAddr
        ? "This doesn't look like a Solana address."
        : resolved.isError
          ? getApiErrorMessage(resolved.error)
          : null;
  // Bloqueado até haver carteira: KOL escolhido ou endereço resolvido.
  const ready = !byAddress || !!found;
  const detail = useCopyKol(byAddress ? null : (kol?.id ?? null), enabled);
  const stats = detail.data?.kol.stats ?? null;
  const tier = tierFor(kol?.relevance ?? 0);
  const radioName = useId();
  // No "Novo Wallet Copy" a carteira é a seção 1 e as demais andam uma casa.
  const n0 = byAddress ? 1 : 0;

  useEscapeClose(onClose);

  const set = <K extends keyof CopyConfig>(k: K, v: Partial<CopyConfig[K]>) =>
    setCfg((c) => ({ ...c, [k]: { ...(c[k] as object), ...v } }));
  const lowBalance = exceedsBalance(cfg, balanceSol);
  const errors = configErrors(cfg);
  const busy = create.isPending || update.isPending;
  const canSubmit = ready && !errors.length && !lowBalance && !busy;

  const submit = async () => {
    if (!ready) return;
    try {
      let saved: CopyView;
      if (editing) saved = await update.mutateAsync({ copyId: editing.id, config: cfg });
      else if (found) {
        // Carteira de KOL segue pelo KOL; avulsa vai pelo endereço.
        saved = await create.mutateAsync(found.kol ? { kolId: found.kol.id, config: cfg } : { address: found.address, config: cfg });
      } else saved = await create.mutateAsync({ kolId: target.kol!.id, config: cfg });
      toast.success(editing ? "Copy updated." : `Copying ${saved.kol.label}.`);
      onSaved(saved.kol);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) setAddress(text);
    } catch {
      toast.error("Couldn't read the clipboard. Paste the address with Ctrl+V.");
    }
  };

  const setTarget = (i: number, t: Partial<CopyTarget>) =>
    set("sell", { targets: cfg.sell.targets.map((x, j) => (j === i ? { ...x, ...t } : x)) });

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Configure copy">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-gray-1/40" />
      <section
        style={tierVars(tier)}
        className="relative flex h-full w-full max-w-[460px] flex-col border-l border-gray-5 bg-gray-2 shadow-[-30px_0_80px_0_rgba(0,0,0,0.55)]"
      >
        {!byAddress && (
          <span aria-hidden className="pointer-events-none absolute top-0 -left-px right-0 z-20 h-0.5 bg-[linear-gradient(90deg,var(--tier-11),transparent)]" />
        )}
        <header className="relative z-20 flex items-center gap-2 border-b border-gray-6 bg-gray-2 px-4 py-2">
          <h2 className="flex-1 text-base leading-[1.1] font-semibold text-gray-12">
            {editing ? "Adjust copy" : byAddress ? "New Wallet Copy" : "Configure copy"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" autoFocus={!byAddress} className="rounded text-gray-12 hover:bg-gray-4">
            <RemoveIcon className="size-6" />
          </button>
        </header>

        {byAddress ? (
          /* 1. Carteira para copiar: campo do endereço + prévia ("carteira encontrada"). */
          <div className="flex flex-col gap-2 border-b border-gray-5 px-4 pt-3 pb-4">
            <BlockTitle n={1} title="Wallet to copy" />
            <AddressField
              value={address}
              onChange={setAddress}
              onPaste={paste}
              state={addrError ? "error" : typed ? "filled" : "empty"}
            />
            {resolving ? (
              <FoundCardSkeleton />
            ) : found ? (
              <FoundWallet wallet={found} tier={tier} />
            ) : (
              <p role={addrError ? "alert" : undefined} className={cn("text-xs leading-[1.3]", addrError ? "text-vermelho-11" : "text-gray-11")}>
                {addrError ?? "Paste the address of any Solana wallet. You'll see its track record before turning it on."}
              </p>
            )}
          </div>
        ) : (
        /* Perfil + KPIs do KOL escolhido. */
        <div className="relative isolate overflow-hidden border-b border-gray-5 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--tier-9)_55%,transparent)_0%,color-mix(in_srgb,var(--tier-9)_12%,transparent)_55%,transparent_100%)] px-4 pt-3 pb-4">
          {kol && (
            <div aria-hidden className="pointer-events-none absolute -top-10 -right-2.5 -z-10 size-[220px] [mask-image:radial-gradient(closest-side,#000_20%,transparent_100%)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tier.emblem} alt="" width={220} height={220} className="size-full object-cover opacity-45" />
            </div>
          )}
          {kol && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <KolAvatar kol={kol} tier={tier} ring="border" className="size-[52px] drop-shadow-[0_0_12px_color-mix(in_srgb,var(--tier-11)_55%,transparent)]" />
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-base leading-[1.1] font-semibold text-gray-12">{kol.label}</p>
                    <RankTag tier={tier} size="md" />
                  </div>
                </div>
              </div>
              <div className="flex overflow-hidden rounded-lg border border-gray-6">
                <KpiCell display label="Hit rate 30d" value={hitLabel(stats?.hitRate)} className="border-r border-gray-6" />
                <KpiCell display label="Result 30d" value={stats ? signedSol(stats.pnlSol) : "—"} tone={pnlTone(stats?.pnlSol)} className="border-r border-gray-6" />
                <KpiCell display label="Avg. bet" value={sol(stats?.avgBetSol)} />
              </div>
            </div>
          )}
        </div>
        )}

        <ScrollArea className="flex min-h-0 flex-1 flex-col" viewportClassName="min-h-0 flex-1">
          {/* Sem carteira ainda, o resto do formulário aparece apagado e fora do foco. */}
          <div inert={!ready} className={cn("flex flex-col gap-5 px-4 py-3 transition-opacity", !ready && "opacity-40")}>
            {mode !== "live" && (
              <p className="rounded-lg border border-principal-6 bg-principal-3 px-3 py-2 text-xs leading-[1.3] text-principal-11">
                {mode === "shadow"
                  ? "Simulation mode: every buy and sell is simulated with real quotes. No SOL leaves your W1 yet."
                  : "Copy execution is off for now: your copy is saved but won't trade yet."}
              </p>
            )}

            {/* 1. Quanto por compra */}
            <section className="flex flex-col gap-2">
              <BlockTitle n={n0 + 1} title="Amount per buy" />
              <Segmented
                label="Amount mode"
                value={cfg.buy.mode}
                onChange={(m) => set("buy", { mode: m })}
                options={[
                  { value: "match", label: "Same as him" },
                  { value: "fixed", label: "Fixed amount" },
                  { value: "percent", label: `${cfg.buy.percent}% of his` },
                ]}
              />
              <AmountField
                id="copy-amount"
                label={cfg.buy.mode === "fixed" ? "Amount per buy" : "Cap per buy"}
                value={cfg.buy.amountSol}
                onChange={(v) => set("buy", { amountSol: v })}
                presets={AMOUNT_PRESETS}
                error={lowBalance ? `Above your W1 balance (${sol(balanceSol)}). Lower the amount or deposit first.` : null}
              />
              <p className="text-xs leading-[1.3] text-gray-11">{buyHint(cfg)}</p>
            </section>

            {/* 2. Quando vender */}
            <section className="flex flex-col gap-2">
              <BlockTitle n={n0 + 2} title="When to sell" />
              <RadioCard
                name={radioName}
                checked={cfg.sell.mode === "follow"}
                onSelect={() => set("sell", { mode: "follow" })}
                title="Sell with him"
                detail="When he sells, you sell the same percentage."
              />
              <RadioCard
                name={radioName}
                checked={cfg.sell.mode === "targets"}
                onSelect={() => set("sell", { mode: "targets" })}
                title="My targets"
                detail="You set profit targets and a loss limit."
              />
              <RadioCard
                name={radioName}
                checked={cfg.sell.mode === "none"}
                onSelect={() => set("sell", { mode: "none" })}
                title="Don't sell"
                detail="Only copies the buys. You sell whenever you want."
              />
              {cfg.sell.mode === "targets" && (
                <div className="flex flex-col gap-2">
                  {cfg.sell.targets.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setTarget(i, { kind: t.kind === "profit" ? "loss" : "profit", atPct: -t.atPct || (t.kind === "profit" ? -50 : 100) })
                        }
                        title="Switch between profit and loss"
                        className={cn(
                          "w-[84px] shrink-0 rounded px-2 py-1.5 text-left text-xs leading-[1.3] font-semibold",
                          t.kind === "profit" ? "bg-green-3 text-green-11" : "bg-vermelho-3 text-vermelho-11",
                        )}
                      >
                        {t.kind === "profit" ? "Profit" : "Loss"}
                      </button>
                      <TargetField
                        prefix="at"
                        value={t.atPct}
                        onChange={(v) => setTarget(i, { atPct: v })}
                        label={`Target ${i + 1} trigger`}
                      />
                      <TargetField prefix="sell" value={t.sellPct} onChange={(v) => setTarget(i, { sellPct: v })} label={`Target ${i + 1} sell`} />
                      <button
                        type="button"
                        aria-label={`Remove target ${i + 1}`}
                        onClick={() => set("sell", { targets: cfg.sell.targets.filter((_, j) => j !== i) })}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-gray-6 bg-gray-3 text-gray-11 hover:text-gray-12"
                      >
                        <TrashIcon className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {cfg.sell.targets.length < 6 && (
                    <button
                      type="button"
                      onClick={() => set("sell", { targets: [...cfg.sell.targets, { kind: "profit", atPct: 200, sellPct: 50 }] })}
                      className="self-start text-xs leading-[1.3] font-medium text-principal-11 hover:text-principal-12"
                    >
                      + Add target
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* 3. Proteção e filtros */}
            <section className="flex flex-col gap-2">
              <BlockTitle n={n0 + 3} title="Protection and filters" hint="optional" />
              <Accordion
                icon={<ShieldIcon className="size-4" />}
                title="Deep Alpha protection"
                summary={protectionSummary(cfg)}
                open={open === "protection"}
                onToggle={() => setOpen(open === "protection" ? null : "protection")}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs leading-[1.3]">
                    <label htmlFor="copy-score" className="text-gray-11">Minimum token Deep Score</label>
                    <span className="text-sm font-semibold text-gray-12">{cfg.protection.minDeepScore ?? "Off"}</span>
                  </div>
                  <input
                    id="copy-score"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={cfg.protection.minDeepScore ?? 0}
                    onChange={(e) => set("protection", { minDeepScore: Number(e.target.value) || null })}
                    className="h-4 w-full accent-principal-9"
                  />
                  <div className="flex justify-between text-xs leading-[1.3] text-gray-9">
                    <span>More buys</span>
                    <span>Safer</span>
                  </div>
                </div>
                <div className="flex flex-col rounded-lg border border-gray-5">
                  <ToggleRow label="Don't buy if the dev sold" note="No data source yet" checked={false} disabled onChange={() => {}} />
                  <ToggleRow label="Don't buy with bundle above 15%" note="No data source yet" checked={false} disabled onChange={() => {}} />
                  <ToggleRow
                    label="Pause if I lose 20% in 24 h"
                    note="You get a warning and decide whether to resume."
                    checked={cfg.protection.pauseOnLossPct24h != null}
                    onChange={(v) => set("protection", { pauseOnLossPct24h: v ? 20 : null })}
                    last
                  />
                </div>
              </Accordion>

              <Accordion
                icon={<FilterIcon className="size-4" />}
                title="Token filters"
                summary={filtersSummary(cfg)}
                open={open === "filters"}
                onToggle={() => setOpen(open === "filters" ? null : "filters")}
              >
                <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                  <NumberField label="Minimum market cap" unit="k $" value={k(cfg.filters.mcMinUsd)} onChange={(v) => set("filters", { mcMinUsd: unk(v) })} />
                  <NumberField label="Maximum market cap" unit="k $" value={k(cfg.filters.mcMaxUsd)} onChange={(v) => set("filters", { mcMaxUsd: unk(v) })} />
                  <NumberField label="Minimum liquidity" unit="k $" value={k(cfg.filters.liqMinUsd)} onChange={(v) => set("filters", { liqMinUsd: unk(v) })} />
                  <NumberField label="Max. buys per day" unit="buys" value={cfg.filters.maxBuysPerDay} onChange={(v) => set("filters", { maxBuysPerDay: v })} />
                </div>
                <ToggleRow
                  label="Buy each token once"
                  note="Skips re-buys of the same token."
                  checked={cfg.filters.oncePerToken}
                  onChange={(v) => set("filters", { oncePerToken: v })}
                  bare
                />
              </Accordion>

              <Accordion
                icon={<BoltIcon className="size-4" />}
                title="Execution"
                summary={executionSummary(cfg)}
                open={open === "execution"}
                onToggle={() => setOpen(open === "execution" ? null : "execution")}
              >
                <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                  <NumberField
                    label="Priority fee"
                    unit="SOL"
                    step={0.001}
                    value={cfg.execution.priorityFeeSol}
                    onChange={(v) => set("execution", { priorityFeeSol: v ?? 0 })}
                  />
                  <NumberField
                    label="Max. slippage"
                    unit="%"
                    step={0.5}
                    value={cfg.execution.slippageBps / 100}
                    onChange={(v) => set("execution", { slippageBps: Math.round((v ?? 15) * 100) })}
                  />
                </div>
                <ToggleRow
                  label="Anti-MEV"
                  note="Sends through Jito so bots can't sandwich your trade."
                  checked={cfg.execution.antiMev}
                  onChange={(v) => set("execution", { antiMev: v })}
                  bare
                />
              </Accordion>
            </section>

            {errors.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-vermelho-11">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        </ScrollArea>

        <footer className="border-t border-gray-5 bg-gray-2 px-4 pt-3 pb-4">
          {ready ? (
            <PrimaryButton disabled={!canSubmit} onClick={submit}>
              {busy ? "Saving…" : editing ? "Save changes" : "Start copying"}
            </PrimaryButton>
          ) : (
            <PendingButton>{resolving ? "Looking up the wallet…" : "Paste the wallet address"}</PendingButton>
          )}
        </footer>
      </section>
    </div>
  );
}

/** "cartão - carteira encontrada" (Figma 1642:34085): identidade + 3 KPIs de 30d. */
function FoundWallet({ wallet, tier }: { wallet: ResolvedWallet; tier: TierSpec }) {
  const s = wallet.stats;
  return (
    <FoundCard
      avatar={
        wallet.kol ? (
          <KolAvatar kol={wallet.kol} tier={tier} ring="border" className="size-9" />
        ) : (
          <InitialsAvatar text={walletInitials(wallet.address)} />
        )
      }
      title={wallet.kol?.label ?? walletShort(wallet.address)}
      subtitle={wallet.kol ? walletShort(wallet.address) : "No KOL profile"}
      kpis={[
        { label: "Hit rate 30d", value: hitLabel(s?.hitRate) },
        { label: "Result 30d", value: s ? signedSol(s.pnlSol) : "—", tone: pnlTone(s?.pnlSol) },
        { label: "Trades 30d", value: s ? `${s.trades.toLocaleString("en-US")}${s.partial ? "+" : ""}` : "—" },
      ]}
    />
  );
}

/** Filtros em mil dólares (campo "50 mil $" = $50k). */
const k = (usd: number | null) => (usd == null ? null : usd / 1000);
const unk = (v: number | null) => (v == null ? null : Math.round(v * 1000));
