"use client";

import { FormEvent, useCallback, useState } from "react";

import {
  getAccessPaidCheckinStatusLabel,
  lookupAccessEntryByToken,
  parseAccessPaidCheckinToken,
  useAccessEntryByToken,
  type AccessPaidCheckinResponse,
  type AccessPaidCheckinStatus,
} from "@/lib/accessCheckin";
import { ApiError } from "@/lib/api";
import { AccessPaidQrScanner } from "./AccessPaidQrScanner";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  cn,
  panelUi,
} from "./ui";

type ResultTone = "success" | "warn" | "danger" | "neutral";

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const parsedDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate);
}

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);
}

function getStatusTone(status: AccessPaidCheckinStatus): ResultTone {
  switch (status) {
    case "valid":
    case "used":
      return "success";
    case "too_early":
      return "neutral";
    case "expired_window":
      return "danger";
    case "already_used":
      return "warn";
    case "voided":
    case "not_paid":
    case "not_valid_status":
      return "danger";
  }
}

function getStatusDescription(status: AccessPaidCheckinStatus): string {
  switch (status) {
    case "too_early":
      return "Podrá validarse desde las 18:00 de la fecha indicada en la entrada.";
    case "expired_window":
      return "Esta entrada era válida hasta las 06:00 del día siguiente a la fecha indicada.";
    default:
      return "Revisá los datos seguros antes de validar la entrada.";
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

function getBadgeVariant(tone: ResultTone): "neutral" | "success" | "warn" | "danger" {
  if (tone === "neutral") {
    return "neutral";
  }

  return tone;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return "No encontramos esta entrada para tu local";
    }

    if (error.status === 401 || error.status === 403) {
      return "No tenés permisos para validar esta entrada";
    }
  }

  return fallback;
}

function FieldRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
      <dt className={panelUi.labelText}>{label}</dt>
      <dd className="mt-1 text-sm font-medium text-neutral-950">{value ?? "-"}</dd>
    </div>
  );
}

function AccessPaidCheckinResultCard({
  isSubmitting,
  onUse,
  result,
}: {
  isSubmitting: boolean;
  onUse: () => void;
  result: AccessPaidCheckinResponse;
}) {
  const tone = getStatusTone(result.status);
  const usedAt = formatDateTime(result.entry.used_at);
  const attendeeName = [result.attendee.name, result.attendee.last_name]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");

  return (
    <Card className={cn("border", getToneClasses(tone))}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className={getToneTitleClass(tone)}>
              {getAccessPaidCheckinStatusLabel(result.status)}
            </CardTitle>
            <CardDescription>{getStatusDescription(result.status)}</CardDescription>
          </div>
          <Badge variant={getBadgeVariant(tone)}>{result.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-3 md:grid-cols-2">
          <FieldRow label="Entrada" value={result.entry.ticket_name} />
          <FieldRow label="Asistente" value={attendeeName || "-"} />
          <FieldRow label="Referencia" value={result.order.public_ref} />
          <FieldRow label="Fecha" value={formatDate(result.entry.access_date)} />
          <FieldRow label="Unidad" value={result.entry.unit_index} />
          <FieldRow label="Estado entrada" value={result.entry.status} />
          <FieldRow label="Estado check-in" value={result.entry.checkin_status} />
          <FieldRow label="Usada en" value={usedAt} />
        </dl>

        {result.status === "valid" ? (
          <button
            className={cn(
              "inline-flex items-center justify-center rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60",
              panelUi.focusRing
            )}
            disabled={isSubmitting}
            onClick={onUse}
            type="button"
          >
            {isSubmitting ? "Validando..." : "Validar entrada"}
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AccessPaidCheckinSection() {
  const [inputValue, setInputValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<AccessPaidCheckinResponse | null>(null);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isUseLoading, setIsUseLoading] = useState(false);

  const lookupToken = useCallback(async (token: string) => {
    setIsLookupLoading(true);
    setLocalError(null);
    setRequestError(null);
    setResult(null);
    setActiveToken(null);
    setInputValue("");

    try {
      const lookupResult = await lookupAccessEntryByToken(token);
      setResult(lookupResult);
      setActiveToken(lookupResult.status === "valid" ? token : null);
    } catch (error) {
      setRequestError(
        getApiErrorMessage(error, "No pudimos consultar la entrada. Reintentá en unos segundos.")
      );
    } finally {
      setIsLookupLoading(false);
    }
  }, []);

  const handleLookupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedToken = parseAccessPaidCheckinToken(inputValue);
    if (!parsedToken.ok) {
      setLocalError("Código no válido");
      setRequestError(null);
      setResult(null);
      setActiveToken(null);
      return;
    }

    await lookupToken(parsedToken.token);
  };

  const handleUse = async () => {
    if (!activeToken || result?.status !== "valid") {
      return;
    }

    setIsUseLoading(true);
    setRequestError(null);

    try {
      const useResult = await useAccessEntryByToken(activeToken);
      setResult(useResult);
      setActiveToken(null);
    } catch (error) {
      setRequestError(
        getApiErrorMessage(error, "No pudimos validar la entrada. Reintentá en unos segundos.")
      );
    } finally {
      setIsUseLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <AccessPaidQrScanner
        disabled={isLookupLoading || isUseLoading}
        onTokenDetected={lookupToken}
      />

      <Card>
        <CardHeader>
          <CardTitle>Buscar manualmente</CardTitle>
          <CardDescription>
            Buscá entradas compradas pegando el QR, enlace o código recibido por correo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleLookupSubmit}>
            <div className="space-y-2">
              <label className={panelUi.labelText} htmlFor="paid-access-checkin-token">
                QR, enlace o código
              </label>
              <input
                autoComplete="off"
                className={cn(
                  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm transition placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500",
                  panelUi.focusRing
                )}
                disabled={isLookupLoading || isUseLoading}
                id="paid-access-checkin-token"
                onChange={(event) => {
                  setInputValue(event.target.value);
                  if (localError) {
                    setLocalError(null);
                  }
                }}
                placeholder="Pegá el QR, enlace o código de entrada"
                type="text"
                value={inputValue}
              />
              {localError ? (
                <p className="text-sm font-medium text-rose-700">{localError}</p>
              ) : (
                <p className={panelUi.mutedText}>
                  El código no se muestra ni se conserva después de buscar.
                </p>
              )}
            </div>
            <button
              className={cn(
                "inline-flex items-center justify-center rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60",
                panelUi.focusRing
              )}
              disabled={isLookupLoading || isUseLoading || inputValue.trim().length === 0}
              type="submit"
            >
              {isLookupLoading ? "Buscando..." : "Buscar entrada"}
            </button>
          </form>
        </CardContent>
      </Card>

      {requestError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {requestError}
        </div>
      ) : null}

      {result ? (
        <AccessPaidCheckinResultCard
          isSubmitting={isUseLoading}
          onUse={handleUse}
          result={result}
        />
      ) : (
        <EmptyState
          description="El resultado de la búsqueda aparecerá en esta sección."
          title="Sin entrada consultada"
        />
      )}
    </section>
  );
}
