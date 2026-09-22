"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/cn";
import { ScrollArea } from "@/components/ui/ScrollArea";

/*
 * Navegação entre as telas de admin.
 *
 * Vive no `layout.tsx` de `/admin`, então cobre TODAS as rotas filhas — inclusive
 * as que vierem depois, sem precisar tocar em cada página. Antes disto cada tela
 * era um beco sem saída: quem entrava em uma só saía pela URL.
 *
 * Separado do `Topbar` do app de propósito: aquele carrega sessão, carteira,
 * sininho e CTA de assinatura, nada disso útil aqui — e o admin precisa é de um
 * caminho de volta para o produto.
 */
const ADMIN_ITEMS: { href: string; label: string }[] = [
  { href: "/admin/mentorship", label: "Mentorship" },
  { href: "/admin/kols", label: "KOLs" },
  { href: "/admin/feed", label: "Discord feed" },
  { href: "/admin/affiliates", label: "Affiliates" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <header className="w-full border-b border-gray-6 bg-gray-2">
      <div className="mx-auto flex h-[60px] w-full max-w-7xl items-center gap-6 px-6 md:px-12">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-sm text-gray-11 transition-colors hover:text-gray-12"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Back to app</span>
        </Link>

        <span
          aria-hidden="true"
          className="hidden h-6 w-px shrink-0 bg-gray-6 sm:block"
        />

        {/* Rola no horizontal em telas estreitas em vez de quebrar a linha: o
            header tem altura fixa e a quebra empurraria o conteúdo para fora. */}
        <ScrollArea orientation="horizontal" className="min-w-0 flex-1">
          <nav className="flex items-center gap-1 py-2">
            {ADMIN_ITEMS.map((item) => {
              // `startsWith` e não igualdade: uma sub-rota futura
              // (/admin/kols/:id) deve manter o item pai marcado.
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center rounded-md px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-gray-3 font-semibold text-gray-12"
                      : "text-gray-11 hover:text-gray-12",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <span className="hidden shrink-0 rounded-full border border-gray-6 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-11 md:inline">
          Admin
        </span>
      </div>
    </header>
  );
}
