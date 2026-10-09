"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

/** Abas da área de KOLs (Figma "Navegação KOLs / Deep Ranking", 1474:58727). */
const TABS = [
  { href: "/wallet-reader", label: "KOLs" },
  { href: "/wallet-reader/ranking", label: "Deep Ranking" },
] as const;

export function KolsTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="KOLs sections" className={cn("flex items-end", className)}>
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center justify-center px-5 py-3 text-sm font-medium leading-[1.3] whitespace-nowrap transition-colors",
              active
                ? "border-b-2 border-principal-11 text-principal-11"
                : "border-b border-gray-6 text-gray-11 hover:text-gray-12",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
