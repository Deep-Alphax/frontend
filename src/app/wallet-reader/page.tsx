import type { Metadata } from "next";
import { WalletReaderScreen } from "@/components/walletReader/WalletReaderScreen";

/*
 * KOLs (ex-Wallet Reader) — diretório de KOLs e suas carteiras, com busca,
 * filtros e edições locais. A rota segue `/wallet-reader` (links existentes);
 * só o nome exibido mudou. Protegida pelo middleware (`src/proxy.ts`): sem
 * sessão, redireciona para /login.
 */
export const metadata: Metadata = {
  title: "KOLs",
};

export default function WalletReaderPage() {
  return <WalletReaderScreen />;
}
