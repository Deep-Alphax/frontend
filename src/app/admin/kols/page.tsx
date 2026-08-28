import type { Metadata } from "next";
import { KolsAdmin } from "@/components/admin/KolsAdmin";

export const metadata: Metadata = {
  title: "Admin · Preset de KOLs",
  robots: { index: false, follow: false },
};

/** Rota de admin: edita o preset GLOBAL de KOLs (o que todo usuário vê). */
export default function AdminKolsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <KolsAdmin />
    </main>
  );
}
