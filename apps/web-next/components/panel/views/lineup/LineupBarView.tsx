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
  Eye,
  MessageCircle,
  Megaphone,
  Star,
  CalendarCheck,
  Clock,
  XCircle,
  CalendarDays,
  RefreshCw,
  Ticket,
  DollarSign,
} from "lucide-react";

import { usePanelContext } from "@/lib/panelContext";
import {
  getPanelMetricsSummaryWithSeries,
  type MetricsSummaryWithSeries,
  type ReservationStatusBucket,
  type ReservationStatusHourDayKey,
  type ReservationStatusHourMeta,
  type ReservationStatusHourRow,
} from "@/lib/metrics";
import { getPanelActivity, type ActivityItem, type ActivityResponse } from "@/lib/activity";
import { getPanelDemoBarActivity } from "@/lib/panel-demo/activity";
import { getPanelDemoMetricsSummaryWithSeries } from "@/lib/panel-demo/dashboard";
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
  cn,
  panelUi,
  panelSuccessTone,
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

type Period = "7d" | "30d" | "90d";
type BarAnalyticsMode = "day" | "hour";

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
  positive: panelSuccessTone.textClass,
  negative: "text-[#b91c1c]",
  neutral: "text-neutral-500",
};

const isNoDataValue = (value: ReactNode) =>
  typeof value === "string" && /(sin datos|aún no hay datos|no hay datos)/i.test(value);

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

const iconWrap = (icon: ReactNode, tone: "neutral" | "blue" | "amber" | "emerald" | "rose") => {
  const styles = "border border-neutral-200 bg-neutral-50 text-neutral-700";
  const iconColor =
    tone === "emerald"
      ? panelSuccessTone.textClass
      : tone === "amber"
      ? "text-[#FACC15]"
      : tone === "rose"
      ? "text-[#EF4444]"
      : "text-[#374151]";
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

interface BarKpiItem {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}

const reservationDayLabels: Record<ReservationStatusHourDayKey, string> = {
  lun: "Lun",
  mar: "Mar",
  mie: "Mié",
  jue: "Jue",
  vie: "Vie",
  sab: "Sáb",
  dom: "Dom",
};

const reservationDayOrder: ReservationStatusHourDayKey[] = [
  "lun",
  "mar",
  "mie",
  "jue",
  "vie",
  "sab",
  "dom",
];

const reservationStatusColorMap = {
  confirmed: "#22C55E",
  pending: "#FACC15",
  cancelled: "#EF4444",
} as const;

const reservationStatusLabelMap = {
  confirmed: "Confirmadas",
  pending: "En revisión",
  cancelled: "Canceladas",
} as const;

type ReservationStatusLineKey = keyof typeof reservationStatusColorMap;

const reservationStatusLineKeys: ReservationStatusLineKey[] = [
  "confirmed",
  "pending",
  "cancelled",
];

function formatOperationalHour(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";

  const normalized = value >= 24 ? 24 : value;
  const totalMinutes = Math.round(normalized * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours >= 24) {
    return "00:00";
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeWeekdayToken(value: string) {
  return value
    .toLowerCase()
    .replace(/\./g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getReservationDayKeyFromBucket(bucket: string): ReservationStatusHourDayKey | null {
  const date = new Date(bucket);
  if (Number.isNaN(date.getTime())) return null;

  const weekday = normalizeWeekdayToken(
    date.toLocaleDateString("es-PY", {
      weekday: "short",
      timeZone: "America/Asuncion",
    })
  );

  switch (weekday) {
    case "lun":
      return "lun";
    case "mar":
      return "mar";
    case "mie":
      return "mie";
    case "jue":
      return "jue";
    case "vie":
      return "vie";
    case "sab":
      return "sab";
    case "dom":
      return "dom";
    default:
      return null;
  }
}

function BarKpiGrid({ items }: { items: BarKpiItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => {
        const isNoData = isNoDataValue(item.value);

        return (
          <Card key={index} className="h-full">
            <CardContent className="flex min-h-[112px] flex-col justify-between gap-3 px-4 py-4 md:px-5 md:py-5">
              <div className="space-y-1.5">
                <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {item.label}
                </div>
                <div
                  className={cn(
                    "leading-tight",
                    isNoData
                      ? "text-lg font-medium text-neutral-500"
                      : "text-3xl font-semibold text-neutral-950"
                  )}
                >
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
        );
      })}
    </div>
  );
}

function ReservationsStatusHourTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-neutral-600">{label}</p>
      <div className="mt-2 space-y-1.5">
        {payload
          .filter((entry) => typeof entry.value === "number" && !Number.isNaN(Number(entry.value)))
          .map((entry, index) => {
            const numericValue = Number(entry.value ?? 0);
            const totalCount =
              entry.payload && typeof entry.payload.total_count === "number"
                ? Number(entry.payload.total_count)
                : 0;
            return (
              <div
                key={`${entry.dataKey ?? entry.name ?? "series"}-${index}`}
                className="flex items-center justify-between gap-4"
              >
                <span className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: entry.color ?? "#737373" }}
                />
                  <span style={{ color: entry.color ?? "#404040" }}>
                    {entry.name ?? entry.dataKey}
                  </span>
                </span>
                <div className="text-right">
                  <div className="text-sm font-semibold text-neutral-900">
                    {formatOperationalHour(numericValue)}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Promedio de {formatNumber(totalCount)} reservas
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function ReservationsStatusHourTrendChart({
  rows,
  meta,
  dayOrder,
  height = 280,
}: {
  rows: ReservationStatusHourRow[];
  meta: ReservationStatusHourMeta;
  dayOrder: ReservationStatusHourDayKey[];
  height?: number;
}) {
  const showDots = dayOrder.length <= 8;
  const rowMap = new Map(rows.map((row) => [row.day_key, row]));
  const chartData = dayOrder.map((dayKey) => {
    const values = rowMap.get(dayKey);
    const weightedEntries = [
      {
        hour: values?.confirmed_hour ?? null,
        count: values?.confirmed_count ?? 0,
      },
      {
        hour: values?.pending_hour ?? null,
        count: values?.pending_count ?? 0,
      },
      {
        hour: values?.cancelled_hour ?? null,
        count: values?.cancelled_count ?? 0,
      },
    ].filter((entry) => entry.hour != null && entry.count > 0);

    const totalCount = weightedEntries.reduce((sum, entry) => sum + entry.count, 0);
    const totalHour =
      totalCount > 0
        ? Number(
            (
              weightedEntries.reduce(
                (sum, entry) => sum + Number(entry.hour ?? 0) * entry.count,
                0
              ) / totalCount
            ).toFixed(2)
          )
        : null;

    const entry: Record<string, string | number | null> = {
      label: reservationDayLabels[dayKey],
      total_hour: totalHour,
      total_count: totalCount,
    };

    return entry;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#2563eb]" />
        <p className="text-xs text-neutral-500">
          <span className="font-medium text-[#2563eb]">Reservas totales</span>{" "}
          muestra la hora promedio operativa total en cada día del período.
        </p>
      </div>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
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
              domain={[meta.window_start_hour, meta.window_end_hour]}
              ticks={[18, 20, 22, 24]}
              tickFormatter={(value) => formatOperationalHour(Number(value))}
            />
            <Tooltip
              cursor={{ stroke: "var(--panel-chart-cursor)", strokeWidth: 1.5 }}
              content={<ReservationsStatusHourTooltip />}
            />
            <Line
              type="linear"
              dataKey="total_hour"
              name="Reservas totales"
              stroke="#2563eb"
              strokeWidth={2.5}
              isAnimationActive={false}
              connectNulls={false}
              dot={
                showDots
                  ? { r: 2.5, fill: "#2563eb", stroke: "#ffffff", strokeWidth: 1 }
                  : false
              }
              activeDot={{ r: 5, fill: "#2563eb", stroke: "#ffffff", strokeWidth: 1.5 }}
              legendType="plainline"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatStatusTrendLabel(bucket: string, bucketMode: "day" | "week") {
  const date = new Date(bucket);
  if (Number.isNaN(date.getTime())) {
    return bucket;
  }

  if (bucketMode === "day") {
    return date.toLocaleDateString("es-PY", {
      weekday: "short",
      timeZone: "America/Asuncion",
    });
  }

  return `Sem ${date.toLocaleDateString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Asuncion",
  })}`;
}

function ReservationsStatusTrendTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-neutral-600">{label}</p>
      <div className="mt-2 space-y-1.5">
        {payload.map((entry, index) => {
          const numericValue =
            typeof entry.value === "number" ? entry.value : Number(entry.value ?? 0);
          return (
            <div
              key={`${entry.dataKey ?? entry.name ?? "series"}-${index}`}
              className="flex items-center justify-between gap-4"
            >
              <span className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: entry.color ?? "#737373" }}
                />
                <span style={{ color: entry.color ?? "#404040" }}>
                  {entry.name ?? entry.dataKey}
                </span>
              </span>
              <span className="text-sm font-semibold text-neutral-900">
                {formatNumber(numericValue)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReservationsStatusTrendChart({
  series,
  bucketMode,
  height = 280,
}: {
  series: ReservationStatusBucket[];
  bucketMode: "day" | "week";
  height?: number;
}) {
  const chartData = series.map((bucket) => ({
    label: formatStatusTrendLabel(bucket.bucket, bucketMode),
    confirmed: bucket.confirmed,
    pending: bucket.pending,
    cancelled: bucket.cancelled,
  }));
  const showDots = chartData.length <= 8;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <p className="text-xs text-neutral-500">
          Cada línea muestra cómo evoluciona cada estado de reserva a lo largo del período.
        </p>
      </div>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
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
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: "var(--panel-chart-cursor)", strokeWidth: 1.5 }}
              content={<ReservationsStatusTrendTooltip />}
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
            {reservationStatusLineKeys.map((statusKey) => (
              <Line
                key={statusKey}
                type="linear"
                dataKey={statusKey}
                name={reservationStatusLabelMap[statusKey]}
                stroke={reservationStatusColorMap[statusKey]}
                strokeWidth={2.5}
                isAnimationActive={false}
                dot={
                  showDots
                    ? {
                        r: 2.5,
                        fill: reservationStatusColorMap[statusKey],
                        stroke: "#ffffff",
                        strokeWidth: 1,
                      }
                    : false
                }
                activeDot={{
                  r: 5,
                  fill: reservationStatusColorMap[statusKey],
                  stroke: "#ffffff",
                  strokeWidth: 1.5,
                }}
                legendType="plainline"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function LineupBarView() {
  const {
    data: context,
    loading: contextLoading,
    error: contextError,
    isDemo,
    demoScenario,
  } = usePanelContext();
  const [period, setPeriod] = useState<Period>("30d");
  const [analyticsMode, setAnalyticsMode] = useState<BarAnalyticsMode>("day");
  const [summary, setSummary] = useState<MetricsSummaryWithSeries | null>(null);
  const [summaryPrev, setSummaryPrev] = useState<MetricsSummaryWithSeries | null>(null);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const barPeriodRangeRef = useRef<{
    period: Period;
    range: { from: string; to: string };
    prev: { from: string; to: string } | null;
  } | null>(null);
  const barFetchKeyRef = useRef<string | null>(null);
  const activityFetchKeyRef = useRef<string | null>(null);
  const isDemoBarMetrics =
    isDemo && demoScenario === "bar" && context?.local.type === "bar";
  const activityNowReference = useMemo(
    () => (isDemoBarMetrics ? getPanelDemoNow("bar") : undefined),
    [isDemoBarMetrics]
  );

  useEffect(() => {
    if (contextLoading || !context) return;
    if (context.local.type !== "bar") return;

    if (
      !barPeriodRangeRef.current ||
      barPeriodRangeRef.current.period !== period ||
      (isDemoBarMetrics
        ? !barFetchKeyRef.current?.startsWith("demo-bar-")
        : barFetchKeyRef.current?.startsWith("demo-bar-"))
    ) {
      const range = isDemoBarMetrics
        ? getPanelDemoRange("bar", period)
        : getLivePeriodDates(period);
      barPeriodRangeRef.current = {
        period,
        range,
        prev: isDemoBarMetrics ? getPanelDemoPreviousRange("bar", period) : getPreviousRange(range),
      };
    }

    const rangeState = barPeriodRangeRef.current;
    if (!rangeState) return;

    const modeKey = isDemoBarMetrics ? "demo-bar" : "live";
    const fetchKey = `${modeKey}-${period}-${rangeState.range.from}-${rangeState.range.to}-${rangeState.prev?.from ?? "none"}-${rangeState.prev?.to ?? "none"}`;
    if (barFetchKeyRef.current === fetchKey) return;
    barFetchKeyRef.current = fetchKey;

    const fetchSummary = async () => {
      setLoadingSummary(true);
      setError(null);
      try {
        const [currentResult, prevResult] = await Promise.allSettled([
          isDemoBarMetrics
            ? getPanelDemoMetricsSummaryWithSeries("bar", rangeState.range)
            : getPanelMetricsSummaryWithSeries(rangeState.range),
          rangeState.prev
            ? isDemoBarMetrics
              ? getPanelDemoMetricsSummaryWithSeries("bar", rangeState.prev)
              : getPanelMetricsSummaryWithSeries(rangeState.prev)
            : Promise.resolve(null),
        ]);

        if (currentResult.status === "fulfilled") {
          setSummary(currentResult.value);
        } else {
          setError(
            currentResult.reason instanceof Error
              ? currentResult.reason.message
              : "Error al cargar métricas"
          );
        }

        if (prevResult.status === "fulfilled") {
          setSummaryPrev(prevResult.value as MetricsSummaryWithSeries | null);
        } else {
          setSummaryPrev(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar métricas");
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [contextLoading, context, isDemoBarMetrics, period]);

  useEffect(() => {
    if (contextLoading || !context) return;
    if (context.local.type !== "bar") return;

    const modeKey = isDemoBarMetrics ? `demo-bar-${period}` : "live";
    if (activityFetchKeyRef.current === modeKey) return;
    activityFetchKeyRef.current = modeKey;

    const fetchActivity = async () => {
      setLoadingActivity(true);
      try {
        const data = isDemoBarMetrics
          ? await getPanelDemoBarActivity(period)
          : await getPanelActivity();
        setActivity(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar actividad");
      } finally {
        setLoadingActivity(false);
      }
    };

    fetchActivity();
  }, [contextLoading, context, isDemoBarMetrics, period]);

  if (contextLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-neutral-200/70 animate-pulse" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
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

  if (context.local.type !== "bar") {
    return <DashboardSandboxView />;
  }

  const kpis = summary?.kpis;
  const prevKpis = summaryPrev?.kpis;
  const deltaPlaceholder = kpiDeltaPlaceholder;

  const kpiItems: BarKpiItem[] = [
    {
      label: "Visitas al perfil",
      value: formatNumber(kpis?.profile_views ?? 0),
      hint: renderDelta(kpis?.profile_views ?? 0, prevKpis?.profile_views),
      icon: iconWrap(<Eye className="h-5 w-5" />, "blue"),
    },
    {
      label: "Clicks de WhatsApp",
      value: formatNumber(kpis?.whatsapp_clicks ?? 0),
      hint: renderDelta(kpis?.whatsapp_clicks ?? 0, prevKpis?.whatsapp_clicks),
      icon: iconWrap(<MessageCircle className="h-5 w-5" />, "blue"),
    },
    {
      label: "Promos vistas",
      value: formatNumber(kpis?.promo_open_count ?? 0),
      hint: renderDelta(kpis?.promo_open_count ?? 0, prevKpis?.promo_open_count),
      icon: iconWrap(<Megaphone className="h-5 w-5" />, "blue"),
    },
    {
      label: "Promo top",
      value: kpis?.top_promo?.title ?? "Sin datos",
      hint: undefined,
      icon: iconWrap(<Star className="h-5 w-5" />, "blue"),
    },
    {
      label: "Reservas totales",
      value: formatNumber(kpis?.reservations_total ?? 0),
      hint: renderDelta(kpis?.reservations_total ?? 0, prevKpis?.reservations_total),
      icon: iconWrap(<CalendarCheck className="h-5 w-5" />, "neutral"),
    },
    {
      label: "En revisión",
      value: formatNumber(kpis?.reservations_en_revision ?? 0),
      hint: undefined,
      icon: iconWrap(<Clock className="h-5 w-5" />, "amber"),
    },
    {
      label: "Confirmadas",
      value: formatNumber(kpis?.reservations_confirmed ?? 0),
      hint: undefined,
      icon: iconWrap(<CheckCircle2 className="h-5 w-5" />, "emerald"),
    },
    {
      label: "Canceladas",
      value: formatNumber(kpis?.reservations_cancelled ?? 0),
      hint: undefined,
      icon: iconWrap(<XCircle className="h-5 w-5" />, "rose"),
    },
  ];

  const statusTrendSeries = summary?.series?.reservations_by_status ?? [];
  const statusTrendBucketMode = summary?.series?.bucket_mode ?? "day";
  const statusHourRows = useMemo(() => {
    return summary?.series?.reservations_status_hour_by_day ?? [];
  }, [summary]);

  const statusHourMeta = useMemo(() => {
    return summary?.series?.reservation_status_hour_meta ?? null;
  }, [summary]);
  const statusHourDayOrder = useMemo(() => {
    const activeRangeFrom = barPeriodRangeRef.current?.range.from;
    if (!activeRangeFrom) {
      return reservationDayOrder;
    }

    const firstDayKey = getReservationDayKeyFromBucket(activeRangeFrom);
    if (!firstDayKey) {
      return reservationDayOrder;
    }

    const startIndex = reservationDayOrder.indexOf(firstDayKey);
    if (startIndex < 0) {
      return reservationDayOrder;
    }

    return Array.from(
      { length: reservationDayOrder.length },
      (_, index) => reservationDayOrder[(startIndex + index) % reservationDayOrder.length]
    );
  }, [period, summary]);

  const hasStatusHourData =
    statusHourRows.length > 0 &&
    statusHourMeta != null &&
    statusHourRows.some(
      (row) =>
        row.confirmed_hour != null || row.pending_hour != null || row.cancelled_hour != null
    );
  const hasStatusTrendData = statusTrendSeries.some(
    (row) => row.confirmed > 0 || row.pending > 0 || row.cancelled > 0
  );
  const activeAnalyticsMode: BarAnalyticsMode =
    analyticsMode === "hour" && hasStatusHourData ? "hour" : "day";

  const activityItems = activity?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2563eb]/10 text-[#2563eb]">
            <CalendarCheck className="h-5 w-5 text-[#374151]" />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className={panelUi.pageTitle}>Bar</h1>
            <p className={panelUi.pageSubtitle}>Gestión de reservas y analíticas</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 p-1">
          {(Object.keys(periodLabels) as Period[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                panelUi.focusRing,
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

      {loadingSummary ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[112px] rounded-2xl bg-neutral-200/70 animate-pulse" />
          ))}
        </div>
      ) : (
        <BarKpiGrid items={kpiItems} />
      )}

      {error ? (
        <div className={panelUi.emptyWrap}>
          <p className="text-sm text-neutral-600">{error}</p>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle>
                {activeAnalyticsMode === "day"
                  ? "Tendencia de reservas por estado"
                  : "Comportamiento horario total de reservas"}
              </CardTitle>
              <p className={panelUi.pageSubtitle}>
                {activeAnalyticsMode === "day"
                  ? `Evolución de confirmadas, en revisión y canceladas · ${periodLabels[period]}`
                  : `Hora promedio operativa total por día · ${periodLabels[period]}`}
              </p>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 p-1">
              {([
                ["day", "Por día"],
                ["hour", "Por hora"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAnalyticsMode(value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    panelUi.focusRing,
                    activeAnalyticsMode === value
                      ? "bg-neutral-100 text-neutral-900"
                      : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingSummary ? (
            <div className="h-[260px] rounded-2xl bg-neutral-200/70 animate-pulse" />
          ) : activeAnalyticsMode === "day" && hasStatusTrendData ? (
            <ReservationsStatusTrendChart
              series={statusTrendSeries}
              bucketMode={statusTrendBucketMode}
            />
          ) : activeAnalyticsMode === "hour" && hasStatusHourData ? (
            <ReservationsStatusHourTrendChart
              rows={statusHourRows}
              meta={statusHourMeta}
              dayOrder={statusHourDayOrder}
            />
          ) : (
            <div className={panelUi.emptyWrap}>
              <p className="text-sm text-neutral-500">
                {activeAnalyticsMode === "day"
                  ? "Aún no hay tendencia disponible"
                  : "Aún no hay comportamiento horario disponible"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingActivity ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-neutral-200/70 animate-pulse" />
              ))}
            </div>
          ) : activityItems.length > 0 ? (
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
