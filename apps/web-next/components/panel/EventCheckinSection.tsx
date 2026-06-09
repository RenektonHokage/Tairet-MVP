"use client";

import { FormEvent, useMemo, useState } from "react";

import {
  checkInEventEntryByToken,
  getEventCheckinStatusLabel,
  getEventCheckinStatusVariant,
  parseEventCheckinToken,
  type EventCheckinResponse,
} from "@/lib/eventCheckin";
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

export function EventCheckinSection({ eventId, className }: EventCheckinSectionProps) {
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [result, setResult] = useState<EventCheckinResponse | null>(null);
  const normalizedEventId = useMemo(() => eventId.trim(), [eventId]);
  const canSubmit = inputValue.trim().length > 0 && !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  return (
    <section className={cn("space-y-6", className)}>
      <PageHeader
        title="Check-in"
        subtitle="Validá entradas del evento por QR, token o URL."
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
                disabled={isSubmitting}
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
