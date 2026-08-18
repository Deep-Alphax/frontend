"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";

/**
 * Cena 3D do Spline carregada sob demanda (client-only). O runtime (~1MB) só é
 * baixado quando o estado de "sincronizando" aparece → não entra no bundle do
 * dashboard. Enquanto o chunk baixa, mostra um placeholder pulsante.
 */
const SplineScene = dynamic(() => import("@/components/home/SplineScene"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse rounded-2xl bg-gray-3" aria-hidden />,
});

/** Spinner de fallback quando a cena do Spline falha ao carregar. */
function Spinner() {
  return (
    <div className="flex size-full items-center justify-center">
      <div
        className="size-16 animate-spin rounded-full border-4 border-gray-6 border-t-principal-9"
        aria-hidden
      />
    </div>
  );
}

/**
 * Isola falhas do runtime do Spline. O react-spline re-lança o erro de load no
 * render (`if (error) throw error`) — ex.: cena com áudio/evento/ação apontando
 * p/ um objeto inexistente lança "Missing property". Aqui capturamos e caímos no
 * fallback (spinner) em vez de deixar a área em branco / derrubar a tela de sync.
 */
class SceneErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Estado exibido enquanto a carteira recém-conectada sincroniza o histórico
 * on-chain (ainda sem trades para montar o dashboard). Traz a cena do Spline
 * + uma barra de progresso INDETERMINADA — o provider de ingestão não expõe %
 * real, então a barra comunica "em andamento", não um percentual.
 *
 * Se a cena do Spline falhar, degrada para um spinner — a barra e o texto seguem
 * informando o sync.
 */
export function WalletSyncingState({
  label,
  trades,
  batches,
}: {
  label?: string;
  /** Trades importados até agora no backfill (progresso real). */
  trades?: number;
  /** Lotes (ticks do cron) já processados. */
  batches?: number;
}) {
  const hasProgress = typeof trades === "number" && (trades > 0 || (batches ?? 0) > 0);
  return (
    <section
      className="relative flex min-h-[442px] w-full flex-col items-center justify-center gap-8 overflow-hidden rounded-lg border border-gray-6 bg-gray-2 px-6 py-12"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Container de BLOCO com altura explícita: o <Spline> mede este box p/
          dimensionar o canvas e preenche 100% via style. */}
      <div className="relative h-[260px] w-full max-w-[440px]">
        <SceneErrorBoundary fallback={<Spinner />}>
          <SplineScene />
        </SceneErrorBoundary>
      </div>

      <div className="flex max-w-[400px] flex-col items-center gap-3 text-center">
        <h2 className="text-2xl font-semibold leading-[1.1] text-gray-12">
          Sincronizando sua carteira
        </h2>
        <p className="text-base text-gray-11">
          {label ? (
            <>
              Estamos lendo o histórico de <span className="text-gray-12">{label}</span>.{" "}
            </>
          ) : (
            "Estamos lendo o histórico on-chain dessa carteira. "
          )}
          Leva alguns instantes — o painel abre sozinho quando terminar de importar
          todo o histórico.
        </p>
      </div>

      {/* Barra indeterminada + leitura de progresso REAL (trades importados por lote). */}
      <div className="flex w-full max-w-[400px] flex-col items-center gap-2">
        <div
          className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-5"
          role="progressbar"
          aria-label="Sincronizando dados da carteira"
        >
          <span className="animate-indeterminate absolute inset-y-0 rounded-full bg-principal-9" />
        </div>
        
      </div>
    </section>
  );
}
