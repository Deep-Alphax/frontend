"use client";

import { useEffect, useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { ChevronIcon } from "@/components/copyTrade/icons";
import { KpiCell, Switch } from "@/components/copyTrade/controls";

/*
 * Peças compartilhadas pelos drawers do Copy Trade: "Configurar copy" /
 * "Novo Wallet Copy" (Figma 1618:29802, 1646:34851) e "Novo Dev Snipe"
 * (1646:36277, 1646:36663). Mesmos componentes do Figma nos dois — título de
 * bloco, campo de endereço, cartão "encontrada", campo de valor, acordeão.
 */

/** Regex de endereço Solana (base58, 32–44). A prévia só é buscada quando bate. */
export const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Esc fecha o drawer — exceto quando outra camada (menu Radix) já tratou a
 * tecla: o Radix chama `preventDefault()` ao fechar o próprio menu.
 */
export function useEscapeClose(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

/** "título - bloco": número no círculo, título 14 e apoio opcional à direita. */
export function BlockTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="flex h-6 items-center gap-1.5">
      <span className="flex size-5 items-center justify-center rounded-full border border-principal-6 bg-principal-3 text-xs leading-[1.3] font-semibold text-principal-11">
        {n}
      </span>
      <h3 className="flex-1 text-sm leading-[1.3] font-medium text-gray-12">{title}</h3>
      {hint && <span className="text-xs leading-[1.3] text-gray-11">{hint}</span>}
    </div>
  );
}

/**
 * "campo - endereço" (Figma 1642:34040): vazio com "Paste", preenchido com
 * limpar. `locked` = endereço fixo (ajustar um snipe existente): sem botões.
 */
export function AddressField({
  value,
  onChange,
  onPaste,
  state,
  label = "Wallet address",
  placeholder = "Paste the wallet address",
  locked = false,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onPaste: () => void;
  state: "empty" | "filled" | "error";
  label?: string;
  placeholder?: string;
  locked?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-11 items-center gap-2 rounded-lg border bg-gray-1 py-2 pr-2 pl-3",
        state === "error" ? "border-vermelho-8" : state === "filled" ? "border-principal-6" : "border-gray-6 focus-within:border-gray-8",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={state === "empty" ? "/copy-trade/wallet-16-empty.svg" : "/copy-trade/wallet-16.svg"}
        alt=""
        width={16}
        height={16}
        className="size-4 shrink-0"
      />
      <input
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        autoFocus={autoFocus && !locked}
        readOnly={locked}
        className="min-w-0 flex-1 truncate bg-transparent text-xs leading-[1.3] text-gray-12 outline-none placeholder:text-gray-9"
      />
      {locked ? null : state === "empty" ? (
        <button
          type="button"
          onClick={onPaste}
          className="shrink-0 rounded border border-gray-6 bg-gray-3 p-2 text-sm leading-[1.3] text-gray-11 transition-colors hover:bg-gray-4 hover:text-gray-12"
        >
          Paste
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear address"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gray-3 transition-colors hover:bg-gray-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/copy-trade/remove-14.svg" alt="" width={14} height={14} className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export interface FoundKpi {
  label: string;
  value: ReactNode;
  tone?: string;
}

/**
 * "cartão - carteira encontrada" (Figma 1642:34085): identidade, selo
 * "Found" e 3 KPIs. O conteúdo (avatar, textos, KPIs) vem de quem usa.
 */
export function FoundCard({
  avatar,
  title,
  subtitle,
  kpis,
}: {
  avatar: ReactNode;
  title: string;
  subtitle: string;
  kpis: FoundKpi[];
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-6 bg-gray-2">
      <div className="flex items-center gap-3 p-3">
        {avatar}
        <div className="flex min-w-0 flex-1 flex-col gap-3 leading-[1.3]">
          <p className="truncate text-sm font-semibold text-gray-12">{title}</p>
          <p className="truncate text-xs text-gray-11">{subtitle}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs leading-[1.3] font-medium text-green-11">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/copy-trade/tick-14.svg" alt="" width={14} height={14} className="size-3.5" />
          Found
        </span>
      </div>
      <div className="h-px bg-gray-6" />
      <div className="flex">
        {kpis.map((k, i) => (
          <KpiCell
            key={k.label}
            display
            label={k.label}
            value={k.value}
            tone={k.tone}
            className={i < kpis.length - 1 ? "border-r border-gray-6" : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/** Avatar de iniciais do cartão "encontrada" (carteira sem foto). */
export function InitialsAvatar({ text }: { text: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gray-6 bg-gray-3 text-xs leading-[1.3] font-medium text-gray-12">
      {text}
    </span>
  );
}

export function FoundCardSkeleton({ label = "Looking up the wallet" }: { label?: string }) {
  return (
    <SkeletonGroup label={label} className="flex flex-col overflow-hidden rounded-xl border border-gray-6 bg-gray-2">
      <div className="flex items-center gap-3 p-3">
        <Skeleton className="size-9 rounded-lg" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="h-px bg-gray-6" />
      <div className="flex">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn("flex flex-1 flex-col gap-3 px-4 py-3", i < 2 && "border-r border-gray-6")}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}

/**
 * "campo - valor" (Figma 1616:29159): valor grande em SOL e atalhos. Estado
 * de erro (borda e número vermelhos + mensagem) quando `error` vem preenchido.
 */
export function AmountField({
  id,
  label,
  value,
  onChange,
  presets,
  error,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  presets: readonly number[];
  error?: string | null;
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border bg-gray-1 p-4", error ? "border-vermelho-8" : "border-gray-6")}>
      <label htmlFor={id} className="text-xs leading-[1.3] text-gray-11">
        {label}
      </label>
      <div className="flex items-baseline gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0.01}
          step={0.01}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            "w-28 bg-transparent font-display text-2xl leading-[1.1] font-semibold tracking-[1px] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none",
            error ? "text-vermelho-11" : "text-gray-12",
          )}
        />
        <span className="text-sm leading-[1.3] font-semibold text-gray-11">SOL</span>
      </div>
      {error && <p className="text-xs leading-[1.3] text-vermelho-11">{error}</p>}
      <div className="flex flex-wrap gap-1">
        {presets.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn(
              "rounded border p-2 text-sm leading-[1.3] transition-colors",
              value === v ? "border-principal-6 bg-principal-3 text-principal-11" : "border-gray-6 bg-gray-3 text-gray-11 hover:bg-gray-4",
            )}
          >
            {v.toLocaleString("en-US")} SOL
          </button>
        ))}
      </div>
    </div>
  );
}

/** Acordeão do bloco avançado: ícone, título, resumo e seta (Figma "acordeão"). */
export function Accordion({
  icon,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  icon: ReactNode;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-gray-5 bg-gray-2">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle} className="flex h-14 items-center gap-3 p-3 text-left">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-principal-6 bg-[linear-gradient(180deg,rgba(249,210,64,0.22)_0%,rgba(249,210,64,0)_100%),linear-gradient(var(--color-principal-3),var(--color-principal-3))] text-principal-11">
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-2 leading-[1.3]">
          <span className="text-sm font-semibold text-gray-12">{title}</span>
          <span className="truncate text-xs text-gray-11">{summary}</span>
        </span>
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border border-gray-6 text-gray-12", open ? "bg-gray-4" : "bg-gray-3")}>
          <ChevronIcon className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div id={id} className="flex flex-col gap-3 px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

export function ToggleRow({
  label,
  note,
  checked,
  onChange,
  disabled,
  last,
  bare,
}: {
  label: string;
  note?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  last?: boolean;
  bare?: boolean;
}) {
  return (
    <div className={cn("flex min-h-11 items-center gap-3", bare ? "py-3" : "p-3", !last && !bare && "border-b border-gray-5")}>
      <div className="flex min-w-0 flex-1 flex-col gap-2 leading-[1.3]">
        <span className={cn("text-sm", disabled ? "text-gray-10" : "text-gray-12")}>{label}</span>
        {note && <span className="text-xs text-gray-11">{note}</span>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}

/** Campo numérico com unidade; vazio = null (mostra `placeholder`, "Off" por padrão). */
export function NumberField({
  label,
  unit,
  value,
  onChange,
  step = 1,
  placeholder = "Off",
}: {
  label: string;
  unit: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs leading-[1.3] whitespace-nowrap text-gray-11">
        {label}
      </label>
      <div className="flex items-center gap-1 rounded-lg border border-gray-6 bg-gray-1 px-3 py-2 focus-within:border-gray-8">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="w-full min-w-0 bg-transparent text-sm font-semibold text-gray-12 outline-none placeholder:font-normal placeholder:text-gray-9 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="shrink-0 text-xs leading-[1.3] whitespace-nowrap text-gray-11">{unit}</span>
      </div>
    </div>
  );
}

/** "campo-gatilho" / "campo-vende" da linha de meta: prefixo, número e unidade. */
export function TargetField({
  prefix,
  value,
  onChange,
  label,
  unit = "%",
}: {
  prefix: string;
  value: number;
  onChange: (v: number) => void;
  label: string;
  unit?: string;
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-gray-6 bg-gray-1 px-3 py-2 leading-[1.3] focus-within:border-gray-8">
      <span className="text-xs whitespace-nowrap text-gray-11">{prefix}</span>
      <input
        aria-label={label}
        type="number"
        value={Number.isFinite(value) ? value : ""}
        // Campo vazio vira NaN (não 0): a validação aponta o campo em branco.
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
        className="w-full min-w-0 bg-transparent text-sm font-semibold text-gray-12 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="text-xs text-gray-11">{unit}</span>
    </label>
  );
}

/** Botão principal do rodapé (Button-main, 44 px). */
export function PrimaryButton({
  children,
  disabled,
  onClick,
  className,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-11 w-full items-center justify-center rounded-lg bg-principal-9 px-8 text-base leading-[1.1] font-semibold text-gray-1 transition-colors hover:bg-principal-10 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Estado "falta o endereço" do Button-main: contorno neutro e o próximo passo como rótulo. */
export function PendingButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      disabled
      className="flex h-11 w-full cursor-not-allowed items-center justify-center rounded-lg border border-gray-5 bg-gray-2 px-8 text-base leading-[1.1] font-semibold text-gray-9"
    >
      {children}
    </button>
  );
}
