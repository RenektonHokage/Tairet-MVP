"use client";

import * as React from "react";
import { cn, panelUi } from "../panel-ui";

export interface ChartContainerProps {
  /** Altura mínima del contenedor */
  minHeight?: number;
  /** Estado de carga */
  loading?: boolean;
  /** Sin datos - muestra empty state */
  empty?: boolean;
  /** Mensaje para empty state */
  emptyMessage?: string;
  children: React.ReactNode;
  className?: string;
}

export function ChartContainer({
  minHeight = 200,
  loading = false,
  empty = false,
  emptyMessage = "Sin datos disponibles",
  children,
  className,
}: ChartContainerProps) {
  if (loading) {
    return (
      <div
        className={cn("flex items-center justify-center", className)}
        style={{ minHeight }}
      >
        <div className="flex flex-col items-center gap-2">
          <div className={cn(panelUi.skeleton, "h-8 w-8 rounded-full")} />
          <div className={cn(panelUi.skeleton, "h-3 w-24")} />
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50/50",
          className
        )}
        style={{ minHeight }}
      >
        <p className="text-sm text-neutral-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)} style={{ minHeight }}>
      {children}
    </div>
  );
}
