import type { Metadata } from "next";

import { MentorshipModuleAdmin } from "@/components/admin/MentorshipModuleAdmin";

export const metadata: Metadata = {
  title: "Admin · Mentorship module",
  robots: { index: false, follow: false },
};

/**
 * Página de um módulo no admin: dados do módulo + aulas (com o painel lateral
 * da aula). Next 16 entrega `params` como Promise — mesmo padrão de
 * `/mentorship/[slug]`.
 */
export default async function AdminMentorshipModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <MentorshipModuleAdmin moduleId={id} />
    </main>
  );
}
