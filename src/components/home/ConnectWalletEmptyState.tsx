"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/auth/useSession";
import { AddWalletModal } from "@/components/home/AddWalletModal";

/**
 * Estado vazio exibido na Home quando não há carteira catalogada (node Figma
 * 215:2964). Card com fundo decorativo (glows + textura pontilhada mascarada, em
 * mix-blend color-dodge), ícone 3D de carteira, texto e CTA.
 *
 * O CTA é sensível à sessão:
 *   - deslogado → leva ao /login;
 *   - logado → abre o modal de busca de carteira (cataloga por endereço, sem assinatura).
 */
export function ConnectWalletEmptyState() {
  const { isAuthenticated } = useSession();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="relative flex min-h-[442px] w-full items-center justify-center overflow-hidden rounded-lg border border-gray-6 bg-gray-2 px-6 py-16">
      {/* Fundo decorativo (não interativo). */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {/* Glow superior-esquerdo */}
        <div className="absolute left-[-164px] top-[-240px] size-[360px]">
          <div className="absolute inset-[-160.58%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/decor/glow-1.svg" alt="" className="block size-full max-w-none" />
          </div>
        </div>

        {/* Glow inferior-direito */}
        <div className="absolute bottom-[-104px] right-[-64px] size-[248px]">
          <div className="absolute inset-[-165.24%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/decor/glow-2.svg" alt="" className="block size-full max-w-none" />
          </div>
        </div>

        {/* Textura pontilhada mascarada (fade nas bordas) em color-dodge */}
        <div
          className="absolute left-1/2 top-1/2 h-[856px] w-[1283px] -translate-x-1/2 -translate-y-1/2 mix-blend-color-dodge"
          style={{
            maskImage: "url('/decor/dots-mask.svg')",
            WebkitMaskImage: "url('/decor/dots-mask.svg')",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskPosition: "-2px 204px",
            WebkitMaskPosition: "-2px 204px",
            maskSize: "1283px 443.382px",
            WebkitMaskSize: "1283px 443.382px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/decor/dots-texture.png"
            alt=""
            className="absolute inset-0 size-full max-w-none object-cover"
          />
        </div>
      </div>

      {/* Conteúdo */}
      <div className="relative flex w-full max-w-[392px] flex-col items-center gap-12">
        <div className="flex flex-col items-center gap-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/wallet-3d.png"
            alt=""
            aria-hidden
            width={96}
            height={104}
            className="h-[104px] w-24 object-contain"
          />

          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="text-2xl font-semibold leading-[1.1] text-gray-12">
              Adicione uma carteira
            </h2>
            <p className="text-base text-gray-11">
              Para visualizar as informações do perfil, cole o endereço de uma
              carteira e a gente lê o histórico dela.
            </p>
          </div>
        </div>

        {isAuthenticated ? (
          <Button onClick={() => setAddOpen(true)}>Buscar carteira</Button>
        ) : (
          <Button asChild>
            <Link href="/login">Acessar plataforma</Link>
          </Button>
        )}
      </div>

      <AddWalletModal open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
