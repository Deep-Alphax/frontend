"use client";

import toast from "react-hot-toast";
import { modal } from "@reown/appkit/react";
import { walletEnabled } from "./config";

export interface WalletConnect {
  /** Abre o modal de conexão de carteira (EVM + Solana). */
  open: () => void;
  /** true quando o wallet connect está configurado (projectId presente). */
  isReady: boolean;
}

/**
 * Ponto ÚNICO para abrir a conexão de carteira (EVM + Solana). Usa o singleton
 * `modal` (setado por `createAppKit` no cliente) em vez do hook `useAppKit` —
 * este lança se `createAppKit` ainda não rodou, o que quebraria o SSR. Como o
 * `open` só é chamado por clique (pós-mount), o modal já existe; se por acaso
 * ainda não, degrada com aviso. Sem projectId, também degrada.
 */
export function useWalletConnect(): WalletConnect {
  return {
    isReady: walletEnabled,
    open: () => {
      if (!walletEnabled) {
        toast(
          "Conexão de carteira indisponível — configure NEXT_PUBLIC_REOWN_PROJECT_ID.",
          { icon: "👛" },
        );
        return;
      }
      if (!modal) {
        toast("Carteira inicializando — tente novamente em instantes.", { icon: "👛" });
        return;
      }
      void modal.open();
    },
  };
}
