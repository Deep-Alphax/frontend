import Link from "next/link";
import { AxiosError } from "axios";
import toast from "react-hot-toast";

import { getApiErrorMessage } from "@/lib/api/client";

/**
 * Códigos estáveis que o backend manda num 403 de plano:
 *  - `PLAN_REQUIRED`: a rota inteira é de um plano acima (`PlanGuard`);
 *  - `PLAN_LIMIT`: o plano atual chegou no teto (carteiras, alertas).
 */
export type PlanErrorCode = "PLAN_REQUIRED" | "PLAN_LIMIT";

export function planErrorCode(error: unknown): PlanErrorCode | null {
  if (!(error instanceof AxiosError) || error.response?.status !== 403) return null;
  const code = (error.response.data as { code?: unknown } | undefined)?.code;
  return code === "PLAN_REQUIRED" || code === "PLAN_LIMIT" ? code : null;
}

/**
 * Toast de erro que, quando o motivo é o plano, oferece o upgrade em vez de só
 * informar — é o momento em que o usuário mais quer o recurso.
 */
export function toastApiError(error: unknown, fallback: string): void {
  const message = getApiErrorMessage(error, fallback);
  if (!planErrorCode(error)) {
    toast.error(message);
    return;
  }
  toast.error(
    (t) => (
      <span className="flex flex-col gap-1">
        <span>{message}</span>
        <Link
          href="/plans"
          onClick={() => toast.dismiss(t.id)}
          className="font-semibold text-principal-9 underline-offset-2 hover:underline"
        >
          See the Pro plan →
        </Link>
      </span>
    ),
    { duration: 6_000 },
  );
}
