import Link from "next/link";
import { Instagram } from "lucide-react";

/** Ícone do X (Twitter) — a lucide não traz o mark novo; SVG inline do logo oficial. */
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  );
}

/** Link de navegação/atalho do footer (texto gray-11 → gray-12 no hover). */
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="whitespace-nowrap px-3 py-4 text-base text-gray-11 transition-colors hover:text-gray-12"
    >
      {children}
    </Link>
  );
}

/** Botão de ícone social (24px), link externo em nova aba. */
function SocialButton({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex size-6 items-center justify-center text-gray-11 transition-colors hover:text-gray-12"
    >
      {children}
    </a>
  );
}

/**
 * Footer do app (node Figma 259:5139): logo + navegação, divisor, card de convite
 * da comunidade + redes/links legais, e copyright. Container alinhado ao resto do
 * app (`max-w-7xl`), empilha em telas menores.
 */
export function Footer() {
  return (
    <footer className="w-full border-t border-gray-6 bg-gray-2 px-6 py-10 md:px-12 lg:px-20">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-9">
        <div className="flex flex-col gap-8">
          {/* Linha 1: logo + navegação */}
          <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between md:gap-4">
            <Link href="/" aria-label="Deep Alpha — início" className="flex flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/deep-alpha-logo.svg"
                alt=""
                width={63}
                height={47}
                className="h-[46px] w-[63px]"
              />
              <span className="font-display text-sm font-semibold tracking-wide text-principal-9">
                Deep Alpha
              </span>
            </Link>

            <nav className="flex flex-wrap items-center justify-center">
             {/*  <FooterLink href="#">Aprender</FooterLink>
              <FooterLink href="#">Mentoria</FooterLink> */}
              <FooterLink href="/radar">Radar</FooterLink>
              <FooterLink href="/">Meu perfil</FooterLink>
             {/*  <FooterLink href="#">Copiloto</FooterLink> */}
            </nav>
          </div>

          <div className="h-px w-full bg-gray-6" />

          {/* Linha 2: card da comunidade + redes/links */}
          <div className="flex flex-col items-stretch gap-8 md:flex-row md:items-center md:justify-between">
            {/* Card convite comunidade — banner ao fundo + conteúdo sobreposto */}
            <div className="relative flex w-full max-w-[474px] flex-col items-start justify-center gap-5 overflow-hidden rounded-lg border border-gray-6 bg-gray-3 p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/community-banner.jpg"
                alt=""
                className="pointer-events-none absolute inset-0 size-full object-cover"
              />
              <p className="font-display relative w-[204px] text-lg font-semibold leading-tight tracking-wide text-gray-12">
                Junte-se à comunidade
              </p>
              <a
                href="#"
                className="relative flex h-9 items-center justify-center rounded-lg bg-principal-9 px-3 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10"
              >
                Quero participar
              </a>
            </div>

            {/* Redes sociais + links legais */}
            <div className="flex flex-col items-center gap-5 md:items-end">
              <div className="flex items-center gap-3">
                <SocialButton href="#" label="Instagram">
                  <Instagram className="size-6" strokeWidth={2} />
                </SocialButton>
                <SocialButton href="#" label="X (Twitter)">
                  <XIcon className="size-5" />
                </SocialButton>
              </div>
              {/* <nav className="flex flex-wrap items-center justify-center">
                <FooterLink href="#">Política de privacidade</FooterLink>
                <FooterLink href="#">Termos e condições</FooterLink>
              </nav> */}
            </div>
          </div>
        </div>

        {/* Copyright */}
        <p className="text-center text-base text-gray-11">
          Copyright Deep Alpha - 2026. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
