import * as React from "react";

import { cn, panelUi } from "./panel-ui";

export type BadgeVariant = "neutral" | "success" | "warn" | "danger";

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: panelUi.badgeNeutral,
  success: panelUi.badgeSuccess,
  warn: panelUi.badgeWarn,
  danger: panelUi.badgeDanger,
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(panelUi.badgeBase, badgeVariants[variant], className)}
      {...props}
    />
  );
}
