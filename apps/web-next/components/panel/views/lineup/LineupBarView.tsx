"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
} from "@/lib/metrics";
import { getPanelActivity, type ActivityItem, type ActivityResponse } from "@/lib/activity";
import { DashboardSandboxView } from "@/components/panel/views/DashboardSandboxView";
import { kpiDeltaPlaceholder } from "./lineupConstants";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  panelUi,
} from "@/components/panel/ui";
import { ReservationsTrendChart, type ReservationsTrendPoint } from "@/components/panel/charts/ReservationsTrendChart";

type Period = "7d" | "30d" | "90d";

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

const iconWrap = (icon: ReactNode, tone: "neutral" | "blue" | "amber" | "emerald" | "rose") => {
  const styles =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-600"
      : tone === "amber"
      ? "bg-amber-50 text-amber-600"
      : tone === "rose"
      ? "bg-rose-50 text-rose-600"
      : tone === "blue"
      ? "bg-blue-50 text-blue-600"
      : "bg-neutral-100 text-neutral-600";
  return (
    <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", styles)}>
      {icon}
    </span>
  );
};

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

interface BarKpiItem {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}

function BarKpiGrid({ items }: { items: BarKpiItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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

function mapReservationSeries(
  series: ReservationStatusBucket[],
  bucketMode: "day" | "week"
): ReservationsTrendPoint[] {
  return series.map((item) => {
    const date = new Date(item.bucket);
    const label = Number.isNaN(date.getTime())
      ? item.bucket
      : `${bucketMode === "week" ? "Sem " : ""}${date.toLocaleDateString("es-PY", {
          day: "2-digit",
          month: "2-digit",
        })}`;
    const total = item.confirmed + item.pending + item.cancelled;
    return {
      label,
      total,
      confirmed: item.confirmed,
      pending: item.pending,
      cancelled: item.cancelled,
    };
  });
}

export function LineupBarView() {
  const { data: context, loading: contextLoading, error: contextError } = usePanelContext();
  const [period, setPeriod] = useState<Period>("30d");
  const [summary, setSummary] = useState<MetricsSummaryWithSeries | null>(null);
  const [summaryPrev, setSummaryPrev] = useState<MetricsSummaryWithSeries | null>(null);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activityGuardRef = useRef(false);
  const barPeriodRangeRef = useRef<{
    period: Period;
    range: { from: string; to: string };
    prev: { from: string; to: string } | null;
  } | null>(null);
  const barFetchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (contextLoading || !context) return;
    if (context.local.type !== "bar") return;

    if (!barPeriodRangeRef.current || barPeriodRangeRef.current.period !== period) {
      const range = getPeriodDates(period);
      barPeriodRangeRef.current = {
        period,
        range,
        prev: getPreviousRange(range),
      };
    }

    const rangeState = barPeriodRangeRef.current;
    if (!rangeState) return;

    const fetchKey = `${period}-${rangeState.range.from}-${rangeState.range.to}-${rangeState.prev?.from ?? "none"}-${rangeState.prev?.to ?? "none"}`;
    if (barFetchKeyRef.current === fetchKey) return;
    barFetchKeyRef.current = fetchKey;

    const fetchSummary = async () => {
      setLoadingSummary(true);
      setError(null);
      try {
        const [currentResult, prevResult] = await Promise.allSettled([
          getPanelMetricsSummaryWithSeries(rangeState.range),
          rangeState.prev ? getPanelMetricsSummaryWithSeries(rangeState.prev) : Promise.resolve(null),
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
  }, [contextLoading, context, period]);

  useEffect(() => {
    if (contextLoading || !context) return;
    if (context.local.type !== "bar") return;
    if (activityGuardRef.current) return;
    activityGuardRef.current = true;

    const fetchActivity = async () => {
      setLoadingActivity(true);
      try {
        const data = await getPanelActivity();
        setActivity(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar actividad");
      } finally {
        setLoadingActivity(false);
      }
    };

    fetchActivity();
  }, [contextLoading, context]);

  if (contextLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-neutral-200/70 animate-pulse" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
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

  const chartData = useMemo(() => {
    if (!summary?.series?.reservations_by_status) return [];
    return mapReservationSeries(summary.series.reservations_by_status, summary.series.bucket_mode);
  }, [summary]);

  const hasChartData = chartData.some(
    (item) => item.total > 0 || item.confirmed > 0 || item.pending > 0 || item.cancelled > 0
  );

  const activityItems = activity?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CalendarCheck className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className={panelUi.pageTitle}>Bars</h1>
            <p className={panelUi.pageSubtitle}>Reservation management and engagement</p>
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

      {loadingSummary ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[96px] rounded-2xl bg-neutral-200/70 animate-pulse" />
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
          <CardTitle>Reservations Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSummary ? (
            <div className="h-[260px] rounded-2xl bg-neutral-200/70 animate-pulse" />
          ) : hasChartData ? (
            <ReservationsTrendChart data={chartData} height={260} />
          ) : (
            <div className={panelUi.emptyWrap}>
              <p className="text-sm text-neutral-500">Aún no hay histórico</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
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
