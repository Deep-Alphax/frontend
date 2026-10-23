"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";

import type { DepositOptions, DepositView } from "@/lib/api/deposits";
import { getWallets, type BackendChain, type Wallet } from "@/lib/api/wallets";
import { cn } from "@/lib/cn";
import {
  addressError,
  amountError,
  amountPresets,
  assetKey,
  CHAIN_LABEL,
  defaultAssetFor,
  displayMinBrlCents,
  formatBrlInput,
  formatBrlShort,
  formatEta,
  formatFee,
  formatTokenAmount,
  groupAssets,
  maxDepositBrlCents,
  parseBrlInput,
  shortAddress,
} from "@/lib/deposits/format";
import { useDebouncedValue, useDepositQuote, useDepositsList } from "@/lib/deposits/useDeposits";
import type { DepositPreset } from "@/lib/store/depositModal";
import { formatBrl, formatFxRate } from "@/lib/pix/format";
import { walletName } from "@/components/home/WalletChip";
import { PRIMARY_BTN } from "@/components/plans/crypto/walletUi";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { TextField } from "@/components/ui/TextField";
import { AssetLabel, ChainBadge, StatusChip } from "@/components/deposits/depositUi";

/*
 * Etapa 1 do depósito: moeda/rede, carteira de destino, valor em reais e a
 * cotação. O servidor revalida tudo (endereço, mínimo, limite diário) — a
 * validação aqui é para o usuário errar menos, não é a barreira.
 */

const CUSTOM = "custom";
const QUOTE_DEBOUNCE_MS = 400;

export interface DepositRequest {
  chain: BackendChain;
  symbol: string;
  toAddress: string;
  amountBrlCents: number;
}

/** Destino inicial: a carteira do preset, senão a 1ª da rede, senão colar. */
function initialDestination(wallets: Wallet[], chain: BackendChain, preset: DepositPreset | null) {
  if (preset && preset.chain === chain) {
    const w = wallets.find((x) => x.chain === chain && x.address === preset.address);
    return w ? { dest: w.id, custom: "" } : { dest: CUSTOM, custom: preset.address };
  }
  const first = wallets.find((x) => x.chain === chain);
  return { dest: first?.id ?? CUSTOM, custom: "" };
}

export function DepositForm({
  options,
  preset,
  submitting,
  onSubmit,
  onOpenDeposit,
  onSelectOpenChange,
}: {
  options: DepositOptions;
  preset: DepositPreset | null;
  submitting: boolean;
  onSubmit: (req: DepositRequest) => void;
  onOpenDeposit: (d: DepositView) => void;
  /** Avisa o modal que um dropdown abriu (o Esc é dele, não do modal). */
  onSelectOpenChange: (open: boolean) => void;
}) {
  // Mesmo cache do chip de carteiras do header (sem requisição nova).
  const walletsQuery = useQuery({ queryKey: ["wallets"], queryFn: getWallets, retry: false });
  const wallets = useMemo(() => walletsQuery.data ?? [], [walletsQuery.data]);

  const [asset, setAsset] = useState(() => {
    const a = defaultAssetFor(options.assets, preset?.chain);
    return a ? assetKey(a) : "";
  });
  const selected = options.assets.find((a) => assetKey(a) === asset);
  const chain = selected?.chain ?? "SOLANA";

  // Destino: só é decidido depois que as carteiras chegam (o skeleton cobre).
  const [destState, setDestState] = useState<{ dest: string; custom: string } | null>(null);
  const destination =
    destState ?? (walletsQuery.isPending ? null : initialDestination(wallets, chain, preset));

  const chainWallets = wallets.filter((w) => w.chain === chain);
  const chosenWallet =
    destination && destination.dest !== CUSTOM
      ? chainWallets.find((w) => w.id === destination.dest)
      : undefined;
  const address = chosenWallet?.address ?? destination?.custom ?? "";

  const [amountText, setAmountText] = useState("");
  const [addressTouched, setAddressTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const max = maxDepositBrlCents(options);
  const limitedByDaily = options.dailyLeftBrlCents < options.maxBrlCents;
  const cents = parseBrlInput(amountText);
  const amountErr = amountError(cents, options.minBrlCents, max, limitedByDaily);
  const addressErr = addressError(chain, address);
  const presets = amountPresets(options.minBrlCents, max);
  // Sem cotação (mínimo desconhecido) ou sem limite hoje: não dá para gerar Pix.
  const blocked =
    options.minBrlCents === null
      ? "Live rates are unavailable right now. Try again in a few minutes."
      : max < options.minBrlCents
        ? "You've reached today's deposit limit. You can deposit again tomorrow."
        : null;

  const validCents = amountErr ? null : cents;
  const debouncedCents = useDebouncedValue(validCents, QUOTE_DEBOUNCE_MS);
  const quoteParams =
    selected && debouncedCents !== null && !blocked
      ? { chain: selected.chain, symbol: selected.symbol, amountBrlCents: debouncedCents }
      : null;
  const quote = useDepositQuote(quoteParams);

  const changeAsset = (key: string) => {
    const next = options.assets.find((a) => assetKey(a) === key);
    if (!next) return; // valor espúrio do <select> nativo do Radix
    setAsset(key);
    if (next.chain !== chain) {
      // Outra rede: a carteira escolhida não serve mais. O endereço colado só
      // continua se for da mesma família (EVM ↔ EVM).
      const keepCustom =
        destination?.dest === CUSTOM && next.chain !== "SOLANA" && chain !== "SOLANA";
      const init = initialDestination(wallets, next.chain, preset);
      setDestState(keepCustom ? { dest: CUSTOM, custom: destination.custom } : init);
      setAddressTouched(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (blocked || !selected || addressErr || amountErr || cents === null) return;
    onSubmit({
      chain: selected.chain,
      symbol: selected.symbol,
      toAddress: address.trim(),
      amountBrlCents: cents,
    });
  };

  const showAddressErr = (addressTouched || submitted) && addressErr;
  // Valor: erro só depois de sair do campo (digitar "5" a caminho de "500" não é erro).
  const showAmountErr = submitted || (amountTouched && amountText.trim() !== "") ? amountErr : null;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 px-5 py-5">
      {/* Moeda + rede */}
      <div className="flex flex-col gap-2">
        <span id="deposit-asset-label" className="text-base text-gray-12">
          Coin and network
        </span>
        <Select value={asset} onValueChange={changeAsset} onOpenChange={onSelectOpenChange}>
          <SelectTrigger aria-labelledby="deposit-asset-label" className="h-12">
            <SelectValue placeholder="Choose a coin">
              {selected ? <AssetLabel chain={selected.chain} symbol={selected.symbol} size={24} /> : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {groupAssets(options.assets).map((g, i) => (
              <SelectGroup key={g.chain}>
                {i > 0 && <SelectSeparator />}
                <SelectLabel className="flex items-center gap-2">
                  <ChainBadge chain={g.chain} size={16} />
                  {CHAIN_LABEL[g.chain]}
                </SelectLabel>
                {g.assets.map((a) => (
                  <SelectItem key={assetKey(a)} value={assetKey(a)} className="pl-8">
                    <span className="font-medium text-gray-12">{a.symbol}</span>{" "}
                    <span className="text-gray-11">· {a.name}</span>{" "}
                    <span className="sr-only">on {CHAIN_LABEL[a.chain]}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Carteira de destino */}
      <div className="flex flex-col gap-2">
        <span id="deposit-dest-label" className="text-base text-gray-12">
          Destination wallet
        </span>
        {destination === null ? (
          <SkeletonGroup label="Loading wallets">
            <Skeleton className="h-12 w-full rounded-lg" />
          </SkeletonGroup>
        ) : (
          <>
            {chainWallets.length > 0 && (
              <Select
                // Remonta por rede: a lista de opções troca inteira. Dentro de um
                // <form> o Radix espelha o valor num <select> nativo escondido, que
                // dispara um "change" espúrio quando as opções mudam — daí também o
                // filtro do valor recebido.
                key={chain}
                value={destination.dest}
                onValueChange={(v) => {
                  if (v !== CUSTOM && !chainWallets.some((w) => w.id === v)) return;
                  setDestState({ dest: v, custom: destination.custom });
                  setAddressTouched(false);
                }}
                onOpenChange={onSelectOpenChange}
              >
                <SelectTrigger aria-labelledby="deposit-dest-label" className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chainWallets.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      <span className="text-gray-12">{walletName(w, wallets.indexOf(w))}</span>
                      <span className="font-mono text-gray-11"> · {shortAddress(w.address)}</span>
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={CUSTOM}>Paste another address</SelectItem>
                </SelectContent>
              </Select>
            )}
            {destination.dest === CUSTOM ? (
              <TextField
                label={`${CHAIN_LABEL[chain]} address`}
                className="font-mono text-sm"
                placeholder={chain === "SOLANA" ? "Solana address (base58)" : "0x…"}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={destination.custom}
                onChange={(e) => setDestState({ dest: CUSTOM, custom: e.target.value })}
                onBlur={() => setAddressTouched(true)}
                error={showAddressErr || undefined}
              />
            ) : (
              // Endereço inteiro: é para onde vai uma transferência sem volta.
              <p className="break-all font-mono text-xs leading-[1.4] text-gray-11" data-testid="deposit-dest-address">
                {address}
              </p>
            )}
            {destination.dest !== CUSTOM && showAddressErr ? (
              <p role="alert" className="text-sm text-danger-11">
                {showAddressErr}
              </p>
            ) : null}
          </>
        )}
      </div>

      {/* Valor em reais */}
      <div className="flex flex-col gap-2">
        <TextField
          label="Amount"
          leftIcon={<span className="text-base text-gray-11">R$</span>}
          inputMode="decimal"
          placeholder="0,00"
          autoComplete="off"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          onBlur={() => setAmountTouched(true)}
          error={showAmountErr || undefined}
        />
        {presets.length > 0 && (
          <div role="group" aria-label="Amount presets" className="flex flex-wrap gap-1.5">
            {presets.map((p) => {
              const on = cents === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setAmountText(formatBrlInput(p));
                    setAmountTouched(true);
                  }}
                  className={cn(
                    "flex h-8 items-center justify-center rounded border px-3 text-sm leading-[1.3] tabular-nums transition-colors",
                    on
                      ? "border-principal-8 bg-principal-5 text-gray-12"
                      : "border-gray-6 bg-gray-3 text-gray-11 hover:border-gray-8 hover:bg-gray-4 hover:text-gray-12",
                  )}
                >
                  {formatBrlShort(p)}
                </button>
              );
            })}
          </div>
        )}
        {!showAmountErr && options.minBrlCents !== null && (
          <p className="text-xs text-gray-11">
            Minimum {formatBrlShort(displayMinBrlCents(options.minBrlCents))} (US$ 100) · Maximum{" "}
            {formatBrlShort(max)}
            {limitedByDaily ? " today" : ""}
          </p>
        )}
      </div>

      <QuoteBox
        params={quoteParams}
        quote={quote}
        feeBps={options.feeBps}
        typing={validCents !== null && validCents !== debouncedCents}
        chain={chain}
      />

      <p className="flex items-start gap-2 text-xs leading-[1.4] text-gray-11">
        <TriangleAlert className="mt-px size-3.5 shrink-0 text-amber-11" strokeWidth={2} aria-hidden />
        Crypto sent on-chain can&apos;t be reversed. Check the address and network.
      </p>

      {blocked && (
        <p role="alert" className="text-sm text-danger-11">
          {blocked}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || blocked !== null}
        className={cn(PRIMARY_BTN, "w-full flex-none disabled:cursor-not-allowed")}
      >
        {submitting
          ? "Generating Pix…"
          : cents !== null && !amountErr
            ? `Generate Pix · ${formatBrl(cents)}`
            : "Generate Pix"}
      </button>

      <RecentDeposits onOpen={onOpenDeposit} />
    </form>
  );
}

function QuoteBox({
  params,
  quote,
  feeBps,
  typing,
  chain,
}: {
  params: { amountBrlCents: number } | null;
  quote: ReturnType<typeof useDepositQuote>;
  feeBps: number;
  /** O valor mudou e a cotação ainda não foi pedida (debounce). */
  typing: boolean;
  chain: BackendChain;
}) {
  const box = "flex flex-col gap-3 rounded-lg border border-gray-6 bg-gray-3/60 p-4";

  if (!params && !typing) {
    return (
      <div className={box}>
        <p className="text-sm text-gray-11">Enter an amount to see how much you receive.</p>
      </div>
    );
  }

  if ((quote.isPending && params) || (typing && !quote.data)) {
    return (
      <SkeletonGroup label="Getting a quote" className={box}>
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-3.5 w-36" />
      </SkeletonGroup>
    );
  }

  if (quote.isError || !quote.data) {
    return (
      <div className={box}>
        <p className="text-sm text-gray-11">Couldn&apos;t get a quote right now. You can still generate the Pix.</p>
      </div>
    );
  }

  const q = quote.data;
  const usdt = Number(q.usdt);
  const rate = usdt > 0 ? (q.amountBrlCents / 100 / usdt).toString() : null;
  return (
    <div
      className={cn(box, (quote.isPlaceholderData || typing) && "opacity-60 transition-opacity")}
      aria-live="polite"
      aria-busy={quote.isPlaceholderData || typing}
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-11">You receive</span>
        <span className="text-2xl font-semibold leading-none text-gray-12" data-testid="deposit-quote-out">
          {q.estimatedOut ? `≈ ${formatTokenAmount(q.estimatedOut, q.symbol)}` : `${q.symbol} worth ≈ ${formatTokenAmount(q.usdt, "USDT")}`}
        </span>
        <span className="text-xs text-gray-11">
          {formatEta(q.etaSeconds)} after the Pix · on {CHAIN_LABEL[chain]}
        </span>
      </div>
      <dl className="flex flex-col gap-1 border-t border-gray-6 pt-3 text-xs">
        {rate && (
          <div className="flex justify-between gap-2">
            <dt className="text-gray-11">Rate</dt>
            <dd className="tabular-nums text-gray-12">R$ {formatFxRate(rate).replace(".", ",")} / USDT</dd>
          </div>
        )}
        {feeBps > 0 && (
          <div className="flex justify-between gap-2">
            <dt className="text-gray-11">Service fee</dt>
            <dd className="tabular-nums text-gray-12">{formatFee(feeBps)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

const RECENT_LIMIT = 3;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Depósitos recentes — reabre um em andamento (o modal pode ter sido fechado). */
function RecentDeposits({ onOpen }: { onOpen: (d: DepositView) => void }) {
  const list = useDepositsList(true);

  if (list.isPending) {
    return (
      <SkeletonGroup label="Loading recent deposits" className="flex flex-col gap-2 border-t border-gray-6 pt-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-[52px] w-full rounded-lg" />
        <Skeleton className="h-[52px] w-full rounded-lg" />
      </SkeletonGroup>
    );
  }
  const items = list.data?.slice(0, RECENT_LIMIT) ?? [];
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="recent-deposits" className="flex flex-col gap-2 border-t border-gray-6 pt-4">
      <h3 id="recent-deposits" className="text-sm font-medium text-gray-12">
        Recent deposits
      </h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onOpen(d)}
              aria-label={`Open deposit of ${formatBrl(d.amountBrlCents)} in ${d.symbol} on ${CHAIN_LABEL[d.chain]}`}
              className="flex h-[52px] w-full items-center gap-3 rounded-lg border border-gray-6 bg-gray-3/60 px-3 text-left outline-none transition-colors hover:border-gray-8 hover:bg-gray-4 focus-visible:ring-2 focus-visible:ring-secundaria-11/60"
            >
              <ChainBadge chain={d.chain} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm text-gray-12">
                  {formatBrl(d.amountBrlCents)} → {d.symbol}
                </span>
                <span className="truncate text-xs text-gray-11">
                  <span className="font-mono">{shortAddress(d.toAddress)}</span> · {formatWhen(d.createdAt)}
                </span>
              </span>
              <StatusChip deposit={d} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Skeleton no formato do formulário (opções carregando). */
export function DepositFormSkeleton() {
  return (
    <SkeletonGroup label="Loading deposit options" className="flex flex-col gap-5 px-5 py-5">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ))}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <div className="flex gap-1.5">
          <Skeleton className="h-8 w-20 rounded" />
          <Skeleton className="h-8 w-20 rounded" />
          <Skeleton className="h-8 w-20 rounded" />
        </div>
      </div>
      <Skeleton className="h-[116px] w-full rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </SkeletonGroup>
  );
}
