import type { Metadata } from "next";
import { WalletReaderScreen } from "@/components/walletReader/WalletReaderScreen";

/*
 * Wallet Reader (KOL Index) — diretório de KOLs e suas carteiras, com busca,
 * filtros e edições locais. Rota protegida pelo middleware (`src/proxy.ts`):
 * sem sessão, redireciona para /login.
 */
export const metadata: Metadata = {
  title: "Wallet Reader",
};

export default function WalletReaderPage() {
  return <WalletReaderScreen />;
}
