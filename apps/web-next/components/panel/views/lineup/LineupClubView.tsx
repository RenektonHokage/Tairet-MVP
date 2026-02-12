"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Eye,
  MessageCircle,
  Sparkles,
  Star,
  Ticket,
  Megaphone,
  CalendarDays,
  RefreshCw,
} from "lucide-react";

import { usePanelContext } from "@/lib/panelContext";
import {
  getPanelMetricsSummaryWithSeries,
  type MetricsSummaryWithSeries,
} from "@/lib/metrics";
import { getPanelActivity, type ActivityResponse, type ActivityItem } from "@/lib/activity";
import { getClubBreakdown, type ClubBreakdown } from "@/lib/metricsBreakdown";
import { DashboardSandboxView } from "@/components/panel/views/DashboardSandboxView";
import { kpiDeltaPlaceholder } from "./lineupConstants";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  InfoTip,
  LineChartSimple,
  type LineChartDataPoint,
  cn,
  panelUi,
} from "@/components/panel/ui";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface LineupKpiItem {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}

type Period = "7d" | "30d" | "90d";
type TrendMode = "entries" | "revenue";
const periodLabels: Record<Period, string> = {
  "7d": "7 días",
  "30d": "30 días",
  "90d": "90 días",
};

const activityLabels: Record<ActivityItem["type"], string> = {
  order_paid: "Orden pagada",
  order_created: "Orden creada",
  order_used: "Orden usada",
  reservation_created: "Reserva creada",
  reservation_updated: "Reserva actualizada",
  whatsapp_click: "Click a WhatsApp",
  promo_view: "Promo vista",
  profile_view: "Visita al perfil",
};

const activityIcons: Record<ActivityItem["type"], ReactNode> = {
  order_paid: <DollarSign className="h-4 w-4" />,
  order_created: <Ticket className="h-4 w-4" />,
  order_used: <CheckCircle2 className="h-4 w-4" />,
  reservation_created: <CalendarDays className="h-4 w-4" />,
  reservation_updated: <RefreshCw className="h-4 w-4" />,
  whatsapp_click: <MessageCircle className="h-4 w-4" />,
  promo_view: <Megaphone className="h-4 w-4" />,
  profile_view: <Eye className="h-4 w-4" />,
};

const getPeriodDates = (period: Period): { from: string; to: string } => {
  const to = new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
};

const getPreviousRange = (range: { from: string; to: string }) => {
  const fromMs = new Date(range.from).getTime();
  const toMs = new Date(range.to).getTime();
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return null;
  const durationMs = toMs - fromMs;
  if (durationMs <= 0) return null;
  return {
    from: new Date(fromMs - durationMs).toISOString(),
    to: new Date(fromMs).toISOString(),
  };
};

type DeltaTone = "positive" | "negative" | "neutral";

const deltaToneClass: Record<DeltaTone, string> = {
  positive: "text-emerald-600",
  negative: "text-rose-600",
  neutral: "text-neutral-400",
};

const formatDelta = (current: number, previous?: number | null) => {
  if (previous == null || previous <= 0) {
    return { text: "Sin datos previos", tone: "neutral" as const };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const sign = pct > 0 ? "+" : "";
  const tone: DeltaTone = pct > 0 ? "positive" : pct < 0 ? "negative" : "neutral";
  return { text: `${sign}${pct}% vs período anterior`, tone };
};

const renderDelta = (current: number, previous?: number | null) => {
  const result = formatDelta(current, previous);
  return <span className={deltaToneClass[result.tone]}>{result.text}</span>;
};

const formatNumber = (value: number) => new Intl.NumberFormat("es-PY").format(value);
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency: "PYG",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

/**
 * Formatea un bucket "YYYY-MM-DD" según el modo (day/week).
 * - day: dd/MM
 * - week: Sem dd/MM (weekStart = lunes UTC)
 */
function formatBucketLabel(bucket: string, mode: "day" | "week"): string {
  try {
    const date = new Date(bucket + "T00:00:00Z");
    const day = date.getUTCDate().toString().padStart(2, "0");
    const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    if (mode === "week") {
      return `Sem ${day}/${month}`;
    }
    return `${day}/${month}`;
  } catch {
    return bucket;
  }
}

const iconWrap = (icon: ReactNode) => (
  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8d1313]/10 text-[#8d1313]">
    {icon}
  </span>
);

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

interface MultiLineSeries {
  key: string;
  name: string;
  color: string;
}

interface MultiLineChartProps {
  data: Array<Record<string, number | string>>;
  series: MultiLineSeries[];
  height?: number;
}

function MultiLineChart({ data, series, height = 200 }: MultiLineChartProps) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {series.map((item) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.name}
              stroke={item.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function LineupKpiGrid({ items }: { items: LineupKpiItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {items.map((item, index) => (
        <Card key={index} className="h-full">
          <CardContent className="flex min-h-[96px] flex-col justify-center gap-3">
            <div className="flex flex-col justify-center gap-1">
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {item.label}
              </div>
              <div className="text-3xl font-semibold leading-none text-neutral-950">
                {item.icon ? (
                  <div className="flex items-center justify-between gap-3">
                    <span>{item.value}</span>
                    {item.icon}
                  </div>
                ) : (
                  item.value
                )}
              </div>
            </div>
            {item.hint ? <div className={panelUi.statHint}>{item.hint}</div> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `hace ${diffMins}m`;
    if (diffHours < 24) return `hace ${diffHours}h`;
    if (diffDays < 7) return `hace ${diffDays}d`;

    return date.toLocaleDateString("es-PY", { day: "2-digit", month: "short" });
  } catch {
    return "—";
  }
}

export function LineupClubView() {
  const { data: context, loading: contextLoading, error: contextError } = usePanelContext();
  const [period, setPeriod] = useState<Period>("30d");
  const [trendMode, setTrendMode] = useState<TrendMode>("entries");
  const [metrics, setMetrics] = useState<MetricsSummaryWithSeries | null>(null);
  const [metricsPrev, setMetricsPrev] = useState<MetricsSummaryWithSeries | null>(null);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [breakdown, setBreakdown] = useState<ClubBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (contextLoading || !context) return;
    if (context.local.type !== "club") return;

    const range = getPeriodDates(period);
    const prevRange = getPreviousRange(range);
    const fetchKey = `${period}-${range.from}-${range.to}`;
    if (fetchKeyRef.current === fetchKey) return;
    fetchKeyRef.current = fetchKey;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [currentResult, prevResult, activityResult, breakdownResult] =
          await Promise.allSettled([
            getPanelMetricsSummaryWithSeries(range),
            prevRange ? getPanelMetricsSummaryWithSeries(prevRange) : Promise.resolve(null),
            getPanelActivity(),
            getClubBreakdown(period),
          ]);

        if (currentResult.status === "fulfilled") {
          setMetrics(currentResult.value);
        } else {
          setError(
            currentResult.reason instanceof Error
              ? currentResult.reason.message
              : "Error al cargar métricas"
          );
        }

        if (prevResult.status === "fulfilled") {
          setMetricsPrev(prevResult.value as MetricsSummaryWithSeries | null);
        } else {
          setMetricsPrev(null);
        }

        if (activityResult.status === "fulfilled") {
          setActivity(activityResult.value);
        } else {
          setActivity(null);
        }

        if (breakdownResult.status === "fulfilled") {
          setBreakdown(breakdownResult.value);
        } else {
          setBreakdown(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [contextLoading, context, period]);

  const activityItems = activity?.items ?? [];

  const bucketMode = metrics?.series?.bucket_mode ?? "day";
  const revenueSeries = metrics?.series?.revenue_paid ?? [];
  const ticketsSoldByTypeSeries = metrics?.series?.tickets_sold_by_type ?? [];
  const ticketTypesMeta = metrics?.series?.ticket_types_meta ?? [];

  const ticketSeriesList = useMemo(
    () =>
      ticketTypesMeta.map((item) => ({
        key: item.key,
        name: item.name,
        color: getTicketColor(item.key),
      })),
    [ticketTypesMeta]
  );

  const ticketSeriesData = useMemo(() => {
    if (ticketsSoldByTypeSeries.length === 0 || ticketSeriesList.length === 0) {
      return [];
    }

    return ticketsSoldByTypeSeries.map((bucket) => {
      const row: Record<string, number | string> = {
        label: formatBucketLabel(bucket.bucket, bucketMode),
      };
      for (const meta of ticketSeriesList) {
        row[meta.key] = bucket.values?.[meta.key] ?? 0;
      }
      return row;
    });
  }, [bucketMode, ticketSeriesList, ticketsSoldByTypeSeries]);

  const hasEntriesData =
    ticketSeriesList.length > 0 &&
    ticketSeriesData.some((row) =>
      ticketSeriesList.some((serie) => Number(row[serie.key] ?? 0) > 0)
    );

  const hasRevenueSeries = revenueSeries.length > 0;
  const hasRevenueData = revenueSeries.some((item) => item.value > 0);
  const revenueLineData: LineChartDataPoint[] = revenueSeries.map((item) => ({
    label: formatBucketLabel(item.bucket, bucketMode),
    value: item.value,
  }));

  if (contextLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-neutral-200/70 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-[96px] rounded-2xl bg-neutral-200/70 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (contextError || !context) {
    return (
      <div className={panelUi.emptyWrap}>
        <p className="text-sm text-neutral-600">
          {contextError || "No se pudo cargar la información del panel."}
        </p>
      </div>
    );
  }

  if (context.local.type !== "club") {
    return <DashboardSandboxView />;
  }

  const ticketsByType = breakdown?.tickets_top ?? [];
  const tablesInterest = breakdown?.tables_interest_top ?? [];
  const maxInterest = Math.max(0, ...tablesInterest.map((item) => item.interest_count ?? 0));

  const deltaPlaceholder = kpiDeltaPlaceholder;
  const currentTicketsSold =
    metrics?.kpis_range?.tickets_sold ?? metrics?.kpis.tickets_sold ?? 0;
  const currentTicketsUsed =
    metrics?.kpis_range?.tickets_used ?? metrics?.kpis.tickets_used ?? 0;
  const currentRevenuePaid =
    metrics?.kpis_range?.revenue_paid ?? metrics?.kpis.revenue_paid ?? 0;
  const prevTicketsSold =
    metricsPrev?.kpis_range?.tickets_sold ?? metricsPrev?.kpis.tickets_sold;
  const prevTicketsUsed =
    metricsPrev?.kpis_range?.tickets_used ?? metricsPrev?.kpis.tickets_used;
  const prevRevenuePaid =
    metricsPrev?.kpis_range?.revenue_paid ?? metricsPrev?.kpis.revenue_paid;

  const kpiItems: LineupKpiItem[] = [
    {
      label: "Visitas al perfil",
      value: formatNumber(metrics?.kpis.profile_views ?? 0),
      hint: renderDelta(metrics?.kpis.profile_views ?? 0, metricsPrev?.kpis.profile_views),
      icon: iconWrap(<Eye className="h-5 w-5" />),
    },
    {
      label: "Clicks a WhatsApp",
      value: formatNumber(metrics?.kpis.whatsapp_clicks ?? 0),
      hint: renderDelta(metrics?.kpis.whatsapp_clicks ?? 0, metricsPrev?.kpis.whatsapp_clicks),
      icon: iconWrap(<MessageCircle className="h-5 w-5" />),
    },
    {
      label: "Promociones vistas",
      value: formatNumber(metrics?.kpis.promo_open_count ?? 0),
      hint: renderDelta(metrics?.kpis.promo_open_count ?? 0, metricsPrev?.kpis.promo_open_count),
      icon: iconWrap(<Sparkles className="h-5 w-5" />),
    },
    {
      label: "Promo destacada",
      value: metrics?.kpis.top_promo?.title ?? "Sin datos",
      hint: undefined,
      icon: iconWrap(<Star className="h-5 w-5" />),
    },
    {
      label: (
        <span className="inline-flex items-center gap-1">
          Entradas totales
          <InfoTip text="Cuenta entradas, no suma quantity (qty)." />
        </span>
      ),
      value: formatNumber(metrics?.kpis.orders_total ?? 0),
      hint: renderDelta(metrics?.kpis.orders_total ?? 0, metricsPrev?.kpis.orders_total),
      icon: iconWrap(<ClipboardList className="h-5 w-5" />),
    },
    {
      label: "Entradas vendidas",
      value: formatNumber(currentTicketsSold),
      hint: renderDelta(currentTicketsSold, prevTicketsSold),
      icon: iconWrap(<Ticket className="h-5 w-5" />),
    },
    {
      label: "Entradas usadas",
      value: formatNumber(currentTicketsUsed),
      hint: renderDelta(currentTicketsUsed, prevTicketsUsed),
      icon: iconWrap(<CheckCircle2 className="h-5 w-5" />),
    },
    {
      label: "Ingresos pagados (PYG)",
      value: formatCurrency(currentRevenuePaid),
      hint: renderDelta(currentRevenuePaid, prevRevenuePaid),
      icon: iconWrap(<DollarSign className="h-5 w-5" />),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Ticket className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className={panelUi.pageTitle}>Discotecas</h1>
            <p className={panelUi.pageSubtitle}>Analítica del club y rendimiento de entradas</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-neutral-100 p-1">
          {(Object.keys(periodLabels) as Period[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                value === period
                  ? "bg-[#8d1313] text-white"
                  : "text-neutral-600 hover:text-neutral-900"
              )}
            >
              {periodLabels[value]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[96px] rounded-2xl bg-neutral-200/70 animate-pulse" />
          ))}
        </div>
      ) : (
        <LineupKpiGrid items={kpiItems} />
      )}

      {error ? (
        <div className={panelUi.emptyWrap}>
          <p className="text-sm text-neutral-600">{error}</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Entradas por tipo</CardTitle>
                <p className={panelUi.pageSubtitle}>Últimos {periodLabels[period]}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {ticketsByType.length > 0 ? (
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
                    {ticketsByType.map((ticket, index) => {
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
                          <td
                            className={cn(
                              panelUi.tableCell,
                              "text-right font-medium text-neutral-900"
                            )}
                          >
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
                  <MultiLineChart data={ticketSeriesData} series={ticketSeriesList} height={200} />
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

        <Card>
          <CardHeader>
            <CardTitle>Mesas con más interés</CardTitle>
            <p className={panelUi.pageSubtitle}>Clicks / Interacciones</p>
          </CardHeader>
          <CardContent>
            {tablesInterest.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {tablesInterest.map((table, index) => {
                  const percent = maxInterest > 0 ? (table.interest_count / maxInterest) * 100 : 0;
                  return (
                    <Card
                      key={`${table.table_type_id ?? "table"}-${index}`}
                      className="border border-neutral-100"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700">
                              {index + 1}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-neutral-900">{table.name}</p>
                              <p className="text-xs text-neutral-500">Precio</p>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-neutral-900">
                            {table.price != null ? formatCurrency(table.price) : "—"}
                          </p>
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-xs text-neutral-500">
                            <span>Clicks</span>
                            <span className="font-medium text-neutral-800">
                              {formatNumber(table.interest_count)}
                            </span>
                          </div>
                          <div>
                            <p className="text-[11px] text-neutral-400">Interacciones</p>
                            <div className="mt-1 h-2 w-full rounded-full bg-neutral-100">
                              <div
                                className="h-2 rounded-full bg-[#8d1313]"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className={panelUi.emptyWrap}>
                <p className="text-sm text-neutral-500">Aún no hay datos</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent>
          {activityItems.length > 0 ? (
            <div className="space-y-4">
              {activityItems.map((item, index) => (
                <div
                  key={`${item.type}-${item.timestamp}-${index}`}
                  className="flex items-center gap-3 border-b border-neutral-100 pb-4 last:border-0 last:pb-0"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                    {activityIcons[item.type]}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-neutral-900">{item.label}</p>
                    <p className="text-xs text-neutral-500">
                      {activityLabels[item.type] ?? item.type}
                    </p>
                  </div>
                  <span className="text-xs text-neutral-400">{formatTime(item.timestamp)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={panelUi.emptyWrap}>
              <p className="text-sm text-neutral-500">Aún no hay actividad</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
