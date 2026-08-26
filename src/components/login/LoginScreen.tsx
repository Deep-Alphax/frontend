import { LoginForm } from "@/components/login/LoginForm";

/**
 * Tela de login (node Figma 176:5290 "Login").
 * Split em duas colunas: esquerda com o formulário (logo → form → termos),
 * direita um painel de destaque. No mobile a coluna direita é ocultada e o
 * formulário ocupa a largura toda.
 */
export function LoginScreen() {
  return (
    <main className="flex min-h-dvh gap-2 bg-gray-1 p-2">
      {/* Coluna do formulário */}
      <section className="flex flex-1 flex-col items-center justify-between gap-10 overflow-y-auto px-6 py-9 md:px-12 lg:px-[132px]">
        {/* Logo */}
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

        {/* Formulário */}
        <div className="w-full max-w-[444px]">
          <LoginForm />
        </div>

        {/* Termos */}
        <p className="max-w-[444px] text-center text-sm text-gray-11">
          {/* Ao continuar você aceita os{" "}
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

      {/* Painel de destaque (imagem/ilustração — placeholder por ora) */}
      <aside
        aria-hidden
        className="hidden flex-1 min-w-[50%] rounded-xl bg-[url('/brand/login-bg.png')] bg-cover lg:block"
      />
    </main>
  );
}
