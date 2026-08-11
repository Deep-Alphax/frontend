import { z } from "zod";

/**
 * Schema de login. Espelha as regras mínimas do backend (EmailLoginDto):
 * e-mail válido + senha com no mínimo 8 caracteres. `remember` controla apenas
 * a UX de "lembrar conta" (a duração real do refresh é decidida pelo backend).
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail")
    .email("E-mail inválido"),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres"),
  remember: z.boolean(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * Regra de senha do backend (EmailRegisterDto.PASSWORD_REGEX): mínimo 8, com ao
 * menos uma maiúscula, uma minúscula e um número. Replicada aqui para barrar no
 * cliente antes do POST (mesma fonte de verdade dos dois lados).
 */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/** Schema de cadastro. `name` → `complete_name` no payload da API. */
export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe como podemos te chamar")
    .max(120, "Nome muito longo"),
  email: z.string().trim().min(1, "Informe seu e-mail").email("E-mail inválido"),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres")
    .regex(
      PASSWORD_REGEX,
      "Use ao menos uma letra maiúscula, uma minúscula e um número",
    ),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
