import type { Metadata } from "next";
import { FeedAdmin } from "@/components/admin/FeedAdmin";

export const metadata: Metadata = {
  title: "Admin · Feed do Discord",
  robots: { index: false, follow: false },
};

/** Rota de admin: gestão das regras de monitoramento + feed de capturas. */
export default function AdminFeedPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <FeedAdmin />
    </main>
  );
}
