"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
import { getPanelDemoClubActivity } from "@/lib/panel-demo/activity";
import { getPanelDemoMetricsSummaryWithSeries } from "@/lib/panel-demo/dashboard";
import { getPanelDemoClubBreakdown } from "@/lib/panel-demo/metricsBreakdown";
import {
  getPanelDemoNow,
  getPanelDemoPreviousRange,
  getPanelDemoRange,
} from "@/lib/panel-demo/time";
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
  type TooltipProps,
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

const getLivePeriodDates = (period: Period): { from: string; to: string } => {
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
  positive: "text-[#15803d]",
  negative: "text-[#b91c1c]",
  neutral: "text-[#2563eb]",
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

const deltaComparisonTooltip =
  "Período anterior = el período inmediatamente anterior de la misma duración (7 días vs 7 anteriores, 30 días vs 30 anteriores). El porcentaje muestra la variación relativa: (actual - anterior) / anterior.";

const deltaNoDataTooltip =
  "Período anterior = el período inmediatamente anterior de la misma duración. Si no hay datos previos suficientes, no se calcula la variación porcentual.";

const renderDelta = (current: number, previous?: number | null) => {
  const result = formatDelta(current, previous);
  const tooltipText = previous == null || previous <= 0 ? deltaNoDataTooltip : deltaComparisonTooltip;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={deltaToneClass[result.tone]}>{result.text}</span>
      <InfoTip text={tooltipText} className="shrink-0" />
    </span>
  );
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
 * Formatea un bucket que puede venir como "YYYY-MM-DD" o ISO string.
 * - day: dd/MM
 * - week: Sem dd/MM
 */
function formatBucketLabel(bucket: string, mode: "day" | "week"): string {
  const normalizedBucket = bucket.includes("T") ? bucket : `${bucket}T00:00:00Z`;
  const date = new Date(normalizedBucket);

  if (Number.isNaN(date.getTime())) {
    return bucket;
  }

  const weekdayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  if (mode === "day") {
    return weekdayLabels[date.getUTCDay()] ?? bucket;
  }

  const day = date.getUTCDate().toString().padStart(2, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  return `Sem ${day}/${month}`;
}

const iconWrap = (icon: ReactNode, tone: "accent" | "blue" | "emerald") => {
  const styles = "border border-neutral-200 bg-neutral-50 text-neutral-700";
  const iconColor = tone === "emerald" ? "text-[#22C55E]" : "text-[#374151]";
  const renderedIcon =
    isValidElement<{ className?: string }>(icon)
      ? cloneElement(icon, {
          className: cn(icon.props.className, iconColor),
        })
      : icon;

  return (
    <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", styles)}>
      {renderedIcon}
    </span>
  );
};

const ticketColorPalette = [
  "#2563eb",
  "#0f766e",
  "#7c3aed",
  "#b45309",
  "#15803d",
  "#475569",
];

const ticketColorMap: Record<string, string> = {
  general: "#2563eb",
  vip: "#0f766e",
  "free pass": "#0f766e",
  backstage: "#7c3aed",
};

function hashColorKey(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 2147483647;
  }
  return Math.abs(hash);
}

function getTicketColor(key: string) {
  const normalizedKey = key.trim().toLowerCase();
  if (ticketColorMap[normalizedKey]) {
    return ticketColorMap[normalizedKey];
  }
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

function TrendTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: TooltipProps<number, string> & { valueFormatter?: (value: number) => string }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-neutral-600">{label}</p>
      <div className="mt-2 space-y-1.5">
        {payload.map((entry, index) => {
          const rawValue = typeof entry.value === "number" ? entry.value : Number(entry.value ?? 0);
          const formattedValue = valueFormatter ? valueFormatter(rawValue) : formatNumber(rawValue);

          return (
            <div key={`${entry.dataKey ?? entry.name ?? "series"}-${index}`} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: entry.color ?? "#737373" }}
                />
                <span style={{ color: typeof entry.color === "string" ? entry.color : "#404040" }}>
                  {entry.name ?? entry.dataKey}
                </span>
              </span>
              <span className="text-sm font-semibold text-neutral-900">{formattedValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MultiLineChart({ data, series, height = 200 }: MultiLineChartProps) {
  const showDots = data.length <= 8;

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="var(--panel-chart-grid)" vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "var(--panel-chart-axis)" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "var(--panel-chart-axis)" }}
          />
          <Tooltip
            cursor={{ stroke: "var(--panel-chart-cursor)", strokeWidth: 1.5 }}
            content={<TrendTooltip />}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value, entry) => (
              <span
                style={{
                  color: typeof entry.color === "string" ? entry.color : "#525252",
                }}
              >
                {value}
              </span>
            )}
          />
          {series.map((item) => (
            <Line
              key={item.key}
              type="linear"
              dataKey={item.key}
              name={item.name}
              stroke={item.color}
              strokeWidth={2.5}
              isAnimationActive={false}
              dot={
                showDots
                  ? { r: 2.5, fill: item.color, stroke: "#ffffff", strokeWidth: 1 }
                  : false
              }
              activeDot={{ r: 5, fill: item.color, stroke: "#ffffff", strokeWidth: 1.5 }}
              legendType="plainline"
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
          <CardContent className="flex min-h-[112px] flex-col justify-between gap-3 px-4 py-4 md:px-5 md:py-5">
            <div className="space-y-1.5">
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {item.label}
              </div>
              <div className="text-3xl font-semibold leading-tight text-neutral-950">
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

function formatTime(isoString: string, nowReference?: Date): string {
  try {
    const date = new Date(isoString);
    const now = nowReference ?? new Date();
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
  const {
    data: context,
    loading: contextLoading,
    error: contextError,
    isDemo,
    demoScenario,
  } = usePanelContext();
  const [period, setPeriod] = useState<Period>("30d");
  const [trendMode, setTrendMode] = useState<TrendMode>("entries");
  const [metrics, setMetrics] = useState<MetricsSummaryWithSeries | null>(null);
  const [metricsPrev, setMetricsPrev] = useState<MetricsSummaryWithSeries | null>(null);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [breakdown, setBreakdown] = useState<ClubBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchKeyRef = useRef<string | null>(null);
  const isDemoClubMetrics =
    isDemo && demoScenario === "discoteca" && context?.local.type === "club";
  const activityNowReference = useMemo(
    () => (isDemoClubMetrics ? getPanelDemoNow("discoteca") : undefined),
    [isDemoClubMetrics]
  );

  useEffect(() => {
    if (contextLoading || !context) return;
    if (context.local.type !== "club") return;

    const range = isDemoClubMetrics
      ? getPanelDemoRange("discoteca", period)
      : getLivePeriodDates(period);
    const prevRange = isDemoClubMetrics
      ? getPanelDemoPreviousRange("discoteca", period)
      : getPreviousRange(range);
    const modeKey = isDemoClubMetrics ? "demo-club" : "live";
    const fetchKey = `${modeKey}-${period}-${range.from}-${range.to}`;
    if (fetchKeyRef.current === fetchKey) return;
    fetchKeyRef.current = fetchKey;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [currentResult, prevResult, activityResult, breakdownResult] =
          await Promise.allSettled([
            isDemoClubMetrics
              ? getPanelDemoMetricsSummaryWithSeries("discoteca", range)
              : getPanelMetricsSummaryWithSeries(range),
            prevRange
              ? isDemoClubMetrics
                ? getPanelDemoMetricsSummaryWithSeries("discoteca", prevRange)
                : getPanelMetricsSummaryWithSeries(prevRange)
              : Promise.resolve(null),
            isDemoClubMetrics ? getPanelDemoClubActivity(period) : getPanelActivity(),
            isDemoClubMetrics ? getPanelDemoClubBreakdown(period) : getClubBreakdown(period),
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
  }, [contextLoading, context, isDemoClubMetrics, period]);

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
            <div key={i} className="h-[112px] rounded-2xl bg-neutral-200/70 animate-pulse" />
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
      icon: iconWrap(<Eye className="h-5 w-5" />, "blue"),
    },
    {
      label: "Clicks a WhatsApp",
      value: formatNumber(metrics?.kpis.whatsapp_clicks ?? 0),
      hint: renderDelta(metrics?.kpis.whatsapp_clicks ?? 0, metricsPrev?.kpis.whatsapp_clicks),
      icon: iconWrap(<MessageCircle className="h-5 w-5" />, "blue"),
    },
    {
      label: "Promociones vistas",
      value: formatNumber(metrics?.kpis.promo_open_count ?? 0),
      hint: renderDelta(metrics?.kpis.promo_open_count ?? 0, metricsPrev?.kpis.promo_open_count),
      icon: iconWrap(<Sparkles className="h-5 w-5" />, "blue"),
    },
    {
      label: "Promo destacada",
      value: metrics?.kpis.top_promo?.title ?? "Sin datos",
      hint: undefined,
      icon: iconWrap(<Star className="h-5 w-5" />, "blue"),
    },
    {
      label: (
        <span className="inline-flex items-center gap-1">
          Compras
          <InfoTip text="Cuenta la cantidad de compras realizadas. Una compra puede incluir varias entradas (ej.: 1 compra = 10 entradas)." />
        </span>
      ),
      value: formatNumber(metrics?.kpis.orders_total ?? 0),
      hint: renderDelta(metrics?.kpis.orders_total ?? 0, metricsPrev?.kpis.orders_total),
      icon: iconWrap(<ClipboardList className="h-5 w-5" />, "blue"),
    },
    {
      label: "Entradas vendidas",
      value: formatNumber(currentTicketsSold),
      hint: renderDelta(currentTicketsSold, prevTicketsSold),
      icon: iconWrap(<Ticket className="h-5 w-5" />, "blue"),
    },
    {
      label: "Entradas usadas",
      value: formatNumber(currentTicketsUsed),
      hint: renderDelta(currentTicketsUsed, prevTicketsUsed),
      icon: iconWrap(<CheckCircle2 className="h-5 w-5" />, "emerald"),
    },
    {
      label: "Ingresos pagados (PYG)",
      value: formatCurrency(currentRevenuePaid),
      hint: renderDelta(currentRevenuePaid, prevRevenuePaid),
      icon: iconWrap(<DollarSign className="h-5 w-5" />, "emerald"),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2563eb]/10 text-[#2563eb]">
            <Ticket className="h-5 w-5 text-[#374151]" />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className={panelUi.pageTitle}>Discotecas</h1>
            <p className={panelUi.pageSubtitle}>Analítica del club y rendimiento de entradas</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 p-1">
          {(Object.keys(periodLabels) as Period[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  value === period
                    ? "bg-neutral-100 text-neutral-900"
                    : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
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
            <div key={i} className="h-[112px] rounded-2xl bg-neutral-200/70 animate-pulse" />
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
                      <th className="px-4 py-3 text-right">Vendidas</th>
                      <th className="px-4 py-3 text-right">Entradas usadas</th>
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
                      ? "Suma de entradas vendidas en el período."
                      : "Suma de pagos confirmados (PYG) en el período."}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setTrendMode("entries")}
                    className={cn(
                      "rounded-full px-3 py-1 transition-colors",
                      trendMode === "entries"
                        ? "bg-neutral-100 text-neutral-900"
                        : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
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
                          ? "bg-neutral-100 text-neutral-900"
                          : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
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
                <LineChartSimple
                  data={revenueLineData}
                  height={200}
                  color="#15803d"
                  lineType="linear"
                  strokeWidth={2.5}
                  showDots={revenueLineData.length <= 8}
                />
              ) : (
                <div className={panelUi.emptyWrap}>
                  <p className="text-sm text-neutral-500">Aún no hay ingresos</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
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
                      className="h-full border border-neutral-100"
                    >
                      <div className="grid min-h-[156px] gap-4 px-4 py-4 md:px-5 md:py-5">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-neutral-900">{table.name}</p>
                            <p className="text-xs text-neutral-500">Precio</p>
                          </div>
                          <p className="text-right text-sm font-semibold text-neutral-900">
                            {table.price != null ? formatCurrency(table.price) : "—"}
                          </p>
                        </div>

                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-neutral-500">Clicks</span>
                            <span className="text-sm font-semibold text-neutral-900">
                              {formatNumber(table.interest_count)}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs text-[#8B5CF6]">Interacciones</p>
                            <div className="mt-1 h-2 w-full rounded-full bg-neutral-100">
                              <div
                                className="h-2 rounded-full bg-[#8B5CF6]"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
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
                  <span className="text-xs text-neutral-400">
                    {formatTime(item.timestamp, activityNowReference)}
                  </span>
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
