"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

import { TEXT_TRIM } from "@/components/plans/textTrim";
import { DURATION, EASE } from "@/lib/motion";
import { cn } from "@/lib/cn";

/*
 * Modal de conclusão (Figma 1044:26714).
 *
 * UM componente para os dois marcos — módulo e curso inteiro — porque o desenho
 * é o mesmo e só o texto muda. `scope` decide a cópia; duplicar o componente
 * faria as duas versões divergirem no primeiro ajuste de layout.
 *
 * Segue o padrão dos modais do app (`LinksModal`): portal, scrim clicável, Esc
 * para fechar e trava de scroll do body.
 */
export type CompletionScope = "module" | "course";

const COPY: Record<
  CompletionScope,
  { title: string; before: string; after: string }
> = {
  module: {
    title: "Module completed",
    before: "You finished ",
    after:
      " from start to finish. Your progress is saved and the next module is ready when you are.",
  },
  course: {
    title: "Course completed",
    before: "You finished every module of ",
    after:
      " . Your progress is saved — revisit any lesson whenever you need a refresher.",
  },
};

export function CompletionModal({
  open,
  scope,
  name,
  onClose,
  primaryHref = "/mentorship",
  primaryLabel = "Back to start",
}: {
  open: boolean;
  scope: CompletionScope;
  /** Nome do módulo (ou do curso) — vai em negrito no meio da frase. */
  name: string;
  onClose: () => void;
  primaryHref?: string;
  primaryLabel?: string;
}) {
  const reduce = useReducedMotion();
  const copy = COPY[scope];

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
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.base, ease: EASE.standard }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-gray-1/80"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={copy.title}
            className="relative flex w-full max-w-[384px] flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-2 shadow-2xl"
            initial={reduce ? false : { opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: DURATION.emphasis, ease: EASE.out }}
          >
            <div className="flex flex-col items-center justify-center gap-6 border-b border-gray-6 px-4 py-7">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/mentorship/check-3d.webp"
                alt=""
                aria-hidden="true"
                width={92}
                height={92}
                className="size-[92px]"
              />

              <div className="flex w-full flex-col items-center justify-center gap-4">
                <h2
                  className={cn(
                    "text-xl font-semibold leading-[1.1] text-gray-12",
                    TEXT_TRIM,
                  )}
                >
                  {copy.title}
                </h2>
                <p
                  className={cn(
                    "text-center text-base leading-[1.3] text-gray-11",
                    TEXT_TRIM,
                  )}
                >
                  {copy.before}
                  <strong className="font-bold text-gray-12">{name}</strong>
                  {copy.after}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 p-4">
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "flex h-10 min-w-0 flex-1 items-center justify-center rounded-lg px-8",
                  "border border-gray-6 bg-gray-3 text-base font-semibold leading-[1.1] text-gray-12",
                  "outline-none transition-colors hover:border-gray-8 focus-visible:ring-2 focus-visible:ring-secundaria-11/60",
                )}
              >
                Close
              </button>
              <Link
                href={primaryHref}
                className={cn(
                  "flex h-10 min-w-0 flex-1 items-center justify-center rounded-lg px-8",
                  "bg-principal-9 text-base font-semibold leading-[1.1] text-gray-1",
                  "outline-none focus-visible:ring-2 focus-visible:ring-principal-11",
                )}
              >
                {primaryLabel}
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
