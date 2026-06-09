"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type EventEntriesSort,
  type EventEntryCheckinStatus,
  type EventEntryListItem,
  type EventEntryStatus,
  getEventEntries,
  getEventEntryCheckinStatusBadgeVariant,
  getEventEntryCheckinStatusLabel,
  getEventEntryPaymentStatusLabel,
  getEventEntrySalesUnitTypeLabel,
  getEventEntrySourceLabel,
  getEventEntryStatusBadgeVariant,
  getEventEntryStatusLabel,
} from "@/lib/eventEntries";

import { Badge, EmptyState, PageHeader, cn, panelUi } from "./ui";

const PAGE_SIZE = 25;

type StatusFilter = "all" | EventEntryStatus;
type CheckinStatusFilter = "all" | EventEntryCheckinStatus;

interface EventEntriesSectionProps {
  eventId: string;
  className?: string;
}

function mergeUniqueItems(
  currentItems: EventEntryListItem[],
  nextItems: EventEntryListItem[],
): EventEntryListItem[] {
  const seen = new Set(currentItems.map((item) => item.entry.id));
  const merged = [...currentItems];

  for (const item of nextItems) {
    if (!seen.has(item.entry.id)) {
      seen.add(item.entry.id);
      merged.push(item);
    }
  }

  return merged;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatAmount(value: number, currency: string): string {
  return new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatAttendeeName(item: EventEntryListItem): string {
  return [item.attendee.name, item.attendee.last_name]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function formatDocument(value: string): string {
  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : "-";
}

function EntriesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          aria-hidden="true"
          className="h-20 animate-pulse rounded-lg border border-neutral-200 bg-white"
          key={index}
        />
      ))}
    </div>
  );
}

function EntryStatusBadges({ item }: { item: EventEntryListItem }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant={getEventEntryStatusBadgeVariant(item.entry.status)}>
        {getEventEntryStatusLabel(item.entry.status)}
      </Badge>
      <Badge variant={getEventEntryCheckinStatusBadgeVariant(item.entry.checkin_status)}>
        {getEventEntryCheckinStatusLabel(item.entry.checkin_status)}
      </Badge>
    </div>
  );
}

function EntriesDesktopTable({ items }: { items: EventEntryListItem[] }) {
  return (
    <div className="hidden overflow-hidden rounded-lg border border-neutral-200 bg-white md:block">
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-3">Asistente</th>
            <th className="px-4 py-3">Ticket</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Orden</th>
            <th className="px-4 py-3">Fecha</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {items.map((item) => {
            const attendeeName = formatAttendeeName(item);
            const salesUnitTypeLabel = getEventEntrySalesUnitTypeLabel(item.entry.sales_unit_type);
            const sourceLabel = getEventEntrySourceLabel(item.order.source);
            const paymentStatusLabel = getEventEntryPaymentStatusLabel(item.order.payment_status);

            return (
              <tr className="align-top" key={item.entry.id}>
                <td className="px-4 py-4">
                  <div className="font-medium text-neutral-950">
                    {attendeeName || "Sin nombre"}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    Documento {formatDocument(item.attendee.document)}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium text-neutral-950">{item.entry.ticket_name}</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {salesUnitTypeLabel}
                    {" · "}
                    {item.item.entries_per_unit} acceso
                    {item.item.entries_per_unit === 1 ? "" : "s"}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {formatAmount(item.entry.unit_price_amount, item.entry.currency)}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <EntryStatusBadges item={item} />
                  {item.entry.used_at ? (
                    <div className="mt-2 text-xs text-neutral-500">
                      Usada: {formatDateTime(item.entry.used_at)}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-4">
                  <div className="text-neutral-950">
                    {formatAmount(item.order.total_amount, item.order.currency)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="neutral">{sourceLabel}</Badge>
                    <Badge variant="neutral">{paymentStatusLabel}</Badge>
                  </div>
                </td>
                <td className="px-4 py-4 text-neutral-600">
                  {formatDateTime(item.entry.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EntriesMobileCards({ items }: { items: EventEntryListItem[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {items.map((item) => {
        const attendeeName = formatAttendeeName(item);
        const salesUnitTypeLabel = getEventEntrySalesUnitTypeLabel(item.entry.sales_unit_type);

        return (
          <article
            className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
            key={item.entry.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-neutral-950">
                  {attendeeName || "Sin nombre"}
                </h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Documento {formatDocument(item.attendee.document)}
                </p>
              </div>
              <EntryStatusBadges item={item} />
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div>
                <span className="text-neutral-500">Ticket: </span>
                <span className="font-medium text-neutral-950">{item.entry.ticket_name}</span>
              </div>
              <div className="text-neutral-600">
                {salesUnitTypeLabel}
                {" · "}
                {item.item.entries_per_unit} acceso
                {item.item.entries_per_unit === 1 ? "" : "s"}
              </div>
              <div className="text-neutral-600">
                Emitida: {formatDateTime(item.entry.created_at)}
              </div>
              {item.entry.used_at ? (
                <div className="text-neutral-600">Usada: {formatDateTime(item.entry.used_at)}</div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function EventEntriesSection({ eventId, className }: EventEntriesSectionProps) {
  const [items, setItems] = useState<EventEntryListItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [checkinStatusFilter, setCheckinStatusFilter] = useState<CheckinStatusFilter>("all");
  const [sort, setSort] = useState<EventEntriesSort>("created_at_desc");
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const normalizedQuery = query.trim();
  const queryForRequest = normalizedQuery.length >= 2 ? normalizedQuery : undefined;
  const showQueryHint = normalizedQuery.length === 1;

  const loadEntries = useCallback(
    async (nextPage: number, mode: "replace" | "append") => {
      if (!eventId) {
        setItems([]);
        setPage(1);
        setTotal(0);
        setTotalPages(0);
        setIsLoadingInitial(false);
        setIsLoadingMore(false);
        setError("Evento invalido.");
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (mode === "replace") {
        setIsLoadingInitial(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        const response = await getEventEntries({
          eventId,
          q: queryForRequest,
          status: statusFilter === "all" ? undefined : statusFilter,
          checkinStatus: checkinStatusFilter === "all" ? undefined : checkinStatusFilter,
          page: nextPage,
          pageSize: PAGE_SIZE,
          sort,
        });

        if (requestIdRef.current !== requestId) {
          return;
        }

        setItems((currentItems) =>
          mode === "replace" ? response.items : mergeUniqueItems(currentItems, response.items),
        );
        setPage(response.pagination.page);
        setTotal(response.pagination.total);
        setTotalPages(response.pagination.total_pages);
      } catch (loadError) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        const message =
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar las entradas.";
        setError(message);
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoadingInitial(false);
          setIsLoadingMore(false);
        }
      }
    },
    [checkinStatusFilter, eventId, queryForRequest, sort, statusFilter],
  );

  useEffect(() => {
    void loadEntries(1, "replace");
  }, [loadEntries]);

  const hasMore = page < totalPages;

  const summaryText = useMemo(() => {
    if (total === 0) {
      return "Sin entradas";
    }

    return `${total} entrada${total === 1 ? "" : "s"}`;
  }, [total]);

  const activeFilterText = useMemo(() => {
    const filters: string[] = [];

    if (queryForRequest) {
      filters.push(`busqueda "${queryForRequest}"`);
    }
    if (statusFilter !== "all") {
      filters.push(getEventEntryStatusLabel(statusFilter));
    }
    if (checkinStatusFilter !== "all") {
      filters.push(getEventEntryCheckinStatusLabel(checkinStatusFilter));
    }

    return filters.length > 0 ? filters.join(" · ") : "Todos los filtros";
  }, [checkinStatusFilter, queryForRequest, statusFilter]);

  return (
    <section className={cn("space-y-6", className)}>
      <PageHeader
        title="Entradas emitidas"
        subtitle="Listado operativo read-only de accesos emitidos para el evento."
      />

      <div className={cn(panelUi.card, "space-y-4 p-4")}>
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_160px_180px]">
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Buscar
            </span>
            <input
              className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nombre, documento, email"
              value={query}
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Estado
            </span>
            <select
              className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900"
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              value={statusFilter}
            >
              <option value="all">Todos</option>
              <option value="issued">Emitida</option>
              <option value="voided">Anulada</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Check-in
            </span>
            <select
              className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900"
              onChange={(event) => setCheckinStatusFilter(event.target.value as CheckinStatusFilter)}
              value={checkinStatusFilter}
            >
              <option value="all">Todos</option>
              <option value="unused">Sin usar</option>
              <option value="used">Usada</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Orden
            </span>
            <select
              className="h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900"
              onChange={(event) => setSort(event.target.value as EventEntriesSort)}
              value={sort}
            >
              <option value="created_at_desc">Mas recientes</option>
              <option value="created_at_asc">Mas antiguas</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
          <div>
            <span className="font-medium text-neutral-950">{summaryText}</span>
            <span className="mx-2 text-neutral-300">/</span>
            <span>{activeFilterText}</span>
          </div>
          {showQueryHint ? (
            <span className="text-xs text-amber-700">
              La busqueda requiere al menos 2 caracteres.
            </span>
          ) : null}
        </div>
      </div>

      {isLoadingInitial ? <EntriesSkeleton /> : null}

      {!isLoadingInitial && error ? (
        <div className={cn(panelUi.card, "space-y-3 p-4")}>
          <div>
            <h2 className="text-sm font-semibold text-neutral-950">No se pudieron cargar</h2>
            <p className="mt-1 text-sm text-neutral-600">{error}</p>
          </div>
          <button
            className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
            onClick={() => void loadEntries(1, "replace")}
            type="button"
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {!isLoadingInitial && !error && items.length === 0 ? (
        <EmptyState
          title="Todavia no hay entradas emitidas"
          description="Cuando se emitan entradas para este evento, apareceran aca."
        />
      ) : null}

      {!isLoadingInitial && !error && items.length > 0 ? (
        <>
          <EntriesDesktopTable items={items} />
          <EntriesMobileCards items={items} />

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-neutral-600">
              Mostrando {items.length} de {total}
            </p>
            {hasMore ? (
              <button
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoadingMore}
                onClick={() => void loadEntries(page + 1, "append")}
                type="button"
              >
                {isLoadingMore ? "Cargando..." : "Cargar mas"}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
