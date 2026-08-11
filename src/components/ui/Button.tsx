import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/*
 * Botão base do design Deep Alpha.
 * - primary: CTA amarelo (principal/9) com texto escuro (gray/1).
 * - secondary: superfície escura (gray/2) com borda (gray/6) — usado no Google.
 * Altura/px/raio espelham o node do Figma (h-44 / px-32 / radius-8).
 */
export const buttonVariants = cva(
  "inline-flex w-full items-center justify-center gap-2 rounded-lg text-base transition-colors outline-none focus-visible:ring-2 focus-visible:ring-secundaria-11/60 disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary:
          "h-11 bg-principal-9 px-8 font-semibold text-gray-1 hover:bg-principal-10",
        secondary:
          "gap-2 border border-gray-6 bg-gray-2 p-3 font-semibold text-gray-12 hover:bg-gray-3",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Renderiza o filho como raiz (ex.: um <Link>) preservando o estilo. */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        // `type` só faz sentido em <button>; ao usar asChild o filho define o seu.
        type={asChild ? undefined : (type ?? "button")}
        className={cn(buttonVariants({ variant }), className)}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
