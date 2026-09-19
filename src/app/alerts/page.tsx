import type { Metadata } from "next";

import { AlertsScreen } from "@/components/alerts/AlertsScreen";

/* Alertas — regras (caller, canal, termo) e push neste navegador. Rota
 * protegida pelo middleware (`src/proxy.ts`): sem sessão, redireciona para /login. */
export const metadata: Metadata = { title: "Alerts" };

export default function AlertsPage() {
  return <AlertsScreen />;
}
