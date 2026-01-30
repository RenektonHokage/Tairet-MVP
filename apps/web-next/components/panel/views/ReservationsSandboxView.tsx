"use client";

import * as React from "react";
import { BarChart3, CalendarDays, CheckCircle2, Clock, Filter, Search } from "lucide-react";

import { Badge, EmptyState, PageHeader, StatCard, Toolbar, cn, panelUi } from "../ui";
import { ReservationCard, type Reservation, type ReservationStatus } from "./ReservationCard";

const mockReservations: Reservation[] = [
  {
    id: "res-1001",
    name: "Laura",
    last_name: "Diaz",
    email: "laura.diaz@email.com",
    phone: "+595 981 111 222",
    date: "25/1/2026, 7:00:00 p. m.",
    guests: 4,
    status: "confirmed",
    notes: "Mesa cerca de la pista.",
    table_note: "Cliente frecuente, mantener contacto.",
  },
  {
    id: "res-1002",
    name: "Juan",
    last_name: "Rodriguez",
    email: "juan.rod@email.com",
    phone: "+595 981 333 444",
    date: "25/1/2026, 9:30:00 p. m.",
    guests: 6,
    status: "en_revision",
    notes: "Celebracion de cumpleanos.",
    table_note: "Confirmar presupuesto de botella.",
  },
  {
    id: "res-1003",
    name: "Pedro",
    last_name: "Sanchez",
    email: "pedro.s@email.com",
    phone: "+595 981 555 666",
    date: "24/1/2026, 10:00:00 p. m.",
    guests: 5,
    status: "cancelled",
    notes: "Grupo de amigos.",
    table_note: "Cancelado por el cliente.",
  },
  {
    id: "res-1004",
    name: "Valeria",
    last_name: "Lopez",
    email: "valeria.l@email.com",
    phone: "+595 981 777 888",
    date: "26/1/2026, 8:15:00 p. m.",
    guests: 3,
    status: "confirmed",
    notes: "Prefiere mesa alta.",
    table_note: "Coordinar ingreso con seguridad.",
  },
  {
    id: "res-1005",
    name: "Diego",
    last_name: "Martinez",
    email: "diego.m@email.com",
    phone: "+595 982 111 999",
    date: "27/1/2026, 6:45:00 p. m.",
    guests: 2,
    status: "en_revision",
    notes: "Cena de negocios.",
    table_note: "Confirmar mesa privada.",
  },
  {
    id: "res-1006",
    name: "Camila",
    last_name: "Gomez",
    email: "camila.g@email.com",
    phone: "+595 982 222 333",
    date: "27/1/2026, 9:00:00 p. m.",
    guests: 7,
    status: "confirmed",
    notes: "Trae invitados internacionales.",
    table_note: "Preparar menu en ingles.",
  },
  {
    id: "res-1007",
    name: "Marcos",
    last_name: "Silva",
    email: "marcos.s@email.com",
    phone: "+595 982 444 555",
    date: "28/1/2026, 7:30:00 p. m.",
    guests: 4,
    status: "en_revision",
    notes: "Mesa para grupo pequeno.",
    table_note: "Revisar disponibilidad terraza.",
  },
  {
    id: "res-1008",
    name: "Sofia",
    last_name: "Rojas",
    email: "sofia.r@email.com",
    phone: "+595 982 666 777",
    date: "30/1/2026, 10:00:00 p. m.",
    guests: 8,
    status: "cancelled",
    notes: "Evento corporativo.",
    table_note: "Revisar para reagendar.",
  },
  {
    id: "res-1009",
    name: "Andrea",
    last_name: "Mendoza",
    email: "andrea.m@email.com",
    phone: "+595 983 101 202",
    date: "25/1/2026, 6:15:00 p. m.",
    guests: 2,
    status: "confirmed",
    notes: "Mesa tranquila, musica baja.",
    table_note: "Ofrecer upgrade a VIP.",
  },
  {
    id: "res-1010",
    name: "Tomas",
    last_name: "Garcia",
    email: "tomas.g@email.com",
    phone: "+595 983 303 404",
    date: "29/1/2026, 8:45:00 p. m.",
    guests: 5,
    status: "en_revision",
    notes: "Primera visita.",
    table_note: "Asignar mesa cerca de la barra.",
  },
];

const statusOptions: Array<{ value: "all" | ReservationStatus; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "confirmed", label: "Confirmadas" },
  { value: "en_revision", label: "Pendientes" },
  { value: "cancelled", label: "Canceladas" },
];

function parseReservationDate(value: string): Date | null {
  const [datePart, timePartRaw] = value.split(",").map((part) => part.trim());
  if (!datePart) return null;
  const [dayStr, monthStr, yearStr] = datePart.split("/");
  const day = Number(dayStr);
  const month = Number(monthStr) - 1;
  const year = Number(yearStr);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (timePartRaw) {
    const isPm = /p\.?\s?m\.?/i.test(timePartRaw);
    const timePart = timePartRaw
      .replace(/a\.?\s?m\.?|p\.?\s?m\.?/i, "")
      .trim();
    const [hourStr, minuteStr, secondStr] = timePart.split(":");
    hours = Number(hourStr || 0);
    minutes = Number(minuteStr || 0);
    seconds = Number(secondStr || 0);
    if (isPm && hours < 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;
  }

  return new Date(year, month, day, hours, minutes, seconds);
}

function isSameDay(date: Date, compareTo: Date) {
  return (
    date.getFullYear() === compareTo.getFullYear() &&
    date.getMonth() === compareTo.getMonth() &&
    date.getDate() === compareTo.getDate()
  );
}

export function ReservationsSandboxView() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedDate, setSelectedDate] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | ReservationStatus>("all");
  const [sortBy, setSortBy] = React.useState<"time" | "name">("time");

  const filteredReservations = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const selectedDateValue = selectedDate
      ? new Date(`${selectedDate}T00:00:00`)
      : null;

    const filtered = mockReservations.filter((reservation) => {
      if (statusFilter !== "all" && reservation.status !== statusFilter) return false;

      if (selectedDateValue) {
        const reservationDate = parseReservationDate(reservation.date);
        if (!reservationDate || !isSameDay(reservationDate, selectedDateValue)) return false;
      }

      if (normalizedQuery) {
        const fullName = [reservation.name, reservation.last_name].filter(Boolean).join(" ");
        const haystack = `${fullName} ${reservation.phone ?? ""} ${
          reservation.email ?? ""
        }`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "name") {
        const nameA = [a.name, a.last_name].filter(Boolean).join(" ").toLowerCase();
        const nameB = [b.name, b.last_name].filter(Boolean).join(" ").toLowerCase();
        return nameA.localeCompare(nameB);
      }
      const dateA = parseReservationDate(a.date)?.getTime() ?? 0;
      const dateB = parseReservationDate(b.date)?.getTime() ?? 0;
      return dateA - dateB;
    });
  }, [searchQuery, selectedDate, sortBy, statusFilter]);

  const stats = React.useMemo(() => {
    const today = new Date();
    return {
      total: filteredReservations.length,
      confirmed: filteredReservations.filter((reservation) => reservation.status === "confirmed")
        .length,
      pending: filteredReservations.filter((reservation) => reservation.status === "en_revision")
        .length,
      today: filteredReservations.filter((reservation) => {
        const reservationDate = parseReservationDate(reservation.date);
        return reservationDate ? isSameDay(reservationDate, today) : false;
      }).length,
    };
  }, [filteredReservations]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservas"
        subtitle="Gestiona confirmaciones, notas y horarios del local."
        breadcrumbs={[
          { label: "Panel", href: "/panel" },
          { label: "Marketing", href: "/panel/marketing" },
          { label: "Lineup" },
        ]}
      />

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
                onChange={(event) => setSearchQuery(event.target.value)}
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
                  onChange={(event) => setSelectedDate(event.target.value)}
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
                    setStatusFilter(event.target.value as "all" | ReservationStatus)
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Badge variant="neutral">{filteredReservations.length} reservas</Badge>
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
            onClick={() => setSortBy("time")}
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
            onClick={() => setSortBy("name")}
          >
            Por nombre
          </button>
        </div>
      </div>

      {filteredReservations.length === 0 ? (
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
              onClick={() => {
                setSearchQuery("");
                setSelectedDate("");
                setStatusFilter("all");
              }}
            >
              Limpiar filtros
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredReservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              onConfirm={(item) => console.log("Confirmar reserva", item.id)}
              onCancel={(item) => console.log("Cancelar reserva", item.id)}
              onEdit={(item) => console.log("Editar reserva", item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
