import { Topbar } from "@/components/home/Topbar";
import { PlanCard, type PlanFeature } from "@/components/plans/PlanCard";
import { PlanCta } from "@/components/plans/PlanCta";
import { PlansBackground } from "@/components/plans/PlansBackground";
import { TEXT_TRIM } from "@/components/plans/textTrim";
import { PRO_PRICE_USD } from "@/lib/billing/price";
import { cn } from "@/lib/cn";

/*
 * Tela de Planos (Figma 972:24788).
 *
 * Reaproveita o <Topbar /> do app; o resto é o "Card Container" do node. O fundo
 * é a camada de luz WebGL de `PlansBackground` — a mesma que a borda dos cards e
 * os badges revelam por recorte (ver `PlanCard`).
 */

/*
 * Tem que bater com `backend/src/app/billing/plan-limits.ts` — lá é o que vale;
 * aqui é só a vitrine. Mudou um limite? Mude os dois.
 */
const FREE_FEATURES: PlanFeature[] = [
  { title: "Monitored groups", detail: "A selection of groups" },
  { title: "KOL index", detail: "Every KOL, without their wallets" },
  { title: "Tracked wallets", detail: "Your own wallet" },
  { title: "Alerts", detail: "1 alert" },
];

const PRO_FEATURES: PlanFeature[] = [
  { title: "Monitored groups", detail: "Every group we monitor" },
  { title: "KOL index", detail: "Every KOL with their wallets, sidewallets and copytraders" },
  { title: "Tracked wallets", detail: "Up to 20" },
  { title: "Alerts", detail: "Unlimited, in the app and as push notifications" },
];

const DISPLAY_28 = "text-display-28 leading-[1.1] tracking-[1px]";

export function PlansScreen() {
  return (
    <div className="flex min-h-dvh flex-col bg-gray-1">
      {/* Camada de luz: fixa atrás de tudo (z-0). É o que a borda dos cards e os
          badges revelam por recorte. */}
      <PlansBackground />

      <div className="relative z-10 flex min-h-dvh flex-col">
        <Topbar />

        <main className="flex w-full flex-1 flex-col items-center gap-10 py-11">
          <div className="flex max-w-[629px] flex-col items-center justify-center gap-4 px-6">
            <h1
              className={cn(
                "text-display-24 text-center leading-[1.1] tracking-[1px] text-gray-12",
                TEXT_TRIM,
              )}
            >
              Three minutes stand between you and the entry!
            </h1>
            <p
              className={cn(
                "w-full text-center text-base leading-[1.3] text-gray-11",
                TEXT_TRIM,
              )}
            >
              On Free the feed holds for three minutes. On Pro it lands the second
              Rick finishes the scan. In memecoins, three minutes is the whole
              chart
            </p>
          </div>

          <div className="flex w-full flex-col items-center gap-8 px-6 lg:flex-row lg:items-start lg:justify-center">
            <PlanCard
              tone="free"
              name="Free"
              nameHidden
              price={
                <span className={cn(DISPLAY_28, TEXT_TRIM)}>Free</span>
              }
              cta={<PlanCta tone="free" />}
              features={FREE_FEATURES}
            />

            <PlanCard
              tone="pro"
              name="Pro"
              price={
                <>
                  <span className={cn(DISPLAY_28, TEXT_TRIM)}>$</span>
                  <span className={cn(DISPLAY_28, TEXT_TRIM)}>
                    {PRO_PRICE_USD.toFixed(2)}
                  </span>
                  <span className={cn("text-base leading-[1.3]", TEXT_TRIM)}>
                    / Per month
                  </span>
                </>
              }
              cta={<PlanCta tone="pro" />}
              features={PRO_FEATURES}
              footnote="Costs less than one rug fee"
            />
          </div>
        </main>
      </div>
    </div>
  );
}
