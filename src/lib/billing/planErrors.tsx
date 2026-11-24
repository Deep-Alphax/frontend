import Link from "next/link";
import { AxiosError } from "axios";
import toast from "react-hot-toast";

import { ACCESS_RESTRICTED } from "@/lib/api/access";
import { getApiErrorMessage } from "@/lib/api/client";

/**
 * Códigos estáveis que o backend manda num 403 de plano/acesso:
 *  - `PLAN_REQUIRED`: a rota inteira é de um plano acima (`PlanGuard`);
 *  - `PLAN_LIMIT`: o plano atual chegou no teto (carteiras, alertas);
 *  - `ACCESS_RESTRICTED`: conta Elixir Alpha no FREE fora da allowlist
 *    (`JwtAuthGuard`). O PRO libera tudo, então a saída também é o upgrade.
 */
export type PlanErrorCode = "PLAN_REQUIRED" | "PLAN_LIMIT" | typeof ACCESS_RESTRICTED;

export function planErrorCode(error: unknown): PlanErrorCode | null {
  if (!(error instanceof AxiosError) || error.response?.status !== 403) return null;
  const code = (error.response.data as { code?: unknown } | undefined)?.code;
  return code === "PLAN_REQUIRED" || code === "PLAN_LIMIT" || code === ACCESS_RESTRICTED
    ? code
    : null;
}

/**
 * Toast de erro que, quando o motivo é o plano (ou o acesso restrito do Elixir
 * Alpha), oferece o upgrade em vez de só informar — é o momento em que o
 * usuário mais quer o recurso. A mensagem é a do backend (já em inglês).
 */
export function toastApiError(error: unknown, fallback: string): void {
  const code = planErrorCode(error);
  const message = getApiErrorMessage(
    error,
    code === ACCESS_RESTRICTED ? "This feature isn't included in your access." : fallback,
  );
  if (!code) {
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
          {code === ACCESS_RESTRICTED ? "Become a Pro to unlock it →" : "See the Pro plan →"}
        </Link>
      </span>
    ),
    { duration: 6_000 },
  );
}
