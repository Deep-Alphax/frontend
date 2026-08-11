import type { LucideIcon } from "lucide-react";
import { InfoHint } from "@/components/ui/InfoHint";
import { cn } from "@/lib/cn";

interface KpiItemProps {
  icon: LucideIcon;
  label: string;
  info: string;
  hint: string;
  value: React.ReactNode;
  /** "stacked" = valor grande abaixo (linha 1); "inline" = valor à direita (linha 2). */
  layout?: "stacked" | "inline";
  valueClassName?: string;
}

export function KpiItem({
  icon: Icon,
  label,
  info,
  hint,
  value,
  layout = "stacked",
  valueClassName,
}: KpiItemProps) {
  const header = (
    <div className="flex items-center gap-2 text-gray-12">
      <Icon className="size-5 text-gray-11" strokeWidth={1.5} />
      <span className="text-base">{label}</span>
      <InfoHint text={info} />
    </div>
  );

  if (layout === "inline") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          {header}
          <span className={cn("text-2xl font-semibold text-gray-12", valueClassName)}>
            {value}
          </span>
        </div>
        <p className="text-sm text-gray-11">{hint}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {header}
      <p className={cn("text-[28px] font-semibold leading-none text-gray-12", valueClassName)}>
        {value}
      </p>
      <p className="text-sm text-gray-11">{hint}</p>
    </div>
  );
}
