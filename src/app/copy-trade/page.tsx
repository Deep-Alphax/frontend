import { Suspense } from "react";
import type { Metadata } from "next";

import { AccessGate } from "@/components/access/AccessGate";
import { CopyTradeScreen } from "@/components/copyTrade/CopyTradeScreen";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";

/*
 * Copy Trade (Figma 1578:26210): KOLs do índice com histórico de 30d e o
 * detalhe da carteira numa 3ª coluna; aba Dev Snipe (1633:33457) em
 * `?type=snipe`. Protegida pelo middleware (`src/proxy.ts`): sem sessão, vai
 * para /login. Fora do acesso do Elixir Alpha (FREE): o `AccessGate` nem
 * monta a tela.
 */
export const metadata: Metadata = {
  title: "Copy Trade",
};

/**
 * Fallback do Suspense: a tela lê a aba da URL com `useSearchParams`, que no
 * build exige a fronteira (a rota segue pré-renderizável). Skeleton no
 * formato do app-shell: topbar, barra de abas e as duas colunas.
 */
function CopyTradeFallback() {
  return (
    <SkeletonGroup label="Loading Copy Trade" className="flex min-h-dvh flex-col bg-gray-1">
      <div className="h-[60px] border-b border-gray-5" />
      <div className="flex h-[53px] items-center gap-6 border-b border-gray-5 bg-gray-2 px-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="flex flex-1 gap-4 p-4">
        <Skeleton className="hidden h-40 w-[288px] rounded-2xl lg:block" />
        <div className="flex flex-1 flex-col gap-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </SkeletonGroup>
  );
}

export default function CopyTradePage() {
  return (
    <AccessGate requires="unrestricted">
      <Suspense fallback={<CopyTradeFallback />}>
        <CopyTradeScreen />
      </Suspense>
    </AccessGate>
  );
}
