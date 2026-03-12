"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePanelContext } from "@/lib/panelContext";
import { NotAvailable } from "@/components/panel/NotAvailable";
import {
  getPanelReservationsByLocalIdAndDate,
  updatePanelReservationStatus,
  type Reservation as ApiReservation,
} from "@/lib/reservations";
import {
  ReservationsView,
  type Reservation,
  type ReservationStatus,
} from "@/components/panel/views/ReservationsView";
import { downloadPanelReservationsClientsCsv } from "@/lib/panelExport";
import {
  getPanelDemoBarReservationsByDate,
  getPanelDemoBarReservationsDefaultDate,
  updatePanelDemoBarReservation,
} from "@/lib/panel-demo/reservations";

// Helper: parsear fecha ISO a Date
function parseDate(dateStr: string): Date | null {
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isValidDateParam(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function ReservationsPage() {
  const {
    data: context,
    loading: contextLoading,
    isDemo,
    demoScenario,
  } = usePanelContext();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Estados de data (ApiReservation es superset de Reservation)
  const [reservations, setReservations] = useState<ApiReservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedDate, setHasLoadedDate] = useState(false);

  // Estados de filtros UI
  const [searchQuery, setSearchQuery] = useState("");
  const dateFromQuery = searchParams.get("date") ?? "";
  const normalizedDateFromQuery = isValidDateParam(dateFromQuery) ? dateFromQuery : "";
  const [selectedDate, setSelectedDate] = useState(normalizedDateFromQuery);
  const [isFetchingForDate, setIsFetchingForDate] = useState(Boolean(normalizedDateFromQuery));
  const [statusFilter, setStatusFilter] = useState<"all" | ReservationStatus>("all");
  const [sortBy, setSortBy] = useState<"time" | "name">("time");
  const [exportFrom, setExportFrom] = useState(normalizedDateFromQuery);
  const [exportTo, setExportTo] = useState(normalizedDateFromQuery);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [noteSavingId, setNoteSavingId] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  // GATING TEMPRANO
  const isBlocked = context?.local.type === "club";
  const isDemoBar = isDemo && demoScenario === "bar" && context?.local.type === "bar";
  const demoDefaultDate = useMemo(
    () => (isDemoBar ? getPanelDemoBarReservationsDefaultDate() : ""),
    [isDemoBar]
  );

  useEffect(() => {
    const nextDate =
      normalizedDateFromQuery || (isDemoBar && demoDefaultDate ? demoDefaultDate : "");

    setSelectedDate((current) =>
      current === nextDate ? current : nextDate
    );
    setIsFetchingForDate(Boolean(nextDate));
    if (nextDate) {
      setExportFrom((current) => current || nextDate);
      setExportTo((current) => current || nextDate);
    }

    if (!normalizedDateFromQuery && isDemoBar && demoDefaultDate) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", demoDefaultDate);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [
    demoDefaultDate,
    isDemoBar,
    normalizedDateFromQuery,
    pathname,
    router,
    searchParams,
  ]);

  const loadReservations = useCallback(async () => {
    if (isBlocked || !context || !selectedDate) return;
    setHasLoadedDate(true);
    setIsFetchingForDate(true);
    setLoading(true);
    setError(null);

    try {
      const data = isDemoBar
        ? getPanelDemoBarReservationsByDate(selectedDate)
        : await getPanelReservationsByLocalIdAndDate(context.local.id, selectedDate);
      setReservations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar reservas");
    } finally {
      setIsFetchingForDate(false);
      setLoading(false);
    }
  }, [context, isBlocked, isDemoBar, selectedDate]);

  // Cargar reservas cuando ya hay fecha seleccionada
  useEffect(() => {
    if (contextLoading || isBlocked || !context) return;

    if (!selectedDate) {
      setReservations([]);
      setHasLoadedDate(false);
      setIsFetchingForDate(false);
      setLoading(false);
      setError(null);
      return;
    }

    void loadReservations();
  }, [contextLoading, isBlocked, context, selectedDate, loadReservations]);

  const handleDateChange = useCallback(
    (value: string) => {
      if (value !== selectedDate) {
        setReservations([]);
        setHasLoadedDate(false);
      }
      setIsFetchingForDate(Boolean(value));
      setSelectedDate(value);
      if (value) {
        setExportFrom(value);
        setExportTo(value);
      }
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("date", value);
      } else {
        params.delete("date");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, selectedDate]
  );

  const handleExport = useCallback(async () => {
    if (!exportFrom || !exportTo || exportLoading) {
      return;
    }

    if (isDemoBar) {
      setExportError("La exportacion CSV no esta disponible en modo demo.");
      return;
    }

    setExportError(null);
    setExportLoading(true);
    try {
      await downloadPanelReservationsClientsCsv({ from: exportFrom, to: exportTo });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Error al exportar CSV");
    } finally {
      setExportLoading(false);
    }
  }, [exportFrom, exportLoading, exportTo, isDemoBar]);

  const handleRefresh = useCallback(() => {
    if (!selectedDate || loading) return;
    void loadReservations();
  }, [selectedDate, loading, loadReservations]);

  // Filtrado y ordenamiento LOCAL sobre dataset ya acotado por fecha en backend
  const filteredReservations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filtered = reservations.filter((r) => {
      // Filtro por estado
      if (statusFilter !== "all" && r.status !== statusFilter) return false;

      // Filtro por búsqueda (nombre, email, teléfono)
      if (normalizedQuery) {
        const fullName = [r.name, r.last_name].filter(Boolean).join(" ");
        const haystack = `${fullName} ${r.phone ?? ""} ${r.email ?? ""}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }

      return true;
    });

    // Ordenar
    return filtered.sort((a, b) => {
      if (sortBy === "name") {
        const nameA = [a.name, a.last_name].filter(Boolean).join(" ").toLowerCase();
        const nameB = [b.name, b.last_name].filter(Boolean).join(" ").toLowerCase();
        return nameA.localeCompare(nameB);
      }
      const dateA = parseDate(a.date)?.getTime() ?? 0;
      const dateB = parseDate(b.date)?.getTime() ?? 0;
      return dateA - dateB;
    });
  }, [reservations, searchQuery, statusFilter, sortBy]);

  // Stats calculadas sobre lista filtrada
  const stats = useMemo(() => {
    const today = new Date();
    return {
      total: filteredReservations.length,
      confirmed: filteredReservations.filter((r) => r.status === "confirmed").length,
      pending: filteredReservations.filter((r) => r.status === "en_revision").length,
      today: filteredReservations.filter((r) => {
        const d = parseDate(r.date);
        return d ? isSameDay(d, today) : false;
      }).length,
    };
  }, [filteredReservations]);

  // Handlers para acciones de reservas (usan el tipo de la View)
  const handleConfirm = async (reservation: Reservation) => {
    if (isBlocked) return;
    try {
      if (isDemoBar && selectedDate) {
        setReservations(
          updatePanelDemoBarReservation(selectedDate, reservation.id, {
            status: "confirmed",
          })
        );
        return;
      }

      await updatePanelReservationStatus(reservation.id, { status: "confirmed" });
      await loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al confirmar reserva");
    }
  };

  const handleCancel = async (reservation: Reservation) => {
    if (isBlocked) return;
    try {
      if (isDemoBar && selectedDate) {
        setReservations(
          updatePanelDemoBarReservation(selectedDate, reservation.id, {
            status: "cancelled",
          })
        );
        return;
      }

      await updatePanelReservationStatus(reservation.id, { status: "cancelled" });
      await loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cancelar reserva");
    }
  };

  const handleEdit = (reservation: Reservation) => {
    if (isBlocked || noteSavingId) return;

    setNoteError(null);
    setEditingReservation(reservation);
    setNoteDraft(reservation.table_note?.trim() ?? "");
  };

  const closeEditModal = useCallback(() => {
    if (noteSavingId) return;
    setEditingReservation(null);
    setNoteDraft("");
    setNoteError(null);
  }, [noteSavingId]);

  const handleSaveNote = useCallback(async () => {
    if (isBlocked || !editingReservation || noteSavingId) return;

    const normalizedValue = noteDraft.trim();
    if (normalizedValue.length > 500) {
      setNoteError("La nota interna no puede superar los 500 caracteres.");
      return;
    }

    const tableNote = normalizedValue.length > 0 ? normalizedValue : null;
    setNoteError(null);
    setNoteSavingId(editingReservation.id);

    try {
      if (isDemoBar && selectedDate) {
        setReservations(
          updatePanelDemoBarReservation(selectedDate, editingReservation.id, {
            table_note: tableNote,
          })
        );
        setEditingReservation(null);
        setNoteDraft("");
        return;
      }

      const updated = await updatePanelReservationStatus(editingReservation.id, { table_note: tableNote });
      const savedNote = updated.table_note ?? tableNote;

      setReservations((prev) =>
        prev.map((item) =>
          item.id === editingReservation.id
            ? {
                ...item,
                table_note: savedNote,
              }
            : item
        )
      );
      setEditingReservation(null);
      setNoteDraft("");
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Error al actualizar nota interna");
    } finally {
      setNoteSavingId(null);
    }
  }, [editingReservation, isBlocked, isDemoBar, noteDraft, noteSavingId, selectedDate]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
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

  // RENDER PRINCIPAL con ReservationsView
  const noteDraftLength = noteDraft.length;
  const noteDraftTooLong = noteDraftLength > 500;
  const isSavingNote = Boolean(editingReservation && noteSavingId === editingReservation.id);
  const editingReservationName = editingReservation
    ? [editingReservation.name, editingReservation.last_name].filter(Boolean).join(" ")
    : "";

  return (
    <>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {exportError && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">{exportError}</p>
        </div>
      )}
      {noteError && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">{noteError}</p>
        </div>
      )}
      {noteSavingId && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">Guardando nota interna...</p>
        </div>
      )}
      <ReservationsView
        reservations={filteredReservations}
        stats={stats}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onRefresh={handleRefresh}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onEdit={handleEdit}
        onClearFilters={handleClearFilters}
        exportFrom={exportFrom}
        exportTo={exportTo}
        onExportFromChange={(value) => {
          setExportError(null);
          setExportFrom(value);
        }}
        onExportToChange={(value) => {
          setExportError(null);
          setExportTo(value);
        }}
        onExport={handleExport}
        exportLoading={exportLoading}
        loading={loading}
        hasLoadedDate={hasLoadedDate}
        isFetchingForDate={isFetchingForDate}
      />

      {editingReservation && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 py-4 sm:items-center sm:py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-note-title"
          onClick={closeEditModal}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-1">
              <h2 id="edit-note-title" className="text-base font-semibold text-neutral-900 sm:text-lg">
                Editar nota interna
              </h2>
              <p className="text-xs text-neutral-600 sm:text-sm">
                {editingReservationName || "Reserva seleccionada"} · {editingReservation.date}
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <label htmlFor="table-note-editor" className="text-xs font-medium text-neutral-700 sm:text-sm">
                Nota de operación
              </label>
              <textarea
                id="table-note-editor"
                value={noteDraft}
                onChange={(event) => {
                  setNoteDraft(event.target.value);
                  if (noteError) {
                    setNoteError(null);
                  }
                }}
                rows={5}
                maxLength={2000}
                className="w-full resize-y rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[#8d1313] focus:ring-2 focus:ring-[#8d1313]/20"
                placeholder="Agregar nota interna para operación..."
                disabled={isSavingNote}
              />
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs ${noteDraftTooLong ? "text-rose-700" : "text-neutral-500"}`}>
                  {noteDraftLength}/500
                </span>
                {noteDraftTooLong && (
                  <span className="text-xs font-medium text-rose-700">
                    La nota interna no puede superar los 500 caracteres.
                  </span>
                )}
              </div>
              {noteError && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:text-sm">
                  {noteError}
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={isSavingNote}
                className="inline-flex h-9 items-center justify-center rounded-full border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveNote()}
                disabled={isSavingNote || noteDraftTooLong}
                className="inline-flex h-9 items-center justify-center rounded-full bg-[#8d1313] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingNote ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
