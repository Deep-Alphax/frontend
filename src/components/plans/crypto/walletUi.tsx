import type { CryptoPayment, SentCryptoTx } from "@/lib/api/billing";
import { cn } from "@/lib/cn";

/*
 * Peças visuais do pagamento por carteira, SEM dependência de lib de carteira:
 * ficam no bundle do modal, enquanto EVM (wagmi/viem) e Solana (web3.js) vão
 * em chunks próprios, carregados só na etapa de pagar.
 */

export const SECONDARY_BTN = cn(
  "flex h-10 min-w-0 flex-1 items-center justify-center rounded-lg px-4",
  "border border-gray-6 bg-gray-3 text-base font-semibold leading-[1.1] text-gray-12",
  "outline-none transition-colors hover:border-gray-8 focus-visible:ring-2 focus-visible:ring-secundaria-11/60",
);
export const PRIMARY_BTN = cn(
  "flex h-10 min-w-0 flex-1 items-center justify-center rounded-lg px-4",
  "bg-principal-9 text-base font-semibold leading-[1.1] text-gray-1 hover:bg-principal-10",
  "outline-none focus-visible:ring-2 focus-visible:ring-principal-11 disabled:opacity-60",
);

/** Contrato entre o modal e o componente de carteira (EVM ou Solana). */
export interface WalletPayProps {
  payment: CryptoPayment;
  /** Rótulo da rede ("Base"). */
  network: string;
  /** O modal está registrando um envio — trava o botão de pagar. */
  busy: boolean;
  /** Erro vindo do modal (registro do envio), mostrado sob o botão. */
  error: string | null;
  /** A carteira devolveu a transação transmitida. */
  onSent: (sent: SentCryptoTx) => void;
}

export interface WalletOption {
  id: string;
  name: string;
  /** data: URL do ícone anunciado pela própria carteira. */
  icon?: string;
}

export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/** Só data: URL — ícone remoto seria uma requisição que a CSP bloqueia. */
export function safeIcon(icon: unknown): string | undefined {
  return typeof icon === "string" && icon.startsWith("data:") ? icon : undefined;
}

function WalletIcon({ src }: { src?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={20} height={20} className="size-5 shrink-0 rounded" />
  ) : (
    <span className="size-5 shrink-0 rounded bg-gray-6" aria-hidden="true" />
  );
}

function InlineError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm text-danger-11">
      {children}
    </p>
  );
}

/** Carteiras detectadas no navegador. */
export function WalletPicker({
  wallets,
  connectingId,
  onPick,
  error,
}: {
  wallets: WalletOption[];
  connectingId: string | null;
  onPick: (id: string) => void;
  error: string | null;
}) {
  if (wallets.length === 0) {
    return (
      <p className="text-sm leading-[1.4] text-gray-11">
        No wallet found — install MetaMask/Phantom, or open this page in your
        wallet&apos;s browser.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2" aria-label="Wallets">
        {wallets.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              disabled={connectingId !== null}
              onClick={() => onPick(w.id)}
              className={cn(SECONDARY_BTN, "w-full flex-none justify-start gap-3 disabled:opacity-60")}
            >
              <WalletIcon src={w.icon} />
              <span className="truncate">
                {connectingId === w.id ? `Connecting ${w.name}…` : w.name}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {error && <InlineError>{error}</InlineError>}
    </div>
  );
}

/** Carteira conectada: quem paga, quanto, e o botão. */
export function ConnectedPay({
  address,
  walletIcon,
  amount,
  network,
  sending,
  busy,
  error,
  onPay,
  onChangeWallet,
}: {
  address: string;
  walletIcon?: string;
  amount: string;
  network: string;
  sending: boolean;
  busy: boolean;
  error: string | null;
  onPay: () => void;
  onChangeWallet: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-gray-11">
        <WalletIcon src={walletIcon} />
        <span className="min-w-0 flex-1 truncate font-mono text-gray-12" data-testid="payer">
          {shortAddress(address)}
        </span>
        <button
          type="button"
          onClick={onChangeWallet}
          disabled={sending || busy}
          className="shrink-0 text-xs font-semibold text-principal-11 hover:underline disabled:opacity-60"
        >
          Change
        </button>
      </div>

      <div className="text-center">
        <p className="text-3xl font-semibold leading-none text-gray-12">{amount} USDC</p>
        <p className="mt-1 text-sm text-gray-11">on {network}</p>
      </div>

      <button
        type="button"
        onClick={onPay}
        disabled={sending || busy}
        className={cn(PRIMARY_BTN, "w-full flex-none disabled:cursor-not-allowed")}
      >
        {sending ? "Confirm in your wallet…" : `Pay ${amount} USDC`}
      </button>
      {error && <InlineError>{error}</InlineError>}
    </div>
  );
}
