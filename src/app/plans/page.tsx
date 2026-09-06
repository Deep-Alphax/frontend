import type { Metadata } from "next";

import { PlansScreen } from "@/components/plans/PlansScreen";

/* Planos (node Figma 972:24788) — comparativo Free x Pro. Rota protegida pelo
 * middleware (`src/proxy.ts`): sem sessão, redireciona para /login. */
export const metadata: Metadata = { title: "Plans" };

export default function PlansPage() {
  return <PlansScreen />;
}
