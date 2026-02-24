"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePanelContext } from "@/lib/panelContext";
import { NotAvailable } from "@/components/panel/NotAvailable";
import {
  getPanelReservationsByLocalId,
  updatePanelReservationStatus,
  type Reservation as ApiReservation,
} from "@/lib/reservations";
import {
  ReservationsView,
  type Reservation,
  type ReservationStatus,
} from "@/components/panel/views/ReservationsView";
import { downloadPanelReservationsClientsCsv } from "@/lib/panelExport";

// Helper: parsear fecha ISO a Date
function parseDate(dateStr: string): Date | null {
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

// Helper: comparar si dos fechas son el mismo día
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
  const { data: context, loading: contextLoading } = usePanelContext();
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

  // GATING TEMPRANO
  const isBlocked = context?.local.type === "club";

  useEffect(() => {
    setSelectedDate((current) =>
      current === normalizedDateFromQuery ? current : normalizedDateFromQuery
    );
    setIsFetchingForDate(Boolean(normalizedDateFromQuery));
    if (normalizedDateFromQuery) {
      setExportFrom((current) => current || normalizedDateFromQuery);
      setExportTo((current) => current || normalizedDateFromQuery);
    }
  }, [normalizedDateFromQuery]);

  const loadReservations = useCallback(async () => {
    if (isBlocked || !context || !selectedDate) return;
    setHasLoadedDate(true);
    setIsFetchingForDate(true);
    setLoading(true);
    setError(null);

    try {
      const data = await getPanelReservationsByLocalId(context.local.id);
      setReservations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar reservas");
    } finally {
      setIsFetchingForDate(false);
      setLoading(false);
    }
  }, [context, isBlocked, selectedDate]);

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

    setExportError(null);
    setExportLoading(true);
    try {
      await downloadPanelReservationsClientsCsv({ from: exportFrom, to: exportTo });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Error al exportar CSV");
    } finally {
      setExportLoading(false);
    }
  }, [exportFrom, exportLoading, exportTo]);

  const handleRefresh = useCallback(() => {
    if (!selectedDate || loading) return;
    void loadReservations();
  }, [selectedDate, loading, loadReservations]);

  // Filtrado y ordenamiento LOCAL (sin endpoint nuevo)
  const filteredReservations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const selectedDateValue = selectedDate ? new Date(`${selectedDate}T00:00:00`) : null;

    const filtered = reservations.filter((r) => {
      // Filtro por estado
      if (statusFilter !== "all" && r.status !== statusFilter) return false;

      // Filtro por fecha (comparar día)
      if (selectedDateValue) {
        const reservationDate = parseDate(r.date);
        if (!reservationDate || !isSameDay(reservationDate, selectedDateValue)) return false;
      }

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
  }, [reservations, searchQuery, selectedDate, statusFilter, sortBy]);

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
      await updatePanelReservationStatus(reservation.id, { status: "confirmed" });
      await loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al confirmar reserva");
    }
  };

  const handleCancel = async (reservation: Reservation) => {
    if (isBlocked) return;
    try {
      await updatePanelReservationStatus(reservation.id, { status: "cancelled" });
      await loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cancelar reserva");
    }
  };

  const handleEdit = (reservation: Reservation) => {
    // TODO: Abrir modal de edición de nota interna
    console.log("Editar reserva", reservation.id);
  };

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
    </>
  );
}
