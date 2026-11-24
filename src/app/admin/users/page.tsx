import type { Metadata } from "next";

import { UsersAdmin } from "@/components/admin/UsersAdmin";

export const metadata: Metadata = {
  title: "Admin · Users",
  robots: { index: false, follow: false },
};

/** Rota de admin: usuários, cargo Elixir Alpha (individual e em lote) e convites. */
export default function AdminUsersPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <UsersAdmin />
    </main>
  );
}
