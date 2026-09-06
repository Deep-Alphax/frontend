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
    .min(1, "Enter your email")
    .email("Invalid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
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
    .min(1, "Tell us what to call you")
    .max(120, "Name is too long"),
  email: z.string().trim().min(1, "Enter your email").email("Invalid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      PASSWORD_REGEX,
      "Use at least one uppercase letter, one lowercase letter and one number",
    ),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
