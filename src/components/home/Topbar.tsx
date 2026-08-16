"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

import { AccountMenu } from "@/components/home/AccountMenu";
import { useSession } from "@/lib/auth/useSession";
import { cn } from "@/lib/cn";

interface NavItem {
  label: string;
  href: string;
}

// Rotas ainda não construídas apontam para "#"; "Meu perfil" é a Home.
const NAV_ITEMS: NavItem[] = [
  { label: "Radar", href: "/radar" },
  { label: "Meu perfil", href: "/" },
];

/** Nome de exibição a partir do perfil (nome, senão prefixo do e-mail). */
function displayName(profile?: {
  firstName: string | null;
  email: string;
}): string {
  if (!profile) return "Minha conta";
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
          <Link href="/" aria-label="Deep Alpha — início" className="flex items-center">
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
          - carregando → nada (evita flash de "Entrar" para quem está logado);
          - logado → notificações + conta;
          - deslogado → só o CTA "Entrar" (nenhuma conta no header). */}
        <div className="flex items-center gap-4">
          {isLoading ? null : isAuthenticated ? (
            <>
              <button
                type="button"
                aria-label="Notificações"
                className="flex size-9 items-center justify-center rounded-lg text-gray-12 transition-colors hover:bg-gray-3"
              >
                <Bell className="size-6" strokeWidth={1.5} />
              </button>

              <AccountMenu name={name} avatarUrl={profile?.avatarUrl} />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-principal-9 px-4 py-2 text-sm font-medium text-gray-1 transition-colors hover:bg-principal-10"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
