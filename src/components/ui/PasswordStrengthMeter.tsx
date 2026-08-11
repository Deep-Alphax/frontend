"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import {
  getPasswordStrength,
  type PasswordStrengthLevel,
} from "@/lib/validation/passwordStrength";

const TOTAL_BARS = 4;

/** Cor da barra preenchida + texto do rótulo por nível. */
const LEVEL_STYLES: Record<
  Exclude<PasswordStrengthLevel, "empty">,
  { bar: string; text: string; label: string }
> = {
  weak: { bar: "bg-danger-10", text: "text-danger-11", label: "Senha fraca" },
  medium: { bar: "bg-amber-10", text: "text-amber-11", label: "Senha média" },
  strong: { bar: "bg-green-10", text: "text-green-11", label: "Senha forte" },
};

interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
}

/**
 * Medidor visual de força de senha: 4 barras + rótulo (fraca/média/forte).
 * Barras vazias usam gray-5; preenchidas seguem a cor do nível. O rótulo é
 * anunciado por leitores de tela (aria-live) conforme a força muda.
 */
export function PasswordStrengthMeter({
  password,
  className,
}: PasswordStrengthMeterProps) {
  const { score, level } = useMemo(
    () => getPasswordStrength(password),
    [password],
  );

  const styles = level === "empty" ? null : LEVEL_STYLES[level];

  return (
    <div className={cn("flex w-full flex-col gap-2.5", className)}>
      <div className="flex w-full items-start gap-3">
        {Array.from({ length: TOTAL_BARS }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-lg transition-colors",
              index < score && styles ? styles.bar : "bg-gray-5",
            )}
          />
        ))}
      </div>

      <p
        aria-live="polite"
        className={cn(
          "min-h-[1.3em] text-base font-medium",
          styles ? styles.text : "text-transparent",
        )}
      >
        {styles?.label ?? ""}
      </p>
    </div>
  );
}
