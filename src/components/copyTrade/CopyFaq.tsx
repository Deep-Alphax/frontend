"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import { HelpIcon, MinusIcon, PlusIcon } from "@/components/copyTrade/icons";
import { SectionTitle } from "@/components/copyTrade/parts";

/*
 * "Dúvidas comuns" (node 1602:26465). Só a 1ª resposta está no Figma; as
 * outras seguem as notas do próprio arquivo (Copy pausado: "não compra nem
 * vende, retomar usa as mesmas regras"; linha do tempo: compra ignorada pelo
 * Deep Score). A de taxa fala só do que vale para qualquer swap on-chain —
 * taxa da plataforma, se houver, ainda não foi definida (ver open-questions).
 */
const FAQ = [
  {
    q: "Where does the money for the buys come from?",
    a: "From your W1. Each copied buy uses the amount you set, up to the wallet balance.",
  },
  {
    q: "Can I stop whenever I want?",
    a: "Yes. Pause a copy at any time and it stops buying and selling. Resuming keeps the same rules.",
  },
  {
    q: "What if the wallet buys a scam?",
    a: "Every buy is checked against the token's Deep Score first. Tokens below your minimum are skipped.",
  },
  {
    q: "Are there fees?",
    a: "Each copied trade pays the network and swap fees of the trade itself, like any on-chain swap.",
  },
];

/** Acordeão: aberto mostra a resposta ("faq - item", node 1601:26263). */
export function CopyFaq() {
  const [open, setOpen] = useState(0);

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle
        icon={<HelpIcon className="size-3" />}
        title="Common questions"
        hint="before your first copy"
      />
      <div className="overflow-hidden rounded-xl border border-gray-6 bg-gray-2">
        {FAQ.map((item, i) => {
          const isOpen = open === i;
          const id = `copy-faq-${i}`;
          return (
            <div key={item.q} className={cn("px-4 py-3", i < FAQ.length - 1 && "border-b border-gray-6")}>
              <h4>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={id}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex min-h-6 w-full items-center gap-3 text-left text-sm leading-[1.3] font-semibold text-gray-12"
                >
                  <span className="flex-1">{item.q}</span>
                  {isOpen ? (
                    <MinusIcon className="size-3.5 shrink-0 text-gray-11" />
                  ) : (
                    <PlusIcon className="size-3.5 shrink-0 text-gray-11" />
                  )}
                </button>
              </h4>
              <p id={id} hidden={!isOpen} className="pt-2 text-xs leading-[1.3] text-gray-11">
                {item.a}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
