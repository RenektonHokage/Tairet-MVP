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

import { ChartContainer } from "@/components/panel/ui/charts/ChartContainer";

export interface ReservationsTrendPoint {
  label: string;
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
}

interface ReservationsTrendChartProps {
  data: ReservationsTrendPoint[];
  height?: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-neutral-600">{label}</p>
      <div className="mt-1 space-y-1 text-xs">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-neutral-600">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-semibold text-neutral-900">{entry.value ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReservationsTrendChart({
  data,
  height = 260,
}: ReservationsTrendChartProps) {
  return (
    <ChartContainer minHeight={height}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#a3a3a3" }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#a3a3a3" }}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#d4d4d4", strokeWidth: 1 }} />
          <Line type="monotone" dataKey="total" name="Total Reservations" stroke="#6366f1" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="confirmed" name="Confirmed" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="pending" name="Under Review" stroke="#f59e0b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="cancelled" name="Canceled" stroke="#ef4444" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
