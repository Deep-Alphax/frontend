import type { Metadata } from "next";

import { MentorshipAdmin } from "@/components/admin/MentorshipAdmin";

export const metadata: Metadata = {
  title: "Admin · Mentorship",
  robots: { index: false, follow: false },
};

/** Rota de admin: edita as trilhas e aulas que TODO usuário vê em /mentorship. */
export default function AdminMentorshipPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <MentorshipAdmin />
    </main>
  );
}
