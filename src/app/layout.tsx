import type { Metadata, Viewport } from "next";
import { Unbounded, Work_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

/*
 * Fontes do design (Figma): Unbounded (display/headlines) e Work Sans (corpo).
 * `next/font/google` baixa e auto-hospeda os arquivos no build — zero request a
 * fonts.gstatic em runtime (performance + sem dependência externa na CSP).
 * `display: swap` evita FOIT (texto invisível durante o carregamento).
 */
const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["700"], // DS: Display usa apenas o peso 700.
  variable: "--font-unbounded",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"], // DS: Body/Heading Regular→Bold.
  variable: "--font-work-sans",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const SITE_DESCRIPTION =
  "PnL real, topo × saída e feed de alpha para carteiras Solana.";

export const metadata: Metadata = {
  // Base para resolver URLs absolutas (og:image, canônicas). Vem do ambiente:
  // localhost em dev, domínio real na VPS (NEXT_PUBLIC_APP_URL).
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Deep Alpha",
    template: "%s · Deep Alpha",
  },
  description: SITE_DESCRIPTION,
  robots: "index, follow",
  // `icon.svg` e `opengraph-image.tsx`/`twitter-image.tsx` (convenções de arquivo do
  // App Router) preenchem o favicon e as imagens de preview automaticamente.
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Deep Alpha",
    url: "/",
    title: "Deep Alpha — Wallet Analytics",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Deep Alpha — Wallet Analytics",
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#111217",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${unbounded.variable} ${workSans.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
