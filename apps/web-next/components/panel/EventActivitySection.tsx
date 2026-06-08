"use client";

import * as React from "react";

import {
  EVENT_ACTIVITY_ACTIONS,
  EVENT_ACTIVITY_SOURCES,
  getEventActivity,
  getEventActivityActionLabel,
  getEventActivityBadgeVariant,
  getEventActivityCategory,
  getEventActivityCategoryLabel,
  getEventActivityEntityTypeLabel,
  getEventActivitySourceLabel,
  type EventActivityAction,
  type EventActivityItem,
  type EventActivitySource,
} from "@/lib/eventActivity";
import { Badge, EmptyState, PageHeader, cn, panelUi } from "./ui";

const PAGE_SIZE = 25;

type ActivityFilterValue<T extends string> = "all" | T;

export interface EventActivitySectionProps {
  eventId: string;
  className?: string;
}

function formatActivityDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getActorLabel(item: EventActivityItem): string {
  const actorLabel = item.actor.label?.trim();
  if (actorLabel) {
    return actorLabel;
  }

  if (item.actor.type === "system") {
    return "Sistema";
  }

  if (item.actor.role === "owner") {
    return "Owner";
  }

  if (item.actor.role === "staff") {
    return "Staff";
  }

  return "Panel";
}

function formatBoolean(value: boolean): string {
  return value ? "Si" : "No";
}

function formatMetadataValue(value: string | number | boolean | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    return formatBoolean(value);
  }

  const normalizedValue = String(value).trim();
  return normalizedValue || null;
}

function getReasonLabel(value: string): string {
  const reasonLabels: Record<string, string> = {
    already_used: "ya usada",
    outside_window: "fuera de ventana",
    voided: "anulada",
    invalid_token: "QR invalido",
  };

  return reasonLabels[value] ?? value;
}

function getCheckinStatusLabel(value: string): string {
  const statusLabels: Record<string, string> = {
    unused: "sin usar",
    used: "usado",
  };

  return statusLabels[value] ?? value;
}

function getEmailStatusLabel(value: string): string {
  const statusLabels: Record<string, string> = {
    sent: "enviado",
    failed: "fallido",
    skipped: "omitido",
  };

  return statusLabels[value] ?? value;
}

function buildMetadataLabels(item: EventActivityItem): string[] {
  const metadata = item.metadata;
  const labels: string[] = [];

  const ticketName = formatMetadataValue(metadata.ticket_name);
  if (ticketName) {
    labels.push(`Ticket: ${ticketName}`);
  }

  const reasonCode = formatMetadataValue(metadata.reason_code);
  if (reasonCode) {
    labels.push(`Motivo: ${getReasonLabel(reasonCode)}`);
  }

  const emailStatus = formatMetadataValue(metadata.email_status);
  if (emailStatus) {
    labels.push(`Email: ${getEmailStatusLabel(emailStatus)}`);
  }

  const emailErrorCode = formatMetadataValue(metadata.email_error_code);
  if (emailErrorCode) {
    labels.push(`Error email: ${emailErrorCode}`);
  }

  const deliveryMode = formatMetadataValue(metadata.delivery_mode);
  if (deliveryMode) {
    labels.push(`Delivery: ${deliveryMode}`);
  }

  const previousCheckinStatus = formatMetadataValue(metadata.previous_checkin_status);
  const nextCheckinStatus = formatMetadataValue(metadata.next_checkin_status);
  if (previousCheckinStatus && nextCheckinStatus) {
    labels.push(
      `Check-in: ${getCheckinStatusLabel(previousCheckinStatus)} -> ${getCheckinStatusLabel(
        nextCheckinStatus
      )}`
    );
  }

  const previousStatus = formatMetadataValue(metadata.previous_status);
  const nextStatus = formatMetadataValue(metadata.next_status);
  if (previousStatus && nextStatus) {
    labels.push(`Estado: ${previousStatus} -> ${nextStatus}`);
  }

  const entriesCount = formatMetadataValue(metadata.entries_count);
  if (entriesCount) {
    labels.push(`Entradas: ${entriesCount}`);
  }

  const bundleEntriesCount = formatMetadataValue(metadata.bundle_entries_count);
  if (bundleEntriesCount) {
    labels.push(`Bundle: ${bundleEntriesCount} entradas`);
  }

  const emailAttempts = formatMetadataValue(metadata.email_attempts);
  if (emailAttempts) {
    labels.push(`Intentos email: ${emailAttempts}`);
  }

  const sentCount = formatMetadataValue(metadata.sent_count);
  if (sentCount) {
    labels.push(`Enviados: ${sentCount}`);
  }

  const failedCount = formatMetadataValue(metadata.failed_count);
  if (failedCount) {
    labels.push(`Fallidos: ${failedCount}`);
  }

  const skippedCount = formatMetadataValue(metadata.skipped_count);
  if (skippedCount) {
    labels.push(`Omitidos: ${skippedCount}`);
  }

  const salesUnitType = formatMetadataValue(metadata.sales_unit_type);
  if (salesUnitType) {
    labels.push(`Unidad: ${salesUnitType}`);
  }

  const entriesPerUnit = formatMetadataValue(metadata.entries_per_unit);
  if (entriesPerUnit) {
    labels.push(`Accesos por unidad: ${entriesPerUnit}`);
  }

  const totalAmount = formatMetadataValue(metadata.total_amount);
  const currency = formatMetadataValue(metadata.currency);
  if (totalAmount && currency) {
    labels.push(`Total: ${totalAmount} ${currency}`);
  } else if (totalAmount) {
    labels.push(`Total: ${totalAmount}`);
  }

  return labels;
}

function mergeUniqueItems(
  currentItems: EventActivityItem[],
  nextItems: EventActivityItem[]
): EventActivityItem[] {
  const seenIds = new Set(currentItems.map((item) => item.id));
  const mergedItems = [...currentItems];

  for (const item of nextItems) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      mergedItems.push(item);
    }
  }

  return mergedItems;
}

function EventActivitySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={`event-activity-skeleton-${index}`}
          className="rounded-lg border border-neutral-200 bg-white p-4"
        >
          <div className={cn(panelUi.skeleton, "h-4 w-48")} />
          <div className={cn(panelUi.skeleton, "mt-3 h-4 w-full")} />
          <div className={cn(panelUi.skeleton, "mt-2 h-4 w-3/4")} />
        </div>
      ))}
    </div>
  );
}

function EventActivityItemRow({ item }: { item: EventActivityItem }) {
  const category = getEventActivityCategory(item.action, item.source);
  const metadataLabels = buildMetadataLabels(item);

  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getEventActivityBadgeVariant(item.action, item.source)}>
              {getEventActivityCategoryLabel(category)}
            </Badge>
            <Badge variant="neutral">{getEventActivitySourceLabel(item.source)}</Badge>
            <span className="text-xs font-medium text-neutral-500">
              {formatActivityDate(item.created_at)}
            </span>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-neutral-950">
              {getEventActivityActionLabel(item.action)}
            </h3>
            <p className="mt-1 text-sm text-neutral-700">{item.message}</p>
          </div>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Actor
          </p>
          <p className="mt-1 text-sm font-medium text-neutral-900">{getActorLabel(item)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
          {getEventActivityEntityTypeLabel(item.entity_type)}
        </span>
        {metadataLabels.map((label) => (
          <span
            key={label}
            className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700"
          >
            {label}
          </span>
        ))}
      </div>
    </article>
  );
}

export function EventActivitySection({ eventId, className }: EventActivitySectionProps) {
  const [items, setItems] = React.useState<EventActivityItem[]>([]);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(0);
  const [actionFilter, setActionFilter] =
    React.useState<ActivityFilterValue<EventActivityAction>>("all");
  const [sourceFilter, setSourceFilter] =
    React.useState<ActivityFilterValue<EventActivitySource>>("all");
  const [loadingInitial, setLoadingInitial] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestIdRef = React.useRef(0);

  const loadActivity = React.useCallback(
    async (nextPage: number, mode: "replace" | "append") => {
      const requestId = ++requestIdRef.current;
      const isAppend = mode === "append";

      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoadingInitial(true);
      }
      setError(null);

      try {
        const response = await getEventActivity({
          eventId,
          action: actionFilter === "all" ? undefined : actionFilter,
          source: sourceFilter === "all" ? undefined : sourceFilter,
          page: nextPage,
          pageSize: PAGE_SIZE,
          sort: "created_at_desc",
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        setItems((currentItems) =>
          isAppend ? mergeUniqueItems(currentItems, response.items) : response.items
        );
        setPage(response.pagination.page);
        setTotalPages(response.pagination.total_pages);
      } catch {
        if (requestId === requestIdRef.current) {
          setError("No se pudo cargar la actividad.");
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoadingInitial(false);
          setLoadingMore(false);
        }
      }
    },
    [actionFilter, eventId, sourceFilter]
  );

  React.useEffect(() => {
    setItems([]);
    setPage(1);
    setTotalPages(0);
    void loadActivity(1, "replace");
  }, [loadActivity]);

  const hasMore = page < totalPages;
  const isInitialEmpty = !loadingInitial && !error && items.length === 0;

  const handleRetry = () => {
    if (items.length > 0 && hasMore) {
      void loadActivity(page + 1, "append");
      return;
    }

    void loadActivity(1, "replace");
  };

  const handleLoadMore = () => {
    if (!hasMore || loadingMore || loadingInitial) {
      return;
    }

    void loadActivity(page + 1, "append");
  };

  return (
    <section className={cn("space-y-5", className)}>
      <PageHeader title="Actividad" subtitle="Historial operativo del evento." />

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-3xl">
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            Tipo de actividad
            <select
              value={actionFilter}
              onChange={(event) =>
                setActionFilter(event.target.value as ActivityFilterValue<EventActivityAction>)
              }
              disabled={loadingInitial || loadingMore}
              className={cn(
                "h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900",
                panelUi.focusRing
              )}
            >
              <option value="all">Todas</option>
              {EVENT_ACTIVITY_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {getEventActivityActionLabel(action)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            Fuente
            <select
              value={sourceFilter}
              onChange={(event) =>
                setSourceFilter(event.target.value as ActivityFilterValue<EventActivitySource>)
              }
              disabled={loadingInitial || loadingMore}
              className={cn(
                "h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900",
                panelUi.focusRing
              )}
            >
              <option value="all">Todas</option>
              {EVENT_ACTIVITY_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {getEventActivitySourceLabel(source)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loadingInitial ? <EventActivitySkeleton /> : null}

      {!loadingInitial && error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-800">No se pudo cargar la actividad.</p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={loadingInitial || loadingMore}
            className={cn(
              "mt-3 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60",
              panelUi.focusRing
            )}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {isInitialEmpty ? (
        <EmptyState
          title="Todavía no hay actividad registrada para este evento."
          description="Cuando se emitan entradas, se envíen QR o se validen accesos, aparecerán acá."
        />
      ) : null}

      {!loadingInitial && items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <EventActivityItemRow key={item.id} item={item} />
          ))}
        </div>
      ) : null}

      {!loadingInitial && items.length > 0 && hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className={cn(
              "rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm disabled:cursor-not-allowed disabled:opacity-60",
              panelUi.focusRing
            )}
          >
            {loadingMore ? "Cargando..." : "Cargar más"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
