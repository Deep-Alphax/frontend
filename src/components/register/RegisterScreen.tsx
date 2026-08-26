import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RegisterForm } from "@/components/register/RegisterForm";

/**
 * Tela de cadastro (node Figma 181:3431 "Cadastro").
 * Mesmo split do login, com um cabeçalho: botão de voltar (→ /login) à esquerda
 * e logo centralizado. No mobile a coluna direita some.
 */
export function RegisterScreen() {
  return (
    <main className="flex min-h-dvh gap-2 bg-gray-1 p-2">
      <section className="flex flex-1 flex-col items-center justify-between gap-10 overflow-y-auto px-6 py-9 md:px-12 lg:px-[132px]">
        {/* Cabeçalho: voltar + logo (spacer invisível mantém o logo centrado) */}
        <div className="flex w-full items-center justify-between">
          <Link
            href="/login"
            aria-label="Voltar para o login"
            className="flex size-8 items-center justify-center rounded border-[1.5px] border-gray-6 bg-gray-3 text-gray-12 transition-colors hover:bg-gray-6"
          >
            <ArrowLeft className="size-5" strokeWidth={1.5} />
          </Link>

          <div className="flex flex-col items-center gap-2">
            {/* SVG local monocromático: next/image não otimiza SVG — <img> é o certo. */}
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

          {/* Espaçador invisível do mesmo tamanho do botão, p/ centrar o logo. */}
          <div className="size-8" aria-hidden />
        </div>

        {/* Formulário */}
        <div className="w-full max-w-[444px]">
          <RegisterForm />
        </div>

        {/* Termos */}
        <p className="max-w-[444px] text-center text-sm text-gray-11">
         {/*  Ao continuar você aceita os{" "}
          <a href="#" className="underline underline-offset-2">
            Termos
          </a>{" "}
          e a{" "}
          <a href="#" className="underline underline-offset-2">
            Política de privacidade
          </a>
          . */}
        </p>
      </section>

      <aside
        aria-hidden
        className="hidden flex-1 rounded-xl bg-gray-3 lg:block"
      />
    </main>
  );
}
