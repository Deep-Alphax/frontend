import axios, { AxiosError } from "axios";
import { API_URL } from "@/lib/env";

/**
 * Instância HTTP única para o backend NestJS.
 *
 * - `withCredentials: true` — a sessão vive em cookies httpOnly setados pelo
 *   backend (access/refresh). O JS nunca toca no token; o cookie viaja sozinho.
 * - `x-pt-surface: client` — o backend isola sessões por superfície
 *   (admin/organizer/client). O front declara a sua explicitamente (não dá p/
 *   deduzir do host em dev). O header está no allowlist de CORS do backend.
 */
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "x-pt-surface": "client",
  },
  timeout: 20_000,
});

/**
 * 401 = sessão inválida/expirada. Em vez de insistir (o que gera enxurrada de
 * requests e 429), "deslogamos no frontend" limpando o cookie-dica
 * `pt_authed_client`. Sem ele, `useSession` fica `enabled:false` e não consulta
 * mais o perfil — a UI cai para o estado deslogado. A autorização real continua
 * sendo dos cookies httpOnly (isto é só o sinal de UI). Não redireciona: a Home
 * é pública; telas protegidas são barradas pelo middleware.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && typeof document !== "undefined") {
      document.cookie = "pt_authed_client=; Max-Age=0; path=/";
    }
    return Promise.reject(error);
  },
);

/** Formato de erro padronizado do backend (AllExceptionsFilter / ValidationPipe). */
interface ApiErrorBody {
  message?: string | string[];
  /**
   * O ValidationPipe do backend manda OBJETOS (`{ property, message, … }`),
   * não strings. Tratar como string fazia o toast receber um objeto e o React
   * derrubar a página ("Objects are not valid as a React child") — E2E 22/11.
   */
  errors?: (string | { message?: unknown })[];
  error?: string;
}

/** Primeiro texto utilizável de `errors[]`, seja string ou `{ message }`. */
function firstErrorText(body: ApiErrorBody | undefined): string | null {
  if (!Array.isArray(body?.errors)) return null;
  for (const e of body.errors) {
    const text = typeof e === "string" ? e : e?.message;
    if (typeof text === "string" && text.trim()) return text;
  }
  return null;
}

/**
 * `true` quando o backend respondeu 404 — o recurso não existe mais lá. Sinal
 * de que o cache local está desatualizado e precisa ser refeito, não de erro
 * transitório para tentar de novo.
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 404;
}

/**
 * `true` quando o backend recusou a sessão (401). Fora do login, a mensagem
 * certa é "sessão expirou", não a de credencial errada de `getApiErrorMessage`.
 */
export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 401;
}

/**
 * Para telas de ADMIN: em 404/409 o texto do backend é a explicação útil
 * ("slug already exists", "category still has 3 modules"). `getApiErrorMessage`
 * trata todo 409 como e-mail duplicado (fluxo de cadastro), o que aqui mentiria.
 */
export function getAdminErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (status === 404 || status === 409) {
      const body = error.response?.data as ApiErrorBody | undefined;
      const message = Array.isArray(body?.message)
        ? body.message[0]
        : body?.message;
      return typeof message === "string" && message.trim() ? message : fallback;
    }
  }
  return getApiErrorMessage(error, fallback);
}

/**
 * Extrai uma mensagem amigável (en-US) de um erro do axios, sem vazar detalhes
 * internos. Mapeia os status mais comuns do fluxo de auth para textos claros.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!(error instanceof AxiosError)) return fallback;

  const status = error.response?.status;
  const body = error.response?.data as ApiErrorBody | undefined;

  // Mapeamento por status (mais estável que depender do texto do backend).
  if (status === 401) return "Invalid email or password.";
  if (status === 409) return "This email is already registered.";
  if (status === 429)
    return "Too many attempts. Wait a few minutes and try again.";
  if (status === 0 || error.code === "ERR_NETWORK")
    return "Could not reach the server. Check your connection.";

  // Mensagem específica retornada pelo backend, quando houver.
  const fromErrors = firstErrorText(body);
  if (fromErrors) return fromErrors;
  if (Array.isArray(body?.message)) return body.message[0];
  if (typeof body?.message === "string") return body.message;
  if (typeof body?.error === "string") return body.error;

  return fallback;
}
