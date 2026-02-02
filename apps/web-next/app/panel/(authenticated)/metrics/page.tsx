"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePanelContext } from "@/lib/panelContext";
import {
  getPanelMetricsSummaryWithSeries,
  type MetricsSummaryWithSeries,
} from "@/lib/metrics";
import { getPanelActivity, type ActivityItem } from "@/lib/activity";
import { getClubBreakdown, type ClubBreakdown } from "@/lib/metricsBreakdown";
import {
  InfoTip,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  LineChartSimple,
  BarChartGrouped,
  cn,
  panelUi,
} from "@/components/panel/ui";
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
  Clock,
} from "lucide-react";

type Period = "7d" | "30d" | "90d";
type TrendMode = "entries" | "revenue";

type RevenueBucket = { bucket: string; value: number };

const getPeriodDates = (period: Period): { from: string; to: string } => {
  const to = new Date();
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
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

const deltaPlaceholder = "— vs período anterior";

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

const formatBucketLabel = (bucket: string, mode: "day" | "week") => {
  const date = new Date(bucket);
  if (Number.isNaN(date.getTime())) return bucket;
  const label = date.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit" });
  return mode === "week" ? `Sem ${label}` : label;
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

export default function MetricsPage() {
  const { data: context, loading: contextLoading, error: contextError } = usePanelContext();
  const [period, setPeriod] = useState<Period>("7d");

  // Club (discotecas) state
  const [clubSummary, setClubSummary] = useState<MetricsSummaryWithSeries | null>(null);
  const [clubBreakdown, setClubBreakdown] = useState<ClubBreakdown | null>(null);
  const [clubActivity, setClubActivity] = useState<ActivityItem[]>([]);
  const [clubLoading, setClubLoading] = useState(true);
  const [clubError, setClubError] = useState<string | null>(null);
  const [trendMode, setTrendMode] = useState<TrendMode>("entries");
  const activityLoadedRef = useRef(false);

  // Bar state (mantener layout existente)
  const [metrics, setMetrics] = useState<MetricsSummaryWithSeries | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isClub = context?.local.type === "club";
  const isBar = context?.local.type === "bar";

  useEffect(() => {
    if (contextLoading || !context || !isClub) return;

    const loadClubData = async () => {
      setClubLoading(true);
      setClubError(null);
      try {
        const { from, to } = getPeriodDates(period);
        const [summaryResult, breakdownResult] = await Promise.allSettled([
          getPanelMetricsSummaryWithSeries({ from, to }),
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
  }, [contextLoading, context, isClub, period]);

  useEffect(() => {
    if (contextLoading || !context || (!isClub && !isBar)) return;
    if (activityLoadedRef.current) return;
    activityLoadedRef.current = true;

    const loadActivity = async () => {
      try {
        const activityData = await getPanelActivity();
        const items = activityData.items ?? [];
        setClubActivity(items);
        setActivity(items.slice(0, 10));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al cargar actividad";
        if (isClub) setClubError(message);
        if (isBar) setError(message);
      }
    };

    loadActivity();
  }, [contextLoading, context, isClub, isBar]);

  useEffect(() => {
    if (contextLoading || !context || !isBar) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { from, to } = getPeriodDates(period);
        const metricsData = await getPanelMetricsSummaryWithSeries({ from, to });
        setMetrics(metricsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar métricas");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [contextLoading, context, isBar, period]);

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

  if (isClub) {
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

    const kpiItems: KpiItem[] = [
      {
        label: "Visitas al perfil",
        value: formatNumber(clubSummary.kpis.profile_views),
        hint: deltaPlaceholder,
        icon: iconWrap(<Eye className="h-5 w-5" />),
      },
      {
        label: "Clicks WhatsApp",
        value: formatNumber(clubSummary.kpis.whatsapp_clicks),
        hint: deltaPlaceholder,
        icon: iconWrap(<MessageCircle className="h-5 w-5" />),
      },
      {
        label: "Promociones vistas",
        value: formatNumber(clubSummary.kpis.promo_open_count),
        hint: deltaPlaceholder,
        icon: iconWrap(<Sparkles className="h-5 w-5" />),
      },
      {
        label: "Promo destacada",
        value: clubSummary.kpis.top_promo?.title ?? "Sin datos",
        hint: deltaPlaceholder,
        icon: iconWrap(<Star className="h-5 w-5" />),
      },
      {
        label: "Órdenes totales",
        value: formatNumber(clubSummary.kpis.orders_total),
        hint: deltaPlaceholder,
        icon: iconWrap(<ClipboardList className="h-5 w-5" />),
      },
      {
        label: "Entradas vendidas",
        value: formatNumber(clubSummary.kpis_range.tickets_sold),
        hint: deltaPlaceholder,
        icon: iconWrap(<Ticket className="h-5 w-5" />),
      },
      {
        label: "Entradas usadas",
        value: formatNumber(clubSummary.kpis_range.tickets_used),
        hint: deltaPlaceholder,
        icon: iconWrap(<CheckCircle2 className="h-5 w-5" />),
      },
      {
        label: "Ingresos (pagados)",
        value: revenueValue,
        hint: deltaPlaceholder,
        icon: iconWrap(<DollarSign className="h-5 w-5" />),
      },
    ];

    const entriesChartData = useMemo(
      () =>
        clubSummary.series.orders_sold_used.map((bucket) => ({
          label: formatBucketLabel(bucket.bucket, clubSummary.series.bucket_mode),
          vendidas: bucket.sold,
          usadas: bucket.used,
        })),
      [clubSummary]
    );

    const revenueSeries =
      (clubSummary.series as unknown as { revenue_paid?: RevenueBucket[] }).revenue_paid ??
      [];

    const revenueChartData = useMemo(
      () =>
        revenueSeries.map((bucket) => ({
          label: formatBucketLabel(bucket.bucket, clubSummary.series.bucket_mode),
          value: bucket.value,
        })),
      [clubSummary, revenueSeries]
    );

    const hasEntriesData = entriesChartData.some(
      (item) => item.vendidas > 0 || item.usadas > 0
    );
    const hasRevenueData = revenueChartData.some((item) => item.value > 0);

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
          <Card>
            <CardHeader className="flex flex-col gap-2">
              <CardTitle>Entradas por tipo</CardTitle>
              <p className={panelUi.pageSubtitle}>
                Rango (breakdown): window {period} (server-side). Órdenes con check-in cuenta
                órdenes, no qty.
              </p>
            </CardHeader>
            <CardContent>
              {breakdownTickets.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-neutral-100">
                  <table className="min-w-full">
                    <thead className={panelUi.tableHead}>
                      <tr>
                        <th className="px-4 py-3 text-left">Tipo</th>
                        <th className="px-4 py-3 text-right">Vendidas (qty)</th>
                        <th className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span>Órdenes con check-in</span>
                            <InfoTip text="Órdenes con check-in = cantidad de órdenes marcadas como usadas en el período (no suma quantity)." />
                          </div>
                        </th>
                        <th className="px-4 py-3 text-right">Ingresos (PYG)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdownTickets.map((ticket, index) => (
                        <tr key={ticket.ticket_type_id ?? index} className={panelUi.tableRow}>
                          <td className={panelUi.tableCell}>
                            {ticket.ticket_type_id === null
                              ? `${ticket.name} (legacy)`
                              : ticket.name}
                          </td>
                          <td className={cn(panelUi.tableCell, "text-right")}>${""}{formatNumber(ticket.sold_qty)}</td>
                          <td className={cn(panelUi.tableCell, "text-right text-neutral-600")}>${""}{formatNumber(ticket.used_orders)}</td>
                          <td className={cn(panelUi.tableCell, "text-right font-medium text-neutral-900")}>${""}{formatCurrency(ticket.revenue)}</td>
                        </tr>
                      ))}
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
                  </div>
                </div>

                {trendMode === "entries" ? (
                  hasEntriesData ? (
                    <BarChartGrouped
                      data={entriesChartData}
                      series={[
                        { dataKey: "vendidas", name: "Vendidas", color: "#3b82f6" },
                        { dataKey: "usadas", name: "Usadas", color: "#10b981" },
                      ]}
                      height={200}
                    />
                  ) : (
                    <div className={panelUi.emptyWrap}>
                      <p className="text-sm text-neutral-500">Aún no hay datos</p>
                    </div>
                  )
                ) : hasRevenueData ? (
                  <LineChartSimple data={revenueChartData} height={200} color="#8d1313" />
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

  // ----- Bar layout (no tocar en este prompt) -----
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Métricas</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => setPeriod(period)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Métricas</h1>
        <p className="text-gray-600">No hay datos disponibles</p>
      </div>
    );
  }

  const { kpis } = metrics;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Métricas</h1>
          <p className="text-gray-600 mt-1">Período: {periodLabels[period]}</p>
        </div>
        <div className="flex gap-2">
          {(["7d", "30d", "90d"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                period === p
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Engagement</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Visitas al Perfil" value={kpis.profile_views} icon="👁️" />
          <MetricCard label="Clicks WhatsApp" value={kpis.whatsapp_clicks} icon="💬" />
          <MetricCard label="Promos Vistas" value={kpis.promo_open_count} icon="🎯" />
          <MetricCard
            label="Promo Top"
            value={kpis.top_promo?.title ?? "—"}
            subtitle={kpis.top_promo ? `${kpis.top_promo.view_count} vistas` : undefined}
            icon="🏆"
          />
        </div>
      </div>

      {isBar && (
        <div>
          <h2 className="text-lg font-semibold text-neutral-800 mb-3">Reservas</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Total Reservas" value={kpis.reservations_total} icon="📅" />
            <MetricCard
              label="En Revisión"
              value={kpis.reservations_en_revision}
              icon="⏳"
              color="yellow"
            />
            <MetricCard
              label="Confirmadas"
              value={kpis.reservations_confirmed}
              icon="✅"
              color="green"
            />
            <MetricCard
              label="Canceladas"
              value={kpis.reservations_cancelled}
              icon="❌"
              color="red"
            />
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-neutral-800 mb-3">
          Actividad Reciente
          <span className="text-sm font-normal text-neutral-500 ml-2">(últimos eventos)</span>
        </h2>
        {activity.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">
                    Descripción
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">
                    Hora
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activity.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {activityLabels[item.type] ?? item.type}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.label}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatTime(item.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
            <p className="text-sm text-neutral-500">No hay actividad reciente</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Componentes auxiliares (Bar)
// ============================================================

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color?: "default" | "green" | "yellow" | "red";
}

function MetricCard({ label, value, subtitle, icon, color = "default" }: MetricCardProps) {
  const colorClasses = {
    default: "bg-white",
    green: "bg-green-50 border-green-200",
    yellow: "bg-yellow-50 border-yellow-200",
    red: "bg-red-50 border-red-200",
  };

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-4 shadow-sm`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs font-medium text-gray-500 uppercase">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}
