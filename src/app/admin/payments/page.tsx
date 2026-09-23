import type { Metadata } from "next";

import { PaymentsAdmin } from "@/components/admin/PaymentsAdmin";

export const metadata: Metadata = {
  title: "Admin · Payments",
  robots: { index: false, follow: false },
};

/** Rota de admin: todos os pagamentos (cartão e USDC), com reembolsos e falhas. */
export default function AdminPaymentsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <PaymentsAdmin />
    </main>
  );
}
