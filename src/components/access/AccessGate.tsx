"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

import { Footer } from "@/components/home/Footer";
import { Topbar } from "@/components/home/Topbar";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { hasSessionHint } from "@/lib/auth/sessionHint";
import { useSession } from "@/lib/auth/useSession";
import { usePlan } from "@/lib/billing/usePlan";
import { useIsClient } from "@/lib/useIsClient";

/*
 * Gate de página por ACESSO (contrato do Elixir Alpha em `lib/api/access.ts`).
 *
 * Fica no `page.tsx`, em volta da tela inteira, para que a tela bloqueada nunca
 * seja montada: nenhuma query dispara, então nenhum 403 aparece em toast/console.
 * É só UX — quem barra de verdade é o backend (`JwtAuthGuard`/`PlanGuard`).
 *
 *  - `unrestricted`: tudo que custa (Radar, Tracker, Copy Trade, Alertas, Home).
 *    Conta Elixir Alpha no FREE vê um card explicando, com saídas para a
 *    Mentoria e para o Pro.
 *  - `mentorship`: PRO, Elixir Alpha e ADMIN. FREE comum vê o upsell do Pro.
 *
 * Deslogado passa direto: a Home ("/") é pública e as demais rotas já são
 * protegidas pelo `proxy.ts`. Se `/billing/me` falhar, também passa — esconder
 * o app inteiro por um erro de rede seria pior que um 403 eventual, e o
 * backend continua sendo a autoridade.
 *
 * Hidratação: no servidor e no 1º render do cliente não há sessão, então os
 * dois lados desenham o MESMO skeleton; a decisão só sai depois do mount.
 */

export type AccessRequirement = "unrestricted" | "mentorship";

export type AccessDecision = "pending" | "allow" | "restricted" | "upsell";

export function useAccessDecision(requires: AccessRequirement): AccessDecision {
  const isClient = useIsClient();
  const { isAuthenticated, isLoading: sessionLoading } = useSession();
  const { access, isLoading: planLoading, isError } = usePlan();

  if (!isClient) return "pending";
  // Sem cookie-dica = deslogado: nada a decidir (e nenhuma chamada à API).
  if (!hasSessionHint()) return "allow";
  if (sessionLoading) return "pending";
  if (!isAuthenticated) return "allow";
  if (!access) return planLoading || !isError ? "pending" : "allow";

  if (requires === "mentorship") return access.mentorship ? "allow" : "upsell";
  return access.restricted ? "restricted" : "allow";
}

export function AccessGate({
  requires,
  children,
  frame = "page",
  redirectRestrictedTo,
}: {
  requires: AccessRequirement;
  children: ReactNode;
  /**
   * `page`: o gate desenha a moldura do app (Topbar + Footer) em volta do
   * skeleton/card — as telas gated trazem a própria moldura, que só monta
   * quando liberadas. `none`: só o miolo (a página já tem moldura, ex.: Home).
   */
  frame?: "page" | "none";
  /** Restrito vai direto para esta rota em vez de ver o card (Home → Mentoria). */
  redirectRestrictedTo?: string;
}) {
  const decision = useAccessDecision(requires);
  const router = useRouter();
  const redirecting = decision === "restricted" && !!redirectRestrictedTo;

  useEffect(() => {
    if (redirecting && redirectRestrictedTo) router.replace(redirectRestrictedTo);
  }, [redirecting, redirectRestrictedTo, router]);

  if (decision === "allow") return <>{children}</>;

  const content =
    decision === "pending" || redirecting ? (
      <AccessSkeleton />
    ) : decision === "restricted" ? (
      <RestrictedCard />
    ) : (
      <MentorshipUpsell />
    );

  if (frame === "none") return content;

  return (
    <div className="flex min-h-dvh flex-col bg-gray-1">
      <Topbar />
      <main className="flex w-full flex-1 flex-col px-6 pb-[92px] pt-8 md:px-12 lg:px-20">
        <div className="mx-auto flex w-full max-w-7xl flex-col">{content}</div>
      </main>
      <Footer />
    </div>
  );
}

/** Skeleton genérico de tela: título + linha de apoio + grade de cards. */
function AccessSkeleton() {
  return (
    <SkeletonGroup className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[360px] rounded-lg" />
    </SkeletonGroup>
  );
}

const PRIMARY_LINK =
  "flex h-10 items-center justify-center rounded-lg bg-principal-9 px-6 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10";
const SECONDARY_LINK =
  "flex h-10 items-center justify-center rounded-lg border border-gray-6 bg-gray-3 px-6 text-sm font-semibold text-gray-12 transition-colors hover:border-gray-8";

function GateCard({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <section
      aria-labelledby="access-gate-title"
      className="mx-auto mt-8 flex w-full max-w-xl flex-col items-center gap-5 rounded-lg border border-gray-6 bg-gray-2 px-6 py-10 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full border border-gray-6 bg-gray-3">
        <Lock className="size-5 text-principal-9" aria-hidden />
      </span>
      <h1 id="access-gate-title" className="text-xl font-semibold text-gray-12">
        {title}
      </h1>
      <p className="text-base text-gray-11">{children}</p>
      <div className="flex w-full flex-col justify-center gap-2 sm:flex-row">{actions}</div>
    </section>
  );
}

function RestrictedCard() {
  return (
    <GateCard
      title="This area isn't included in your Elixir Alpha access"
      actions={
        <>
          <Link href="/mentorship" className={SECONDARY_LINK}>
            Go to Mentorship
          </Link>
          <Link href="/plans" className={PRIMARY_LINK}>
            Become a Pro
          </Link>
        </>
      }
    >
      Elixir Alpha includes the Mentorship, the KOLs index and the Deep Ranking.
      Upgrade to Pro to unlock Radar, Tracker, Copy Trade, Alerts and your wallet
      profile.
    </GateCard>
  );
}

function MentorshipUpsell() {
  return (
    <GateCard
      title="Mentorship is part of Pro"
      actions={
        <Link href="/plans" className={PRIMARY_LINK}>
          Become a Pro
        </Link>
      }
    >
      Upgrade to Pro to watch every module of the Deep Alpha Mentorship, track
      your progress and pick up right where you left off.
    </GateCard>
  );
}
