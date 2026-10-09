import type { Metadata } from "next";
import { DeepRankingScreen } from "@/components/ranking/DeepRankingScreen";

/*
 * Deep Ranking — aba da área de KOLs (Figma 1463:13409): classificação dos
 * KOLs do índice pelas calls da temporada. Protegida pelo middleware
 * (`src/proxy.ts`), como o resto de /wallet-reader.
 */
export const metadata: Metadata = {
  title: "Deep Ranking",
};

export default function DeepRankingPage() {
  return <DeepRankingScreen />;
}
