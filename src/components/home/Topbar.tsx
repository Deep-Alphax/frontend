"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NotificationBell } from "@/components/alerts/NotificationBell";
import { AccountMenu } from "@/components/home/AccountMenu";
import { BecomeProButton } from "@/components/home/BecomeProButton";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { WalletChip } from "@/components/home/WalletChip";
import { useSession } from "@/lib/auth/useSession";
import { cn } from "@/lib/cn";

interface NavItem {
  label: string;
  href: string;
}

// Rotas ainda não construídas apontam para "#"; "My profile" é a Home.
// Planos NÃO entra aqui: virou o CTA "Become a Pro" à direita (Figma 1056:27771).
const NAV_ITEMS: NavItem[] = [
  { label: "Mentorship", href: "/mentorship" },
  { label: "Radar", href: "/radar" },
  { label: "KOLs", href: "/wallet-reader" },
  { label: "My profile", href: "/" },
];

/** Nome de exibição a partir do perfil (nome, senão prefixo do e-mail). */
function displayName(profile?: {
  firstName: string | null;
  email: string;
}): string {
  if (!profile) return "My account";
  if (profile.firstName?.trim()) return profile.firstName.trim();
  return profile.email.split("@")[0];
}

export function Topbar() {
  const pathname = usePathname();
  const { profile, isAuthenticated, isLoading } = useSession();
  const name = displayName(profile);

  return (
    <header className="flex h-[60px] w-full  items-center justify-between border-b border-gray-6 bg-gray-2 px-6 md:px-12 lg:px-20">
      {/* Esquerda: logo + navegação */}
      <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
        <div className="flex h-full items-center gap-8">
          <Link href="/" aria-label="Deep Alpha — home" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/deep-alpha-logomark.svg"
              alt="Deep Alpha"
              width={38}
              height={28}
              className="h-7 w-[38px]"
            />
          </Link>

          <nav className="hidden h-full items-center md:flex">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href !== "#" && pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex h-full items-center px-2 text-sm transition-colors",
                    isActive
                      ? "text-secundaria-11"
                      : "text-gray-11 hover:text-gray-12",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Direita: depende da sessão.
          - carregando → skeleton no formato de carteira + sino + conta (nem
            flash de "Sign in" para quem está logado, nem o header pulando);
          - logado → carteiras + notificações + conta;
          - deslogado → só o CTA "Sign in" (nenhuma conta no header). */}
        <div className="flex items-center gap-4">
          <BecomeProButton />

          {isLoading ? (
            <SkeletonGroup label="Loading account" className="flex items-center gap-4">
              <Skeleton className="h-9 w-32 rounded-lg" />
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </SkeletonGroup>
          ) : isAuthenticated ? (
            <>
              <WalletChip />

              <NotificationBell />

              <AccountMenu name={name} avatarUrl={profile?.avatarUrl} />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-principal-9 px-4 py-2 text-sm font-medium text-gray-1 transition-colors hover:bg-principal-10"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
