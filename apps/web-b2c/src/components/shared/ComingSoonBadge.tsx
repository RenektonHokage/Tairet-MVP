import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ComingSoonBadgeProps {
  children?: ReactNode;
  className?: string;
  staticVisual?: boolean;
}

export default function ComingSoonBadge({
  children = "Próximamente",
  className,
  staticVisual = true,
}: ComingSoonBadgeProps) {
  const staticClasses = staticVisual
    ? "hover:bg-white hover:text-amber-900 hover:border-amber-200 active:bg-white active:text-amber-900 dark:hover:bg-amber-100/10 dark:hover:text-amber-100 dark:hover:border-amber-300/40 dark:active:bg-amber-100/10 dark:active:text-amber-100"
    : "";

  return (
    <Badge
      variant="secondary"
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-semibold leading-none text-amber-900 shadow-sm dark:border-amber-300/40 dark:bg-amber-100/10 dark:text-amber-100",
        staticClasses,
        className,
      )}
    >
      {children}
    </Badge>
  );
}
