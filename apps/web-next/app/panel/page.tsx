"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPanelUserInfo } from "@/lib/panel";
import { getOrder, useOrder, type Order } from "@/lib/orders";
import {
  getPanelReservationsByLocalId,
  updatePanelReservationStatus,
  type Reservation,
} from "@/lib/reservations";
import { getWhatsappClickCount } from "@/lib/whatsapp";
import { getPanelPromosByLocalId, type Promo } from "@/lib/promos";
import { getPanelMetricsSummary, type MetricsSummary } from "@/lib/metrics";
import { getPanelActivity, type ActivityResponse } from "@/lib/activity";

export default function PanelPage() {
  const router = useRouter();
  // Estado de autenticación
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [localId, setLocalId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [errorReservations, setErrorReservations] = useState<string | null>(
    null
  );
  const [updatingReservationId, setUpdatingReservationId] = useState<string | null>(null);
  const [editingTableNoteId, setEditingTableNoteId] = useState<string | null>(null);
  const [tableNoteValue, setTableNoteValue] = useState<string>("");

  const [whatsappCount, setWhatsappCount] = useState<number | null>(null);
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(false);
  const [errorWhatsapp, setErrorWhatsapp] = useState<string | null>(null);

  const [promos, setPromos] = useState<Promo[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(false);
  const [errorPromos, setErrorPromos] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  // Verificar sesión al montar
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push("/panel/login");
          return;
        }

        setIsAuthenticated(true);

        // Obtener información del usuario del panel
        try {
          const userInfo = await getPanelUserInfo();
          setLocalId(userInfo.local_id);
          setUserEmail(userInfo.email);
        } catch (err) {
          console.error("Error loading panel user info:", err);
          // Si falla, redirigir a login
          router.push("/panel/login");
        }
      } catch (err) {
        console.error("Error checking session:", err);
        router.push("/panel/login");
      }
    };

    checkSession();
  }, [router]);

  // Cargar datos cuando tengamos localId
  useEffect(() => {
    if (!localId) return;

    // Cargar datos iniciales
    handleLoadMetrics();
    handleLoadActivity();
    handleLoadReservations();
    handleLoadPromos();
    handleLoadWhatsappClicks();
  }, [localId]);

  const handleLoadOrder = async () => {
    if (!orderId.trim()) {
      setError("Por favor ingresa un ID de orden");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getOrder(orderId.trim());
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la orden");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUseOrder = async () => {
    if (!orderId.trim()) {
      setError("Por favor ingresa un ID de orden");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await useOrder(orderId.trim());
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al realizar check-in");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadReservations = async () => {
    if (!localId) {
      return;
    }

    setLoadingReservations(true);
    setErrorReservations(null);

    try {
      const data = await getPanelReservationsByLocalId(localId);
      setReservations(data);
    } catch (err) {
      setErrorReservations(
        err instanceof Error ? err.message : "Error al cargar reservas"
      );
      setReservations([]);
    } finally {
      setLoadingReservations(false);
    }
  };

  const handleUpdateReservationStatus = async (
    reservationId: string,
    status: "confirmed" | "cancelled"
  ) => {
    setUpdatingReservationId(reservationId);
    setErrorReservations(null);

    try {
      await updatePanelReservationStatus(reservationId, { status });
      // Refrescar la lista de reservas
      if (localId) {
        const data = await getPanelReservationsByLocalId(localId);
        setReservations(data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al actualizar la reserva";
      setErrorReservations(errorMessage);
      console.error("Error updating reservation:", err);
    } finally {
      setUpdatingReservationId(null);
    }
  };

  const handleStartEditTableNote = (reservation: Reservation) => {
    setEditingTableNoteId(reservation.id);
    setTableNoteValue(reservation.table_note || "");
  };

  const handleCancelEditTableNote = () => {
    setEditingTableNoteId(null);
    setTableNoteValue("");
  };

  const handleSaveTableNote = async (reservationId: string) => {
    setErrorReservations(null);

    try {
      await updatePanelReservationStatus(reservationId, {
        table_note: tableNoteValue.trim() || null,
      });
      // Refrescar la lista de reservas
      if (localId) {
        const data = await getPanelReservationsByLocalId(localId);
        setReservations(data);
      }
      setEditingTableNoteId(null);
      setTableNoteValue("");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al actualizar la nota";
      setErrorReservations(errorMessage);
      console.error("Error updating table note:", err);
    }
  };

  const handleLoadWhatsappClicks = async () => {
    if (!localId) {
      return;
    }

    setLoadingWhatsapp(true);
    setErrorWhatsapp(null);

    try {
      const data = await getWhatsappClickCount(localId);
      setWhatsappCount(data.count);
    } catch (err) {
      setErrorWhatsapp(
        err instanceof Error ? err.message : "Error al cargar los clics"
      );
      setWhatsappCount(null);
    } finally {
      setLoadingWhatsapp(false);
    }
  };

  const handleLoadPromos = async () => {
    if (!localId) {
      return;
    }

    setLoadingPromos(true);
    setErrorPromos(null);

    try {
      const data = await getPanelPromosByLocalId(localId);
      setPromos(data);
    } catch (err) {
      setErrorPromos(
        err instanceof Error ? err.message : "Error al cargar las promos"
      );
      setPromos([]);
    } finally {
      setLoadingPromos(false);
    }
  };

  const handleLoadMetrics = async () => {
    if (!localId) {
      return;
    }

    setLoadingMetrics(true);
    setMetricsError(null);

    try {
      const data = await getPanelMetricsSummary();
      setMetrics(data);
    } catch (err) {
      setMetricsError(
        err instanceof Error ? err.message : "Error al cargar métricas"
      );
      setMetrics(null);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleLoadActivity = async () => {
    if (!localId) {
      return;
    }

    setLoadingActivity(true);
    setActivityError(null);

    try {
      const data = await getPanelActivity();
      setActivity(data);
    } catch (err) {
      setActivityError(
        err instanceof Error ? err.message : "Error al cargar la actividad"
      );
      setActivity(null);
    } finally {
      setLoadingActivity(false);
    }
  };

  const topPromo = promos.length
    ? promos.reduce((max, promo) => {
        const currentViews = promo.view_count ?? 0;
        const maxViews = max.view_count ?? 0;
        return currentViews > maxViews ? promo : max;
      }, promos[0])
    : null;

  const getActivityBadge = (
    type: ActivityResponse["items"][number]["type"]
  ) => {
    switch (type) {
      case "order_paid":
        return {
          label: "Orden pagada",
          className:
            "inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800",
        };
      case "order_created":
        return {
          label: "Orden creada",
          className:
            "inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700",
        };
      case "order_used":
        return {
          label: "Orden usada",
          className:
            "inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800",
        };
      case "reservation_created":
        return {
          label: "Reserva creada",
          className:
            "inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800",
        };
      case "reservation_updated":
        return {
          label: "Reserva actualizada",
          className:
            "inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800",
        };
      case "whatsapp_click":
        return {
          label: "Click WhatsApp",
          className:
            "inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800",
        };
      case "promo_view":
        return {
          label: "Promo vista",
          className:
            "inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800",
        };
      case "profile_view":
        return {
          label: "Vista perfil",
          className:
            "inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700",
        };
      default:
        return {
          label: type,
          className:
            "inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700",
        };
    }
  };

  // Mostrar loading mientras se verifica la sesión
  if (isAuthenticated === null || !localId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <Link
            href="/panel/calendar"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            📅 Calendario
          </Link>
        </div>
        {userEmail && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">{userEmail}</span>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI: WhatsApp clicks */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">WhatsApp Clicks</h3>
          <p className="text-3xl font-bold mt-2">-</p>
          <p className="text-xs text-gray-500 mt-1">TODO: Conectar con métricas</p>
        </div>

        {/* KPI: Reservas web (bares) */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">Reservas Web</h3>
          <p className="text-3xl font-bold mt-2">-</p>
          <p className="text-xs text-gray-500 mt-1">TODO: Conectar con API</p>
        </div>

        {/* KPI: Entradas vendidas/usadas */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">Entradas Vendidas</h3>
          <p className="text-3xl font-bold mt-2">-</p>
          <p className="text-xs text-gray-500 mt-1">TODO: Conectar con orders</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">Entradas Usadas</h3>
          <p className="text-3xl font-bold mt-2">-</p>
          <p className="text-xs text-gray-500 mt-1">TODO: Conectar con orders (used_at)</p>
        </div>

        {/* KPI: Ingresos estimados */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">Ingresos Estimados</h3>
          <p className="text-3xl font-bold mt-2">PYG 0</p>
          <p className="text-xs text-gray-500 mt-1">TODO: Sumar de orders pagadas</p>
        </div>
      </div>

      {/* Probar Órdenes */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Probar Órdenes</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="orderId" className="block text-sm font-medium text-gray-700 mb-2">
              ID de Orden
            </label>
            <input
              id="orderId"
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Pega el UUID de la orden aquí"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleLoadOrder}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Cargando..." : "Cargar orden"}
            </button>
            <button
              onClick={handleUseOrder}
              disabled={loading || !order}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Check-in
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {order && (
            <div className="p-4 bg-gray-50 rounded-md">
              <h4 className="font-semibold mb-2">Estado de la Orden</h4>
              <div className="space-y-1 text-sm">
                <p><strong>ID:</strong> {order.id}</p>
                <p><strong>Status:</strong> <span className="font-mono">{order.status}</span></p>
                <p><strong>Usada:</strong> {order.used_at ? new Date(order.used_at).toLocaleString() : "No"}</p>
                <p><strong>Cantidad:</strong> {order.quantity}</p>
                <p><strong>Total:</strong> {order.total_amount} {order.currency}</p>
                {order.customer_name && <p><strong>Cliente:</strong> {order.customer_name}</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPIs del Local */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">KPIs del Local</h3>
        {loadingMetrics && (
          <p className="text-sm text-gray-500 mb-4">Cargando métricas...</p>
        )}

        {metricsError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{metricsError}</p>
          </div>
        )}

        {metrics && !metricsError && !loadingMetrics && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-md p-4">
                <h4 className="text-sm font-medium text-gray-600">WhatsApp Clicks</h4>
                <p className="text-2xl font-semibold text-gray-900">
                  {metrics.kpis.whatsapp_clicks}
                </p>
              </div>
              <div className="bg-gray-50 rounded-md p-4">
                <h4 className="text-sm font-medium text-gray-600">Reservas</h4>
                <p className="text-sm text-gray-700">
                  Total: <span className="font-semibold">{metrics.kpis.reservations_total}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Confirmadas: {metrics.kpis.reservations_confirmed} · En revisión: {metrics.kpis.reservations_en_revision} · Canceladas: {metrics.kpis.reservations_cancelled}
                </p>
              </div>
              <div className="bg-gray-50 rounded-md p-4">
                <h4 className="text-sm font-medium text-gray-600">Órdenes</h4>
                <p className="text-sm text-gray-700">
                  Total: <span className="font-semibold">{metrics.kpis.orders_total}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Tickets vendidos: {metrics.kpis.tickets_sold} · Usados: {metrics.kpis.tickets_used}
                </p>
              </div>
              <div className="bg-gray-50 rounded-md p-4">
                <h4 className="text-sm font-medium text-gray-600">Ingresos Pagados</h4>
                <p className="text-2xl font-semibold text-gray-900">
                  PYG {metrics.kpis.revenue_paid.toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-50 rounded-md p-4">
                <h4 className="text-sm font-medium text-gray-600">Profile Views</h4>
                <p className="text-2xl font-semibold text-gray-900">
                  {metrics.kpis.profile_views}
                </p>
              </div>
            </div>

            {metrics.kpis.top_promo && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-md">
                <h4 className="text-sm font-semibold text-blue-900">Promo más vista</h4>
                <p className="text-sm text-blue-900">{metrics.kpis.top_promo.title}</p>
                <p className="text-xs text-blue-700">
                  Vistas: <span className="font-semibold">{metrics.kpis.top_promo.view_count}</span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reservas (Bares) */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Reservas (Bares)</h3>
        {loadingReservations && (
          <p className="text-sm text-gray-500 mb-4">Cargando reservas...</p>
        )}
        <div className="space-y-4">

          {errorReservations && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{errorReservations}</p>
            </div>
          )}

          {reservations.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Apellido
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Personas
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Notas Cliente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Mesa/Nota Interna
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Creado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {reservation.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {reservation.last_name || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(reservation.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {reservation.guests}
                      </td>
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
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {reservation.notes || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {editingTableNoteId === reservation.id ? (
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={tableNoteValue}
                              onChange={(e) => setTableNoteValue(e.target.value)}
                              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Ej: Mesa 5 / cerca ventana"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveTableNote(reservation.id)}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                              ✓
                            </button>
                            <button
                              onClick={handleCancelEditTableNote}
                              className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900">
                              {reservation.table_note || "-"}
                            </span>
                            <button
                              onClick={() => handleStartEditTableNote(reservation)}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
                              title="Editar nota interna"
                            >
                              ✏️
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(reservation.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {reservation.status === "en_revision" ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                handleUpdateReservationStatus(reservation.id, "confirmed")
                              }
                              disabled={updatingReservationId === reservation.id || editingTableNoteId === reservation.id}
                              className="px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {updatingReservationId === reservation.id ? "..." : "Confirmar"}
                            </button>
                            <button
                              onClick={() =>
                                handleUpdateReservationStatus(reservation.id, "cancelled")
                              }
                              disabled={updatingReservationId === reservation.id || editingTableNoteId === reservation.id}
                              className="px-3 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {updatingReservationId === reservation.id ? "..." : "Cancelar"}
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

          {reservations.length === 0 && !loadingReservations && localId && (
            <p className="text-sm text-gray-500">No hay reservas para este local</p>
          )}
        </div>
      </div>

      {/* WhatsApp Clicks */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">WhatsApp Clicks</h3>
        {loadingWhatsapp && (
          <p className="text-sm text-gray-500 mb-4">Cargando clics de WhatsApp...</p>
        )}
        <div className="space-y-4">
          {errorWhatsapp && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{errorWhatsapp}</p>
            </div>
          )}

          {whatsappCount !== null && !loadingWhatsapp && !errorWhatsapp && (
            whatsappCount > 0 ? (
              <p className="text-sm text-gray-700">
                Clics a WhatsApp: <span className="font-semibold">{whatsappCount}</span>
              </p>
            ) : (
              <p className="text-sm text-gray-500">Sin datos</p>
            )
          )}
        </div>
      </div>

      {/* Promos */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Promos</h3>
        {loadingPromos && (
          <p className="text-sm text-gray-500 mb-4">Cargando promos...</p>
        )}
        <div className="space-y-4">
          {errorPromos && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{errorPromos}</p>
            </div>
          )}

          {promos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Título
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Vistas
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Inicio
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Fin
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {promos.map((promo) => (
                    <tr key={promo.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {promo.title}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {promo.view_count ?? 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {promo.start_date
                          ? new Date(promo.start_date).toLocaleString()
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {promo.end_date
                          ? new Date(promo.end_date).toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {promos.length === 0 && !loadingPromos && (
            <p className="text-sm text-gray-500">No hay promos para este local</p>
          )}

          {topPromo && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-md">
              <h4 className="font-semibold mb-1">Promo más vista</h4>
              <p className="text-sm text-gray-700">{topPromo.title}</p>
              <p className="text-xs text-gray-500">
                Vistas: <span className="font-semibold">{topPromo.view_count ?? 0}</span>
              </p>
              <p className="text-xs text-gray-500">
                {topPromo.start_date
                  ? `Inicio: ${new Date(topPromo.start_date).toLocaleString()}`
                  : "Inicio: -"}
              </p>
              <p className="text-xs text-gray-500">
                {topPromo.end_date
                  ? `Fin: ${new Date(topPromo.end_date).toLocaleString()}`
                  : "Fin: -"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Actividad reciente */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Actividad Reciente</h3>
        {loadingActivity && (
          <p className="text-sm text-gray-500 mb-4">Cargando actividad...</p>
        )}
        <div className="space-y-4">
          {activityError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{activityError}</p>
            </div>
          )}

          {activity && activity.items.length > 0 && (
            <ul className="space-y-3">
              {activity.items.map((item, index) => {
                const badge = getActivityBadge(item.type);
                return (
                  <li
                    key={`${item.type}-${item.timestamp}-${index}`}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      <span className={badge.className}>{badge.label}</span>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          {activity && activity.items.length === 0 && !loadingActivity && !activityError && (
            <p className="text-sm text-gray-500">Sin actividad reciente</p>
          )}
        </div>
      </div>
    </div>
  );
}

