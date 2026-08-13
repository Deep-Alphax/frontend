import { WalletSyncingState } from "@/components/home/WalletSyncingState";

// ROTA TEMPORÁRIA de debug do Spline — remover depois.
export default function SplineTestPage() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <WalletSyncingState />
    </div>
  );
}
