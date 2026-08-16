"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import toast from "react-hot-toast";

import { cn } from "@/lib/cn";
import { DURATION, EASE } from "@/lib/motion";

/** Rótulo curto (ticker-like) a partir da URL. */
function labelFromLink(link: string): string {
  try {
    const url = new URL(link);
    const seg = url.pathname.split("/").filter(Boolean)[0];
    const host = url.hostname.replace(/^www\./, "");
    const base = seg && seg.length <= 24 ? seg : host.split(".")[0];
    return base.toUpperCase();
  } catch {
    return link.slice(0, 12).toUpperCase();
  }
}

/** Encurta no meio: "FK7nFZyuREL…d7o8Xxvpump". */
function middleTruncate(str: string, head = 14, tail = 10): string {
  if (str.length <= head + tail + 1) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
}

/** Botão de ícone quadrado (32px) do DS. */
function IconButton({
  label,
  onClick,
  href,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
}) {
  const cls =
    "flex size-8 shrink-0 items-center justify-center rounded border border-gray-6 bg-gray-3 text-gray-11 transition-colors hover:text-gray-12";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cls}>
      {children}
    </button>
  );
}

function LinkRow({ link, index }: { link: string; index: number }) {
  const [copied, setCopied] = useState(false);
  const label = labelFromLink(link);
  const subtext = middleTruncate(link.replace(/^https?:\/\//, ""));

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

  return (
    <div className="flex items-center gap-2 border-b border-gray-6 p-4">
      <div className="flex min-w-0 flex-1 items-center gap-6">
        <span className="w-3 shrink-0 text-center text-base font-semibold text-gray-10">
          {index}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-base font-semibold text-gray-12">{label}</span>
          <span className="truncate text-sm text-gray-11">{subtext}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <IconButton label="Copiar link" onClick={copy}>
          {copied ? (
            <Check className="size-4 text-green-11" strokeWidth={2} />
          ) : (
            <Copy className="size-4" strokeWidth={2} />
          )}
        </IconButton>
        <IconButton label="Abrir link" href={link}>
          <ExternalLink className="size-4" strokeWidth={2} />
        </IconButton>
      </div>
    </div>
  );
}

interface LinksModalProps {
  open: boolean;
  links: string[];
  onClose: () => void;
}

/**
 * Modal "Todos os links" (node Figma 422:8440). Portal em document.body,
 * fecha por Esc / clique no scrim, com trava de scroll do body. Leve e sem
 * dependência de dialog — foco inicial no botão de fechar.
 */
export function LinksModal({ open, links, onClose }: LinksModalProps) {
  const reduce = useReducedMotion();

  // Esc para fechar + trava de scroll do body enquanto aberto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Portal só no cliente (evita tocar document.body no SSR).
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.base, ease: EASE.standard }}
        >
          {/* Scrim */}
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-gray-1/70 backdrop-blur-sm"
          />

          {/* Painel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Todos os links"
            className="relative flex max-h-[80vh] w-full max-w-[605px] flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-2 shadow-2xl"
            initial={reduce ? false : { opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: DURATION.emphasis, ease: EASE.out }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-6 px-4 py-3">
              <h2 className="text-lg font-semibold text-gray-12">Todos os links</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className={cn(
                  "flex size-8 items-center justify-center rounded text-gray-11",
                  "transition-colors hover:bg-gray-3 hover:text-gray-12",
                )}
              >
                <X className="size-5" strokeWidth={2} />
              </button>
            </div>

            {/* Lista */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {links.length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-11">Nenhum link.</p>
              ) : (
                links.map((l, i) => <LinkRow key={l + i} link={l} index={i + 1} />)
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
