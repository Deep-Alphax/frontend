"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { GripVertical } from "lucide-react";

import { useSession } from "@/lib/auth/useSession";
import { cn } from "@/lib/cn";

/*
 * Peças compartilhadas pelas telas de admin da mentoria (árvore de categorias,
 * página do módulo e painel da aula). Ficam aqui para que as três falem a
 * mesma língua visual: mesmo campo, mesmo botão, mesmo selo de status.
 */

export const inputCls =
  "h-10 w-full rounded-lg border border-gray-6 bg-gray-1 px-3 text-sm text-gray-12 outline-none placeholder:text-gray-11 focus-visible:border-secundaria-11/60 aria-[invalid=true]:border-vermelho-8";

export const textareaCls = cn(inputCls, "h-20 resize-none py-2");

/** Campo rotulado. `hint` em cinza; `error` substitui o hint em vermelho. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-11">
        {label}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-vermelho-11">{error}</span>
      ) : hint ? (
        <span className="text-xs text-gray-11">{hint}</span>
      ) : null}
    </label>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md border border-gray-6 text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12 disabled:cursor-not-allowed disabled:opacity-40",
        danger && "hover:border-vermelho-8 hover:text-vermelho-11",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Alça de arrastar. É um botão focável: com foco, ↑/↓ reordenam (ver
 * `useDragReorder`). O arrasto em si é na linha inteira.
 */
export function DragHandle({
  label,
  disabled,
  onKeyDown,
}: {
  label: string;
  disabled?: boolean;
  onKeyDown: (e: KeyboardEvent) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Reorder ${label}`}
      title="Drag to reorder (or focus and use ↑ ↓)"
      disabled={disabled}
      onKeyDown={onKeyDown}
      onClick={(e) => e.preventDefault()}
      className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
    >
      <GripVertical className="size-4" />
    </button>
  );
}

export const primaryBtnCls =
  "flex h-10 items-center justify-center gap-2 rounded-lg bg-principal-9 px-4 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10 disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryBtnCls =
  "flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-6 px-4 text-sm font-semibold text-gray-12 transition-colors hover:bg-gray-3 disabled:cursor-not-allowed disabled:opacity-60";

export const smallBtnCls =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-gray-6 px-2.5 text-xs font-semibold text-gray-12 transition-colors hover:bg-gray-3 disabled:cursor-not-allowed disabled:opacity-50";

type Tone = "neutral" | "warning" | "success";

/** Selo curto de status ("Draft", "Hidden", "No video"). */
export function StatusBadge({
  tone = "neutral",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone === "neutral" && "border-gray-6 text-gray-11",
        tone === "warning" && "border-laranja-7 text-laranja-11",
        tone === "success" && "border-green-7 text-green-11",
      )}
    >
      {children}
    </span>
  );
}

/**
 * Visibilidade REAL de um módulo para o aluno. Rascunho em qualquer nível
 * esconde: categoria em rascunho some com módulos publicados — e é isso que o
 * admin não enxergava quando só via o próprio flag do módulo.
 */
export function moduleVisibility(
  modulePublished: boolean,
  categoryPublished: boolean,
): "visible" | "draft" | "hidden-by-category" {
  if (!modulePublished) return "draft";
  if (!categoryPublished) return "hidden-by-category";
  return "visible";
}

export function VisibilityBadge({
  modulePublished,
  categoryPublished,
}: {
  modulePublished: boolean;
  categoryPublished: boolean;
}) {
  const v = moduleVisibility(modulePublished, categoryPublished);
  if (v === "draft") return <StatusBadge>Draft</StatusBadge>;
  if (v === "hidden-by-category") {
    return (
      <StatusBadge
        tone="warning"
        title="Published, but its category is a draft, so users don't see it."
      >
        Hidden · category draft
      </StatusBadge>
    );
  }
  return null;
}

/**
 * Base do slug: sem acento, minúsculo, com hífen no lugar do resto. Não apara a
 * ponta direita — quem faz isso é `slugify`.
 */
export function slugifyLoose(value: string): string {
  return (
    value
      .normalize("NFD")
      // Tira os diacríticos que o NFD acabou de separar ("ç" → "c", "ã" → "a").
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+/, "")
      .slice(0, 80)
  );
}

/**
 * `"On-chain fundamentals"` → `"on-chain-fundamentals"`.
 *
 * Aplicada quando o campo perde o foco, NUNCA a cada tecla: aparar o hífen
 * final durante a digitação o apagaria no instante em que é digitado, e ninguém
 * conseguiria escrever "my-url" (sairia "myurl").
 */
export function slugify(value: string): string {
  return slugifyLoose(value).replace(/-+$/, "");
}

/**
 * Só renderiza os filhos para ADMIN. A autoridade real é o `AdminGuard` do
 * backend; isto evita montar telas (e disparar queries) que levariam 403.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { profile, isAuthenticated, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="h-40 animate-pulse rounded-lg bg-gray-2" aria-hidden />
    );
  }
  if (!isAuthenticated) {
    return <p className="text-gray-11">Sign in to continue.</p>;
  }
  if (profile?.role !== "ADMIN") {
    return (
      <div className="rounded-lg border border-gray-6 bg-gray-2 p-6">
        <h1 className="text-lg font-semibold text-gray-12">
          Restricted access
        </h1>
        <p className="text-sm text-gray-11">This area is admins only.</p>
      </div>
    );
  }
  return <>{children}</>;
}
