import { Info } from "lucide-react";

/**
 * Ícone (i) com dica em hover/foco (tooltip CSS, acessível via `title`/aria).
 * Leve de propósito — não puxa biblioteca de tooltip para um texto curto.
 */
export function InfoHint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={text}
        className="inline-flex text-gray-11 outline-none transition-colors hover:text-gray-12 focus-visible:text-gray-12"
      >
        <Info className="size-4" strokeWidth={1.5} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[240px] -translate-x-1/2 rounded-lg border border-gray-6 bg-gray-3 px-3 py-2 text-xs leading-snug text-gray-12 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
