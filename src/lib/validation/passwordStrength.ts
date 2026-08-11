/**
 * Cálculo de força de senha para o medidor visual (4 barras).
 *
 * Heurística baseada em critérios cumulativos (tamanho, variedade de classes de
 * caractere). É um sinal de UX — a validação "dura" que barra o envio vive no
 * Zod (`registerSchema`), espelhando a regra do backend (min 8 + maiúscula +
 * minúscula + número).
 */

export type PasswordStrengthLevel = "empty" | "weak" | "medium" | "strong";

export interface PasswordStrength {
  /** Nº de barras preenchidas (0–4). */
  score: number;
  level: PasswordStrengthLevel;
}

/** Pontua a senha de 0 a 4 e deriva o nível fraca/média/forte. */
export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, level: "empty" };

  let points = 0;
  if (password.length >= 8) points++;
  if (password.length >= 12) points++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++;
  if (/\d/.test(password)) points++;
  if (/[^A-Za-z0-9]/.test(password)) points++;

  // Qualquer senha não-vazia acende ao menos 1 barra; teto de 4 (nº de barras).
  const score = Math.min(Math.max(points, 1), 4);
  const level: PasswordStrengthLevel =
    score <= 2 ? "weak" : score === 3 ? "medium" : "strong";

  return { score, level };
}
