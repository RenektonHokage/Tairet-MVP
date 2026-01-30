"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type TooltipProps,
} from "recharts";
import { ChartContainer } from "./ChartContainer";

export interface LineChartDataPoint {
  /** Label del eje X (ej: "Lun", "Mar") */
  label: string;
  /** Valor numérico */
  value: number;
}

export interface LineChartSimpleProps {
  data: LineChartDataPoint[];
  /** Color de la línea (hex o tailwind color) */
  color?: string;
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
  const value = payload[0]?.value ?? 0;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-neutral-600">{label}</p>
      <p className="text-sm font-semibold text-neutral-900">
        {formatter ? formatter(value) : value}
      </p>
    </div>
  );
}

export function LineChartSimple({
  data,
  color = "#8b5cf6",
  showGrid = true,
  showYAxis = false,
  height = 180,
  loading = false,
  valueFormatter,
  className,
}: LineChartSimpleProps) {
  const isEmpty = !data || data.length === 0;

  return (
    <ChartContainer
      minHeight={height}
      loading={loading}
      empty={isEmpty}
      emptyMessage="Sin datos de visitas"
      className={className}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
          )}
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#a3a3a3" }}
            dy={8}
          />
          {showYAxis && (
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              width={40}
            />
          )}
          <Tooltip
            content={<CustomTooltip formatter={valueFormatter} />}
            cursor={{ stroke: "#d4d4d4", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
