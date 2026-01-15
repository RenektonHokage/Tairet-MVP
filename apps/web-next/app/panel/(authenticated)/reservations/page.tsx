"use client";

import { useState, useEffect } from "react";
import { usePanelContext } from "@/lib/panelContext";
import { NotAvailable } from "@/components/panel/NotAvailable";
import {
  getPanelReservationsByLocalId,
  updatePanelReservationStatus,
  searchPanelReservations,
  type Reservation,
} from "@/lib/reservations";

export default function ReservationsPage() {
  const { data: context, loading: contextLoading } = usePanelContext();

  // Estados
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Búsqueda
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Edición de nota interna (table_note)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");

  // GATING TEMPRANO
  const isBlocked = context?.local.type === "club";

  // Cargar últimas reservas al montar (solo si no está bloqueado)
  useEffect(() => {
    // GUARDS: loading, bloqueado, sin contexto
    if (contextLoading) return;
    if (isBlocked) return;
    if (!context) return;

    loadReservations();
  }, [contextLoading, isBlocked, context]);

  const loadReservations = async () => {
    // GUARD: bloqueado
    if (isBlocked) return;

    setLoading(true);
    setError(null);
    setIsSearching(false);

    try {
      const data = await getPanelReservationsByLocalId(context!.local.id);
      setReservations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar reservas");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    // GUARDS: query vacío, bloqueado
    if (!searchQuery.trim()) return;
    if (isBlocked) return;

    setLoading(true);
    setError(null);
    setIsSearching(true);

    try {
      const data = await searchPanelReservations(searchQuery);
      setReservations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en búsqueda");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (
    id: string,
    status: "confirmed" | "cancelled"
  ) => {
    // GUARD: bloqueado
    if (isBlocked) return;

    setUpdatingId(id);
    setError(null); // Limpiar error previo

    try {
      await updatePanelReservationStatus(id, { status });
      // Recargar lista actual (búsqueda o listado)
      if (isSearching) {
        await handleSearch();
      } else {
        await loadReservations();
      }
    } catch (err) {
      // NO console.error (no loguear PII)
      setError(err instanceof Error ? err.message : "Error al actualizar reserva");
    } finally {
      setUpdatingId(null);
    }
  };

  // Handlers para edición de nota interna (table_note)
  const handleStartEdit = (reservation: Reservation) => {
    setEditingNoteId(reservation.id);
    setNoteValue(reservation.table_note ?? "");
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setNoteValue("");
  };

  const handleSaveNote = async (id: string) => {
    // GUARD: bloqueado
    if (isBlocked) return;

    setUpdatingId(id);
    setError(null);

    try {
      await updatePanelReservationStatus(id, { table_note: noteValue || null });
      setEditingNoteId(null);
      setNoteValue("");
      // Recargar lista (FIX: verificar que searchQuery tenga contenido)
      if (isSearching && searchQuery.trim()) {
        await handleSearch();
      } else {
        await loadReservations();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar nota");
    } finally {
      setUpdatingId(null);
    }
  };

  // RENDERS TEMPRANOS
  if (contextLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }

  if (!context) {
    return <div className="text-red-600">Error al cargar contexto</div>;
  }

  if (isBlocked) {
    return (
      <NotAvailable
        localType="club"
        feature="Reservas"
        message="Las discotecas gestionan entradas con Check-in, no reservas."
      />
    );
  }

  // RENDER PRINCIPAL (solo para bares)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Reservas</h1>
        <button
          onClick={loadReservations}
          disabled={loading}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
        >
          {loading ? "Cargando..." : "🔄 Refrescar"}
        </button>
      </div>

      {/* Búsqueda */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Buscar Reserva</h3>
        <p className="text-sm text-gray-600 mb-4">
          Busca por email, teléfono o nombre del cliente
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ejemplo@correo.com, 099123456, Juan"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={loading || !searchQuery.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading && isSearching ? "Buscando..." : "Buscar"}
          </button>
          {isSearching && (
            <button
              onClick={loadReservations}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Ver Todas
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Tabla de Reservas */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">
          {isSearching
            ? `Resultados (${reservations.length})`
            : `Últimas 20 Reservas (${reservations.length})`}
        </h3>

        {loading && reservations.length === 0 ? (
          <p className="text-sm text-gray-500">Cargando reservas...</p>
        ) : reservations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Contacto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha/Hora
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Personas
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Nota Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Nota Interna
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
                      {reservation.name} {reservation.last_name ?? ""}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {/* Fallback para nulls */}
                      <div>{reservation.email ?? "—"}</div>
                      <div className="text-xs">{reservation.phone ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(reservation.date).toLocaleString("es-PY")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {reservation.guests}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
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
                    {/* Nota del cliente (solo lectura) */}
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px]">
                      <div className="truncate" title={reservation.notes ?? ""}>
                        {reservation.notes ?? "—"}
                      </div>
                    </td>
                    {/* Nota interna (editable) */}
                    <td className="px-4 py-3 text-sm max-w-[200px]">
                      {editingNoteId === reservation.id ? (
                        <div className="flex flex-col gap-1">
                          <textarea
                            rows={2}
                            value={noteValue}
                            onChange={(e) => setNoteValue(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded resize-none"
                            placeholder="Nota interna..."
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleSaveNote(reservation.id)}
                              disabled={updatingId === reservation.id}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              ✓ Guardar
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-1">
                          <span
                            className="truncate text-gray-600"
                            title={reservation.table_note ?? ""}
                          >
                            {reservation.table_note ?? "—"}
                          </span>
                          <button
                            onClick={() => handleStartEdit(reservation)}
                            className="ml-1 px-1 text-xs text-gray-400 hover:text-gray-600 flex-shrink-0"
                            title="Editar nota"
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {reservation.status === "en_revision" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateStatus(reservation.id, "confirmed")}
                            disabled={updatingId === reservation.id}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            ✓ Confirmar
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(reservation.id, "cancelled")}
                            disabled={updatingId === reservation.id}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            ✗ Cancelar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            {isSearching ? "No se encontraron reservas" : "No hay reservas registradas"}
          </p>
        )}
      </div>
    </div>
  );
}
