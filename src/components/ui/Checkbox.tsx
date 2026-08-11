"use client";

import { useId } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  id?: string;
  className?: string;
}

/**
 * Checkbox acessível (Radix) no estilo do Figma: 20px, borda secundária (azul)
 * e preenchimento azul com "check" escuro quando ativo. Radix cuida de foco,
 * teclado e semântica ARIA.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  id,
  className,
}: CheckboxProps) {
  const autoId = useId();
  const checkboxId = id ?? autoId;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <CheckboxPrimitive.Root
        id={checkboxId}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-[4px] border border-secundaria-11 outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-secundaria-11/60",
          "data-[state=checked]:bg-secundaria-11",
        )}
      >
        <CheckboxPrimitive.Indicator>
          <Check className="size-3.5 text-gray-1" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>

      <label htmlFor={checkboxId} className="cursor-pointer text-base text-gray-12">
        {label}
      </label>
    </div>
  );
}
