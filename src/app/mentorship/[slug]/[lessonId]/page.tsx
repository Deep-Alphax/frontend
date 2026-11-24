import type { Metadata } from "next";

import { AccessGate } from "@/components/access/AccessGate";
import { LessonScreen } from "@/components/mentorship/LessonScreen";

/* Episódio (node Figma 1039:25421) — player, materiais, progresso e próximos.
 * Rota protegida pelo middleware (`src/proxy.ts`) e pelo `AccessGate`, como o
 * resto da mentoria.
 *
 * Título estático pelo mesmo motivo da página do módulo: o nome da aula só
 * existe atrás de chamada autenticada. O `<h1>` mostra o nome real. */
export const metadata: Metadata = { title: "Mentorship" };

export default async function MentorshipLessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  return (
    <AccessGate requires="mentorship">
      <LessonScreen slug={slug} lessonId={lessonId} />
    </AccessGate>
  );
}
