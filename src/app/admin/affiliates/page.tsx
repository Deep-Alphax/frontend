import type { Metadata } from "next";

import { AffiliatesAdmin } from "@/components/admin/AffiliatesAdmin";

export const metadata: Metadata = {
  title: "Admin · Affiliates",
  robots: { index: false, follow: false },
};

/** Rota de admin: percentuais do programa de afiliados (padrão e exceções). */
export default function AdminAffiliatesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <AffiliatesAdmin />
    </main>
  );
}
