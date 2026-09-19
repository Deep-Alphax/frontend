import Link from "next/link";
import { Lock } from "lucide-react";

import { FlashIcon } from "@/components/icons/hugeicons";
import { cn } from "@/lib/cn";

interface ProLockProps {
  /** O que está travado, dito como benefício ("See the 4 wallets of this KOL"). */
  title: string;
  /** Linha de apoio opcional. */
  detail?: string;
  className?: string;
}

/**
 * Bloco "isto é do Pro" no lugar de um recurso travado.
 *
 * É só apresentação: quem barra de verdade é o backend (o dado nem chega ao
 * navegador do FREE). Por isso não há "blur sobre o conteúdo real" — não
 * existe conteúdo real aqui para borrar.
 */
export function ProLock({ title, detail, className }: ProLockProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border border-gray-6 bg-gray-1/60 p-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Lock className="mt-0.5 size-4 shrink-0 text-principal-9" aria-hidden />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm font-semibold leading-[1.3] text-gray-12">{title}</p>
          {detail && <p className="text-[13px] leading-[1.3] text-gray-11">{detail}</p>}
        </div>
      </div>
      <Link
        href="/plans"
        className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-principal-9 px-3 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10"
      >
        <FlashIcon className="size-4 shrink-0" />
        Upgrade to Pro
      </Link>
    </div>
  );
}
