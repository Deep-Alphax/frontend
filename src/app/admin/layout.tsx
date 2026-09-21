import type { Metadata } from "next";

import { AdminNav } from "@/components/admin/AdminNav";

/* Layout de TODAS as rotas de /admin — o header de navegação mora aqui para que
 * uma tela nova ganhe a navegação sem precisar importar nada.
 *
 * `robots: noindex` no layout vale para as filhas; cada página mantém o seu
 * `title`, que o Next combina com este. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /* `min-h-dvh` + fundo próprio: sem isto a área abaixo do conteúdo curto
       mostraria o fundo do body, e o header pareceria solto na página. */
    <div className="flex min-h-dvh flex-col bg-gray-1">
      <AdminNav />
      {children}
    </div>
  );
}
