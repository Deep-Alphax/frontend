import type { Metadata } from "next";

import { AccessGate } from "@/components/access/AccessGate";
import { ModuleDetailScreen } from "@/components/mentorship/ModuleDetailScreen";

/* Detalhes do módulo (node Figma 1036:23317) — capa com progresso e a grade de
 * episódios. Rota protegida pelo middleware (`src/proxy.ts`) e pelo
 * `AccessGate`, como /mentorship.
 *
 * Título estático: o nome do módulo só existe atrás de uma chamada autenticada,
 * e buscá-lo aqui só para o `<title>` custaria um request do servidor em toda
 * navegação. O `<h1>` da página mostra o nome real. */
export const metadata: Metadata = { title: "Mentorship" };

export default async function MentorshipModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <AccessGate requires="mentorship">
      <ModuleDetailScreen slug={slug} />
    </AccessGate>
  );
}
