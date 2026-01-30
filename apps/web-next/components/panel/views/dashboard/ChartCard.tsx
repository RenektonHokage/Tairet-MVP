import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui";

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Leyenda del chart (opcional) */
  legend?: React.ReactNode;
}

export function ChartCard({ title, subtitle, children, legend }: ChartCardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chart placeholder / real chart */}
        <div className="min-h-[180px]">{children}</div>
        {/* Legend */}
        {legend && <div className="flex flex-wrap gap-4 text-xs">{legend}</div>}
      </CardContent>
    </Card>
  );
}

/** Helper para crear leyenda con colores */
export interface LegendItemProps {
  color: string;
  label: string;
}

export function LegendItem({ color, label }: LegendItemProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-neutral-600">{label}</span>
    </div>
  );
}
