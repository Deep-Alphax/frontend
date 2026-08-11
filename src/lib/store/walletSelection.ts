import { create } from "zustand";

interface WalletSelectionState {
  /** Carteira selecionada no dashboard. null = portfólio (todas as carteiras). */
  selectedWalletId: string | null;
  select: (walletId: string | null) => void;
}

/**
 * Seleção de carteira do dashboard "Meu perfil", compartilhada entre o menu do
 * header (troca) e o `ProfileContent` (dados exibidos). Em memória (reseta para o
 * agregado ao recarregar) — é estado de UI, não de sessão.
 */
export const useWalletSelection = create<WalletSelectionState>((set) => ({
  selectedWalletId: null,
  select: (walletId) => set({ selectedWalletId: walletId }),
}));
