"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Pencil, X } from "lucide-react";
import toast from "react-hot-toast";

import { cn } from "@/lib/cn";
import { DURATION, EASE } from "@/lib/motion";
import { Avatar } from "@/components/ui/Avatar";
import type { FavoriteAuthor } from "@/lib/api/feed";
import {
  FAVORITE_COLOR_KEYS,
  swatchActiveFor,
  swatchFor,
  tickFor,
  toneFor,
  type FavoriteColorKey,
} from "@/components/radar/favoriteColors";

/** Teto do upload (espelha o backend) — validado antes de subir. */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

interface UserCustomizeModalProps {
  open: boolean;
  authorName: string;
  /** Subtítulo (grupo do autor). */
  group: string | null;
  /** Favorito atual (valores iniciais do formulário). */
  favorite: FavoriteAuthor | undefined;
  onClose: () => void;
  /** Persiste apelido + cor. */
  onSave: (input: { nickname: string | null; color: string | null }) => Promise<unknown>;
  /** Envia a foto do avatar. */
  onUploadPhoto: (file: File) => Promise<unknown>;
  isSaving: boolean;
}

/**
 * Modal "Personalizar usuário" (node Figma 536:8082). Portal em document.body,
 * fecha por Esc / clique no scrim, com trava de scroll do body — mesmo padrão do
 * `LinksModal`. O formulário vive em `<CustomizeForm>`, montado só quando aberto,
 * para inicializar o estado a partir do favorito sem `setState` em efeito.
 */
export function UserCustomizeModal({ open, onClose, ...rest }: UserCustomizeModalProps) {
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
            aria-label="Personalizar usuário"
            className="relative flex max-h-[90vh] w-full max-w-[440px] flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-2 shadow-2xl"
            initial={reduce ? false : { opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: DURATION.emphasis, ease: EASE.out }}
          >
            <CustomizeForm onClose={onClose} {...rest} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

type CustomizeFormProps = Omit<UserCustomizeModalProps, "open">;

/**
 * Conteúdo do modal (header + corpo + footer). Montado só quando aberto → o
 * estado inicializa a partir do favorito nos inicializadores do `useState`.
 */
function CustomizeForm({
  authorName,
  group,
  favorite,
  onClose,
  onSave,
  onUploadPhoto,
  isSaving,
}: CustomizeFormProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);

  const [nickname, setNickname] = useState(() => favorite?.nickname ?? "");
  const [color, setColor] = useState<FavoriteColorKey | null>(
    () => (favorite?.color as FavoriteColorKey | null) ?? null,
  );
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null);

  // Revoga a object URL da foto escolhida ao desmontar (fechar o modal).
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-selecionar o mesmo arquivo
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Imagem muito grande (máx. 5MB)");
      return;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setPicked({ file, url });
  };

  const save = async () => {
    try {
      // A foto exige um favorito existente no servidor → sobe primeiro.
      if (picked) await onUploadPhoto(picked.file);
      await onSave({ nickname: nickname.trim() || null, color });
      toast.success("Alterações salvas");
      onClose();
    } catch {
      // Erros já exibem toast nas mutações; mantém o modal aberto p/ nova tentativa.
    }
  };

  const displayName = nickname.trim() || authorName;
  const photoSrc = picked?.url ?? favorite?.photoUrl ?? null;

  return (
    <>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-6 px-4 py-2">
        <h2 className="text-lg font-semibold text-gray-12">Personalizar usuário</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex size-8 items-center justify-center rounded text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12"
        >
          <X className="size-6" strokeWidth={2} />
        </button>
      </div>

      {/* Corpo */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto border-b border-gray-6 p-4">
        {/* Avatar + Mudar foto */}
        <div className="flex flex-col items-center gap-5">
          <div className="flex flex-col items-center gap-4">
            <Avatar
              src={photoSrc}
              name={displayName}
              className="size-20 text-2xl"
              fallbackClassName={toneFor(color)}
            />
            <div className="flex flex-col items-center">
              <p className="text-center text-lg font-semibold text-gray-12">{displayName}</p>
              {group && <p className="text-center text-base text-gray-11">{group}</p>}
            </div>
          </div>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-6 bg-gray-3 px-8 text-sm font-semibold text-gray-12 transition-colors hover:bg-gray-4"
          >
            <Pencil className="size-4" strokeWidth={2} />
            Mudar foto
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onPickFile}
            className="hidden"
          />
        </div>

        <div className="h-px w-full bg-gray-6" />

        {/* Apelido */}
        <div className="flex flex-col gap-2">
          <label htmlFor="fav-nickname" className="text-base text-gray-12">
            Apelido
          </label>
          <input
            id="fav-nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={60}
            placeholder="Digite um apelido para este usuário"
            className={cn(
              "h-12 w-full rounded-lg border border-gray-6 bg-gray-2 px-3",
              "text-base text-gray-12 placeholder:text-gray-11 outline-none",
              "focus-visible:border-secundaria-11/60 focus-visible:ring-2 focus-visible:ring-secundaria-11/30",
            )}
          />
        </div>

        {/* Cores */}
        <div className="flex flex-col gap-3">
          <p className="text-base text-gray-12">Cores</p>
          <div className="flex flex-wrap gap-2">
            {FAVORITE_COLOR_KEYS.map((key) => {
              const active = color === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColor(active ? null : key)}
                  aria-label={`Cor ${key}`}
                  aria-pressed={active}
                  className={cn(
                    "relative flex size-7 items-center justify-center rounded-full border transition-transform hover:scale-110",
                    swatchFor(key),
                    active && swatchActiveFor(key),
                  )}
                >
                  {active && <Check className={cn("size-4", tickFor(key))} strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center gap-2 p-4">
        <button
          type="button"
          onClick={onClose}
          className="h-10 flex-1 rounded-lg border border-gray-6 bg-gray-3 px-8 text-base font-semibold text-gray-12 transition-colors hover:bg-gray-4"
        >
          Fechar
        </button>
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="h-10 flex-1 rounded-lg bg-principal-9 px-8 text-base font-semibold text-gray-1 transition-colors hover:bg-principal-10 disabled:opacity-60"
        >
          {isSaving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </>
  );
}
