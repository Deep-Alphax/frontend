import { Suspense } from "react";
import type { Metadata } from "next";

import { AccessGate } from "@/components/access/AccessGate";
import { Footer } from "@/components/home/Footer";
import { Topbar } from "@/components/home/Topbar";
import { HeroBanner } from "@/components/mentorship/HeroBanner";
import {
  MentorshipScreen,
  MentorshipSkeleton,
} from "@/components/mentorship/MentorshipScreen";

/* Mentoria (node Figma 1011:21678) — categorias, trilhas, aulas e progresso.
 * Rota protegida pelo middleware (`src/proxy.ts`): sem sessão, vai para /login.
 * Só PRO, Elixir Alpha e ADMIN: os demais veem o upsell do `AccessGate` (e
 * nenhuma query da mentoria dispara). */
export const metadata: Metadata = { title: "Mentorship" };

/**
 * Fallback do Suspense: a tela lê a aba de categoria da URL com
 * `useSearchParams`, que no build exige a fronteira (a rota segue
 * pré-renderizável). Mesma moldura da tela, para nada pular ao trocar.
 */
function MentorshipFallback() {
  return (
    <div className="flex min-h-dvh flex-col bg-gray-1">
      <Topbar />
      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 pb-[92px] pt-8 md:px-12 lg:px-20">
          <HeroBanner />
          <MentorshipSkeleton />
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function MentorshipPage() {
  return (
    <AccessGate requires="mentorship">
      <Suspense fallback={<MentorshipFallback />}>
        <MentorshipScreen />
      </Suspense>
    </AccessGate>
  );
}
