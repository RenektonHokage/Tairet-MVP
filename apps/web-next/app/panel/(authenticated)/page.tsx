"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { usePanelContext, type PanelUserInfo } from "@/lib/panelContext";
// reservations se usa solo en /panel/reservations, no en dashboard
import {
  getPanelMetricsSummaryWithSeries,
  type MetricsSummaryWithSeries,
} from "@/lib/metrics";
import {
  DashboardClubView,
  DashboardBarView,
} from "@/components/panel/views/dashboard";
import {
  calculateBarSummaryFromKpis,
  calculateClubSummary,
  type RangeDays,
} from "@/lib/dashboardHelpers";

// ============================================================
// Helper: Calcula from/to ISO strings según rango
// ============================================================
function getRangeDates(rangeDays: RangeDays): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  const from = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

// ============================================================
// Componente: Header del Panel (común para bar y club)
// ============================================================
function PanelHeader({ context }: { context: PanelUserInfo }) {
  const localTypeBadge =
    context.local.type === "club" ? "🎵 Discoteca" : "🍸 Bar";
  const localTypeColor =
    context.local.type === "club" ? "bg-purple-100 text-purple-800" : "bg-amber-100 text-amber-800";

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-4">
        <div>
          <h2 className="text-3xl font-bold">{context.local.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${localTypeColor}`}>
              {localTypeBadge}
            </span>
            <span className="text-sm text-gray-600">
              {context.role === "owner" ? "Propietario" : "Staff"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Componente: Dashboard para Clubs (discotecas)
// ============================================================
function DashboardClub({ context }: { context: PanelUserInfo }) {
  const router = useRouter();
  const [metrics, setMetrics] = useState<MetricsSummaryWithSeries | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [range, setRange] = useState<RangeDays>(30);

  // Calcular from/to basado en el rango actual
  const rangeDates = useMemo(() => getRangeDates(range), [range]);

  // Cargar métricas CON series cuando cambia el rango
  useEffect(() => {
    const loadMetrics = async () => {
      setLoadingMetrics(true);
      try {
        const data = await getPanelMetricsSummaryWithSeries(rangeDates);
        setMetrics(data);
      } catch (err) {
        console.error("Error loading club metrics:", err);
      } finally {
        setLoadingMetrics(false);
      }
    };

    loadMetrics();
  }, [rangeDates]);

  const handlePrimaryAction = useCallback(() => {
    router.push("/panel/checkin");
  }, [router]);

  const handleRangeChange = useCallback((value: "7d" | "30d") => {
    setRange(value === "7d" ? 7 : 30);
  }, []);

  // =========================================================================
  // FUENTES DE DATOS (desde backend con includeSeries=1):
  // - kpis: legacy KPIs (compatibilidad)
  // - kpis_range: semántica A (tickets sold/used por rango)
  // - series: series temporales para charts
  // =========================================================================

  // KPIs: usar kpis_range (semántica A, coherente con series)
  const kpis = {
    ticketsSold: metrics?.kpis_range?.tickets_sold ?? metrics?.kpis.tickets_sold ?? 0,
    ticketsUsed: metrics?.kpis_range?.tickets_used ?? metrics?.kpis.tickets_used ?? 0,
    revenuePaid: metrics?.kpis.revenue_paid ?? 0,
  };

  // Profile views y WhatsApp clicks: usar kpis (totales en rango)
  const profileViews = metrics?.kpis.profile_views ?? 0;
  const whatsappClicks = metrics?.kpis.whatsapp_clicks ?? 0;

  // Summary metrics
  const summary = calculateClubSummary(
    kpis.ticketsSold,
    profileViews,
    kpis.revenuePaid,
    range
  );

  // Trend data: usar series.orders_sold_used del backend
  const trendData = useMemo(() => {
    const series = metrics?.series?.orders_sold_used ?? [];
    return series.map((s) => ({
      label: formatBucketLabel(s.bucket, metrics?.series?.bucket_mode ?? "day"),
      vendidas: s.sold,
      usadas: s.used,
    }));
  }, [metrics?.series]);

  // Visitas series: usar series.profile_views del backend
  const visitsData = useMemo(() => {
    const series = metrics?.series?.profile_views ?? [];
    return series.map((s) => ({
      label: formatBucketLabel(s.bucket, metrics?.series?.bucket_mode ?? "day"),
      value: s.value,
    }));
  }, [metrics?.series]);

  // Top promo
  const topPromo = metrics?.kpis.top_promo
    ? {
        title: metrics.kpis.top_promo.title,
        viewCount: metrics.kpis.top_promo.view_count,
      }
    : null;

  return (
    <DashboardClubView
      onPrimaryAction={handlePrimaryAction}
      kpis={kpis}
      loading={loadingMetrics}
      trendData={trendData}
      visitsData={visitsData}
      totalVisits={profileViews}
      summary={summary}
      whatsappClicks={whatsappClicks}
      topPromo={topPromo}
      range={range === 7 ? "7d" : "30d"}
      onRangeChange={handleRangeChange}
    />
  );
}

// Helper para formatear bucket labels según el modo
function formatBucketLabel(bucket: string, mode: "day" | "week"): string {
  const date = new Date(bucket);
  if (mode === "day") {
    // Día de la semana abreviado
    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    return days[date.getUTCDay()];
  }
  // Semana: mostrar "Sem N" o fecha del lunes
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  return `${day}/${month}`;
}

// ============================================================
// Componente: Dashboard para Bars
// ============================================================
function DashboardBar({ context }: { context: PanelUserInfo }) {
  const router = useRouter();
  const [metrics, setMetrics] = useState<MetricsSummaryWithSeries | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [range, setRange] = useState<RangeDays>(30);

  // Calcular from/to basado en el rango actual
  const rangeDates = useMemo(() => getRangeDates(range), [range]);

  // Cargar métricas CON series cuando cambia el rango
  useEffect(() => {
    const loadMetrics = async () => {
      setLoadingMetrics(true);
      try {
        const data = await getPanelMetricsSummaryWithSeries(rangeDates);
        setMetrics(data);
      } catch (err) {
        console.error("Error loading bar metrics:", err);
      } finally {
        setLoadingMetrics(false);
      }
    };

    loadMetrics();
  }, [rangeDates]);

  const handlePrimaryAction = useCallback(() => {
    router.push("/panel/reservations");
  }, [router]);

  const handleRangeChange = useCallback((value: "7d" | "30d") => {
    setRange(value === "7d" ? 7 : 30);
  }, []);

  // =========================================================================
  // FUENTES DE DATOS (desde backend con includeSeries=1):
  // - kpis: KPIs de reservas (en rango)
  // - series: series temporales para charts
  // =========================================================================

  // KPIs de reservas: usar kpis del backend (ya filtrados por rango)
  const kpis = {
    reservationsTotal: metrics?.kpis.reservations_total ?? 0,
    reservationsConfirmed: metrics?.kpis.reservations_confirmed ?? 0,
    reservationsEnRevision: metrics?.kpis.reservations_en_revision ?? 0,
  };

  // Profile views y WhatsApp clicks: usar kpis (totales en rango)
  const profileViews = metrics?.kpis.profile_views ?? 0;
  const whatsappClicks = metrics?.kpis.whatsapp_clicks ?? 0;

  // Summary metrics: usar KPIs del backend
  const avgPartySizeConfirmed = metrics?.kpis_range?.avg_party_size_confirmed ?? null;
  const summary = calculateBarSummaryFromKpis(
    kpis.reservationsTotal,
    profileViews,
    range,
    avgPartySizeConfirmed
  );

  // Trend data: usar series.reservations_by_status del backend
  const trendData = useMemo(() => {
    const series = metrics?.series?.reservations_by_status ?? [];
    return series.map((s) => ({
      label: formatBucketLabel(s.bucket, metrics?.series?.bucket_mode ?? "day"),
      confirmadas: s.confirmed,
      canceladas: s.cancelled,
      pendientes: s.pending,
    }));
  }, [metrics?.series]);

  // Visitas series: usar series.profile_views del backend
  const visitsData = useMemo(() => {
    const series = metrics?.series?.profile_views ?? [];
    return series.map((s) => ({
      label: formatBucketLabel(s.bucket, metrics?.series?.bucket_mode ?? "day"),
      value: s.value,
    }));
  }, [metrics?.series]);

  // Top promo
  const topPromo = metrics?.kpis.top_promo
    ? {
        title: metrics.kpis.top_promo.title,
        viewCount: metrics.kpis.top_promo.view_count,
      }
    : { title: "Analizando...", viewCount: undefined };

  // Indica si hay datos reales de promedio de personas (no null)
  const hasAvgPartySizeData = avgPartySizeConfirmed != null;

  return (
    <DashboardBarView
      onPrimaryAction={handlePrimaryAction}
      kpis={kpis}
      loading={loadingMetrics}
      trendData={trendData}
      visitsData={visitsData}
      totalVisits={profileViews}
      summary={summary}
      hasAvgPartySizeData={hasAvgPartySizeData}
      whatsappClicks={whatsappClicks}
      topPromo={topPromo}
      range={range === 7 ? "7d" : "30d"}
      onRangeChange={handleRangeChange}
    />
  );
}

// ============================================================
// Página Principal del Panel
// ============================================================
export default function PanelPage() {
  const router = useRouter();
  const { data: context, loading, error } = usePanelContext();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Verificar sesión al montar
  useEffect(() => {
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/panel/login");
          return;
        }

        setIsAuthenticated(true);
      } catch (err) {
        console.error("Error checking session:", err);
        router.push("/panel/login");
      }
    };

    checkSession();
  }, [router]);

  // Mostrar loading mientras se verifica la sesión o se carga el contexto
  if (isAuthenticated === null || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // Mostrar error si no se pudo cargar el contexto
  if (error || !context) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600">{error || "Error al cargar información del panel"}</p>
          <button
            onClick={() => router.push("/panel/login")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Volver al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PanelHeader context={context} />
      {context.local.type === "club" ? (
        <DashboardClub context={context} />
      ) : (
        <DashboardBar context={context} />
      )}
    </div>
  );
}
