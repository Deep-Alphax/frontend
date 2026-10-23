"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { AddWalletModal } from "@/components/home/AddWalletModal";
import {
  CancelIcon,
  ChevronRightIcon,
  CopyIcon,
  DepositIcon,
  PencilIcon,
  PlusSignIcon,
  WalletIcon,
} from "@/components/icons/hugeicons";
import { deleteWallet, getWallets, type Wallet } from "@/lib/api/wallets";
import { getApiErrorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useDepositModal } from "@/lib/store/depositModal";
import { useWalletSelection } from "@/lib/store/walletSelection";
import { cn } from "@/lib/cn";

/** Encurta um endereço on-chain (7xKXtg…RbXcAj9M), como no design. */
function shortAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-8)}`;
}

/**
 * Nome exibido da carteira. O backend só guarda `label` quando o usuário
 * nomeia; sem ele o design numera ("2 Carteira"), então a posição na lista
 * vira o nome — por isso o índice entra aqui.
 */
export function walletName(wallet: Wallet, index: number): string {
  return wallet.label?.trim() || `Wallet ${index + 1}`;
}

/** Cor da miniatura por chain — distintivo visual, não dado do backend. */
function chainSwatch(chain: Wallet["chain"]): string {
  switch (chain) {
    case "SOLANA":
      return "bg-purple-10";
    case "ETHEREUM":
      return "bg-gray-7";
    case "BASE":
      return "bg-blue-10";
    case "ARBITRUM":
      return "bg-azul-9";
    case "BSC":
      return "bg-amber-10";
    case "POLYGON":
      return "bg-violeta-9";
    case "OPTIMISM":
      return "bg-danger-10";
  }
}

/**
 * Chip de carteira do header (Figma `1056:27771`) e o dropdown que ele abre
 * (Figma `547:18300`).
 *
 * Sem carteira nenhuma o chip dá lugar ao CTA amarelo "Connect wallet" (Figma
 * "sem carteira conectada"): não há o que listar e o próximo passo é um só.
 *
 * Este bloco SAIU do menu de conta. Estava lá por falta de lugar melhor; com
 * chip próprio, escolher qual carteira alimenta o dashboard deixa de estar
 * escondido atrás do avatar.
 */
export function WalletChip() {
  const { isAuthenticated } = useSession();
  const queryClient = useQueryClient();
  const selectedWalletId = useWalletSelection((s) => s.selectedWalletId);
  const select = useWalletSelection((s) => s.select);
  const showDeposit = useDepositModal((s) => s.show);

  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Wallet | null>(null);

  // Lê o cache ["wallets"] (compartilhado com o ProfileContent, que faz o
  // polling enquanto sincroniza) — sem poller próprio aqui.
  const { data: wallets = [] } = useQuery({
    queryKey: ["wallets"],
    queryFn: getWallets,
    enabled: isAuthenticated,
    retry: false,
  });

  if (!isAuthenticated) return null;

  /**
   * Abre o modal. O menu é controlado só por causa daqui: ele é a camada de
   * BAIXO, e deixá-lo aberto atrás do modal empilha dois níveis de foco.
   */
  const openModal = (wallet: Wallet | null) => {
    setEditing(wallet);
    setAddOpen(true);
    setMenuOpen(false);
  };

  const handleCopy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success("Address copied.");
    } catch {
      // Clipboard bloqueado (contexto inseguro / permissão negada) — avisa em
      // vez de falhar calado, senão o clique parece não ter feito nada.
      toast.error("Could not copy the address.");
    }
  };

  const handleDelete = async (wallet: Wallet, name: string) => {
    if (!window.confirm(`Remove ${name}? Its data leaves the dashboard.`)) return;
    try {
      await deleteWallet(wallet.id);
      if (selectedWalletId === wallet.id) select(null); // ProfileContent escolhe outra
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-analytics"] });
      toast.success("Wallet removed.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not remove the wallet."));
    }
  };

  const modal = (
    <AddWalletModal
      open={addOpen}
      onOpenChange={(open) => {
        setAddOpen(open);
        if (!open) setEditing(null);
      }}
      replacing={editing}
    />
  );

  if (wallets.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => openModal(null)}
          className="flex h-9 items-center gap-1 rounded-lg bg-principal-9 px-3 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10"
        >
          <WalletIcon className="size-5 shrink-0" />
          Connect wallet
        </button>
        {modal}
      </>
    );
  }

  return (
    <>
      <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex h-9 items-center gap-3 rounded-lg border border-gray-6 bg-gray-3 px-2 transition-colors hover:bg-gray-4 data-[state=open]:bg-gray-4"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded border border-gray-6 bg-gray-2">
              <WalletIcon className="size-4 text-gray-12" />
            </span>
            <span className="flex flex-col items-start gap-1 leading-none">
              <span className="text-xs font-medium text-gray-12">
                {wallets.length === 1 ? "1 Wallet" : `${wallets.length} Wallets`}
              </span>
              <span className="text-[11px] text-gray-11">Connected</span>
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-gray-11" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          {/* 289px = 265px do Figma + a ação "Deposit with Pix" (24px) — sem
              isso o endereço curto da linha ficava cortado de novo. */}
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="z-50 w-[289px] overflow-hidden rounded-lg border border-gray-6 bg-gray-2"
          >
            {wallets.map((wallet, index) => {
              const name = walletName(wallet, index);
              const syncing =
                wallet.syncStatus === "PENDING" || wallet.syncStatus === "SYNCING";
              return (
                <DropdownMenu.Item
                  key={wallet.id}
                  // Não fecha ao clicar: copiar, editar e escolher costumam vir
                  // em sequência — fechar a cada clique obrigaria reabrir.
                  onSelect={(e) => {
                    e.preventDefault();
                    select(wallet.id);
                  }}
                  className={cn(
                    "flex h-[52px] cursor-pointer items-center gap-2 border-b border-gray-6 px-3 outline-none transition-colors data-[highlighted]:bg-gray-3",
                    selectedWalletId === wallet.id && "bg-gray-3",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-8 shrink-0 rounded-full",
                      chainSwatch(wallet.chain),
                    )}
                  />

                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-xs font-medium text-gray-12">
                      {name}
                    </span>
                    <span className="truncate font-mono text-[11px] text-gray-11">
                      {syncing ? "Syncing…" : shortAddress(wallet.address)}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-1">
                    {/* Depósito via Pix com ESTA carteira como destino (a rede
                        dela vem pré-escolhida). Fecha o menu antes de abrir o
                        modal, pelo mesmo motivo do `openModal`. */}
                    <RowAction
                      label={`Deposit with Pix to ${name}`}
                      title="Deposit with Pix"
                      onClick={() => {
                        setMenuOpen(false);
                        showDeposit({ chain: wallet.chain, address: wallet.address });
                      }}
                    >
                      <DepositIcon className="size-4" />
                    </RowAction>
                    <RowAction
                      label={`Copy ${name} address`}
                      onClick={() => handleCopy(wallet.address)}
                    >
                      <CopyIcon className="size-4" />
                    </RowAction>
                    <RowAction
                      label={`Edit ${name}`}
                      onClick={() => openModal(wallet)}
                    >
                      <PencilIcon className="size-4" />
                    </RowAction>
                    <RowAction
                      label={`Remove ${name}`}
                      onClick={() => handleDelete(wallet, name)}
                      danger
                    >
                      <CancelIcon className="size-4" />
                    </RowAction>
                  </span>
                </DropdownMenu.Item>
              );
            })}

            <DropdownMenu.Item
              onSelect={() => openModal(null)}
              className="flex h-11 cursor-pointer items-center justify-center gap-1 px-3 text-sm text-gray-12 outline-none transition-colors data-[highlighted]:bg-gray-3"
            >
              <PlusSignIcon className="size-5 shrink-0" />
              Connect another wallet
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {modal}
    </>
  );
}

/** Botão de ação da linha — para o clique antes que ele vire "selecionar". */
function RowAction({
  label,
  title,
  onClick,
  danger,
  children,
}: {
  label: string;
  /** Dica no hover (o `aria-label` já nomeia para leitor de tela). */
  title?: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      // O Radix decide o destino do item já no `pointerdown`; sem parar o evento
      // aqui, a linha some antes de o `click` chegar e o botão nunca dispara.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex size-6 items-center justify-center rounded text-gray-11 transition-colors",
        danger ? "hover:text-danger-11" : "hover:text-gray-12",
      )}
    >
      {children}
    </button>
  );
}
