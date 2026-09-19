"use client";

import Link from "next/link";
import { FlashIcon } from "@/components/icons/hugeicons";
import { usePlan } from "@/lib/billing/usePlan";

/**
 * CTA de upsell no header (Figma `1056:27771` — "Assinar Pro").
 *
 * Substitui o antigo link "Plans" da navegação. Some para quem JÁ é PRO: oferecer
 * assinatura a assinante é ruído. Estado padrão (carregando ou deslogado) = FREE,
 * o mesmo piso seguro do `PlanCta` — no máximo mostra a oferta a mais, nunca
 * esconde de quem não assina.
 *
 * Usa o mesmo `usePlan` do `PlanCta`, então o header e a tela de planos
 * dividem a MESMA entrada de cache (uma requisição, não duas).
 */
export function BecomeProButton() {
  const { isPro } = usePlan();
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
