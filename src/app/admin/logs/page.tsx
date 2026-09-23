import type { Metadata } from "next";

import { AuditLogsAdmin } from "@/components/admin/AuditLogsAdmin";

export const metadata: Metadata = {
  title: "Admin · Logs",
  robots: { index: false, follow: false },
};

/** Rota de admin: log de auditoria (páginas, alterações antes/depois, logins). */
export default function AdminLogsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <AuditLogsAdmin />
    </main>
  );
}
