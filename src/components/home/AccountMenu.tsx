"use client";

import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Check, ChevronDown, LayoutGrid, Loader2, Plus, Shield, Trash2 } from "lucide-react";

import { Avatar } from "@/components/ui/Avatar";
import { getWallets, deleteWallet } from "@/lib/api/wallets";
import { getApiErrorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useWalletSelection } from "@/lib/store/walletSelection";
import { useWalletConnect } from "@/lib/wallet/useWalletConnect";
import { cn } from "@/lib/cn";

/** Encurta um endereço on-chain (0x1234…abcd). */
function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

interface AccountMenuProps {
  name: string;
  avatarUrl?: string | null;
}

/**
 * Menu de conta no header. Clicar no perfil abre um dropdown para: escolher qual
 * carteira alimenta o dashboard ("Meu perfil"), conectar outra carteira, ou
 * remover uma. A seleção vive no store `useWalletSelection` (lida pelo ProfileContent).
 */
export function AccountMenu({ name, avatarUrl }: AccountMenuProps) {
  const queryClient = useQueryClient();
  const wallet = useWalletConnect();
  const { profile } = useSession();
  const isAdmin = profile?.role === "ADMIN";
  const selectedWalletId = useWalletSelection((s) => s.selectedWalletId);
  const select = useWalletSelection((s) => s.select);

  // Lê o cache ["wallets"] (compartilhado com o ProfileContent, que faz o polling
  // enquanto sincroniza) — sem poller próprio aqui, para não duplicar requests.
  const { data: wallets = [] } = useQuery({
    queryKey: ["wallets"],
    queryFn: getWallets,
    retry: false,
  });

  const handleDelete = async (id: string, label: string) => {
    if (!window.confirm(`Remover a carteira ${label}? Os dados dela saem do painel.`)) return;
    try {
      await deleteWallet(id);
      if (selectedWalletId === id) select(null); // caiu a selecionada → volta ao agregado
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-analytics"] });
      toast.success("Carteira removida.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Não foi possível remover a carteira."));
    }
  };

  const itemClass =
    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-12 outline-none transition-colors data-[highlighted]:bg-gray-3";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-gray-3 data-[state=open]:bg-gray-3"
        >
          <Avatar src={avatarUrl} name={name} />
          <span className="text-sm font-medium text-gray-12">{name}</span>
          <ChevronDown className="size-4 text-gray-11" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[280px] rounded-lg border border-gray-6 bg-gray-2 p-1.5 shadow-xl"
        >
          <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-gray-11">
            Carteiras
          </div>

          {/* Agregado (todas) */}
          <DropdownMenu.Item className={itemClass} onSelect={() => select(null)}>
            <LayoutGrid className="size-4 text-gray-11" />
            <span className="flex-1">Portfólio (todas)</span>
            {selectedWalletId === null ? <Check className="size-4 text-principal-9" /> : null}
          </DropdownMenu.Item>

          {wallets.length > 0 ? <DropdownMenu.Separator className="my-1.5 h-px bg-gray-6" /> : null}

          {/* Uma carteira por linha (selecionar + remover) */}
          {wallets.map((w) => {
            const label = `${w.chain} ${shortAddress(w.address)}`;
            const syncing = w.syncStatus === "PENDING" || w.syncStatus === "SYNCING";
            return (
              <div key={w.id} className="flex items-center gap-1">
                <DropdownMenu.Item
                  className={cn(
                    "flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 rounded-md px-2 py-2 outline-none transition-colors data-[highlighted]:bg-gray-3",
                  )}
                  onSelect={() => select(w.id)}
                >
                  <div className="flex w-full items-center gap-2">
                    <span className="shrink-0 text-xs text-gray-11">{w.chain}</span>
                    <span className="truncate font-mono text-xs text-gray-12">
                      {shortAddress(w.address)}
                    </span>
                    {selectedWalletId === w.id ? (
                      <Check className="ml-auto size-4 shrink-0 text-principal-9" />
                    ) : null}
                  </div>
                  {syncing ? (
                    <span className="flex items-center gap-1 text-[11px] text-gray-11">
                      <Loader2 className="size-3 animate-spin" aria-hidden />
                      Sincronizando…
                    </span>
                  ) : w.syncStatus === "ERROR" ? (
                    <span className="text-[11px] text-danger-11">Erro ao sincronizar</span>
                  ) : null}
                </DropdownMenu.Item>
                <button
                  type="button"
                  aria-label={`Remover ${label}`}
                  onClick={() => handleDelete(w.id, label)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-11 transition-colors hover:bg-gray-3 hover:text-danger-11"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}

          <DropdownMenu.Separator className="my-1.5 h-px bg-gray-6" />

          <DropdownMenu.Item className={itemClass} onSelect={() => wallet.open()}>
            <Plus className="size-4 text-gray-11" />
            <span>Conectar outra carteira</span>
          </DropdownMenu.Item>

          {isAdmin ? (
            <>
              <DropdownMenu.Separator className="my-1.5 h-px bg-gray-6" />
              <DropdownMenu.Item asChild className={itemClass}>
                <Link href="/admin/feed">
                  <Shield className="size-4 text-gray-11" />
                  <span>Admin · Feed do Discord</span>
                </Link>
              </DropdownMenu.Item>
            </>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
