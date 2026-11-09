import type { Metadata } from "next";

import { CouponsAdmin } from "@/components/admin/CouponsAdmin";

export const metadata: Metadata = {
  title: "Admin · Coupons",
  robots: { index: false, follow: false },
};

/** Rota de admin: cupons de PRO grátis (criação, limites e quem resgatou). */
export default function AdminCouponsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <CouponsAdmin />
    </main>
  );
}
