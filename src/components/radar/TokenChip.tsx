"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

import { cn } from "@/lib/cn";

/** Deriva um rótulo curto e legível de uma URL (host sem www/TLD ou 1º segmento). */
function labelFromLink(link: string): { label: string; host: string } {
  try {
    const url = new URL(link);
    const host = url.hostname.replace(/^www\./, "");
    const seg = url.pathname.split("/").filter(Boolean)[0];
    // Preferimos um segmento de caminho (costuma ser o ticker/contrato); senão o host.
    const label = seg && seg.length <= 24 ? seg : host.split(".")[0];
    return { label: label.toUpperCase(), host };
  } catch {
    return { label: link.slice(0, 12).toUpperCase(), host: link };
  }
}

/**
 * Chip de token/link detectado na mensagem. Espelha o node do Figma (rótulo +
 * host + divisor + botões copiar/abrir). Copiar usa a Clipboard API com feedback.
 */
export function TokenChip({
  link,
  compact = false,
  label: labelOverride,
}: {
  link: string;
  compact?: boolean;
  /** Rótulo fixo (provedor priorizado); sem ele, deriva da URL. */
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const derived = labelFromLink(link);
  const label = labelOverride ?? derived.label;
  const host = derived.host;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copiado");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const textCls = compact ? "text-xs" : "text-sm";

  return (
    <div
      className={cn(
        "flex items-center gap-2 self-start rounded-lg border border-gray-6 bg-gray-3",
        compact ? "px-2 py-1" : "p-2",
      )}
    >
      <span className={cn("max-w-[10rem] truncate font-semibold text-gray-12", textCls)}>
        {label}
      </span>
      <span className={cn("max-w-[8rem] truncate text-gray-11", textCls)}>{host}</span>

      <span className="w-px self-stretch bg-gray-6" aria-hidden />

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={copy}
          aria-label="Copiar link"
          className="flex size-6 items-center justify-center rounded border border-gray-6 bg-gray-3 text-gray-11 transition-colors hover:text-gray-12"
        >
          {copied ? (
            <Check className="size-4 text-green-11" strokeWidth={2} />
          ) : (
            <Copy className="size-4" strokeWidth={2} />
          )}
        </button>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir link"
          className="flex size-6 items-center justify-center rounded border border-gray-6 bg-gray-3 text-gray-11 transition-colors hover:text-gray-12"
        >
          <ExternalLink className="size-4" strokeWidth={2} />
        </a>
      </div>
    </div>
  );
}

/** Chip de overflow ("+N") que abre o modal com todos os links. */
export function MoreChip({
  count,
  onClick,
  compact = false,
}: {
  count: number;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center self-start rounded-lg border border-gray-6 bg-gray-3 px-2",
        "text-sm font-semibold text-gray-12 transition-colors hover:bg-gray-2",
        compact ? "size-[34px]" : "h-[42px] min-w-[42px]",
      )}
    >
      +{count}
    </button>
  );
}
