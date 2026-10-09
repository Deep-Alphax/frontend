import type { Metadata } from "next";

import { RankingAdmin } from "@/components/admin/RankingAdmin";

export const metadata: Metadata = {
  title: "Admin · Deep Ranking",
  robots: { index: false, follow: false },
};

/** Rota de admin: temporadas do Deep Ranking (período e prêmios). */
export default function AdminRankingPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <RankingAdmin />
    </main>
  );
}
