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
  errors?: string[];
  error?: string;
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
 * Extrai uma mensagem amigável (pt-BR) de um erro do axios, sem vazar detalhes
 * internos. Mapeia os status mais comuns do fluxo de auth para textos claros.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Algo deu errado. Tente novamente.",
): string {
  if (!(error instanceof AxiosError)) return fallback;

  const status = error.response?.status;
  const body = error.response?.data as ApiErrorBody | undefined;

  // Mapeamento por status (mais estável que depender do texto do backend).
  if (status === 401) return "E-mail ou senha inválidos.";
  if (status === 409) return "Este e-mail já está cadastrado.";
  if (status === 429)
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (status === 0 || error.code === "ERR_NETWORK")
    return "Não foi possível conectar ao servidor. Verifique sua conexão.";

  // Mensagem específica retornada pelo backend, quando houver.
  if (Array.isArray(body?.errors) && body.errors.length > 0) return body.errors[0];
  if (Array.isArray(body?.message)) return body.message[0];
  if (typeof body?.message === "string") return body.message;
  if (typeof body?.error === "string") return body.error;

  return fallback;
}
