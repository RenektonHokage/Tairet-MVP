"use client";

import { FormEvent, useMemo, useState } from "react";

import {
  checkInEventEntryByToken,
  checkInEventEntryManually,
  getEventCheckinStatusLabel,
  getEventCheckinStatusVariant,
  parseEventCheckinToken,
  type EventCheckinResponse,
} from "@/lib/eventCheckin";
import {
  getEventEntries,
  getEventEntryCheckinStatusBadgeVariant,
  getEventEntryCheckinStatusLabel,
  getEventEntryStatusBadgeVariant,
  getEventEntryStatusLabel,
  type EventEntryListItem,
} from "@/lib/eventEntries";
import { EventCheckinScanner } from "./EventCheckinScanner";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  cn,
  panelUi,
} from "./ui";

interface EventCheckinSectionProps {
  eventId: string;
  className?: string;
}

const MANUAL_SEARCH_PAGE_SIZE = 25;

type ResultTone = "success" | "warn" | "danger" | "neutral";

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatAttendeeName(result: EventCheckinResponse): string | null {
  const attendee = result.attendee;
  if (!attendee) {
    return null;
  }

  const fullName = [attendee.name, attendee.last_name]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");

  return fullName || null;
}

function normalizeDisplayValue(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim() ?? "";
  return normalizedValue || null;
}

function getResultTone(result: EventCheckinResponse): ResultTone {
  if (!result.ok || !result.status) {
    return "danger";
  }

  return getEventCheckinStatusVariant(result.status);
}

function getResultDescription(status: EventCheckinResponse["status"]): string {
  switch (status) {
    case "valid":
      return "La entrada quedó marcada como usada.";
    case "already_used":
      return "Esta entrada ya fue utilizada anteriormente.";
    case "invalid":
      return "No se encontró una entrada válida para este QR.";
    case "outside_window":
      return "Esta entrada pertenece al evento, pero no puede validarse en este momento.";
    case "voided":
      return "Esta entrada fue anulada y no puede validarse.";
    case "not_valid_status":
      return "La entrada no está en un estado válido para check-in.";
    case "event_not_operable":
      return "El evento no está habilitado para validar entradas.";
    default:
      return "No se pudo validar la entrada.";
  }
}

function getToneClasses(tone: ResultTone): string {
  switch (tone) {
    case "success":
      return "border-green-200 bg-green-50";
    case "warn":
      return "border-amber-200 bg-amber-50";
    case "danger":
      return "border-rose-200 bg-rose-50";
    default:
      return "border-neutral-200 bg-neutral-50";
  }
}

function getToneTitleClass(tone: ResultTone): string {
  switch (tone) {
    case "success":
      return "text-green-800";
    case "warn":
      return "text-amber-900";
    case "danger":
      return "text-rose-800";
    default:
      return "text-neutral-900";
  }
}

function ResultField({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <dt className={panelUi.labelText}>{label}</dt>
      <dd className="mt-1 text-sm font-medium text-neutral-950">{value}</dd>
    </div>
  );
}

function formatEntryAttendeeName(item: EventEntryListItem): string {
  return [item.attendee.name, item.attendee.last_name]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function formatEntryDocument(value: string): string {
  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : "-";
}

function isEntryUsable(item: EventEntryListItem): boolean {
  return item.entry.status === "issued" && item.entry.checkin_status === "unused";
}

function getEntryUnavailableReason(item: EventEntryListItem): string | null {
  if (item.entry.status === "voided") {
    return "Esta entrada está anulada.";
  }

  if (item.entry.checkin_status === "used") {
    return "Esta entrada ya fue utilizada.";
  }

  if (item.entry.status !== "issued") {
    return "Esta entrada no está en un estado válido para check-in.";
  }

  return null;
}

function EventCheckinResultCard({ result }: { result: EventCheckinResponse }) {
  const status = result.status;
  const tone = getResultTone(result);
  const title = status ? getEventCheckinStatusLabel(status) : "No se pudo validar la entrada";
  const attendeeName = formatAttendeeName(result);
  const attendeeDocument = normalizeDisplayValue(result.attendee?.document);
  const ticketName = normalizeDisplayValue(result.entry?.ticket_name);
  const checkinStatus = normalizeDisplayValue(result.entry?.checkin_status);
  const usedAt = formatDateTime(result.entry?.used_at);
  const eventTitle = normalizeDisplayValue(result.event?.title);
  const eventStatus = normalizeDisplayValue(result.event?.status);

  return (
    <Card className={cn("border", getToneClasses(tone))}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className={getToneTitleClass(tone)}>{title}</CardTitle>
            <CardDescription>{getResultDescription(status)}</CardDescription>
          </div>
          {status ? (
            <Badge variant={getEventCheckinStatusVariant(status)}>
              {getEventCheckinStatusLabel(status)}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {result.entry || result.attendee || result.event ? (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ResultField label="Ticket" value={ticketName} />
            <ResultField label="Asistente" value={attendeeName} />
            <ResultField label="Documento" value={attendeeDocument} />
            <ResultField label="Estado check-in" value={checkinStatus} />
            <ResultField label="Usada en" value={usedAt} />
            <ResultField label="Evento" value={eventTitle} />
            <ResultField label="Estado evento" value={eventStatus} />
          </dl>
        ) : (
          <p className="text-sm text-neutral-700">
            No hay datos de entrada asociados para mostrar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface ManualEntrySummaryProps {
  item: EventEntryListItem;
}

function ManualEntrySummary({ item }: ManualEntrySummaryProps) {
  const attendeeName = formatEntryAttendeeName(item);
  const usedAt = formatDateTime(item.entry.used_at);

  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <ResultField label="Asistente" value={attendeeName || "Sin nombre"} />
      <ResultField label="Documento" value={formatEntryDocument(item.attendee.document)} />
      <ResultField label="Ticket" value={item.entry.ticket_name} />
      <ResultField label="Estado" value={getEventEntryStatusLabel(item.entry.status)} />
      <ResultField
        label="Estado check-in"
        value={getEventEntryCheckinStatusLabel(item.entry.checkin_status)}
      />
      <ResultField label="Usada en" value={usedAt} />
    </dl>
  );
}

interface ManualEntryResultCardProps {
  item: EventEntryListItem;
  isBusy: boolean;
  isSubmitting: boolean;
  onConfirmRequest: (item: EventEntryListItem) => void;
}

function ManualEntryResultCard({
  item,
  isBusy,
  isSubmitting,
  onConfirmRequest,
}: ManualEntryResultCardProps) {
  const attendeeName = formatEntryAttendeeName(item);
  const unavailableReason = getEntryUnavailableReason(item);

  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div>
            <h3 className="text-sm font-semibold text-neutral-950">
              {attendeeName || "Sin nombre"}
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Documento {formatEntryDocument(item.attendee.document)}
            </p>
          </div>
          <div className="text-sm text-neutral-700">
            <span className="font-medium text-neutral-950">{item.entry.ticket_name}</span>
            {item.entry.used_at ? (
              <span className="block text-xs text-neutral-500">
                Usada: {formatDateTime(item.entry.used_at)}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={getEventEntryStatusBadgeVariant(item.entry.status)}>
              {getEventEntryStatusLabel(item.entry.status)}
            </Badge>
            <Badge variant={getEventEntryCheckinStatusBadgeVariant(item.entry.checkin_status)}>
              {getEventEntryCheckinStatusLabel(item.entry.checkin_status)}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 md:items-end">
          {unavailableReason ? (
            <p className="max-w-xs text-sm text-neutral-600 md:text-right">
              {unavailableReason}
            </p>
          ) : null}
          <button
            className={cn(
              "inline-flex items-center justify-center rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60",
              panelUi.focusRing
            )}
            disabled={isBusy || !isEntryUsable(item)}
            onClick={() => onConfirmRequest(item)}
            type="button"
          >
            {isSubmitting ? "Validando..." : "Validar manualmente"}
          </button>
        </div>
      </div>
    </article>
  );
}

interface ManualConfirmCardProps {
  item: EventEntryListItem;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ManualConfirmCard({
  item,
  isSubmitting,
  onCancel,
  onConfirm,
}: ManualConfirmCardProps) {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="text-amber-950">Confirmar validación manual</CardTitle>
        <CardDescription>
          Esta acción marcará la entrada como usada. Verificá que los datos coincidan
          antes de continuar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ManualEntrySummary item={item} />
        <div className="flex flex-wrap gap-3">
          <button
            className={cn(
              "inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60",
              panelUi.focusRing
            )}
            disabled={isSubmitting}
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className={cn(
              "inline-flex items-center justify-center rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60",
              panelUi.focusRing
            )}
            disabled={isSubmitting}
            onClick={onConfirm}
            type="button"
          >
            {isSubmitting ? "Validando..." : "Confirmar validación"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export function EventCheckinSection({ eventId, className }: EventCheckinSectionProps) {
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [result, setResult] = useState<EventCheckinResponse | null>(null);
  const [manualQuery, setManualQuery] = useState("");
  const [manualSearchLoading, setManualSearchLoading] = useState(false);
  const [manualSearchError, setManualSearchError] = useState<string | null>(null);
  const [manualResults, setManualResults] = useState<EventEntryListItem[]>([]);
  const [manualHasSearched, setManualHasSearched] = useState(false);
  const [confirmEntry, setConfirmEntry] = useState<EventEntryListItem | null>(null);
  const [manualSubmittingEntryId, setManualSubmittingEntryId] = useState<string | null>(null);
  const [manualNotice, setManualNotice] = useState<string | null>(null);
  const [scannerProcessing, setScannerProcessing] = useState(false);
  const normalizedEventId = useMemo(() => eventId.trim(), [eventId]);
  const isManualSubmitting = manualSubmittingEntryId !== null;
  const canSubmit =
    inputValue.trim().length > 0 && !isSubmitting && !isManualSubmitting && !scannerProcessing;
  const manualRequestBusy =
    manualSearchLoading || isSubmitting || isManualSubmitting || scannerProcessing;
  const scannerDisabled = isSubmitting || isManualSubmitting || manualSearchLoading;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (scannerProcessing) {
      return;
    }

    setLocalError(null);

    const parsedToken = parseEventCheckinToken(inputValue);
    if (!parsedToken.ok) {
      setLocalError(
        parsedToken.error === "empty_input"
          ? "Pegá el QR, token o URL de validación."
          : "QR o token inválido."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await checkInEventEntryByToken({
        eventId: normalizedEventId,
        token: parsedToken.token,
      });
      setResult(response);
      setInputValue("");
    } catch {
      setResult(null);
      setLocalError("No se pudo validar la entrada.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleManualSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (scannerProcessing) {
      return;
    }

    const normalizedQuery = manualQuery.trim();

    setManualSearchError(null);
    setManualNotice(null);
    setConfirmEntry(null);

    if (!normalizedQuery) {
      setManualResults([]);
      setManualHasSearched(false);
      setManualSearchError("Ingresá al menos 2 caracteres para buscar una entrada.");
      return;
    }

    if (normalizedQuery.length === 1) {
      setManualResults([]);
      setManualHasSearched(false);
      setManualSearchError("La búsqueda requiere al menos 2 caracteres.");
      return;
    }

    setManualSearchLoading(true);
    try {
      const response = await getEventEntries({
        eventId: normalizedEventId,
        q: normalizedQuery,
        pageSize: MANUAL_SEARCH_PAGE_SIZE,
        sort: "created_at_desc",
      });

      setManualResults(response.items);
      setManualHasSearched(true);
      setManualNotice(
        response.items.length === 0
          ? null
          : `${response.items.length} resultado${response.items.length === 1 ? "" : "s"}.`
      );
    } catch {
      setManualResults([]);
      setManualHasSearched(false);
      setManualSearchError("No se pudieron buscar entradas.");
    } finally {
      setManualSearchLoading(false);
    }
  }

  async function handleManualConfirm() {
    if (!confirmEntry || manualSubmittingEntryId || scannerProcessing) {
      return;
    }

    const entryId = confirmEntry.entry.id;
    setManualSubmittingEntryId(entryId);
    setManualSearchError(null);
    setManualNotice(null);

    try {
      const response = await checkInEventEntryManually({
        eventId: normalizedEventId,
        entryId,
      });

      setResult(response);
      setConfirmEntry(null);

      if (response.entry?.id) {
        setManualResults((currentResults) =>
          currentResults.map((item) =>
            item.entry.id === response.entry?.id
              ? {
                  ...item,
                  entry: {
                    ...item.entry,
                    checkin_status:
                      response.entry.checkin_status === "used" ? "used" : item.entry.checkin_status,
                    used_at: response.entry.used_at ?? item.entry.used_at,
                  },
                }
              : item
          )
        );
      }
    } catch {
      setResult(null);
      setManualSearchError("No se pudo validar la entrada manualmente.");
    } finally {
      setManualSubmittingEntryId(null);
    }
  }

  return (
    <section className={cn("space-y-6", className)}>
      <PageHeader
        title="Check-in"
        subtitle="Validá entradas del evento por QR, token o URL."
      />

      <EventCheckinScanner
        disabled={scannerDisabled}
        eventId={normalizedEventId}
        onProcessingChange={setScannerProcessing}
        onResult={(scannerResult) => {
          setLocalError(null);
          setManualSearchError(null);
          setResult(scannerResult);
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Validar entrada</CardTitle>
          <CardDescription>
            Acepta la URL completa del QR o el token UUID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className={panelUi.labelText} htmlFor="event-checkin-token">
                QR, token o URL
              </label>
              <input
                autoComplete="off"
                className={cn(
                  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm transition placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500",
                  panelUi.focusRing
                )}
                disabled={isSubmitting || isManualSubmitting}
                id="event-checkin-token"
                onChange={(event) => {
                  setInputValue(event.target.value);
                  if (localError) {
                    setLocalError(null);
                  }
                }}
                placeholder="Pegá el QR, token o URL de validación"
                type="text"
                value={inputValue}
              />
              {localError ? (
                <p className="text-sm font-medium text-rose-700">{localError}</p>
              ) : (
                <p className={panelUi.mutedText}>
                  El token no se muestra ni se conserva después del intento.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className={cn(
                  "inline-flex items-center justify-center rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60",
                  panelUi.focusRing
                )}
                disabled={!canSubmit}
                type="submit"
              >
                {isSubmitting ? "Validando..." : "Validar entrada"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fallback manual</CardTitle>
          <CardDescription>
            Buscá una entrada por nombre, documento o referencia y validala solo después
            de confirmar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form className="space-y-4" onSubmit={handleManualSearch}>
            <div className="space-y-2">
              <label className={panelUi.labelText} htmlFor="event-checkin-manual-search">
                Buscar entrada
              </label>
              <input
                autoComplete="off"
                className={cn(
                  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm transition placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500",
                  panelUi.focusRing
                )}
                disabled={manualRequestBusy}
                id="event-checkin-manual-search"
                onChange={(event) => {
                  setManualQuery(event.target.value);
                  setManualSearchError(null);
                  setManualNotice(null);
                  setManualResults([]);
                  setManualHasSearched(false);
                  setConfirmEntry(null);
                }}
                placeholder="Buscar por nombre, apellido o documento"
                type="text"
                value={manualQuery}
              />
              {manualSearchError ? (
                <p className="text-sm font-medium text-rose-700">{manualSearchError}</p>
              ) : (
                <p className={panelUi.mutedText}>
                  La validación manual requiere confirmar la entrada antes de marcarla como usada.
                </p>
              )}
            </div>
            <button
              className={cn(
                "inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60",
                panelUi.focusRing
              )}
              disabled={manualRequestBusy || manualQuery.trim().length === 0}
              type="submit"
            >
              {manualSearchLoading ? "Buscando..." : "Buscar entrada"}
            </button>
          </form>

          {manualNotice ? <p className="text-sm text-neutral-600">{manualNotice}</p> : null}

          {!manualSearchLoading &&
          manualHasSearched &&
          manualResults.length === 0 &&
          !manualSearchError ? (
            <EmptyState
              className="py-6"
              description="Probá con otro nombre, apellido o documento."
              title="No se encontraron entradas."
            />
          ) : null}

          {manualResults.length > 0 ? (
            <div className="space-y-3">
              {manualResults.map((item) => (
                <ManualEntryResultCard
                  item={item}
                  isBusy={manualRequestBusy}
                  isSubmitting={manualSubmittingEntryId === item.entry.id}
                  key={item.entry.id}
                  onConfirmRequest={setConfirmEntry}
                />
              ))}
            </div>
          ) : null}

          {confirmEntry ? (
            <ManualConfirmCard
              item={confirmEntry}
              isSubmitting={manualSubmittingEntryId === confirmEntry.entry.id}
              onCancel={() => setConfirmEntry(null)}
              onConfirm={() => void handleManualConfirm()}
            />
          ) : null}
        </CardContent>
      </Card>

      {result ? (
        <EventCheckinResultCard result={result} />
      ) : (
        <EmptyState
          description="El resultado de la última validación aparecerá en esta sección."
          title="Sin validaciones recientes"
        />
      )}
    </section>
  );
}
