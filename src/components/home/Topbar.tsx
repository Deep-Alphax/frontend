"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NotificationBell } from "@/components/alerts/NotificationBell";
import { AccountMenu } from "@/components/home/AccountMenu";
import { BecomeProButton } from "@/components/home/BecomeProButton";
import { DepositButton } from "@/components/deposits/DepositButton";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { WalletChip } from "@/components/home/WalletChip";
import { useAccountEvents } from "@/lib/alerts/useAccountEvents";
import { useSession } from "@/lib/auth/useSession";
import { usePlan } from "@/lib/billing/usePlan";
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
  { label: "Tracker", href: "/tracker" },
  { label: "KOLs", href: "/wallet-reader" },
  { label: "Copy Trade", href: "/copy-trade" },
  { label: "My profile", href: "/" },
];

/**
 * Elixir Alpha no FREE (`access.restricted`): só o que o acesso cobre. Planos
 * seguem no CTA "Become a Pro" e Afiliados no menu da conta; Deep Ranking é
 * aba dentro de KOLs.
 */
const RESTRICTED_NAV_ITEMS: NavItem[] = [
  { label: "Mentorship", href: "/mentorship" },
  { label: "KOLs", href: "/wallet-reader" },
];

/**
 * Eventos da conta pelo socket para quem NÃO tem o sininho (restrito): sem
 * isto, um `plan:update` (ex.: assinou o Pro em outra aba) não refaria o acesso.
 */
function AccountEvents() {
  useAccountEvents(true);
  return null;
}

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
  const { isRestricted, isLoading: accessLoading } = usePlan();
  const name = displayName(profile);
  // `isAuthenticated` já é false no servidor e na hidratação (`useSession`),
  // então os dois lados desenham a navegação completa — sem hydration mismatch.
  // Enquanto o acesso carrega também: o backend é quem barra.
  const restricted = isAuthenticated && isRestricted;
  const navItems = restricted ? RESTRICTED_NAV_ITEMS : NAV_ITEMS;

  return (
    <header className="flex h-[60px] w-full  items-center justify-between border-b border-gray-6 bg-gray-2 px-6 md:px-12 lg:px-20">
      {/* Esquerda: logo + navegação */}
      <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
        <div className="flex h-full items-center gap-8">
          <Link
            href={restricted ? "/mentorship" : "/"}
            aria-label="Deep Alpha — home"
            className="flex items-center"
          >
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
            {navItems.map((item) => {
              // Sub-rota mantém o item pai marcado (/wallet-reader/ranking →
              // KOLs). A raiz "/" só por igualdade, senão tudo casaria.
              const isActive =
                item.href !== "#" &&
                (pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(`${item.href}/`)));
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
          - logado → depósito + carteiras + notificações + conta;
          - logado restrito (Elixir Alpha FREE) → só a conta: depósito,
            carteiras e sininho chamariam rotas que dão 403 para ele;
          - deslogado → só o CTA "Sign in" (nenhuma conta no header). */}
        <div className="flex items-center gap-4">
          <BecomeProButton />

          {/* O skeleton cobre também o acesso carregando: montar carteira e
              sininho antes de saber se a conta é restrita dispararia 403. */}
          {isLoading || (isAuthenticated && accessLoading) ? (
            <SkeletonGroup label="Loading account" className="flex items-center gap-4">
              <Skeleton className="h-9 w-9 rounded-lg sm:w-[104px]" />
              <Skeleton className="h-9 w-32 rounded-lg" />
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </SkeletonGroup>
          ) : restricted ? (
            <>
              <AccountEvents />
              <AccountMenu name={name} avatarUrl={profile?.avatarUrl} restricted />
            </>
          ) : isAuthenticated ? (
            <>
              {/* Depósito via Pix — antes do chip de carteira, que também o abre. */}
              <DepositButton />

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
