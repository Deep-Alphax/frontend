import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { LightSurface } from "@/components/plans/LightSurface";
import { StrokeLight } from "@/components/plans/StrokeLight";
import { FREE_STROKE, PRO_STROKE } from "@/components/plans/strokeField";
import { FREE_COLORS, PRO_COLORS } from "@/components/plans/lightRays";
import { TEXT_TRIM } from "@/components/plans/textTrim";

/*
 * Card de plano (Figma 972:26092 / 972:26173).
 *
 * O card é montado em 4 faixas empilhadas (header → CTA → features → nota) sobre
 * uma camada de fundo absoluta com os dois glows e o mascote. Todas as peças do
 * fundo são ancoradas à DIREITA, como no Figma, então o card pode estreitar em
 * telas pequenas sem deslocar a arte.
 *
 * A BORDA é a luz de `strokeField.ts` (WebGL2) recortada numa faixa de 2px. O
 * estilo do Figma (`Stroke-animation`) não é exportável — vem vazio no
 * `get_design_context` e no `get_variable_defs`, e `get_motion_context` devolve
 * `{"nodes":[]}` — então o alvo foi obtido medindo o render: um matiz só,
 * modulado entre ~0,37 e 1,0, com manchas suaves e irregulares.
 *
 * As cores saem das variáveis que cada node de fato usa (via
 * `get_variable_defs`): o Free só tem cinzas (Gray 1,2,3,5,6,8,9,11,12) e o Pro
 * a escala Principal (2,6,8,9,11).
 *
 * A borda sólida da <section> fica por baixo como piso: é ela que aparece sem
 * WebGL2 ou sem `mask-composite`.
 *
 * O BADGE segue no shader de `background-planos.html` (`LightSurface`), onde ele
 * aparece inteiro e funciona — cada card com a sua paleta.
 */

const RING_MASK: CSSProperties = {
  maskImage: `linear-gradient(#000 0 0), linear-gradient(#000 0 0)`,
  maskClip: "content-box, border-box",
  maskComposite: "exclude",
};

export interface PlanFeature {
  title: string;
  detail: string;
}

interface PlanCardProps {
  tone: "free" | "pro";
  /** Rótulo do plano. No Free ele é um espaçador invisível (opacity-0 no Figma). */
  name: string;
  nameHidden?: boolean;
  /** Linha de preço — livre porque Free é uma palavra e Pro é "$ 50,00 / Por mês". */
  price: ReactNode;
  cta: ReactNode;
  features: PlanFeature[];
  /** Faixa opcional no rodapé do card (só o Pro tem). */
  footnote?: string;
}

/** Geometria e arte do fundo, por tom. Valores medidos no Figma. */
const TONE = {
  free: {
    bgHeight: "h-[485px]",
    bgFill: "bg-gray-1",
    glowLg: "/plans/glow-free-lg.svg",
    glowSm: "/plans/glow-free-sm.svg",
    badge: "/plans/badge-free.svg",
    /** Contorno do badge, amostrado do render do Figma. */
    badgeBorder: "border-[#606372]",
    icon: "/plans/icon-remove-circle.svg",
    featuresPadding: "pb-4",
    palette: FREE_COLORS,
    /** Borda sólida por baixo: é o que sobra sem WebGL2. */
    border: "border-gray-8",
    stroke: FREE_STROKE,
  },
  pro: {
    bgHeight: "h-[529px]",
    bgFill: "",
    glowLg: "/plans/glow-pro-lg.svg",
    glowSm: "/plans/glow-pro-sm.svg",
    badge: "/plans/badge-pro.svg",
    badgeBorder: "border-[#816c22]",
    icon: "/plans/icon-check-circle.svg",
    featuresPadding: "pb-3",
    palette: PRO_COLORS,
    border: "border-principal-8",
    stroke: PRO_STROKE,
  },
} as const;

export function PlanCard({
  tone,
  name,
  nameHidden = false,
  price,
  cta,
  features,
  footnote,
}: PlanCardProps) {
  const t = TONE[tone];

  return (
    <section
      className={cn(
        "relative flex w-full max-w-[440px] flex-col items-start rounded-2xl border-2 bg-gray-2 lg:w-[440px]",
        t.border,
      )}
    >
      {/*
        Contorno vivo. O wrapper cobre a border box (`inset-[-2px]`) e a máscara
        de duas camadas deixa só a faixa de 2px: a de cima é recortada no content
        box (`p-[2px]` define a espessura) e removida da de baixo por `exclude`.
        Vem ANTES da superfície no DOM de propósito: onde `mask-composite` não
        existir, as camadas somam e o canvas cobriria o card inteiro — assim a
        superfície opaca pinta o miolo por cima e sobra justamente a borda.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[-2px] overflow-hidden rounded-2xl p-[2px]"
        style={RING_MASK}
      >
        <StrokeLight palette={t.stroke} />
      </div>

      {/* Superfície do card: carrega os glows e o mascote, recortada no raio
          interno (16px do card menos os 2px da borda). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[14px]"
      >
        {/* Glows + mascote. Puramente decorativo. */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 overflow-hidden",
            t.bgHeight,
            t.bgFill,
          )}
        >
        <div className="absolute top-[-93.93px] right-[-172px] h-[447px] w-[469px]">
          <div className="absolute inset-[-116.87%_-111.39%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.glowLg} alt="" className="block size-full max-w-none" />
          </div>
        </div>
        <div className="absolute top-[-71.93px] right-[-64px] h-[93px] w-[329px]">
          <div className="absolute inset-[-322.58%_-91.19%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.glowSm} alt="" className="block size-full max-w-none" />
          </div>
        </div>
        {tone === "free" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/plans/octopus-free.png"
            alt=""
            width={233}
            height={176}
            className="absolute top-[0.07px] right-0 h-[176px] w-[233px] max-w-none object-cover object-bottom"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/plans/octopus-pro.png"
            alt=""
            width={283}
            height={218}
            className="absolute top-[11.07px] right-[8px] h-[218px] w-[283px] max-w-none object-cover"
          />
        )}
        </div>
      </div>

      {/* Header: badge + nome + preço */}
      <div className="relative flex w-full flex-col items-start gap-5 px-5 pt-4 pb-2">
        {/* Badge: mesma dupla do card — contorno vivo de 1px por fora e o
            "Moving gradient" preenchendo por dentro, com o glifo exportado do
            Figma por cima de tudo. A borda estática é o piso sem WebGL2. */}
        <div
          className={cn(
            "relative size-[52px] shrink-0 rounded-lg border",
            t.badgeBorder,
          )}
        >
          {/* Anel de 1px sobre a borda. Antes do preenchimento no DOM pelo mesmo
              motivo do card: sem `mask-composite` o miolo opaco cobre o excesso. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[-1px] overflow-hidden rounded-lg p-px"
            style={RING_MASK}
          >
            <StrokeLight palette={t.stroke} />
          </div>
          <div className="absolute inset-0 overflow-hidden rounded-[7px]">
            <LightSurface
              colors={t.palette}
              fallbackColor={t.palette.base}
              resolutionScale={1}
              className="absolute inset-0 size-full"
            />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={t.badge}
            alt=""
            width={52}
            height={52}
            className="absolute inset-[-1px] size-[52px] max-w-none"
          />
        </div>

        <div className="flex w-full flex-col items-start gap-4">
          <p
            aria-hidden={nameHidden || undefined}
            className={cn(
              "text-[18px] leading-[1.1] font-semibold",
              TEXT_TRIM,
              nameHidden ? "opacity-0" : "text-principal-9",
            )}
          >
            {name}
          </p>
          <div className="flex w-full items-baseline gap-1 text-gray-12">
            {price}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="relative flex w-full flex-col items-start px-5 pt-5 pb-4">
        {cta}
      </div>

      {/* Lista de recursos */}
      <ul
        className={cn(
          "relative flex w-full flex-col items-start gap-4 px-5 pt-2",
          t.featuresPadding,
        )}
      >
        {features.map((feature) => (
          <li key={feature.title} className="flex w-full items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={t.icon}
              alt=""
              width={20}
              height={20}
              className="size-5 shrink-0"
            />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2 text-sm">
              <span
                className={cn(
                  "w-full leading-[1.1] font-semibold text-gray-12",
                  TEXT_TRIM,
                )}
              >
                {feature.title}
              </span>
              <span
                className={cn("w-full leading-[1.3] text-gray-11", TEXT_TRIM)}
              >
                {feature.detail}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {footnote ? (
        <div className="relative flex w-full items-center gap-2 border-t border-gray-6 px-5 pt-3 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/plans/icon-flag.svg"
            alt=""
            width={20}
            height={20}
            className="size-5 shrink-0"
          />
          <p
            className={cn(
              "text-sm leading-[1.1] font-semibold text-gray-12",
              TEXT_TRIM,
            )}
          >
            {footnote}
          </p>
        </div>
      ) : null}
    </section>
  );
}
