"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePanelContext } from "@/lib/panelContext";
import {
  getPanelMetricsSummaryWithSeries,
  type MetricsSummaryWithSeries,
} from "@/lib/metrics";
import { getPanelActivity, type ActivityItem } from "@/lib/activity";
import { getClubBreakdown, type ClubBreakdown } from "@/lib/metricsBreakdown";
import { Card, CardContent, CardHeader, CardTitle, cn, panelUi } from "@/components/panel/ui";
import { TicketsByTypeCard } from "@/components/panel/views/metrics/TicketsByTypeCard";
import { LineupBarView } from "@/components/panel/views/lineup/LineupBarView";
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

type Period = "7d" | "30d" | "90d";
type PanelContextData = NonNullable<ReturnType<typeof usePanelContext>["data"]>;

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

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency: "PYG",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const iconWrap = (icon: ReactNode) => (
  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8d1313]/10 text-[#8d1313]">
    {icon}
  </span>
);

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

interface KpiItem {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}

function KpiGrid({ items }: { items: KpiItem[] }) {
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

function ClubMetricsContent({ context }: { context: PanelContextData }) {
  const [period, setPeriod] = useState<Period>("7d");

  // Club (discotecas) state
  const [clubSummary, setClubSummary] = useState<MetricsSummaryWithSeries | null>(null);
  const [clubSummaryPrev, setClubSummaryPrev] = useState<MetricsSummaryWithSeries | null>(null);
  const [clubBreakdown, setClubBreakdown] = useState<ClubBreakdown | null>(null);
  const [clubActivity, setClubActivity] = useState<ActivityItem[]>([]);
  const [clubLoading, setClubLoading] = useState(true);
  const [clubError, setClubError] = useState<string | null>(null);
  const activityLoadedRef = useRef(false);
  const clubFetchKeyRef = useRef<string | null>(null);
  const clubPeriodRangeRef = useRef<{ period: Period; range: { from: string; to: string } } | null>(
    null
  );

  useEffect(() => {
    if (context.local.type !== "club") return;

    let range: { from: string; to: string };
    if (!clubPeriodRangeRef.current || clubPeriodRangeRef.current.period !== period) {
      range = getPeriodDates(period);
      clubPeriodRangeRef.current = { period, range };
    } else {
      range = clubPeriodRangeRef.current.range;
    }

    const fetchKey = `${period}-${range.from}-${range.to}`;
    if (clubFetchKeyRef.current === fetchKey) return;
    clubFetchKeyRef.current = fetchKey;
    const prevRange = getPreviousRange(range);

    const loadClubData = async () => {
      setClubLoading(true);
      setClubError(null);
      try {
        const [summaryResult, prevSummaryResult, breakdownResult] =
          await Promise.allSettled([
            getPanelMetricsSummaryWithSeries(range),
            prevRange ? getPanelMetricsSummaryWithSeries(prevRange) : Promise.resolve(null),
            getClubBreakdown(period),
          ]);

        if (summaryResult.status === "fulfilled") {
          setClubSummary(summaryResult.value);
        } else {
          setClubError(
            summaryResult.reason instanceof Error
              ? summaryResult.reason.message
              : "Error al cargar métricas"
          );
        }

        if (prevSummaryResult.status === "fulfilled") {
          setClubSummaryPrev(prevSummaryResult.value as MetricsSummaryWithSeries | null);
        } else {
          setClubSummaryPrev(null);
        }

        if (breakdownResult.status === "fulfilled") {
          setClubBreakdown(breakdownResult.value);
        } else {
          setClubBreakdown(null);
        }
      } catch (err) {
        setClubError(err instanceof Error ? err.message : "Error al cargar métricas");
      } finally {
        setClubLoading(false);
      }
    };

    loadClubData();
  }, [context, period]);

  useEffect(() => {
    if (context.local.type !== "club") return;
    if (activityLoadedRef.current) return;
    activityLoadedRef.current = true;

    const loadActivity = async () => {
      try {
        const activityData = await getPanelActivity();
        const items = activityData.items ?? [];
        setClubActivity(items);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al cargar actividad";
        setClubError(message);
      }
    };

    loadActivity();
  }, [context]);

  if (clubLoading) {
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

  if (clubError) {
    return (
      <div className={panelUi.emptyWrap}>
        <p className="text-sm text-neutral-600">{clubError}</p>
      </div>
    );
  }

  if (!clubSummary) {
    return (
      <div className={panelUi.emptyWrap}>
        <p className="text-sm text-neutral-600">No hay datos disponibles</p>
      </div>
    );
  }

  const revenueRange =
      (clubSummary as unknown as { kpis_range?: { revenue_paid?: number } }).kpis_range
        ?.revenue_paid ?? clubSummary.kpis.revenue_paid;

    const revenueValue =
      revenueRange > 0 ? formatCurrency(revenueRange) : "Aún no hay ingresos";
    const prevRevenueRange =
      (clubSummaryPrev as unknown as { kpis_range?: { revenue_paid?: number } }).kpis_range
        ?.revenue_paid ?? clubSummaryPrev?.kpis.revenue_paid;

    const currentTicketsSold =
      clubSummary.kpis_range?.tickets_sold ?? clubSummary.kpis.tickets_sold ?? 0;
    const currentTicketsUsed =
      clubSummary.kpis_range?.tickets_used ?? clubSummary.kpis.tickets_used ?? 0;
    const prevTicketsSold =
      clubSummaryPrev?.kpis_range?.tickets_sold ?? clubSummaryPrev?.kpis.tickets_sold;
    const prevTicketsUsed =
      clubSummaryPrev?.kpis_range?.tickets_used ?? clubSummaryPrev?.kpis.tickets_used;

    const kpiItems: KpiItem[] = [
      {
        label: "Visitas al perfil",
        value: formatNumber(clubSummary.kpis.profile_views),
        hint: renderDelta(clubSummary.kpis.profile_views, clubSummaryPrev?.kpis.profile_views),
        icon: iconWrap(<Eye className="h-5 w-5" />),
      },
      {
        label: "Clicks WhatsApp",
        value: formatNumber(clubSummary.kpis.whatsapp_clicks),
        hint: renderDelta(clubSummary.kpis.whatsapp_clicks, clubSummaryPrev?.kpis.whatsapp_clicks),
        icon: iconWrap(<MessageCircle className="h-5 w-5" />),
      },
      {
        label: "Promociones vistas",
        value: formatNumber(clubSummary.kpis.promo_open_count),
        hint: renderDelta(clubSummary.kpis.promo_open_count, clubSummaryPrev?.kpis.promo_open_count),
        icon: iconWrap(<Sparkles className="h-5 w-5" />),
      },
      {
        label: "Promo destacada",
        value: clubSummary.kpis.top_promo?.title ?? "Sin datos",
        hint: "—",
        icon: iconWrap(<Star className="h-5 w-5" />),
      },
      {
        label: "Órdenes totales",
        value: formatNumber(clubSummary.kpis.orders_total),
        hint: renderDelta(clubSummary.kpis.orders_total, clubSummaryPrev?.kpis.orders_total),
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
        label: "Ingresos (pagados)",
        value: revenueValue,
        hint: renderDelta(revenueRange, prevRevenueRange),
        icon: iconWrap(<DollarSign className="h-5 w-5" />),
      },
    ];

    const breakdownTickets = clubBreakdown?.tickets_top ?? [];
    const breakdownTables = clubBreakdown?.tables_interest_top ?? [];

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

        <div className="space-y-2">
          <KpiGrid items={kpiItems} />
          <p className="text-xs text-neutral-500">
            Rango (series): {clubSummary.range.from} → {clubSummary.range.to}.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <TicketsByTypeCard
            periodLabel={periodLabels[period]}
            tickets={breakdownTickets}
            entriesSeries={clubSummary.series?.orders_sold_used ?? []}
            revenueSeries={
              (clubSummary.series as unknown as { revenue_paid?: { bucket: string; value: number }[] })
                ?.revenue_paid ?? []
            }
            bucketMode={clubSummary.series?.bucket_mode ?? "day"}
          />

          <Card>
            <CardHeader>
              <CardTitle>Mesas con más interés</CardTitle>
              <p className={panelUi.pageSubtitle}>Clicks / Interacciones</p>
            </CardHeader>
            <CardContent>
              {breakdownTables.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {breakdownTables.map((table, index) => (
                    <Card key={table.table_type_id ?? index} className="border border-neutral-100">
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
                                style={{ width: `${Math.min(100, (table.interest_count / (breakdownTables[0]?.interest_count || 1)) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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
            <CardTitle>Recent activity</CardTitle>
            <p className={panelUi.pageSubtitle}>Feed reciente, no representa series.</p>
          </CardHeader>
          <CardContent>
            {clubActivity.length > 0 ? (
              <div className="space-y-4">
                {clubActivity.map((item, index) => (
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

function BarMetricsContent() {
  return <LineupBarView />;
}

export default function MetricsPage() {
  const { data: context, loading: contextLoading, error: contextError } = usePanelContext();

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

  if (context.local.type === "club") {
    return <ClubMetricsContent context={context} />;
  }

  if (context.local.type === "bar") {
    return <BarMetricsContent />;
  }

  return (
    <div className={panelUi.emptyWrap}>
      <p className="text-sm text-neutral-600">No hay datos disponibles</p>
    </div>
  );
}
