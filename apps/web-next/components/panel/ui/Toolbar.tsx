import * as React from "react";

import { cn, panelUi } from "./panel-ui";

export interface ToolbarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export function Toolbar({ left, right, className }: ToolbarProps) {
  return (
    <div className={cn(panelUi.toolbar, "lg:items-end", className)}>
      {left}
      {right}
    </div>
  );
}
