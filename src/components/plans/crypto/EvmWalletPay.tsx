"use client";

import { useMemo, useState } from "react";
import { encodeFunctionData, erc20Abi, type Address, type Hex } from "viem";
import { arbitrum, base, bsc, mainnet, optimism, polygon } from "viem/chains";
import {
  createConfig,
  custom,
  useConfig,
  useConnection,
  useConnectors,
  WagmiProvider,
  type Connector,
} from "wagmi";
import {
  connect,
  disconnect,
  sendTransaction,
  signMessage,
  switchChain,
} from "wagmi/actions";
import { injected } from "wagmi/connectors";

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
 * Pagamento em redes EVM pela carteira do navegador (chunk carregado sob
 * demanda — wagmi/viem não entram no bundle do app).
 *
 * O navegador NÃO fala com RPC público nenhum (a CSP só libera a API): toda
 * chamada vai para o provider da carteira — conectar, trocar de rede,
 * `personal_sign` e `eth_sendTransaction`. Por isso o transporte dos clientes
 * públicos é um stub que recusa: se algum hook de leitura for usado por engano,
 * falha alto aqui em vez de tentar um RPC que a CSP bloquearia. Recibo e confirmações quem confere
 * é o backend, a partir do hash.
 */

const noPublicRpc = custom({
  async request({ method }: { method: string }) {
    throw new Error(`Public RPC disabled in the browser (${method}).`);
  },
});

const chains = [mainnet, base, arbitrum, optimism, polygon, bsc] as const;

const config = createConfig({
  chains,
  // `injected()` genérico cobre carteiras sem EIP-6963 (alguns navegadores
  // in-app); as que anunciam via 6963 entram sozinhas, com nome e ícone.
  connectors: [injected()],
  multiInjectedProviderDiscovery: true,
  ssr: true,
  transports: {
    [mainnet.id]: noPublicRpc,
    [base.id]: noPublicRpc,
    [arbitrum.id]: noPublicRpc,
    [optimism.id]: noPublicRpc,
    [polygon.id]: noPublicRpc,
    [bsc.id]: noPublicRpc,
  },
});

export default function EvmWalletPay(props: WalletPayProps) {
  return (
    <WagmiProvider config={config}>
      <EvmPay {...props} />
    </WagmiProvider>
  );
}

/** Carteiras para a lista: as anunciadas (6963) e, sem nenhuma, a genérica. */
function walletOptions(connectors: readonly Connector[]): Array<WalletOption & { connector: Connector }> {
  const announced = connectors.filter((c) => c.type === "injected" && c.id !== "injected");
  const hasWindowProvider =
    typeof window !== "undefined" && "ethereum" in window && !!(window as { ethereum?: unknown }).ethereum;
  const list = announced.length > 0
    ? announced
    : connectors.filter((c) => c.id === "injected" && hasWindowProvider);
  return list.map((c) => ({
    id: c.uid,
    name: c.id === "injected" ? "Browser wallet" : c.name,
    icon: safeIcon(c.icon),
    connector: c,
  }));
}

function EvmPay({ payment, network, busy, error: outerError, onSent }: WalletPayProps) {
  const cfg = useConfig();
  const connection = useConnection();
  const connectors = useConnectors();
  const options = useMemo(() => walletOptions(connectors), [connectors]);

  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chainId = payment.chainId;
  const address = connection.status === "connected" ? connection.address : undefined;

  async function pick(id: string) {
    const opt = options.find((o) => o.id === id);
    if (!opt) return;
    setError(null);
    setConnectingId(id);
    try {
      await connect(cfg, { connector: opt.connector, chainId: chainId ?? undefined });
    } catch (err) {
      setError(walletErrorMessage(err));
    } finally {
      setConnectingId(null);
    }
  }

  async function pay() {
    if (!address || chainId === null) return;
    const target = chainId as (typeof chains)[number]["id"];
    setError(null);
    setSending(true);
    try {
      if (!payment.ownershipMessage) throw new Error("Payment is missing its signing message.");
      const units = toBaseUnits(payment.amount, payment.tokenDecimals);
      // Rede errada na carteira → pede a troca (ou o cadastro) antes de tudo.
      if (connection.chainId !== target) {
        await switchChain(cfg, { chainId: target });
      }
      // Assina ANTES de enviar: recusar a assinatura nunca movimenta dinheiro.
      // A assinatura prova ao servidor que o dono da carteira de origem é quem
      // registra o hash (transferências são públicas — sem isso, qualquer um
      // poderia reivindicar a de outra pessoa).
      const signature = await signMessage(cfg, {
        account: address,
        message: payment.ownershipMessage,
      });
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [payment.receiver as Address, units],
      });
      // `sendTransaction` com conector JSON-RPC → só `eth_chainId` +
      // `eth_sendTransaction` no provider da carteira (sem simulação via RPC
      // público). A carteira estima o gás.
      const hash: Hex = await sendTransaction(cfg, {
        to: payment.tokenAddress as Address,
        data,
        chainId: target,
      });
      onSent({ txHash: hash, payer: address, signature });
    } catch (err) {
      setError(walletErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  if (chainId === null) {
    return <p className="text-sm text-danger-11">This network is not supported.</p>;
  }

  if (!address) {
    return (
      <WalletPicker
        wallets={options}
        connectingId={connectingId}
        onPick={(id) => void pick(id)}
        error={error ?? outerError}
      />
    );
  }

  return (
    <ConnectedPay
      address={address}
      walletIcon={safeIcon(connection.connector?.icon)}
      amount={payment.amount}
      network={network}
      sending={sending}
      busy={busy}
      error={error ?? outerError}
      onPay={() => void pay()}
      onChangeWallet={() => {
        setError(null);
        void disconnect(cfg);
      }}
    />
  );
}
