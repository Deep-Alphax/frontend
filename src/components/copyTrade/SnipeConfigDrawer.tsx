"use client";

import { useId, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import toast from "react-hot-toast";

import type { ExecMode } from "@/lib/api/copyTrade";
import type { SnipeConfig, SnipeRule, SnipeRuleKind, SnipeView } from "@/lib/api/devSnipe";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { AMOUNT_PRESETS } from "@/lib/copyTrade/config";
import { walletShort } from "@/lib/copyTrade/format";
import {
  RULE_MENU,
  RULE_META,
  SEED_RULES,
  addRule,
  bestLabel,
  canAddRule,
  devInitials,
  executionSummary,
  lastLaunchLabel,
  migrationRateLabel,
  newSnipeConfig,
  snipeErrors,
  snipesSummary,
  toPayload,
  type RuleTone,
} from "@/lib/devSnipe/config";
import { useResolveDev, useSnipeMutations } from "@/lib/devSnipe/useDevSnipe";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { BoltIcon, DevSnipeIcon, PauseIcon, RemoveIcon, TrashIcon, WarningIcon } from "@/components/copyTrade/icons";
import { RadioCard } from "@/components/copyTrade/controls";
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

export interface SnipeDrawerTarget {
  /** Carteira já escolhida (botão "Snipe" do card) — o campo vem preenchido. */
  dev?: string;
  /** Ajustar um snipe que está aguardando lançamento. */
  snipe?: SnipeView;
}

interface Props {
  target: SnipeDrawerTarget;
  mode: ExecMode;
  enabled: boolean;
  onClose: () => void;
}

/** Chip da linha de regra (Figma 1661:42194). Classes LITERAIS — o Tailwind só emite o estático. */
const CHIP: Record<RuleTone, string> = {
  green: "bg-green-3 text-green-11",
  red: "bg-vermelho-3 text-vermelho-11",
  blue: "bg-azul-3 text-azul-11",
  violet: "bg-violeta-3 text-violeta-11",
};

/**
 * Drawer "Novo Dev Snipe" (Figma 1646:36277 vazio, 1646:36663 dev encontrado
 * + minhas regras, 1661:42194 tipos de regra). Mesma mecânica do "Novo Wallet
 * Copy": colar/limpar o endereço, prévia só com endereço válido, seções 2–4
 * travadas (`inert` + 40%) até o dev aparecer.
 *
 * Com `target.snipe` vira "Adjust Dev Snipe" (fora do Figma, mínimo): endereço
 * travado, "Save changes", Pausar/Retomar e "Stop snipe" (com confirmação).
 *
 * Divergência: sem "≈ US$" sob o valor (mesma decisão do Wallet Copy — o front
 * não tem preço do SOL sem abrir a CSP a outra origem).
 */
export function SnipeConfigDrawer({ target, mode, enabled, onClose }: Props) {
  const editing = target.snipe ?? null;
  const [cfg, setCfg] = useState<SnipeConfig>(() => structuredClone(editing?.config ?? newSnipeConfig()));
  const [address, setAddress] = useState(editing?.dev ?? target.dev ?? "");
  const [open, setOpen] = useState<"snipes" | "execution" | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const { create, update, action } = useSnipeMutations();
  const radioName = useId();

  const typed = address.trim();
  const validAddr = SOLANA_ADDRESS.test(typed);
  const resolved = useResolveDev(validAddr ? typed : null, enabled);
  // Prévia só vale para o endereço que está no campo agora.
  const found = validAddr && resolved.data?.address === typed ? resolved.data : null;
  const resolving = validAddr && resolved.isFetching && !found;
  const addrError = !typed
    ? null
    : !validAddr
      ? "This doesn't look like a Solana address."
      : resolved.isError
        ? getApiErrorMessage(resolved.error)
        : null;
  // Ajustar não depende da prévia: o snipe já existe.
  const ready = !!editing || !!found;

  useEscapeClose(onClose);

  const errors = snipeErrors(cfg);
  const busy = create.isPending || update.isPending;
  const canSubmit = ready && !errors.length && !busy;
  const rules = cfg.sell.rules;
  const setRules = (next: SnipeRule[]) => setCfg((c) => ({ ...c, sell: { ...c.sell, rules: next } }));
  const setRule = (i: number, patch: Partial<SnipeRule>) =>
    setRules(rules.map((r, j) => (j === i ? ({ ...r, ...patch } as SnipeRule) : r)));
  const setExec = (patch: Partial<SnipeConfig["execution"]>) => setCfg((c) => ({ ...c, execution: { ...c.execution, ...patch } }));

  const paste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) setAddress(text);
    } catch {
      toast.error("Couldn't read the clipboard. Paste the address with Ctrl+V.");
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, config: toPayload(cfg) });
        toast.success("Dev Snipe updated.");
      } else {
        const saved = await create.mutateAsync({ dev: found!.address, config: toPayload(cfg) });
        toast.success(`Dev Snipe on: waiting for ${saved.label}'s next launch.`);
      }
      onClose();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const run = async (kind: "pause" | "resume" | "end") => {
    if (!editing) return;
    try {
      await action.mutateAsync({ id: editing.id, action: kind });
      toast.success(kind === "pause" ? "Dev Snipe paused." : kind === "resume" ? "Dev Snipe resumed." : "Dev Snipe stopped.");
      onClose();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const chooseSell = (m: "none" | "rules") =>
    setCfg((c) => ({
      ...c,
      // "My rules" sem nenhuma regra começa com as do design.
      sell: { mode: m, rules: m === "rules" && !c.sell.rules.length ? structuredClone(SEED_RULES) : c.sell.rules },
    }));

  const title = editing ? "Adjust Dev Snipe" : "New Dev Snipe";
  const stats = found?.stats ?? null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-gray-1/40" />
      <section className="relative flex h-full w-full max-w-[460px] flex-col border-l border-gray-5 bg-gray-2 shadow-[-30px_0_80px_0_rgba(0,0,0,0.55)]">
        <header className="relative z-20 flex items-center gap-2 border-b border-gray-6 bg-gray-2 px-4 py-2">
          <h2 className="flex-1 text-base leading-[1.1] font-semibold text-gray-12">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded text-gray-12 hover:bg-gray-4">
            <RemoveIcon className="size-6" />
          </button>
        </header>

        {/* Aviso + 1. Carteira do dev (fixos acima da rolagem, como no Figma). */}
        <div className="flex flex-col gap-3 border-b border-gray-5 px-4 pt-3 pb-4">
          <div className="flex items-start gap-2 rounded-lg border border-laranja-6 bg-laranja-2 p-3">
            <WarningIcon className="size-4 shrink-0 text-laranja-11" />
            <p className="flex-1 text-xs leading-[1.3] text-laranja-11">
              New tokens may charge an anti-sniper fee in the first blocks. Check the project before turning this on.
            </p>
          </div>
          <BlockTitle n={1} title="Dev wallet" />
          <AddressField
            value={address}
            onChange={setAddress}
            onPaste={paste}
            label="Dev wallet address"
            placeholder="Paste the dev wallet address"
            locked={!!editing}
            autoFocus={!target.dev}
            state={addrError ? "error" : typed ? "filled" : "empty"}
          />
          {resolving ? (
            <FoundCardSkeleton label="Looking up the dev" />
          ) : found ? (
            <FoundCard
              avatar={<InitialsAvatar text={devInitials(found.address)} />}
              title={walletShort(found.address)}
              subtitle={lastLaunchLabel(stats)}
              kpis={[
                { label: "Tokens created", value: stats ? stats.tokens.toLocaleString("en-US") : "—" },
                {
                  label: "Migrated",
                  value: migrationRateLabel(stats),
                  tone: stats?.migrationRate ? "text-green-11" : undefined,
                },
                { label: "Best", value: bestLabel(stats) },
              ]}
            />
          ) : (
            <p role={addrError ? "alert" : undefined} className={cn("text-xs leading-[1.3]", addrError ? "text-vermelho-11" : "text-gray-11")}>
              {addrError ?? "The buy fires when this wallet creates a new token."}
            </p>
          )}
        </div>

        <ScrollArea className="flex min-h-0 flex-1 flex-col" viewportClassName="min-h-0 flex-1">
          {/* Sem dev ainda, o resto do formulário aparece apagado e fora do foco. */}
          <div inert={!ready} className={cn("flex flex-col gap-5 px-4 py-3 transition-opacity", !ready && "opacity-40")}>
            {mode !== "live" && (
              <p className="rounded-lg border border-principal-6 bg-principal-3 px-3 py-2 text-xs leading-[1.3] text-principal-11">
                {mode === "shadow"
                  ? "Simulation mode: every snipe is simulated with real quotes. No SOL leaves your W1 yet."
                  : "Snipe execution is off for now: your Dev Snipe is saved but won't buy yet."}
              </p>
            )}

            {/* 2. Valor da compra */}
            <section className="flex flex-col gap-2">
              <BlockTitle n={2} title="Buy amount" />
              <AmountField
                id="snipe-amount"
                label="Amount per snipe"
                value={cfg.amountSol}
                onChange={(v) => setCfg((c) => ({ ...c, amountSol: v }))}
                presets={AMOUNT_PRESETS}
              />
              <p className="text-xs leading-[1.3] text-gray-11">Buys this amount in the first block of each new token from the dev.</p>
            </section>

            {/* 3. Quando vender */}
            <section className="flex flex-col gap-2">
              <BlockTitle n={3} title="When to sell" />
              <RadioCard
                name={radioName}
                checked={cfg.sell.mode === "none"}
                onSelect={() => chooseSell("none")}
                title="Don't sell"
                detail="Only buys. You sell whenever you want in the Portfolio."
              />
              <RadioCard
                name={radioName}
                checked={cfg.sell.mode === "rules"}
                onSelect={() => chooseSell("rules")}
                title="My rules"
                detail="Profit, loss and trailing set by you."
              />
              {cfg.sell.mode === "rules" && (
                <div className="flex flex-col gap-2">
                  {rules.map((r, i) => (
                    <RuleRow
                      key={i}
                      rule={r}
                      n={i + 1}
                      onChange={(patch) => setRule(i, patch)}
                      onRemove={() => setRules(rules.filter((_, j) => j !== i))}
                    />
                  ))}
                  <AddRuleMenu rules={rules} onAdd={(kind) => setRules(addRule(rules, kind))} />
                </div>
              )}
            </section>

            {/* 4. Avançado */}
            <section className="flex flex-col gap-2">
              <BlockTitle n={4} title="Advanced" hint="optional" />
              <Accordion
                icon={<DevSnipeIcon className="size-4" />}
                title="Snipes"
                summary={snipesSummary(cfg)}
                open={open === "snipes"}
                onToggle={() => setOpen(open === "snipes" ? null : "snipes")}
              >
                <NumberField
                  label="Stop after"
                  unit="tokens"
                  placeholder="No limit"
                  value={cfg.maxTokens}
                  onChange={(v) => setCfg((c) => ({ ...c, maxTokens: v }))}
                />
                <p className="text-xs leading-[1.3] text-gray-11">
                  Counts the tokens already bought. Leave it empty to snipe every new token from this dev.
                </p>
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
                    onChange={(v) => setExec({ priorityFeeSol: v ?? 0 })}
                  />
                  <NumberField
                    label="Max. slippage"
                    unit="%"
                    step={0.5}
                    placeholder="Auto"
                    value={cfg.execution.slippageBps == null ? null : cfg.execution.slippageBps / 100}
                    onChange={(v) => setExec({ slippageBps: v == null ? null : Math.round(v * 100) })}
                  />
                </div>
                <ToggleRow
                  label="Anti-MEV"
                  note="Sends through Jito so bots can't sandwich your trade."
                  checked={cfg.execution.antiMev}
                  onChange={(v) => setExec({ antiMev: v })}
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

        <footer className="flex flex-col gap-3 border-t border-gray-5 bg-gray-2 px-4 pt-3 pb-4">
          {!ready ? (
            <PendingButton>{resolving ? "Looking up the dev…" : "Paste the dev wallet"}</PendingButton>
          ) : editing ? (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={action.isPending}
                  onClick={() => run(editing.status === "PAUSED" ? "resume" : "pause")}
                  className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-6 bg-gray-3 px-4 text-sm leading-[1.3] font-medium text-gray-12 transition-colors hover:bg-gray-4 disabled:opacity-50"
                >
                  {editing.status === "PAUSED" ? (
                    <DevSnipeIcon className="size-4" />
                  ) : (
                    <PauseIcon className="size-4" />
                  )}
                  {editing.status === "PAUSED" ? "Resume" : "Pause"}
                </button>
                <PrimaryButton disabled={!canSubmit} onClick={submit} className="flex-1">
                  {busy ? "Saving…" : "Save changes"}
                </PrimaryButton>
              </div>
              <button
                type="button"
                disabled={action.isPending}
                onClick={() => (confirmStop ? run("end") : setConfirmStop(true))}
                className="self-center text-xs leading-[1.3] font-medium text-vermelho-11 hover:text-vermelho-12 disabled:opacity-50"
              >
                {confirmStop ? "Click again to stop this snipe" : "Stop snipe"}
              </button>
            </>
          ) : (
            <PrimaryButton disabled={!canSubmit} onClick={submit}>
              {busy ? "Saving…" : "Activate Dev Snipe"}
            </PrimaryButton>
          )}
        </footer>
      </section>
    </div>
  );
}

/** "linha - meta" com os 7 estilos do recorte 1661:42194. */
function RuleRow({
  rule: r,
  n,
  onChange,
  onRemove,
}: {
  rule: SnipeRule;
  n: number;
  onChange: (patch: Partial<SnipeRule>) => void;
  onRemove: () => void;
}) {
  const meta = RULE_META[r.kind];
  const sell =
    "sellPct" in r ? (
      <TargetField prefix="sell" value={r.sellPct} onChange={(v) => onChange({ sellPct: v })} label={`Rule ${n} sell`} />
    ) : null;
  let fields: React.ReactNode;
  switch (r.kind) {
    case "tp":
    case "sl":
      fields = (
        <>
          <TargetField prefix="at" value={r.atPct} onChange={(v) => onChange({ atPct: v })} label={`Rule ${n} trigger`} />
          {sell}
        </>
      );
      break;
    case "trail_tp":
      fields = (
        <>
          <TargetField prefix="pullback" value={r.pullbackPct} onChange={(v) => onChange({ pullbackPct: v })} label={`Rule ${n} pullback`} />
          {sell}
        </>
      );
      break;
    case "trail_sl":
      fields = (
        <>
          <TargetField prefix="drops" value={r.dropPct} onChange={(v) => onChange({ dropPct: v })} label={`Rule ${n} drop`} />
          {sell}
        </>
      );
      break;
    case "delay":
      fields = (
        <>
          <TargetField prefix="between" unit="s" value={r.minS} onChange={(v) => onChange({ minS: v })} label={`Rule ${n} minimum delay`} />
          <TargetField prefix="and" unit="s" value={r.maxS} onChange={(v) => onChange({ maxS: v })} label={`Rule ${n} maximum delay`} />
        </>
      );
      break;
    default:
      fields = sell;
  }
  return (
    <div className="flex h-9 items-center gap-2" data-rule={r.kind}>
      <span
        title={r.kind === "delay" ? "Applies to every sale" : meta.name}
        className={cn("w-[84px] shrink-0 truncate rounded px-2 py-1.5 text-xs leading-[1.3] font-semibold", CHIP[meta.tone])}
      >
        {meta.chip}
      </span>
      {fields}
      <button
        type="button"
        aria-label={`Remove rule ${n} (${meta.name})`}
        onClick={onRemove}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-gray-6 bg-gray-3 text-gray-11 hover:text-gray-12"
      >
        <TrashIcon className="size-3.5" />
      </button>
    </div>
  );
}

/**
 * Menu "+ Add rule" (sem nó no Figma — nota do designer): abre no link,
 * fecha ao escolher, ao clicar fora ou com Esc; cada escolha entra no fim.
 * Dois grupos, Price e Events; o Atraso fica desabilitado se já existe.
 */
function AddRuleMenu({ rules, onAdd }: { rules: SnipeRule[]; onAdd: (kind: SnipeRuleKind) => void }) {
  const item =
    "flex cursor-pointer flex-col gap-1 rounded px-2 py-1.5 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-gray-4";
  const group = (label: string, kinds: SnipeRuleKind[]) => (
    <DropdownMenu.Group>
      <DropdownMenu.Label className="px-2 pt-1.5 pb-1 text-xs leading-[1.3] text-gray-9">{label}</DropdownMenu.Label>
      {kinds.map((k) => (
        <DropdownMenu.Item key={k} disabled={!canAddRule(rules, k)} onSelect={() => onAdd(k)} className={item}>
          <span className="text-sm leading-[1.3] font-medium text-gray-12">{RULE_META[k].name}</span>
          <span className="text-xs leading-[1.3] text-gray-11">
            {k === "delay" && rules.some((r) => r.kind === "delay") ? "Already added: one per snipe" : RULE_META[k].hint}
          </span>
        </DropdownMenu.Item>
      ))}
    </DropdownMenu.Group>
  );
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="self-start rounded text-xs leading-[1.3] font-medium text-principal-11 hover:text-principal-12 data-[state=open]:text-principal-12"
        >
          + Add rule
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-[60] flex w-[260px] flex-col gap-1 rounded-lg border border-gray-6 bg-gray-2 p-1 shadow-[0_12px_32px_0_rgba(0,0,0,0.45)]"
        >
          {group("Price", RULE_MENU.price)}
          <DropdownMenu.Separator className="my-0.5 h-px bg-gray-6" />
          {group("Events", RULE_MENU.events)}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
