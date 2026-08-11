"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

export interface TextFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Ícone à esquerda (ex.: <Mail /> do lucide). */
  leftIcon?: React.ReactNode;
  /** Slot à direita (ex.: botão de mostrar/ocultar senha). */
  rightSlot?: React.ReactNode;
  /** Mensagem de erro — quando presente, realça a borda e é anunciada por SR. */
  error?: string;
}

/**
 * Campo de texto com rótulo, ícone e slot à direita, espelhando o input do
 * Figma (h-48 / borda gray-6 / bg gray-2 / placeholder gray-11).
 * `forwardRef` permite o registro direto no React Hook Form.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, leftIcon, rightSlot, error, id, className, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;

    return (
      <div className="flex w-full flex-col gap-2">
        <label htmlFor={inputId} className="text-base text-gray-12">
          {label}
        </label>

        <div
          className={cn(
            "flex h-12 items-center gap-2 rounded-lg border bg-gray-2 px-3 transition-colors",
            error
              ? "border-danger-11"
              : "border-gray-6 focus-within:border-secundaria-11",
          )}
        >
          {leftIcon ? (
            <span className="flex shrink-0 items-center text-gray-11">
              {leftIcon}
            </span>
          ) : null}

          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "min-w-0 flex-1 bg-transparent text-base text-gray-12 outline-none placeholder:text-gray-11",
              className,
            )}
            {...props}
          />

          {rightSlot ? (
            <span className="flex shrink-0 items-center">{rightSlot}</span>
          ) : null}
        </div>

        {error ? (
          <p id={errorId} role="alert" className="text-sm text-danger-11">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

TextField.displayName = "TextField";
