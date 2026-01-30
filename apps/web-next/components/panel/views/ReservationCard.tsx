import * as React from "react";
import { Clock, Mail, Phone, Users } from "lucide-react";

import { Badge, Card, CardContent, CardFooter, CardHeader, CardTitle, cn, panelUi } from "../ui";

export type ReservationStatus = "en_revision" | "confirmed" | "cancelled";

// Tipo base para ReservationCard - compatible con mock data y datos reales
export interface Reservation {
  id: string;
  name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  date: string;
  guests: number;
  status: ReservationStatus;
  notes?: string | null;
  table_note?: string | null;
}

export interface ReservationCardProps {
  reservation: Reservation;
  onConfirm?: (reservation: Reservation) => void;
  onCancel?: (reservation: Reservation) => void;
  onEdit?: (reservation: Reservation) => void;
}

const statusMap: Record<
  ReservationStatus,
  { label: string; variant: "success" | "warn" | "danger" }
> = {
  confirmed: { label: "Confirmada", variant: "success" },
  en_revision: { label: "Pendiente", variant: "warn" },
  cancelled: { label: "Cancelada", variant: "danger" },
};

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

function formatTime(value: string) {
  const date = parseReservationDate(value);
  if (!date) return value;
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDateLabel(value: string) {
  const [datePart] = value.split(",");
  return datePart?.trim() ?? value;
}

export function ReservationCard({ reservation, onConfirm, onCancel, onEdit }: ReservationCardProps) {
  const status = statusMap[reservation.status];
  const timeLabel = formatTime(reservation.date);
  const dateLabel = formatDateLabel(reservation.date);
  const fullName = [reservation.name, reservation.last_name].filter(Boolean).join(" ");

  const notes = reservation.notes?.trim() || "Sin notas del cliente";
  const tableNote = reservation.table_note?.trim() || "Sin nota interna";

  return (
    <Card className="h-full">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">{fullName}</CardTitle>
            <div className="text-xs text-neutral-500">{dateLabel}</div>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 text-neutral-500">
              <Clock className="h-4 w-4" />
            </span>
            <div>
              <div className="text-xs text-neutral-500">Horario</div>
              <div className="font-semibold text-neutral-900">{timeLabel}</div>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 text-neutral-500">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <div className="text-xs text-neutral-500">Personas</div>
              <div className="font-semibold text-neutral-900">{reservation.guests}</div>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 text-neutral-500">
              <Phone className="h-4 w-4" />
            </span>
            <div>
              <div className="text-xs text-neutral-500">Telefono</div>
              <div className="font-semibold text-neutral-900">
                {reservation.phone || "-"}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 text-neutral-500">
              <Mail className="h-4 w-4" />
            </span>
            <div>
              <div className="text-xs text-neutral-500">Email</div>
              <div className="font-semibold text-neutral-900">
                {reservation.email || "-"}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="rounded-xl border border-neutral-200/70 bg-neutral-50 px-4 py-3">
            <div className="text-xs font-medium text-neutral-500">Notas del cliente</div>
            <div
              className="text-sm text-neutral-800 break-words whitespace-pre-wrap"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 4,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {notes}
            </div>
          </div>
          <div className="rounded-xl border border-neutral-200/70 bg-neutral-50/80 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-neutral-500">Nota de operacion</div>
              <button
                type="button"
                className={cn(
                  "text-xs font-medium text-[#8d1313] hover:underline",
                  panelUi.focusRing
                )}
                onClick={() => onEdit?.(reservation)}
              >
                Editar
              </button>
            </div>
            <div className="text-sm text-neutral-800 break-words whitespace-pre-wrap">
              {tableNote}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex w-full flex-wrap gap-2">
          {reservation.status === "en_revision" ? (
            <>
              <button
                className={cn(
                  "flex-1 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm",
                  panelUi.focusRing
                )}
                type="button"
                onClick={() => onConfirm?.(reservation)}
              >
                Confirmar
              </button>
              <button
                className={cn(
                  "flex-1 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm",
                  panelUi.focusRing
                )}
                type="button"
                onClick={() => onCancel?.(reservation)}
              >
                Cancelar
              </button>
            </>
          ) : null}
          {/* confirmed: sin botón "Cancelar reserva" (quitado intencionalmente) */}
        </div>
      </CardFooter>
    </Card>
  );
}
