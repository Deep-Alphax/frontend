"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WalletReadyState, type Adapter, type WalletName } from "@solana/wallet-adapter-base";
import { useWallet, WalletProvider } from "@solana/wallet-adapter-react";
import bs58 from "bs58";

import { getSolanaBlockhash } from "@/lib/api/billing";
import { buildUsdcTransfer } from "@/lib/crypto/solanaTransfer";
import { toBaseUnits } from "@/lib/crypto/units";
import { walletErrorMessage } from "@/lib/crypto/walletErrors";
import {
  ConnectedPay,
  safeIcon,
  WalletPicker,
  type WalletOption,
  type WalletPayProps,
} from "./walletUi";

/*
 * Pagamento na Solana pela carteira do navegador (chunk sob demanda).
 *
 * Sem RPC no navegador: o blockhash vem do backend e a carteira assina E
 * transmite (`solana:signAndSendTransaction` do Wallet Standard). Por isso não
 * há `ConnectionProvider` e o `adapter.sendTransaction` NÃO é usado — ele exige
 * uma `Connection` e, em carteiras só com `signTransaction`, transmitiria pelo
 * nosso lado. Só entram na lista as carteiras que transmitem sozinhas
 * (Phantom, Solflare, Backpack…).
 */

const MAINNET = "solana:mainnet";
const SIGN_AND_SEND = "solana:signAndSendTransaction";

// Wallet Standard: tipos mínimos do que usamos (evita depender do pacote de features).
interface StdAccount {
  address: string;
  chains: readonly string[];
}
interface SignAndSendFeature {
  signAndSendTransaction(
    ...inputs: Array<{ account: StdAccount; chain: string; transaction: Uint8Array }>
  ): Promise<Array<{ signature: Uint8Array }>>;
}
interface StdWallet {
  accounts: readonly StdAccount[];
  features: Record<string, unknown>;
}

function standardWallet(adapter: Adapter): StdWallet | null {
  const w = (adapter as unknown as { wallet?: StdWallet }).wallet;
  return w && typeof w === "object" && SIGN_AND_SEND in w.features ? w : null;
}

// Nenhum adapter legado: o Wallet Standard detecta as instaladas sozinho.
const NO_ADAPTERS: Adapter[] = [];

export default function SolanaWalletPay(props: WalletPayProps) {
  return (
    <WalletProvider wallets={NO_ADAPTERS} autoConnect={false} onError={() => {}}>
      <SolanaPay {...props} />
    </WalletProvider>
  );
}

function SolanaPay({ payment, network, busy, error: outerError, onSent }: WalletPayProps) {
  const { wallets, wallet, select, connect, disconnect, connected, publicKey } = useWallet();

  const options: WalletOption[] = useMemo(
    () =>
      wallets
        .filter(
          (w) =>
            w.readyState === WalletReadyState.Installed && standardWallet(w.adapter) !== null,
        )
        .map((w) => ({
          id: w.adapter.name,
          name: w.adapter.name,
          icon: safeIcon(w.adapter.icon),
        })),
    [wallets],
  );

  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `select` só vale no próximo render: a conexão sai no efeito, quando o
  // adapter escolhido já é o atual.
  const pendingConnect = useRef<string | null>(null);
  useEffect(() => {
    const name = pendingConnect.current;
    if (!name || wallet?.adapter.name !== name) return;
    pendingConnect.current = null;
    connect()
      .catch((err: unknown) => setError(walletErrorMessage(err)))
      .finally(() => setConnectingId(null));
  }, [wallet, connect]);

  function pick(name: string) {
    setError(null);
    setConnectingId(name);
    if (wallet?.adapter.name === name) {
      // Já selecionada (ex.: sessão anterior): o efeito não dispararia.
      connect()
        .catch((err: unknown) => setError(walletErrorMessage(err)))
        .finally(() => setConnectingId(null));
      return;
    }
    pendingConnect.current = name;
    select(name as WalletName);
  }

  async function pay() {
    if (!wallet || !publicKey) return;
    setError(null);
    setSending(true);
    try {
      const std = standardWallet(wallet.adapter);
      const account = std?.accounts.find((a) => a.address === publicKey.toBase58());
      if (!std || !account) throw new Error("This wallet cannot send the payment.");
      if (!account.chains.includes(MAINNET)) {
        throw new Error("Switch your wallet to Solana mainnet.");
      }
      if (!payment.reference) throw new Error("Payment reference missing.");

      const amount = toBaseUnits(payment.amount, payment.tokenDecimals);
      const { blockhash, lastValidBlockHeight } = await getSolanaBlockhash();
      const tx = buildUsdcTransfer({
        payer: publicKey,
        receiver: payment.receiver,
        mint: payment.tokenAddress,
        reference: payment.reference,
        amount,
        decimals: payment.tokenDecimals,
        blockhash,
        lastValidBlockHeight,
      });
      const bytes = tx.serialize({ requireAllSignatures: false, verifySignatures: false });

      const feature = std.features[SIGN_AND_SEND] as SignAndSendFeature;
      const [out] = await feature.signAndSendTransaction({
        account,
        chain: MAINNET,
        transaction: new Uint8Array(bytes),
      });
      onSent({ txHash: bs58.encode(out.signature), payer: publicKey.toBase58() });
    } catch (err) {
      setError(walletErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  if (!connected || !publicKey) {
    return (
      <WalletPicker
        wallets={options}
        connectingId={connectingId}
        onPick={pick}
        error={error ?? outerError}
      />
    );
  }

  return (
    <ConnectedPay
      address={publicKey.toBase58()}
      walletIcon={safeIcon(wallet?.adapter.icon)}
      amount={payment.amount}
      network={network}
      sending={sending}
      busy={busy}
      error={error ?? outerError}
      onPay={() => void pay()}
      onChangeWallet={() => {
        setError(null);
        void disconnect().catch(() => {});
        select(null);
      }}
    />
  );
}
