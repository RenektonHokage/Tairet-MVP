"use client";

import { useState, useEffect } from "react";
import { usePanelContext } from "@/lib/panelContext";
import { getPanelMetricsSummary, type MetricsSummary } from "@/lib/metrics";
import { getPanelActivity, type ActivityItem } from "@/lib/activity";

type Period = "7d" | "30d" | "90d";

/**
 * Calcula from/to ISO para el periodo seleccionado.
 * Definido fuera del componente para evitar recreacion.
 */
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

const activityLabels: Record<string, string> = {
  order_paid: "Orden pagada",
  order_created: "Orden creada",
  order_used: "Entrada usada",
  reservation_created: "Reserva creada",
  reservation_updated: "Reserva actualizada",
  whatsapp_click: "Click WhatsApp",
  promo_view: "Promo vista",
  profile_view: "Visita al perfil",
};

export default function MetricsPage() {
  const { data: context, loading: contextLoading } = usePanelContext();
  const [period, setPeriod] = useState<Period>("7d");
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isClub = context?.local.type === "club";
  const isBar = context?.local.type === "bar";

  useEffect(() => {
    if (contextLoading || !context) return;
    loadData();
  }, [contextLoading, context, period]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getPeriodDates(period);
      const [metricsData, activityData] = await Promise.all([
        getPanelMetricsSummary(from, to),
        getPanelActivity(),
      ]);
      setMetrics(metricsData);
      // Activity no filtra por periodo, muestra ultimos eventos
      setActivity(activityData.items.slice(0, 10));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar métricas");
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (contextLoading || loading) {
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
            onClick={loadData}
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
      {/* Header + Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Métricas</h1>
          <p className="text-gray-600 mt-1">
            Período: {periodLabels[period]}
          </p>
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

      {/* Seccion 1: KPIs Comunes */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Engagement</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Visitas al Perfil"
            value={kpis.profile_views}
            icon="👁️"
          />
          <MetricCard
            label="Clicks WhatsApp"
            value={kpis.whatsapp_clicks}
            icon="💬"
          />
          <MetricCard
            label="Promos Vistas"
            value={kpis.promo_open_count}
            icon="🎯"
          />
          <MetricCard
            label="Promo Top"
            value={kpis.top_promo?.title ?? "—"}
            subtitle={
              kpis.top_promo ? `${kpis.top_promo.view_count} vistas` : undefined
            }
            icon="🏆"
          />
        </div>
      </div>

      {/* Seccion 2: Breakdown por Tipo */}
      {isClub && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Ventas y Entradas
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Órdenes Totales"
              value={kpis.orders_total}
              icon="📋"
            />
            <MetricCard
              label="Entradas Vendidas"
              value={kpis.tickets_sold}
              icon="🎟️"
            />
            <MetricCard
              label="Entradas Usadas"
              value={kpis.tickets_used}
              icon="✅"
            />
            <MetricCard
              label="Ingresos"
              value={formatCurrency(kpis.revenue_paid)}
              icon="💰"
            />
          </div>
        </div>
      )}

      {isBar && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Reservas</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Total Reservas"
              value={kpis.reservations_total}
              icon="📅"
            />
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

      {/* Seccion 3: Actividad Reciente */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Actividad Reciente
          <span className="text-sm font-normal text-gray-500 ml-2">
            (últimos eventos)
          </span>
        </h2>
        {activity.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Descripción
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
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
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.label}
                    </td>
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
            <p className="text-gray-500">No hay actividad reciente</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Componentes auxiliares
// ============================================================

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color?: "default" | "green" | "yellow" | "red";
}

function MetricCard({
  label,
  value,
  subtitle,
  icon,
  color = "default",
}: MetricCardProps) {
  const colorClasses = {
    default: "bg-white",
    green: "bg-green-50 border-green-200",
    yellow: "bg-yellow-50 border-yellow-200",
    red: "bg-red-50 border-red-200",
  };

  return (
    <div
      className={`${colorClasses[color]} border rounded-lg p-4 shadow-sm`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs font-medium text-gray-500 uppercase">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && (
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency: "PYG",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `hace ${diffMins}m`;
    }
    if (diffHours < 24) {
      return `hace ${diffHours}h`;
    }
    if (diffDays < 7) {
      return `hace ${diffDays}d`;
    }
    return date.toLocaleDateString("es-PY", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "—";
  }
}
