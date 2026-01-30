import * as React from "react";
import { BarChart3, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui";
import { RangeToggle, type RangeValue } from "./RangeToggle";

export interface SummaryMetric {
  label: string;
  value: string | number;
  /** Color del valor: default, success, danger */
  color?: "default" | "success" | "danger";
  /** Texto pequeño debajo del valor (ej: "Solo confirmadas") */
  hint?: string;
  /** Tooltip de info que aparece al lado del label */
  tooltip?: string;
}

export interface SummaryCardProps {
  title?: string;
  range: RangeValue;
  onRangeChange?: (value: RangeValue) => void;
  metrics: SummaryMetric[];
  /** Si false, muestra el rango como label en vez de toggle (default: true si hay onRangeChange) */
  showToggle?: boolean;
}

const colorMap = {
  default: "text-neutral-950",
  success: "text-emerald-600",
  danger: "text-rose-600",
};

export function SummaryCard({
  title = "Resumen",
  range,
  onRangeChange,
  metrics,
  showToggle = true,
}: SummaryCardProps) {
  const rangeLabel = range === "7d" ? "Últimos 7 días" : "Últimos 30 días";

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-neutral-500" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        {showToggle && onRangeChange ? (
          <RangeToggle value={range} onChange={onRangeChange} />
        ) : (
          <span className="text-xs text-neutral-500">{rangeLabel}</span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.map((metric, index) => (
          <div key={index} className="space-y-0.5">
            <div className="flex items-center gap-1 text-xs text-neutral-500">
              <span>{metric.label}</span>
              {metric.tooltip && (
                <span
                  tabIndex={0}
                  role="button"
                  aria-label={metric.tooltip}
                  title={metric.tooltip}
                  className="inline-flex cursor-help rounded-full focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-1"
                >
                  <Info className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-600" />
                </span>
              )}
            </div>
            <div
              className={`text-2xl font-bold ${colorMap[metric.color ?? "default"]}`}
            >
              {metric.value}
            </div>
            {metric.hint && (
              <div className="text-xs text-neutral-400">{metric.hint}</div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
