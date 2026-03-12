"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type TooltipProps,
} from "recharts";
import { ChartContainer } from "./ChartContainer";

export interface BarChartSeries {
  /** Key del data point */
  dataKey: string;
  /** Nombre para leyenda/tooltip */
  name: string;
  /** Color de las barras */
  color: string;
}

export interface BarChartGroupedProps<T extends Record<string, unknown>> {
  /** Array de datos, cada item debe tener `label` + keys de las series */
  data: T[];
  /** Definición de las series a mostrar */
  series: BarChartSeries[];
  /** Key del label en el eje X */
  labelKey?: string;
  /** Mostrar grid */
  showGrid?: boolean;
  /** Mostrar eje Y */
  showYAxis?: boolean;
  /** Altura del chart */
  height?: number;
  /** Estado de carga */
  loading?: boolean;
  /** Formato del tooltip value */
  valueFormatter?: (value: number) => string;
  className?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  formatter,
}: TooltipProps<number, string> & { formatter?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-medium" style={{ color: "var(--panel-chart-tooltip-muted)" }}>
        {label}
      </p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span style={{ color: "var(--panel-chart-tooltip-muted)" }}>{entry.name}:</span>
          <span className="font-semibold" style={{ color: "var(--panel-chart-tooltip-text)" }}>
            {formatter ? formatter(entry.value ?? 0) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BarChartGrouped<T extends Record<string, unknown>>({
  data,
  series,
  labelKey = "label",
  showGrid = true,
  showYAxis = false,
  height = 180,
  loading = false,
  valueFormatter,
  className,
}: BarChartGroupedProps<T>) {
  const isEmpty = !data || data.length === 0;

  return (
    <ChartContainer
      minHeight={height}
      loading={loading}
      empty={isEmpty}
      emptyMessage="Sin datos para mostrar"
      className={className}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          barCategoryGap="20%"
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--panel-chart-grid)"
              vertical={false}
            />
          )}
          <XAxis
            dataKey={labelKey}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--panel-chart-axis)" }}
            dy={8}
          />
          {showYAxis && (
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--panel-chart-axis)" }}
              width={40}
            />
          )}
          <Tooltip
            content={<CustomTooltip formatter={valueFormatter} />}
            cursor={{ fill: "var(--panel-chart-cursor)", fillOpacity: 0.12 }}
          />
          {series.map((s) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.name}
              fill={s.color}
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
