"use client";

/**
 * DESATIVADO. O modelo mudou de "provar posse por assinatura" para "catalogar um
 * endereço público" (sem assinatura) — ver `AddWalletModal`. Este componente virou
 * um no-op para não quebrar a montagem existente no `WalletProvider`; pode ser
 * removido junto com a infra Reown quando ela sair de vez.
 */
export function WalletVerifier() {
  return null;
}
