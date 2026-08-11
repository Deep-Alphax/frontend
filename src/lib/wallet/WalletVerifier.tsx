"use client";

import { useEffect, useRef } from "react";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppKitAccount, useAppKitNetwork, useAppKitProvider, modal } from "@reown/appkit/react";
import { useSignMessage } from "wagmi";
import { createWallet, getWallets, requestWalletNonce } from "@/lib/api/wallets";
import { getApiErrorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { chainFromCaipNetwork } from "./config";

/** Uint8Array → base64 (encoding da assinatura Solana enviada ao backend). */
function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Provider Solana do AppKit — só usamos `signMessage`. */
type SolanaSigner = { signMessage: (message: Uint8Array) => Promise<Uint8Array> };

/** Detecta recusa da assinatura pelo usuário (não é erro nosso). */
function isUserRejection(err: unknown): boolean {
  const e = err as { name?: string; message?: string; code?: number };
  return (
    e?.name === "UserRejectedRequestError" ||
    e?.code === 4001 ||
    /reject|denied|user rejected|recus/i.test(e?.message ?? "")
  );
}

/**
 * Verificação de posse por ASSINATURA (sem conexão persistente). Ao conectar uma
 * carteira nova (usuário logado), pede a mensagem ao backend, faz o usuário
 * ASSINAR (read-only, não autoriza transação), envia a assinatura para o backend
 * validar/cadastrar, e DESCONECTA — não fica sessão ativa. Idempotente por
 * conexão (não reassina o que já está cadastrado). Não renderiza nada.
 */
export function WalletVerifier() {
  const { isAuthenticated } = useSession();
  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider<SolanaSigner>("solana");
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();

  const walletsQuery = useQuery({
    queryKey: ["wallets"],
    queryFn: getWallets,
    retry: false,
    enabled: isAuthenticated,
  });

  // Endereço já processado NESTA conexão (reseta ao desconectar → reconectar reprocessa).
  const processedAddress = useRef<string | null>(null);

  useEffect(() => {
    if (!isConnected) processedAddress.current = null;
    if (!isAuthenticated || !isConnected || !address || !caipNetwork) return;
    if (walletsQuery.isLoading) return;
    if (processedAddress.current === address) return;
    processedAddress.current = address;

    const chain = chainFromCaipNetwork(caipNetwork);
    if (!chain) {
      toast.error("Rede não suportada para leitura de histórico.");
      void modal?.disconnect();
      return;
    }

    const wallets = walletsQuery.data ?? [];
    const already = wallets.some(
      (w) => w.chain === chain && w.address.toLowerCase() === address.toLowerCase(),
    );
    if (already) {
      void modal?.disconnect(); // já cadastrada → não precisa reassinar
      return;
    }

    const namespace = caipNetwork.chainNamespace;

    void (async () => {
      try {
        const { message } = await requestWalletNonce({ chain, address });

        let signature: string;
        if (namespace === "solana") {
          if (!walletProvider) throw new Error("Carteira Solana indisponível para assinar.");
          const sig = await walletProvider.signMessage(new TextEncoder().encode(message));
          signature = toBase64(sig);
        } else {
          signature = await signMessageAsync({ message }); // hex 0x… (EVM)
        }

        await createWallet({ chain, address, signature });
        toast.success("Carteira verificada — lendo seu histórico.");
        queryClient.invalidateQueries({ queryKey: ["wallets"] });
        queryClient.invalidateQueries({ queryKey: ["portfolio-analytics"] });
      } catch (err: unknown) {
        if (err instanceof AxiosError && err.response?.status === 409) {
          queryClient.invalidateQueries({ queryKey: ["wallets"] });
        } else if (isUserRejection(err)) {
          toast.error("Assinatura recusada.");
        } else {
          toast.error(getApiErrorMessage(err, "Não foi possível verificar a carteira."));
        }
      } finally {
        // Só queríamos a assinatura → desconecta (sem sessão/permissão persistente).
        void modal?.disconnect();
      }
    })();
  }, [
    isAuthenticated,
    isConnected,
    address,
    caipNetwork,
    walletsQuery.isLoading,
    walletsQuery.data,
    walletProvider,
    signMessageAsync,
    queryClient,
  ]);

  return null;
}
