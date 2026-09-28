import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Bloco de carregamento (padrão shadcn/ui). Desenhe o skeleton no FORMATO do
 * conteúdo que vai chegar — mesma altura de card, de linha de tabela, de
 * pílula — para a tela não "pular" quando o dado substitui o placeholder.
 *
 * `motion-reduce`: quem pede menos movimento no sistema vê o bloco parado.
 * Decorativo (`aria-hidden`): o anúncio para leitor de tela fica no
 * `SkeletonGroup` em volta, uma vez só, não em cada bloco.
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-md bg-gray-3 motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

/**
 * Região em carregamento: agrupa os `Skeleton` e anuncia "Loading" UMA vez
 * para tecnologia assistiva (`role="status"`).
 */
export function SkeletonGroup({
  label = "Loading",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Skeleton do card de KOL (mesma altura do `KolCard`), reusado no índice e no admin. */
export function KolCardSkeleton() {
  return (
    <div className="flex h-[295px] flex-col rounded-lg border border-gray-6 bg-gray-2">
      <div className="flex flex-col items-center gap-4 px-4 py-5">
        <Skeleton className="size-16 rounded-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-0.5 w-full rounded-none" />
      <div className="flex items-center gap-3 border-b border-gray-6 p-4">
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-5 w-6" />
        </div>
      </div>
      <div className="flex items-center gap-2 p-4">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-10 rounded-full" />
      </div>
    </div>
  );
}

/** Skeleton de mensagem do feed (avatar + nome + 2 linhas de texto). */
export function MessageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 border-b border-gray-6/70 px-4 py-4", className)}>
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-3/4" />
    </div>
  );
}

/** Skeleton de tabela: `rows` linhas × `cols` colunas, alinhado a um `<table>` real. */
export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-gray-6 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-4", c === 0 ? "w-40" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}
