"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePanelContext } from "@/lib/panelContext";
import { ApiError } from "@/lib/api";
import { reservationDateLabel } from "@/lib/reservationDate";
import { formatTimePy } from "@/lib/time";
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
import { downloadPanelReservationsClientsExcel } from "@/lib/panelExport";
import {
  getPanelDemoBarReservationsByDate,
  getPanelDemoBarReservationsDefaultDate,
  updatePanelDemoBarReservation,
} from "@/lib/panel-demo/reservations";
import { getPanelDemoReservationActivityItems } from "@/lib/panel-demo/operationalActivity";

const RESERVATIONS_AUTO_REFRESH_MS = 15000;

type RefreshMode = "foreground" | "background";

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

type EditedFields = Partial<Pick<ApiReservation, "status" | "table_note" | "cancel_reason">>;

function mergeReceipt<T extends { updated_at?: string | null; status?: ReservationStatus; cancel_reason?: string | null }>(
  current: T,
  fields: EditedFields,
  savedAt: string | null,
) {
  const keepCurrentTime = !savedAt || (current.updated_at && Date.parse(current.updated_at) > Date.parse(savedAt));
  const merged = { ...current, ...fields, updated_at: keepCurrentTime ? current.updated_at ?? null : savedAt };
  // A later operator may already have cancelled the confirmation we just received.
  if (current.status === "cancelled" && fields.status === "confirmed") {
    return { ...merged, status: current.status, cancel_reason: current.cancel_reason };
  }
  return merged;
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
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

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
  // Only receipts committed while the current list request is in flight need merging.
  const receiptsDuringRead = useRef<Map<string, Partial<ApiReservation>> | null>(null);
  const statusRequests = useRef(new Set<string>());
  const [busyReservations, setBusyReservations] = useState<ReadonlySet<string>>(new Set());
  const [actionResult, setActionResult] = useState("");
  const [noteSavingId, setNoteSavingId] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const reservationsRequestIdRef = useRef(0);
  const reservationsInFlightRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const editingReservationIdRef = useRef<string | null>(null);

  // GATING TEMPRANO
  const isBlocked = context?.local.type === "club";
  const isDemoBar = isDemo && demoScenario === "bar" && context?.local.type === "bar";
  const canExport = context?.role === "owner";
  const demoDefaultDate = useMemo(
    () => (isDemoBar ? getPanelDemoBarReservationsDefaultDate() : ""),
    [isDemoBar]
  );

  useEffect(() => {
    editingReservationIdRef.current = editingReservation?.id ?? null;
  }, [editingReservation?.id]);

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

  const loadReservations = useCallback(async (
    mode: RefreshMode = "foreground"
  ) => {
    if (isBlocked || !context || !selectedDate) return;
    if (reservationsInFlightRef.current) return;

    const isBackground = mode === "background";
    const requestId = ++reservationsRequestIdRef.current;
    reservationsInFlightRef.current = true;
    const receipts = new Map<string, Partial<ApiReservation>>();
    receiptsDuringRead.current = receipts;
    setHasLoadedDate(true);
    if (!isBackground) {
      setIsFetchingForDate(true);
      setLoading(true);
      setError(null);
    }

    try {
      const data = isDemoBar
        ? getPanelDemoBarReservationsByDate(selectedDate)
        : await getPanelReservationsByLocalIdAndDate(context.local.id, selectedDate);

      if (requestId !== reservationsRequestIdRef.current) {
        return;
      }

      const refreshed = data.map(item => {
        const saved = receipts.get(item.id);
        return saved ? mergeReceipt(item, saved, saved.updated_at ?? null) : item;
      });
      setReservations((current) => {
        const editingId = editingReservationIdRef.current;
        if (!isBackground || !editingId) {
          return refreshed;
        }

        const currentEditingReservation = current.find((item) => item.id === editingId);
        if (!currentEditingReservation) {
          return refreshed;
        }

        return refreshed.map((item) =>
          item.id === editingId
            ? {
                ...item,
                table_note: currentEditingReservation.table_note,
              }
            : item
        );
      });
      setLastRefreshAt(new Date());
      setRefreshError(null);
    } catch (err) {
      if (requestId !== reservationsRequestIdRef.current) {
        return;
      }
      if (isBackground) {
        throw err;
      }
      setError(err instanceof Error ? err.message : "Error al cargar reservas");
    } finally {
      if (receiptsDuringRead.current === receipts) receiptsDuringRead.current = null;
      reservationsInFlightRef.current = false;
      if (requestId === reservationsRequestIdRef.current && !isBackground) {
        setIsFetchingForDate(false);
        setLoading(false);
      }
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

  const refreshReservationsData = useCallback(async (
    mode: RefreshMode = "background"
  ) => {
    if (refreshInFlightRef.current || contextLoading || isBlocked || !context || !selectedDate) {
      return;
    }

    refreshInFlightRef.current = true;
    if (mode === "foreground") {
      setRefreshLoading(true);
    }

    try {
      await loadReservations(mode);
      setRefreshError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar reservas.";
      setRefreshError(
        mode === "background"
          ? `No se pudo actualizar en segundo plano: ${message}`
          : message
      );
    } finally {
      refreshInFlightRef.current = false;
      if (mode === "foreground") {
        setRefreshLoading(false);
      }
    }
  }, [
    context,
    contextLoading,
    isBlocked,
    loadReservations,
    selectedDate,
  ]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshTick((current) => current + 1);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (contextLoading || isBlocked || !context || isDemoBar || !selectedDate) {
      return;
    }

    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void refreshReservationsData("background");
    };

    const intervalId = window.setInterval(
      refreshIfVisible,
      RESERVATIONS_AUTO_REFRESH_MS
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshReservationsData("background");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    context,
    contextLoading,
    isBlocked,
    isDemoBar,
    refreshReservationsData,
    selectedDate,
  ]);

  const handleDateChange = useCallback(
    (value: string) => {
      if (value !== selectedDate) {
        setReservations([]);
        setHasLoadedDate(false);
        setLastRefreshAt(null);
        setRefreshError(null);
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
    if (!canExport || !exportFrom || !exportTo || exportLoading) {
      return;
    }

    if (isDemoBar) {
      setExportError("La exportacion Excel no esta disponible en modo demo.");
      return;
    }

    setExportError(null);
    setExportLoading(true);
    try {
      await downloadPanelReservationsClientsExcel({ from: exportFrom, to: exportTo });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Error al exportar Excel");
    } finally {
      setExportLoading(false);
    }
  }, [canExport, exportFrom, exportLoading, exportTo, isDemoBar]);

  const handleRefresh = useCallback(() => {
    if (!selectedDate || loading || refreshLoading) return;
    void refreshReservationsData("foreground");
  }, [selectedDate, loading, refreshLoading, refreshReservationsData]);

  const lastRefreshLabel = useMemo(() => {
    void refreshTick;

    if (!lastRefreshAt) {
      return "Actualizado: pendiente";
    }

    const seconds = Math.max(
      0,
      Math.floor((Date.now() - lastRefreshAt.getTime()) / 1000)
    );

    if (seconds < 5) {
      return "Actualizado recién";
    }

    if (seconds < 60) {
      return `Actualizado hace ${seconds}s`;
    }

    return `Actualizado hace ${Math.floor(seconds / 60)} min`;
  }, [lastRefreshAt, refreshTick]);

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
  const applyReceipt = useCallback((id: string, fields: EditedFields, savedAt: string | null) => {
    const receipts = receiptsDuringRead.current;
    if (receipts) {
      receipts.set(id, mergeReceipt(receipts.get(id) ?? {}, fields, savedAt));
    }
    setReservations(rows => rows.map(row => row.id === id ? mergeReceipt(row, fields, savedAt) : row));
  }, []);

  const changeStatus = async (reservation: Reservation, status: "confirmed" | "cancelled", reason?: string) => {
    if (isBlocked || reservation.status === "cancelled" || statusRequests.current.has(reservation.id)) return;
    if (reservation.status === "confirmed" &&
        (status !== "cancelled" || !reason || Array.from(reason).length > 160 || isDemoBar)) return;
    statusRequests.current.add(reservation.id);
    setBusyReservations(new Set(statusRequests.current));
    setActionResult("");
    setError(null);
    const input = { status, expected_status: reservation.status, cancel_reason: reason };

    try {
      if (isDemoBar && selectedDate) {
        setReservations(updatePanelDemoBarReservation(selectedDate, reservation.id, input));
      } else {
        const saved = await updatePanelReservationStatus(reservation.id, input);
        applyReceipt(saved.id, {status: saved.status, cancel_reason: saved.cancel_reason}, saved.updated_at);
      }
      if (reason) setCancelTarget(null);
      setActionResult(status === "confirmed" ? "Reserva confirmada." : "Reserva cancelada.");
    } catch (err) {
      if (reason && err instanceof ApiError && err.status === 409) setCancelTarget(null);
      await loadReservations();
      setError(err instanceof Error ? err.message : "No se pudo actualizar la reserva.");
    } finally {
      statusRequests.current.delete(reservation.id);
      setBusyReservations(new Set(statusRequests.current));
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
      applyReceipt(updated.id, {table_note: updated.table_note}, updated.updated_at);
      setEditingReservation(null);
      setNoteDraft("");
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Error al actualizar nota interna");
    } finally {
      setNoteSavingId(null);
    }
  }, [applyReceipt, editingReservation, isBlocked, isDemoBar, noteDraft, noteSavingId, selectedDate]);

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
  const dialogReservation = cancelTarget ?? editingReservation;
  const normalizedReason = reasonDraft.trim();
  const draftLength = cancelTarget ? Array.from(normalizedReason).length : noteDraft.length;
  const draftLimit = cancelTarget ? 160 : 500;
  const invalidDraft = draftLength > draftLimit || (Boolean(cancelTarget) && !draftLength);
  const saving = cancelTarget ? busyReservations.has(cancelTarget.id) : Boolean(noteSavingId);
  const dialogError = cancelTarget ? error : noteError;
  const closeDialog = () => {
    if (saving) return;
    if (cancelTarget) setCancelTarget(null);
    else closeEditModal();
  };
  const dialogName = dialogReservation
    ? [dialogReservation.name, dialogReservation.last_name].filter(Boolean).join(" ")
    : "";

  return (
    <>
      {actionResult && <p role="status" className="mb-4 text-sm text-emerald-800">{actionResult}</p>}
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
        onConfirm={reservation => void changeStatus(reservation, "confirmed")}
        allowConfirmedCancellation={context.local.type === "bar" && !isDemoBar}
        onCancel={reservation => {
          if (reservation.status === "confirmed") {
            setReasonDraft("");
            setError(null);
            setCancelTarget(reservation);
          } else {
            void changeStatus(reservation, "cancelled");
          }
        }}
        busyReservations={busyReservations}
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
        showExport={canExport}
        loading={loading}
        hasLoadedDate={hasLoadedDate}
        isFetchingForDate={isFetchingForDate}
        refreshLoading={refreshLoading}
        lastRefreshLabel={lastRefreshLabel}
        refreshError={refreshError}
        showActivityHistory
        getActivityHistoryItems={
          isDemoBar ? getPanelDemoReservationActivityItems : undefined
        }
      />

      {dialogReservation && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 py-4 sm:items-center sm:py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reservation-editor-title"
          onClick={closeDialog}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-1">
              <h2 id="reservation-editor-title" className="text-base font-semibold text-neutral-900 sm:text-lg">
                {cancelTarget ? "Cancelar reserva confirmada" : "Editar nota interna"}
              </h2>
              <p className="text-xs text-neutral-600 sm:text-sm">
                {dialogName || "Reserva seleccionada"} · {reservationDateLabel(dialogReservation.date)} · {formatTimePy(dialogReservation.date)}
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <label htmlFor="reservation-editor" className="text-xs font-medium text-neutral-700 sm:text-sm">
                {cancelTarget ? "Motivo que se comunicará al cliente (obligatorio)" : "Nota de operación"}
              </label>
              <textarea
                id="reservation-editor"
                value={cancelTarget ? reasonDraft : noteDraft}
                onChange={(event) => {
                  if (cancelTarget) {
                    setReasonDraft(event.target.value);
                    setError(null);
                  } else {
                    setNoteDraft(event.target.value);
                    setNoteError(null);
                  }
                }}
                rows={5}
                maxLength={2000}
                className="w-full resize-y rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[#8d1313] focus:ring-2 focus:ring-[#8d1313]/20"
                placeholder={cancelTarget ? "Indicá el motivo de la cancelación" : "Agregar nota interna para operación..."}
                required={Boolean(cancelTarget)}
                disabled={saving}
              />
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs ${draftLength > draftLimit ? "text-rose-700" : "text-neutral-500"}`}>
                  {draftLength}/{draftLimit}
                </span>
                {draftLength > draftLimit && (
                  <span className="text-xs font-medium text-rose-700">
                    El texto no puede superar los {draftLimit} caracteres.
                  </span>
                )}
              </div>
              {dialogError && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:text-sm">
                  {dialogError}
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeDialog}
                disabled={saving}
                className="inline-flex h-9 items-center justify-center rounded-full border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelTarget ? "Volver" : "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => cancelTarget
                  ? void changeStatus(cancelTarget, "cancelled", normalizedReason)
                  : void handleSaveNote()}
                disabled={saving || invalidDraft}
                className="inline-flex h-9 items-center justify-center rounded-full bg-[#8d1313] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Guardando..." : cancelTarget ? "Confirmar cancelación" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
