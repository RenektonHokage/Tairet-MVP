"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { usePanelContext, type PanelUserInfo } from "@/lib/panelContext";
import { getOrder, useOrder, type Order } from "@/lib/orders";
import {
  getPanelReservationsByLocalId,
  updatePanelReservationStatus,
  type Reservation,
} from "@/lib/reservations";
import { getPanelMetricsSummary, type MetricsSummary } from "@/lib/metrics";
import { getPanelActivity, type ActivityResponse } from "@/lib/activity";

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
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoadingMetrics(true);
      setLoadingActivity(true);

      try {
        const [metricsData, activityData] = await Promise.all([
          getPanelMetricsSummary(),
          getPanelActivity(),
        ]);
        setMetrics(metricsData);
        setActivity(activityData);
      } catch (err) {
        console.error("Error loading club data:", err);
      } finally {
        setLoadingMetrics(false);
        setLoadingActivity(false);
      }
    };

    loadData();
  }, []);

  const getActivityBadge = (type: ActivityResponse["items"][number]["type"]) => {
    switch (type) {
      case "order_paid":
        return { label: "Orden pagada", className: "bg-green-100 text-green-800" };
      case "order_created":
        return { label: "Orden creada", className: "bg-gray-100 text-gray-700" };
      case "order_used":
        return { label: "Orden usada", className: "bg-blue-100 text-blue-800" };
      case "whatsapp_click":
        return { label: "Click WhatsApp", className: "bg-emerald-100 text-emerald-800" };
      case "promo_view":
        return { label: "Promo vista", className: "bg-purple-100 text-purple-800" };
      case "profile_view":
        return { label: "Vista perfil", className: "bg-slate-100 text-slate-700" };
      default:
        return { label: type, className: "bg-gray-100 text-gray-700" };
    }
  };

  return (
    <div className="space-y-6">
      {/* CTA Principal */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-8 text-white">
        <h3 className="text-2xl font-bold mb-2">Check-in de Entradas</h3>
        <p className="mb-4 opacity-90">Escanea QR o ingresa código manualmente</p>
        <Link
          href="/panel/checkin"
          className="inline-block px-6 py-3 bg-white text-green-600 font-semibold rounded-md hover:bg-gray-100"
        >
          ✓ Abrir Check-in
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics && (
          <>
            <div className="bg-white p-6 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-600">Entradas Vendidas</h4>
              <p className="text-3xl font-bold mt-2">{metrics.kpis.tickets_sold}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-600">Entradas Usadas</h4>
              <p className="text-3xl font-bold mt-2">{metrics.kpis.tickets_used}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-600">Ingresos Pagados</h4>
              <p className="text-2xl font-bold mt-2">
                PYG {metrics.kpis.revenue_paid.toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-600">WhatsApp Clicks</h4>
              <p className="text-3xl font-bold mt-2">{metrics.kpis.whatsapp_clicks}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-600">Visitas al Perfil (30d)</h4>
              <p className="text-3xl font-bold mt-2">{metrics.kpis.profile_views}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-600">Promo más vista (30d)</h4>
              {metrics.kpis.top_promo ? (
                <>
                  <p className="text-lg font-bold mt-2 truncate" title={metrics.kpis.top_promo.title}>
                    {metrics.kpis.top_promo.title}
                  </p>
                  <p className="text-sm text-gray-500">
                    {metrics.kpis.top_promo.view_count} vistas de {metrics.kpis.promo_open_count} totales
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500 mt-2">Aún sin datos</p>
              )}
            </div>
          </>
        )}
        {loadingMetrics && (
          <div className="col-span-4 text-center text-gray-500">Cargando métricas...</div>
        )}
      </div>

      {/* Actividad Reciente */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Actividad Reciente</h3>
        {loadingActivity && <p className="text-sm text-gray-500">Cargando actividad...</p>}
        {activity && activity.items.length > 0 && (
          <ul className="space-y-3">
            {activity.items.slice(0, 10).map((item, index) => {
              const badge = getActivityBadge(item.type);
              return (
                <li key={`${item.type}-${item.timestamp}-${index}`} className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.className}`}>
                      {badge.label}
                    </span>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {activity && activity.items.length === 0 && !loadingActivity && (
          <p className="text-sm text-gray-500">Sin actividad reciente</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Componente: Dashboard para Bars
// ============================================================
function DashboardBar({ context }: { context: PanelUserInfo }) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [updatingReservationId, setUpdatingReservationId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoadingReservations(true);
      setLoadingMetrics(true);

      try {
        const [reservationsData, metricsData] = await Promise.all([
          getPanelReservationsByLocalId(context.local.id),
          getPanelMetricsSummary(),
        ]);
        setReservations(reservationsData);
        setMetrics(metricsData);
      } catch (err) {
        console.error("Error loading bar data:", err);
      } finally {
        setLoadingReservations(false);
        setLoadingMetrics(false);
      }
    };

    loadData();
  }, [context.local.id]);

  const handleUpdateReservationStatus = async (
    reservationId: string,
    status: "confirmed" | "cancelled"
  ) => {
    setUpdatingReservationId(reservationId);
    try {
      await updatePanelReservationStatus(reservationId, { status });
      const data = await getPanelReservationsByLocalId(context.local.id);
      setReservations(data);
    } catch (err) {
      console.error("Error updating reservation:", err);
    } finally {
      setUpdatingReservationId(null);
    }
  };

  const pendingReservations = reservations.filter((r) => r.status === "en_revision");

  return (
    <div className="space-y-6">
      {/* CTA Principal */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg shadow-lg p-8 text-white">
        <h3 className="text-2xl font-bold mb-2">Gestión de Reservas</h3>
        <p className="mb-4 opacity-90">
          {pendingReservations.length > 0
            ? `Tienes ${pendingReservations.length} reserva(s) pendiente(s) de confirmación`
            : "Todas las reservas están gestionadas"}
        </p>
        <button
          onClick={() => {
            const section = document.getElementById("reservations-section");
            section?.scrollIntoView({ behavior: "smooth" });
          }}
          className="inline-block px-6 py-3 bg-white text-amber-600 font-semibold rounded-md hover:bg-gray-100"
        >
          📌 Ver Reservas
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics && (
          <>
            <div className="bg-white p-6 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-600">Reservas Totales</h4>
              <p className="text-3xl font-bold mt-2">{metrics.kpis.reservations_total}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-600">Confirmadas</h4>
              <p className="text-3xl font-bold mt-2 text-green-600">
                {metrics.kpis.reservations_confirmed}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-600">En Revisión</h4>
              <p className="text-3xl font-bold mt-2 text-yellow-600">
                {metrics.kpis.reservations_en_revision}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-600">WhatsApp Clicks</h4>
              <p className="text-3xl font-bold mt-2">{metrics.kpis.whatsapp_clicks}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-600">Visitas al Perfil (30d)</h4>
              <p className="text-3xl font-bold mt-2">{metrics.kpis.profile_views}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h4 className="text-sm font-medium text-gray-600">Promo más vista (30d)</h4>
              {metrics.kpis.top_promo ? (
                <>
                  <p className="text-lg font-bold mt-2 truncate" title={metrics.kpis.top_promo.title}>
                    {metrics.kpis.top_promo.title}
                  </p>
                  <p className="text-sm text-gray-500">
                    {metrics.kpis.top_promo.view_count} vistas de {metrics.kpis.promo_open_count} totales
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500 mt-2">Aún sin datos</p>
              )}
            </div>
          </>
        )}
        {loadingMetrics && (
          <div className="col-span-4 text-center text-gray-500">Cargando métricas...</div>
        )}
      </div>

      {/* Reservas Recientes */}
      <div id="reservations-section" className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Reservas</h3>
        {loadingReservations && <p className="text-sm text-gray-500">Cargando reservas...</p>}
        {reservations.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Personas</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {reservation.name} {reservation.last_name || ""}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(reservation.date).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{reservation.guests}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          reservation.status === "confirmed"
                            ? "bg-green-100 text-green-800"
                            : reservation.status === "cancelled"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {reservation.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {reservation.status === "en_revision" ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateReservationStatus(reservation.id, "confirmed")}
                            disabled={updatingReservationId === reservation.id}
                            className="px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => handleUpdateReservationStatus(reservation.id, "cancelled")}
                            disabled={updatingReservationId === reservation.id}
                            className="px-3 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {reservations.length === 0 && !loadingReservations && (
          <p className="text-sm text-gray-500">No hay reservas para este local</p>
        )}
      </div>
    </div>
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
