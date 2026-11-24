"use client";

import { useState } from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ChevronDown, Shield } from "lucide-react";

import { AffiliatesModal } from "@/components/affiliates/AffiliatesModal";
import { Avatar } from "@/components/ui/Avatar";
import { LogoutIcon, UserIcon, VoucherIcon } from "@/components/icons/hugeicons";
import { logout } from "@/lib/api/auth";
import { SESSION_HINT_COOKIE } from "@/lib/auth/sessionHint";
import { useSession } from "@/lib/auth/useSession";
import { cn } from "@/lib/cn";

interface AccountMenuProps {
  name: string;
  avatarUrl?: string | null;
  /** Elixir Alpha no FREE: sem "My profile" (a Home de carteiras é bloqueada). */
  restricted?: boolean;
}

/**
 * Menu de conta no header (Figma `1150:32711`): perfil e sair.
 *
 * A lista de carteiras SAIU daqui — virou o `WalletChip`, ao lado. Este menu
 * voltou a ser só sobre a conta, que é o que o avatar promete.
 *
 * Os atalhos de admin não estão no design (ele não modela um usuário ADMIN),
 * mas continuam aqui abaixo de um separador: são a única porta para `/admin/*`
 * e o custo de perdê-los é digitar URL na mão.
 */
export function AccountMenu({ name, avatarUrl, restricted = false }: AccountMenuProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { profile } = useSession();
  const isAdmin = profile?.role === "ADMIN";
  const [affiliatesOpen, setAffiliatesOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout(); // backend limpa os cookies httpOnly de sessão
    } catch {
      // Mesmo se o request falhar, encerramos no cliente (evita ficar "preso").
    }
    // Limpa o cookie-dica → useSession vira deslogado; zera o cache e vai p/ login.
    document.cookie = `${SESSION_HINT_COOKIE}=; Max-Age=0; path=/`;
    queryClient.clear();
    router.replace("/login");
  };

  // Linha do menu: 36px, ícone 20, borda inferior — como no design.
  const itemClass =
    "flex h-9 cursor-pointer items-center gap-1 border-b border-gray-6 px-3 text-sm font-medium text-gray-12 outline-none transition-colors data-[highlighted]:bg-gray-3";

  return (
    <>
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
          className="z-50 min-w-[159px] overflow-hidden rounded-lg border border-gray-6 bg-gray-2"
        >
          {!restricted && (
            <DropdownMenu.Item asChild className={itemClass}>
              <Link href="/">
                <UserIcon className="size-5 shrink-0" />
                <span>My profile</span>
              </Link>
            </DropdownMenu.Item>
          )}

          <DropdownMenu.Item
            className={itemClass}
            onSelect={() => setAffiliatesOpen(true)}
          >
            <VoucherIcon className="size-5 shrink-0" />
            <span>Affiliates</span>
          </DropdownMenu.Item>

          {isAdmin ? (
            <>
              <DropdownMenu.Item asChild className={itemClass}>
                <Link href="/admin/feed">
                  <Shield className="size-5 shrink-0 text-gray-11" />
                  <span>Admin · Feed</span>
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild className={itemClass}>
                <Link href="/admin/kols">
                  <Shield className="size-5 shrink-0 text-gray-11" />
                  <span>Admin · KOL preset</span>
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild className={itemClass}>
                <Link href="/admin/mentorship">
                  <Shield className="size-5 shrink-0 text-gray-11" />
                  <span>Admin · Mentorship</span>
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild className={itemClass}>
                <Link href="/admin/affiliates">
                  <Shield className="size-5 shrink-0 text-gray-11" />
                  <span>Admin · Affiliates</span>
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild className={itemClass}>
                <Link href="/admin/users">
                  <Shield className="size-5 shrink-0 text-gray-11" />
                  <span>Admin · Users</span>
                </Link>
              </DropdownMenu.Item>
            </>
          ) : null}

          <DropdownMenu.Item
            className={cn(itemClass, "border-b-0")}
            onSelect={handleLogout}
          >
            <LogoutIcon className="size-5 shrink-0" />
            <span>Sign out</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>

    <AffiliatesModal open={affiliatesOpen} onOpenChange={setAffiliatesOpen} />
    </>
  );
}
