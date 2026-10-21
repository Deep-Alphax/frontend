import type { Metadata } from "next";
import { CopyTradeScreen } from "@/components/copyTrade/CopyTradeScreen";

/*
 * Copy Trade (Figma 1578:26210): KOLs do índice com histórico de 30d e o
 * detalhe da carteira numa 3ª coluna. Protegida pelo middleware
 * (`src/proxy.ts`): sem sessão, vai para /login.
 */
export const metadata: Metadata = {
  title: "Copy Trade",
};

export default function CopyTradePage() {
  return <CopyTradeScreen />;
}
