import { Info } from "lucide-react";
import { cn } from "@/lib/cn";

export type TooltipTone = "default" | "positive" | "negative";

export interface TooltipRow {
  label: string;
  value: string;
  tone?: TooltipTone;
}

interface RichInfoHintProps {
  title: string;
  description?: string;
  rows: TooltipRow[];
  footer?: string;
}

const TONE_CLASS: Record<TooltipTone, string> = {
  default: "text-gray-12",
  positive: "text-green-11",
  negative: "text-danger-11",
};

/**
 * Ícone (i) com um tooltip RICO em hover/foco: título, descrição, linhas
 * rótulo→valor e rodapé opcional (nós de KPI do dashboard). CSS-only (group),
 * sem biblioteca de tooltip.
 */
export function RichInfoHint({ title, description, rows, footer }: RichInfoHintProps) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={title}
        className="inline-flex text-gray-11 outline-none transition-colors hover:text-gray-12 focus-visible:text-gray-12"
      >
        <Info className="size-4" strokeWidth={1.5} />
      </button>

      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-40 mt-2 w-[280px] rounded-xl border border-gray-6 bg-gray-3 p-4 text-left opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <span className="block text-[15px] font-semibold text-gray-12">{title}</span>
        {description ? (
          <span className="mt-1 block text-[13px] leading-snug text-gray-11">
            {description}
          </span>
        ) : null}

        <span className="mt-3 block border-t border-gray-6 pt-3">
          {rows.map((row) => (
            <span key={row.label} className="flex items-center justify-between gap-4 py-1 text-sm">
              <span className="text-gray-11">{row.label}</span>
              <span className={cn("font-medium", TONE_CLASS[row.tone ?? "default"])}>
                {row.value}
              </span>
            </span>
          ))}
        </span>

        {footer ? (
          <span className="mt-3 block border-t border-gray-6 pt-3 text-[13px] leading-snug text-gray-11">
            {footer}
          </span>
        ) : null}
      </span>
    </span>
  );
}
