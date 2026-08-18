import { api } from "@/lib/api/client";
import { API_URL } from "@/lib/env";

export interface LoginPayload {
  email: string;
  password: string;
  /** Token Cloudflare Turnstile — opcional (fail-open em dev, exigido em prod). */
  turnstileToken?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: string;
}

/** Sucesso: tokens já foram setados em cookies httpOnly; recebemos só o usuário. */
export interface LoginSuccess {
  success: true;
  message: string;
  data: { user: AuthUser };
}

/** Desafio de 2FA: backend enviou OTP por e-mail e aguarda verificação. */
export interface LoginMfaChallenge {
  mfaRequired: true;
  mfaToken: string;
}

export type LoginResult = LoginSuccess | LoginMfaChallenge;

/** Type guard: o login exigiu verificação em duas etapas. */
export function isMfaChallenge(r: LoginResult): r is LoginMfaChallenge {
  return "mfaRequired" in r && r.mfaRequired === true;
}

/** POST /api/v1/auth/login — e-mail + senha. */
export async function login(payload: LoginPayload): Promise<LoginResult> {
  const { data } = await api.post<LoginResult>("/api/v1/auth/login", payload);
  return data;
}

export interface RegisterPayload {
  complete_name: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
  acceptedPrivacyPolicy: boolean;
  /** Idioma preferido; default do app é PT. */
  language?: "EN" | "PT" | "ES";
  turnstileToken?: string;
}

/** Cadastro autologa: retorna o usuário e o backend seta os cookies de sessão. */
export interface RegisterSuccess {
  success: true;
  message: string;
  data: { user: AuthUser };
}

/**
 * POST /api/v1/auth/register — cria a conta e já inicia a sessão (cookies
 * httpOnly). 409 se o e-mail já existir.
 */
export async function register(
  payload: RegisterPayload,
): Promise<RegisterSuccess> {
  const { data } = await api.post<RegisterSuccess>(
    "/api/v1/auth/register",
    payload,
  );
  return data;
}

/** Perfil do usuário autenticado (GET /api/v1/auth/profile, cookie httpOnly). */
export async function getProfile(): Promise<AuthUser> {
  const { data } = await api.get<{ data: AuthUser }>("/api/v1/auth/profile");
  return data.data;
}

/** POST /api/v1/auth/logout — encerra a sessão (o backend limpa os cookies httpOnly). */
export async function logout(): Promise<void> {
  await api.post("/api/v1/auth/logout");
}

/**
 * URL de início do OAuth Google (navegação top-level, não XHR — o backend
 * redireciona para o consent). `redirect_to` é o caminho relativo pós-login.
 */
export function buildGoogleAuthUrl(redirectTo = "/"): string {
  const url = new URL("/api/v1/auth/google", API_URL);
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

/**
 * Troca o `code` do Google por uma sessão (POST /api/v1/auth/google/validate).
 * O backend seta os cookies httpOnly + o cookie-dica; aqui só disparamos a troca.
 *
 * `redirectUri` DEVE ser o callback do BACKEND — é o `redirect_uri` usado no
 * consent, e a troca do code no Google exige que ele bata exatamente. 400 =
 * code inválido/expirado (ex.: page refresh reusa o code).
 */
export async function validateGoogleCode(code: string): Promise<void> {
  const redirectUri = `${API_URL}/api/v1/auth/google/callback`;
  await api.post("/api/v1/auth/google/validate", { code, redirectUri });
}
