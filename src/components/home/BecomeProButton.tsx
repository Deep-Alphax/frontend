"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { FlashIcon } from "@/components/icons/hugeicons";
import { getMyPlan, PLAN_KEY, type Plan } from "@/lib/api/billing";
import { useSession } from "@/lib/auth/useSession";

/**
 * CTA de upsell no header (Figma `1056:27771` — "Assinar Pro").
 *
 * Substitui o antigo link "Plans" da navegação. Some para quem JÁ é PRO: oferecer
 * assinatura a assinante é ruído. Estado padrão (carregando ou deslogado) = FREE,
 * o mesmo piso seguro do `PlanCta` — no máximo mostra a oferta a mais, nunca
 * esconde de quem não assina.
 *
 * Compartilha `PLAN_KEY` com o `PlanCta`, então o header e a tela de planos
 * dividem a MESMA entrada de cache (uma requisição, não duas).
 */
export function BecomeProButton() {
  const { isAuthenticated } = useSession();

  const { data: plan } = useQuery({
    queryKey: PLAN_KEY,
    queryFn: getMyPlan,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const current: Plan = plan ?? "FREE";
  if (current === "PRO") return null;

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
