import { create } from "zustand";

import type { BackendChain } from "@/lib/api/wallets";

/** Destino pré-escolhido ao abrir pelo menu de carteiras. */
export interface DepositPreset {
  chain: BackendChain;
  address: string;
}

interface DepositModalState {
  open: boolean;
  /** null = abriu pelo botão "Deposit" do header (sem destino escolhido). */
  preset: DepositPreset | null;
  /** Abre o modal; cada abertura ganha um `session` novo (o formulário nasce limpo). */
  show: (preset?: DepositPreset | null) => void;
  close: () => void;
  session: number;
}

/**
 * Modal de depósito via Pix, aberto de dois lugares do header (botão "Deposit"
 * e a linha de cada carteira no `WalletChip`). Estado de UI em memória — o
 * depósito em si vive no servidor.
 */
export const useDepositModal = create<DepositModalState>((set) => ({
  open: false,
  preset: null,
  session: 0,
  show: (preset = null) => set((s) => ({ open: true, preset, session: s.session + 1 })),
  close: () => set({ open: false }),
}));
