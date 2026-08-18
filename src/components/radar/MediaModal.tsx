"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

import { DURATION, EASE } from "@/lib/motion";
import type { EmbedMediaItem } from "@/components/radar/embedMedia";

interface MediaModalProps {
  /** Mídia a exibir em tela; `null` = fechado. */
  item: EmbedMediaItem | null;
  onClose: () => void;
}

/**
 * Lightbox de mídia (GIF/imagem/vídeo) — abre a mídia grande ao clicar no card.
 * Portal em document.body, fecha por Esc / clique no scrim, com trava de scroll
 * (mesmo padrão do `LinksModal`). Vídeo com controles (o usuário pode dar play/som).
 */
export function MediaModal({ item, onClose }: MediaModalProps) {
  const reduce = useReducedMotion();
  const open = item != null;

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

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && item && (
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
            className="absolute inset-0 cursor-default bg-gray-1/80 backdrop-blur-sm"
          />

          {/* Botão fechar */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full border border-gray-6 bg-gray-2/80 text-gray-11 transition-colors hover:text-gray-12"
          >
            <X className="size-5" strokeWidth={2} />
          </button>

          {/* Mídia */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Mídia"
            className="relative flex max-h-[90vh] max-w-[92vw] items-center justify-center"
            initial={reduce ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
            transition={{ duration: DURATION.emphasis, ease: EASE.out }}
          >
            {item.kind === "video" ? (
              <video
                src={item.src}
                poster={item.poster}
                autoPlay
                loop
                muted
                controls
                playsInline
                className="max-h-[88vh] max-w-[92vw] rounded-lg"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.src}
                alt=""
                className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain"
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
