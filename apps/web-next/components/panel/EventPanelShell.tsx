"use client";

import * as React from "react";

import {
  getEventPanelMe,
  type EventPanelMeResponse,
  type EventPanelRole,
} from "@/lib/eventPanel";
import { Badge, cn, panelUi } from "./ui";
import { EventPanelNav } from "./EventPanelNav";

interface EventPanelShellProps {
  eventId: string;
  children: React.ReactNode;
}

function getRoleLabel(role: EventPanelRole): string {
  return role === "owner" ? "Owner" : "Staff";
}

function formatStatus(value: string): string {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return "Estado no disponible";
  }

  return normalizedValue.replace(/_/g, " ");
}

function EventPanelLoadingState() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className={cn(panelUi.skeleton, "h-5 w-48")} />
        <div className={cn(panelUi.skeleton, "mt-3 h-4 w-72 max-w-full")} />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`event-panel-loading-${index}`}
            className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <div className={cn(panelUi.skeleton, "h-4 w-52")} />
            <div className={cn(panelUi.skeleton, "mt-3 h-4 w-full")} />
            <div className={cn(panelUi.skeleton, "mt-2 h-4 w-2/3")} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EventPanelErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-lg items-center justify-center">
      <div className="w-full rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-950">
          No se pudo cargar el panel del evento.
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          Verifica tu sesión y volvé a intentar.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "mt-5 inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 shadow-sm hover:bg-neutral-50",
            panelUi.focusRing
          )}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

function EventPanelContextSummary({
  context,
}: {
  context: EventPanelMeResponse;
}) {
  const roleLabel = getRoleLabel(context.membership.role);
  const displayName = context.membership.displayName?.trim();

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-sm sm:px-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Panel de evento
          </p>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-neutral-950">
            {context.event.title}
          </h1>
          {displayName ? (
            <p className="mt-1 text-sm text-neutral-600">{displayName}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">{roleLabel}</Badge>
          <Badge variant="neutral">{formatStatus(context.event.status)}</Badge>
        </div>
      </div>
    </div>
  );
}

export function EventPanelShell({ eventId, children }: EventPanelShellProps) {
  const normalizedEventId = eventId.trim();
  const [context, setContext] = React.useState<EventPanelMeResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const loadContext = React.useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const response = await getEventPanelMe(normalizedEventId);
      setContext(response);
    } catch {
      setContext(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [normalizedEventId]);

  React.useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const eventTitle = context?.event.title ?? "Panel de evento";
  const roleLabel = context ? getRoleLabel(context.membership.role) : null;
  const statusLabel = context ? formatStatus(context.event.status) : null;

  return (
    <div className="min-h-screen bg-gray-50 text-neutral-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-neutral-200 bg-white lg:flex">
        <div className="border-b border-neutral-200 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Tairet Eventos
          </p>
          <h2 className="mt-1 line-clamp-2 text-lg font-semibold text-neutral-950">
            {eventTitle}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {roleLabel ? <Badge variant="neutral">{roleLabel}</Badge> : null}
            {statusLabel ? <Badge variant="neutral">{statusLabel}</Badge> : null}
          </div>
        </div>
        <EventPanelNav eventId={normalizedEventId} />
      </aside>

      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Tairet Eventos
            </p>
            <h1 className="line-clamp-1 text-lg font-semibold text-neutral-950">
              {eventTitle}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {roleLabel ? <Badge variant="neutral">{roleLabel}</Badge> : null}
            {statusLabel ? <Badge variant="neutral">{statusLabel}</Badge> : null}
          </div>
          <EventPanelNav eventId={normalizedEventId} variant="mobile" />
        </div>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {loading ? <EventPanelLoadingState /> : null}

          {!loading && error ? <EventPanelErrorState onRetry={loadContext} /> : null}

          {!loading && !error && context ? (
            <div className="space-y-6">
              <EventPanelContextSummary context={context} />
              {children}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
