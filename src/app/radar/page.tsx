import type { Metadata } from "next";
import { AccessGate } from "@/components/access/AccessGate";
import { RadarScreen } from "@/components/radar/RadarScreen";

/*
 * Radar (node Figma 492:9713) — feed de capturas dos grupos monitorados, com
 * grupos à esquerda e favoritos à direita. Rota protegida pelo middleware
 * (`src/proxy.ts`): sem sessão, redireciona para /login. Fora do acesso do
 * Elixir Alpha (FREE): o `AccessGate` nem monta a tela.
 */
export const metadata: Metadata = {
  title: "Radar",
};

export default function RadarPage() {
  return (
    <AccessGate requires="unrestricted">
      <RadarScreen />
    </AccessGate>
  );
}
