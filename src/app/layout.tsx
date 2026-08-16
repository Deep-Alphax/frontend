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

export const metadata: Metadata = {
  title: {
    default: "Deep Alpha",
    template: "%s · Deep Alpha",
  },
  description: "Deep Alpha — Wallet Analytics.",
  robots: "index, follow",
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
