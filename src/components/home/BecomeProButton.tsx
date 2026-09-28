"use client";

import Link from "next/link";
import { FlashIcon } from "@/components/icons/hugeicons";
import { usePlan } from "@/lib/billing/usePlan";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * CTA de upsell no header (Figma `1056:27771` — "Assinar Pro").
 *
 * Substitui o antigo link "Plans" da navegação. Some para quem JÁ é PRO: oferecer
 * assinatura a assinante é ruído. Enquanto o plano carrega, um skeleton do
 * mesmo tamanho — antes o botão aparecia e sumia para quem já era PRO.
 * Deslogado = FREE (mostra a oferta).
 *
 * Usa o mesmo `usePlan` do `PlanCta`, então o header e a tela de planos
 * dividem a MESMA entrada de cache (uma requisição, não duas).
 */
export function BecomeProButton() {
  const { isPro, isLoading } = usePlan();
  if (isLoading) return <Skeleton className="h-9 w-[132px] rounded-lg" />;
  if (isPro) return null;

  return (
    <Link
      href="/plans"
      className="flex h-9 items-center gap-1 rounded-lg bg-principal-9 px-3 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10"
    >
      <FlashIcon className="size-5 shrink-0" />
      Become a Pro
    </Link>
  );
}
