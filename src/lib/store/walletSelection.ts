import { create } from "zustand";

interface WalletSelectionState {
  /** Carteira selecionada no dashboard. null = nenhuma ainda (o ProfileContent
   * escolhe a 1ª do catálogo automaticamente — não há mais agregado "todas"). */
  selectedWalletId: string | null;
  select: (walletId: string | null) => void;
}

/**
 * Seleção de carteira do dashboard "Meu perfil", compartilhada entre o menu do
 * header (troca) e o `ProfileContent` (dados exibidos). Em memória (reseta ao
 * recarregar; o ProfileContent re-seleciona a 1ª) — é estado de UI, não de sessão.
 */
export const useWalletSelection = create<WalletSelectionState>((set) => ({
  selectedWalletId: null,
  select: (walletId) => set({ selectedWalletId: walletId }),
}));
