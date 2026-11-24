import type { Metadata } from "next";
import { AccessGate } from "@/components/access/AccessGate";
import { TrackerScreen } from "@/components/tracker/TrackerScreen";

/*
 * Tracker — SocialFi Wallet Tracker (Figma 1311:47443): feed em tempo real
 * das carteiras dos KOLs, Confluence, Top sources e Wallets Discovery.
 * Protegida pelo middleware (`src/proxy.ts`): sem sessão, vai para /login.
 * Fora do acesso do Elixir Alpha (FREE): o `AccessGate` nem monta a tela.
 */
export const metadata: Metadata = {
  title: "Tracker",
};

export default function TrackerPage() {
  return (
    <AccessGate requires="unrestricted">
      <TrackerScreen />
    </AccessGate>
  );
}
