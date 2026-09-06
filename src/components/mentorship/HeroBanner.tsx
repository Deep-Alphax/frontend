import { TEXT_TRIM } from "@/components/plans/textTrim";
import { cn } from "@/lib/cn";

/*
 * Faixa de abertura da mentoria (Figma 1011:25861).
 *
 * A arte fica atrás de um gradiente que escurece só o terço esquerdo — é ele
 * que garante contraste do texto sobre qualquer parte clara do desenho. As duas
 * peças douradas (canto e barra) são as mesmas do arquivo, espelhadas em baixo.
 */
export function HeroBanner() {
  return (
    <section className="relative flex h-[272px] flex-col justify-center gap-5 overflow-hidden rounded-xl border border-gray-6 bg-gray-3 p-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mentorship/hero-banner.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full object-cover object-top"
      />
      {/* Gradiente de leitura: opaco à esquerda, transparente a 39,4% da largura. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#0b1727_0%,rgba(11,23,39,0)_39.423%)]"
      />

      {/* Ornamentos dourados: canto (169×21) e barra (464×8), no topo e espelhados embaixo. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {/* eslint-disable @next/next/no-img-element */}
        <img src="/mentorship/hero-corner.svg" alt="" className="absolute left-0 top-0 h-[21px] w-[169px]" />
        <img src="/mentorship/hero-corner.svg" alt="" className="absolute bottom-0 left-0 h-[21px] w-[169px] -scale-y-100" />
        <img src="/mentorship/hero-bar.svg" alt="" className="absolute left-0 top-0 h-2 w-[464px] max-w-[36%]" />
        <img src="/mentorship/hero-bar.svg" alt="" className="absolute bottom-0 left-0 h-2 w-[464px] max-w-[36%] -scale-y-100" />
        {/* eslint-enable @next/next/no-img-element */}
      </div>

      <div className="relative flex w-full max-w-[406px] flex-col gap-5 text-gray-12">
        <h1 className={cn("text-display-28 leading-[1.1]", TEXT_TRIM)}>
          Understand everything before you trade
        </h1>
        <p className={cn("text-xl font-medium leading-[1.3]", TEXT_TRIM)}>
          The starter track takes 40 minutes and saves you the most expensive
          mistakes.
        </p>
      </div>
    </section>
  );
}
