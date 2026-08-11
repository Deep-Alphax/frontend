import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compõe classes condicionais (clsx) e resolve conflitos do Tailwind
 * (tailwind-merge) — ex.: `px-3` sobrescreve `px-8` corretamente ao mesclar.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
