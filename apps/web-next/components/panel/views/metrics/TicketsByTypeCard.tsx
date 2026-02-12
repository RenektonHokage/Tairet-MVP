"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  LineChartSimple,
  type LineChartDataPoint,
  cn,
  panelUi,
} from "@/components/panel/ui";

type TrendMode = "entries" | "revenue";

type TicketItem = {
  ticket_type_id: string | null;
  name: string;
  sold_qty: number;
  used_orders: number;
  revenue: number;
};

type OrdersSeriesItem = { bucket: string; sold: number; used: number };
type RevenueSeriesItem = { bucket: string; value: number };

interface TicketsByTypeCardProps {
  periodLabel: string;
  tickets: TicketItem[];
  entriesSeries: OrdersSeriesItem[];
  revenueSeries: RevenueSeriesItem[];
  bucketMode: "day" | "week";
}

const formatNumber = (value: number) => new Intl.NumberFormat("es-PY").format(value);
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency: "PYG",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

/**
 * Formatea bucket usando UTC para evitar corrimientos de zona horaria.
 * - day: dd/MM
 * - week: Sem dd/MM (weekStart = lunes UTC)
 */
function formatBucketLabel(bucket: string, mode: "day" | "week"): string {
  try {
    const date = new Date(`${bucket}T00:00:00Z`);
    const day = date.getUTCDate().toString().padStart(2, "0");
    const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    return mode === "week" ? `Sem ${day}/${month}` : `${day}/${month}`;
  } catch {
    return bucket;
  }
}

const ticketColorPalette = [
  "#8d1313",
  "#1d4ed8",
  "#16a34a",
  "#f97316",
  "#7c3aed",
  "#0f766e",
  "#b45309",
  "#475569",
];

function hashColorKey(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 2147483647;
  }
  return Math.abs(hash);
}

function getTicketColor(key: string) {
  const idx = hashColorKey(key) % ticketColorPalette.length;
  return ticketColorPalette[idx];
}

export function TicketsByTypeCard({
  periodLabel,
  tickets,
  entriesSeries,
  revenueSeries,
  bucketMode,
}: TicketsByTypeCardProps) {
  const [trendMode, setTrendMode] = useState<TrendMode>("entries");

  const trendData = useMemo(
    () =>
      entriesSeries.map((point) => ({
        label: formatBucketLabel(point.bucket, bucketMode),
        vendidas: point.sold,
        usadas: point.used,
      })),
    [bucketMode, entriesSeries]
  );

  const hasEntriesData = trendData.some((item) => item.vendidas > 0 || item.usadas > 0);
  const entriesLineData: LineChartDataPoint[] = trendData.map((item) => ({
    label: item.label,
    value: item.vendidas,
  }));

  const hasRevenueSeries = revenueSeries.length > 0;
  const hasRevenueData = revenueSeries.some((item) => item.value > 0);
  const revenueLineData: LineChartDataPoint[] = revenueSeries.map((item) => ({
    label: formatBucketLabel(item.bucket, bucketMode),
    value: item.value,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Entradas por tipo</CardTitle>
            <p className={panelUi.pageSubtitle}>Últimos {periodLabel}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {tickets.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-neutral-100">
            <table className="min-w-full">
              <thead className={panelUi.tableHead}>
                <tr>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-right">Vendidas (qty)</th>
                  <th className="px-4 py-3 text-right">Entradas con check-in</th>
                  <th className="px-4 py-3 text-right">Ingresos (PYG)</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket, index) => {
                  const label = ticket.ticket_type_id
                    ? ticket.name
                    : `${ticket.name} (legacy)`;
                  const colorKey = ticket.ticket_type_id ?? ticket.name ?? "legacy";
                  const dotColor = getTicketColor(colorKey);
                  return (
                    <tr
                      key={`${ticket.ticket_type_id ?? "legacy"}-${index}`}
                      className={panelUi.tableRow}
                    >
                      <td className={panelUi.tableCell}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: dotColor }}
                          />
                          <span className="font-medium text-neutral-900">{label}</span>
                        </span>
                      </td>
                      <td className={cn(panelUi.tableCell, "text-right")}>
                        {formatNumber(ticket.sold_qty)}
                      </td>
                      <td className={cn(panelUi.tableCell, "text-right text-neutral-600")}>
                        {formatNumber(ticket.used_orders)}
                      </td>
                      <td className={cn(panelUi.tableCell, "text-right font-medium text-neutral-900")}>
                        {formatCurrency(ticket.revenue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={panelUi.emptyWrap}>
            <p className="text-sm text-neutral-500">Aún no hay datos</p>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-neutral-900">Tendencia en el tiempo</h4>
              <p className="text-xs text-neutral-500">
                {trendMode === "entries"
                  ? "Suma de entradas vendidas (qty) en el período."
                  : "Suma de pagos confirmados (PYG) en el período."}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-neutral-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTrendMode("entries")}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors",
                  trendMode === "entries"
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-900"
                )}
              >
                Entradas
              </button>
              {hasRevenueSeries ? (
                <button
                  type="button"
                  onClick={() => setTrendMode("revenue")}
                  className={cn(
                    "rounded-full px-3 py-1 transition-colors",
                    trendMode === "revenue"
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-900"
                  )}
                >
                  Ingresos
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Requiere serie temporal de ingresos (pendiente)"
                  aria-label="Ingresos - requiere serie temporal de ingresos (pendiente)"
                  className="cursor-not-allowed rounded-full px-3 py-1 text-neutral-400"
                >
                  Ingresos
                </button>
              )}
            </div>
          </div>

          {trendMode === "entries" ? (
            hasEntriesData ? (
              <LineChartSimple data={entriesLineData} height={200} color="#8d1313" />
            ) : (
              <div className={panelUi.emptyWrap}>
                <p className="text-sm text-neutral-500">Aún no hay datos</p>
              </div>
            )
          ) : hasRevenueData ? (
            <LineChartSimple data={revenueLineData} height={200} color="#16a34a" />
          ) : (
            <div className={panelUi.emptyWrap}>
              <p className="text-sm text-neutral-500">Aún no hay ingresos</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
