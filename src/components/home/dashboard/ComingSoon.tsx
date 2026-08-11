import { cn } from "@/lib/cn";

/**
 * Selo "sem dado" — os widgets do Bloco 2 estão construídos; quando o histórico
 * de preço não cobre o token (memecoin sem OHLC), sinalizamos ausência em vez de
 * um número fabricado.
 */
export function NoDataBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-gray-6 bg-gray-3 px-2 py-0.5 text-xs font-medium text-gray-11",
        className,
      )}
    >
      sem dado
    </span>
  );
}

/** Valor esmaecido "—" para métricas sem cobertura de preço. */
export function NoDataValue() {
  return (
    <span className="text-gray-6" aria-label="sem dado">
      —
    </span>
  );
}
