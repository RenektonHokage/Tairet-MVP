import * as React from "react";

import { cn, panelUi } from "./panel-ui";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(panelUi.emptyWrap, className)}>
      {icon ? (
        <div className={cn(panelUi.accentBgSoft, "rounded-full p-2")}>{icon}</div>
      ) : null}
      <div className="text-base font-semibold text-neutral-900">{title}</div>
      {description ? <p className={panelUi.mutedText}>{description}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center">{action}</div> : null}
    </div>
  );
}
