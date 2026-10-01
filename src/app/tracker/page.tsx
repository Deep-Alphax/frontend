import type { Metadata } from "next";
import { TrackerScreen } from "@/components/tracker/TrackerScreen";

/*
 * Tracker — SocialFi Wallet Tracker (Figma 1311:47443): feed em tempo real
 * das carteiras dos KOLs, Confluence, Top sources e Wallets Discovery.
 * Protegida pelo middleware (`src/proxy.ts`): sem sessão, vai para /login.
 */
export const metadata: Metadata = {
  title: "Tracker",
};

export default function TrackerPage() {
  return <TrackerScreen />;
}
