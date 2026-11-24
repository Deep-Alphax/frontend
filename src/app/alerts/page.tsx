import type { Metadata } from "next";

import { AccessGate } from "@/components/access/AccessGate";

import { AlertsScreen } from "@/components/alerts/AlertsScreen";

/* Alertas — regras (caller, canal, termo) e push neste navegador. Rota
 * protegida pelo middleware (`src/proxy.ts`): sem sessão, redireciona para /login.
 * Fora do acesso do Elixir Alpha (FREE): o `AccessGate` nem monta a tela. */
export const metadata: Metadata = { title: "Alerts" };

export default function AlertsPage() {
  return (
    <AccessGate requires="unrestricted">
      <AlertsScreen />
    </AccessGate>
  );
}
