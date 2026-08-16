import Link from "next/link";
import { Button } from "@/components/ui/Button";

/**
 * Tela de conclusão de cadastro (node Figma 188:6208).
 * Coluna única centrada (sem split): logo, ícone 3D de check, mensagem e CTA.
 * O cadastro já autologou (cookies de sessão setados) — "Acessar plataforma"
 * leva para a raiz.
 */
export function RegisterSuccess() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-between gap-10 bg-gray-1 px-6 py-9">
      {/* Logo */}
      <div className="flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/deep-alpha-logo.svg"
          alt="Deep Alpha"
          width={63}
          height={47}
          className="h-[47px] w-[63px]"
        />
        <span className="font-display text-[13.5px] font-semibold text-gray-12">
          Deep Alpha
        </span>
      </div>

      {/* Conteúdo central */}
      <div className="flex w-full max-w-[400px] flex-col items-center gap-14">
        <div className="flex flex-col items-center gap-9">
          {/* Ilustração 3D de marca (PNG exportado do Figma). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/register-success-check.png"
            alt=""
            aria-hidden
            width={164}
            height={164}
            className="size-[164px] object-contain"
          />

          <div className="flex flex-col items-center gap-5 text-center text-gray-12">
            <h1 className="font-display text-display-24">
              Cadastro concluído!
            </h1>
            <p className="text-base">
              Sua conta está ativa e pronta para uso. O restante você acompanha
              dentro da plataforma
            </p>
          </div>
        </div>

        <Button asChild>
          <Link href="/">Acessar plataforma</Link>
        </Button>
      </div>

      {/* Espaçador inferior (mantém o conteúdo centrado verticalmente). */}
      <div aria-hidden />
    </main>
  );
}
