"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/cn";

/*
 * Select (dropdown) do Deep Alpha — mesma API/anatomia do shadcn/ui, sobre o
 * Radix Select: gatilho + painel em portal, com teclado, typeahead, rolagem e
 * ARIA de listbox prontos. O estilo usa os tokens do DS (gray/principal), não
 * as classes do shadcn.
 *
 *   <Select value={v} onValueChange={setV}>
 *     <SelectTrigger><SelectValue placeholder="Escolha…" /></SelectTrigger>
 *     <SelectContent>
 *       <SelectItem value="a">Opção A</SelectItem>
 *     </SelectContent>
 *   </Select>
 */

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

/** Gatilho. `size="sm"` (36px) para raias/barras densas; padrão 40px. */
export function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & { size?: "sm" | "default" }) {
  return (
    <SelectPrimitive.Trigger
      data-size={size}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg border border-gray-6 bg-gray-2 px-3 text-sm text-gray-12 outline-none transition-colors",
        "hover:border-gray-8 focus-visible:border-secundaria-11/60 focus-visible:ring-2 focus-visible:ring-secundaria-11/40",
        "data-[placeholder]:text-gray-11 disabled:cursor-not-allowed disabled:opacity-60",
        "[&>span]:min-w-0 [&>span]:truncate",
        size === "sm" ? "h-9" : "h-10",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown
          className="size-4 shrink-0 text-gray-11 transition-transform duration-quick"
          strokeWidth={1.75}
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

/** Painel de opções (portal). `position="popper"` casa a largura do gatilho. */
export function SelectContent({
  className,
  children,
  position = "popper",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        sideOffset={sideOffset}
        className={cn(
          "relative z-50 max-h-[var(--radix-select-content-available-height)] min-w-[8rem] overflow-hidden rounded-lg border border-gray-6 bg-gray-2 shadow-lg shadow-gray-1/60",
          "origin-[var(--radix-select-content-transform-origin)]",
          "data-[state=open]:animate-popover-in data-[state=closed]:animate-popover-out",
          position === "popper" && "w-[var(--radix-select-trigger-width)]",
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

/** Rótulo de um grupo de opções. */
export function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn("px-2 py-1.5 text-xs font-medium text-gray-10", className)}
      {...props}
    />
  );
}

/** Opção. O "check" da seleção fica à direita, como no shadcn. */
export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-md py-1.5 pl-2 pr-8 text-sm text-gray-11 outline-none transition-colors",
        "data-[highlighted]:bg-gray-4 data-[highlighted]:text-gray-12",
        "data-[state=checked]:text-gray-12",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4 text-principal-9" strokeWidth={2.5} />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

/** Separador entre grupos. */
export function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-gray-6", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton() {
  return (
    <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1 text-gray-11">
      <ChevronUp className="size-4" strokeWidth={1.75} />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton() {
  return (
    <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1 text-gray-11">
      <ChevronDown className="size-4" strokeWidth={1.75} />
    </SelectPrimitive.ScrollDownButton>
  );
}
