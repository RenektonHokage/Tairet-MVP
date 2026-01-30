"use client";

import * as React from "react";
import { BarChart3, CalendarDays, CheckCircle2, Clock, Filter, Search } from "lucide-react";

import { Badge, EmptyState, PageHeader, StatCard, Toolbar, cn, panelUi } from "../ui";
import { ReservationCard, type Reservation, type ReservationStatus } from "./ReservationCard";

// Re-export para conveniencia de la page
export type { Reservation, ReservationStatus };

const statusOptions: Array<{ value: "all" | ReservationStatus; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "confirmed", label: "Confirmadas" },
  { value: "en_revision", label: "Pendientes" },
  { value: "cancelled", label: "Canceladas" },
];

export interface ReservationsViewStats {
  total: number;
  confirmed: number;
  pending: number;
  today: number;
}

export interface ReservationsViewProps {
  // Data
  reservations: Reservation[];
  stats: ReservationsViewStats;

  // Filter states (controlados desde page)
  searchQuery: string;
  onSearchChange: (value: string) => void;

  selectedDate: string;
  onDateChange: (value: string) => void;

  statusFilter: "all" | ReservationStatus;
  onStatusFilterChange: (value: "all" | ReservationStatus) => void;

  sortBy: "time" | "name";
  onSortChange: (value: "time" | "name") => void;

  // Handlers para acciones de reservas
  onConfirm: (reservation: Reservation) => void;
  onCancel: (reservation: Reservation) => void;
  onEdit: (reservation: Reservation) => void;

  // Handler para limpiar filtros
  onClearFilters: () => void;

  // Loading state (opcional)
  loading?: boolean;
}

export function ReservationsView({
  reservations,
  stats,
  searchQuery,
  onSearchChange,
  selectedDate,
  onDateChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortChange,
  onConfirm,
  onCancel,
  onEdit,
  onClearFilters,
  loading,
}: ReservationsViewProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservas"
        subtitle="Gestiona confirmaciones, notas y horarios del local."
        breadcrumbs={[
          { label: "Panel", href: "/panel" },
          { label: "Reservas" },
        ]}
      />

      {/* Stats KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Total reservas"
          value={
            <div className="flex items-center justify-between gap-3">
              <span>{stats.total}</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-[#8d1313]">
                <BarChart3 className="h-5 w-5" />
              </span>
            </div>
          }
        />
        <StatCard
          label="Confirmadas"
          value={
            <div className="flex items-center justify-between gap-3">
              <span>{stats.confirmed}</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </span>
            </div>
          }
        />
        <StatCard
          label="Pendientes"
          value={
            <div className="flex items-center justify-between gap-3">
              <span>{stats.pending}</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Clock className="h-5 w-5" />
              </span>
            </div>
          }
        />
        <StatCard
          label="Hoy"
          value={
            <div className="flex items-center justify-between gap-3">
              <span>{stats.today}</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <CalendarDays className="h-5 w-5" />
              </span>
            </div>
          }
        />
      </div>

      {/* Toolbar: búsqueda + filtros */}
      <Toolbar
        left={
          <div className="flex w-full flex-1 flex-col gap-1 min-w-0">
            <label className="text-xs font-medium text-neutral-600" htmlFor="search-reservations">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                id="search-reservations"
                className={cn(
                  "w-full rounded-full border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900",
                  panelUi.focusRing
                )}
                placeholder="Buscar por nombre, telefono o email..."
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>
          </div>
        }
        right={
          <div className="flex w-full flex-wrap items-end gap-3 shrink-0 lg:w-auto lg:justify-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-600" htmlFor="date-filter">
                Fecha
              </label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <input
                  id="date-filter"
                  className={cn(
                    "rounded-full border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900",
                    panelUi.focusRing
                  )}
                  type="date"
                  value={selectedDate}
                  onChange={(event) => onDateChange(event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-600" htmlFor="status-filter">
                Estado
              </label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <select
                  id="status-filter"
                  className={cn(
                    "appearance-none rounded-full border border-neutral-200 bg-white py-2 pl-9 pr-8 text-sm text-neutral-900",
                    panelUi.focusRing
                  )}
                  value={statusFilter}
                  onChange={(event) =>
                    onStatusFilterChange(event.target.value as "all" | ReservationStatus)
                  }
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">
                  ▾
                </span>
              </div>
            </div>
          </div>
        }
      />

      {/* Sort bar + count badge */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Badge variant="neutral">
            {loading ? "Cargando..." : `${reservations.length} reservas`}
          </Badge>
          {selectedDate ? (
            <span className="text-xs text-neutral-500">Filtrado por fecha</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            className={cn(
              "rounded-full px-4 py-2 text-xs font-semibold",
              panelUi.focusRing,
              sortBy === "time"
                ? "bg-[#8d1313] text-white shadow-sm"
                : "border border-neutral-200 bg-white text-neutral-700"
            )}
            type="button"
            onClick={() => onSortChange("time")}
          >
            Por hora
          </button>
          <button
            className={cn(
              "rounded-full px-4 py-2 text-xs font-semibold",
              panelUi.focusRing,
              sortBy === "name"
                ? "bg-[#8d1313] text-white shadow-sm"
                : "border border-neutral-200 bg-white text-neutral-700"
            )}
            type="button"
            onClick={() => onSortChange("name")}
          >
            Por nombre
          </button>
        </div>
      </div>

      {/* Reservations grid o empty state */}
      {reservations.length === 0 ? (
        <EmptyState
          title="No hay reservas para estos filtros"
          description="Proba ajustando la fecha o el estado para ver resultados."
          action={
            <button
              className={cn(
                "rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700",
                panelUi.focusRing
              )}
              type="button"
              onClick={onClearFilters}
            >
              Limpiar filtros
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {reservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              onConfirm={onConfirm}
              onCancel={onCancel}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
