"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { CalendarDays, Info, MoreVertical, Plus, Ticket, Trash2 } from "lucide-react";
import { Badge, EmptyState, PageHeader, cn, panelUi } from "@/components/panel/ui";
import { ApiError } from "@/lib/api";
import {
  createAccessTicketType,
  getAccessConfig,
  saveAccessTicketAvailability,
  updateAccessTicketType,
  type AccessAvailabilityExceptionMode,
  type AccessStockMode,
  type AccessTicketConfig,
  type SaveAccessTicketAvailabilityInput,
} from "@/lib/accessConfig";
import { usePanelContext } from "@/lib/panelContext";

interface TicketFormState {
  name: string;
  description: string;
  priceGs: string;
  active: boolean;
}

interface WeekdayFormState {
  isoWeekday: number;
  enabled: boolean;
  stockMode: AccessStockMode;
  capacity: string;
}

interface ExceptionFormState {
  localId: string;
  accessDate: string;
  exceptionMode: AccessAvailabilityExceptionMode;
  capacity: string;
  reason: string;
}

interface AvailabilityFormState {
  validFrom: string;
  validTo: string;
  weekdays: WeekdayFormState[];
  exceptions: ExceptionFormState[];
}

type NoticeState = { type: "success" | "error"; message: string } | null;

const EMPTY_TICKET_FORM: TicketFormState = {
  name: "",
  description: "",
  priceGs: "",
  active: false,
};

const WEEKDAYS = [
  { isoWeekday: 1, label: "Lunes", shortLabel: "Lun" },
  { isoWeekday: 2, label: "Martes", shortLabel: "Mar" },
  { isoWeekday: 3, label: "Miércoles", shortLabel: "Mié" },
  { isoWeekday: 4, label: "Jueves", shortLabel: "Jue" },
  { isoWeekday: 5, label: "Viernes", shortLabel: "Vie" },
  { isoWeekday: 6, label: "Sábado", shortLabel: "Sáb" },
  { isoWeekday: 7, label: "Domingo", shortLabel: "Dom" },
] as const;

const DEFAULT_AVAILABILITY_DAYS = 30;
const MAX_AVAILABILITY_DAYS = 93;
const MAX_REASON_LENGTH = 200;

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateDiffInDays(from: string, to: string): number {
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  return Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000);
}

function isValidDateKey(dateKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === dateKey;
}

function formatPYG(value: number): string {
  return `Gs. ${new Intl.NumberFormat("es-PY", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function formatDateShort(dateKey: string): string {
  if (!isValidDateKey(dateKey)) return dateKey;
  return new Intl.DateTimeFormat("es-PY", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00.000Z`));
}

function formatDateRange(from: string, to: string): string {
  return `${formatDateShort(from)} al ${formatDateShort(to)}`;
}

function getWeekdayLabel(isoWeekday: number): string {
  return WEEKDAYS.find((weekday) => weekday.isoWeekday === isoWeekday)?.label ?? String(isoWeekday);
}

function getWeekdayShortLabel(isoWeekday: number): string {
  return (
    WEEKDAYS.find((weekday) => weekday.isoWeekday === isoWeekday)?.shortLabel ??
    String(isoWeekday)
  );
}

function getIsoWeekdayFromDateKey(dateKey: string): number | null {
  if (!isValidDateKey(dateKey)) return null;
  const day = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function formatPreviewDate(dateKey: string): string {
  const isoWeekday = getIsoWeekdayFromDateKey(dateKey);
  if (!isoWeekday) return dateKey;
  return `${getWeekdayShortLabel(isoWeekday)} ${formatDateShort(dateKey)}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function getApiErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (!error.details || typeof error.details !== "object") return null;
  const code = (error.details as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function getAvailabilityErrorMessage(error: unknown): string {
  const code = getApiErrorCode(error);
  if (code === "invalid_range") return "Revisá el rango de fechas.";
  if (code === "invalid_weekdays") return "Elegí al menos una noche disponible.";
  if (code === "invalid_capacity") return "Revisá los cupos cargados.";
  if (code === "duplicate_exception_date") return "Ya existe una excepción para esa fecha.";
  if (code === "capacity_below_reserved") {
    return "No se pudo guardar porque una o más fechas ya tienen más entradas vendidas o reservadas que la capacidad indicada.";
  }
  if (code === "availability_materialization_failed") {
    return "Hubo un conflicto temporal al guardar. Probá de nuevo.";
  }

  return getErrorMessage(error, "No pudimos guardar la disponibilidad.");
}

function getInitialAvailabilityForm(): AvailabilityFormState {
  const today = getDateKey(new Date());
  return {
    validFrom: today,
    validTo: addDays(today, DEFAULT_AVAILABILITY_DAYS),
    weekdays: WEEKDAYS.map((weekday) => ({
      isoWeekday: weekday.isoWeekday,
      enabled: false,
      stockMode: "limited",
      capacity: "",
    })),
    exceptions: [],
  };
}

function buildAvailabilityForm(ticket: AccessTicketConfig | null): AvailabilityFormState {
  if (!ticket?.availability.rule) return getInitialAvailabilityForm();

  const weekdaysByIso = new Map(
    ticket.availability.weekdays.map((weekday) => [weekday.iso_weekday, weekday])
  );

  return {
    validFrom: ticket.availability.rule.valid_from,
    validTo: ticket.availability.rule.valid_to,
    weekdays: WEEKDAYS.map((weekday) => {
      const configured = weekdaysByIso.get(weekday.isoWeekday);
      return {
        isoWeekday: weekday.isoWeekday,
        enabled: Boolean(configured),
        stockMode: configured?.stock_mode ?? "limited",
        capacity:
          configured?.stock_mode === "limited" && configured.capacity !== null
            ? String(configured.capacity)
            : "",
      };
    }),
    exceptions: ticket.availability.exceptions.map((exception) => ({
      localId: exception.id,
      accessDate: exception.access_date,
      exceptionMode: exception.exception_mode,
      capacity:
        exception.exception_mode === "limited" && exception.capacity !== null
          ? String(exception.capacity)
          : "",
      reason: exception.reason ?? "",
    })),
  };
}

function buildTicketForm(ticket: AccessTicketConfig | null): TicketFormState {
  if (!ticket) return EMPTY_TICKET_FORM;
  return {
    name: ticket.name,
    description: ticket.description ?? "",
    priceGs: String(ticket.price_gs),
    active: ticket.active,
  };
}

function getAvailabilitySummary(ticket: AccessTicketConfig): {
  rangeLabel: string;
  nightsLabel: string;
  weekdayBadges: string[];
} {
  if (!ticket.availability.rule) {
    return {
      rangeLabel: "Sin disponibilidad configurada",
      nightsLabel: ticket.active ? "No disponible para venta" : "No se vende",
      weekdayBadges: [],
    };
  }

  const weekdayBadges = [...ticket.availability.weekdays]
    .sort((left, right) => left.iso_weekday - right.iso_weekday)
    .map((weekday) => {
      const label = getWeekdayLabel(weekday.iso_weekday);
      if (weekday.stock_mode === "unlimited") return `${label} ilimitado`;
      return `${label} ${weekday.capacity ?? 0} cupos`;
    });

  return {
    rangeLabel: `Disponible del ${formatDateRange(
      ticket.availability.rule.valid_from,
      ticket.availability.rule.valid_to
    )}`,
    nightsLabel: weekdayBadges.length > 0 ? weekdayBadges.join(" / ") : "Sin noches disponibles",
    weekdayBadges,
  };
}

function createLocalException(accessDate: string): ExceptionFormState {
  return {
    localId: `new-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    accessDate,
    exceptionMode: "closed",
    capacity: "",
    reason: "",
  };
}

function validateAvailabilityForm(form: AvailabilityFormState): string | null {
  if (!isValidDateKey(form.validFrom) || !isValidDateKey(form.validTo)) {
    return "Cargá fechas válidas en formato YYYY-MM-DD.";
  }

  if (form.validFrom > form.validTo) {
    return "La fecha desde debe ser anterior o igual a la fecha hasta.";
  }

  if (dateDiffInDays(form.validFrom, form.validTo) + 1 > MAX_AVAILABILITY_DAYS) {
    return "El rango no puede superar 93 días.";
  }

  const enabledWeekdays = form.weekdays.filter((weekday) => weekday.enabled);
  if (enabledWeekdays.length === 0) {
    return "Elegí al menos una noche disponible.";
  }

  for (const weekday of enabledWeekdays) {
    if (weekday.stockMode === "limited") {
      const capacity = Number(weekday.capacity);
      if (!Number.isInteger(capacity) || capacity <= 0) {
        return `Revisá los cupos de ${getWeekdayLabel(weekday.isoWeekday)}.`;
      }
    }
  }

  const exceptionDates = new Set<string>();
  for (const exception of form.exceptions) {
    if (!isValidDateKey(exception.accessDate)) {
      return "Revisá la fecha de las excepciones.";
    }

    if (exception.accessDate < form.validFrom || exception.accessDate > form.validTo) {
      return "Las excepciones deben estar dentro del rango de disponibilidad.";
    }

    if (exceptionDates.has(exception.accessDate)) {
      return "Ya existe una excepción para esa fecha.";
    }
    exceptionDates.add(exception.accessDate);

    if (exception.exceptionMode === "limited") {
      const capacity = Number(exception.capacity);
      if (!Number.isInteger(capacity) || capacity <= 0) {
        return "Revisá los cupos de las excepciones limitadas.";
      }
    }

    if (exception.reason.trim().length > MAX_REASON_LENGTH) {
      return "El motivo de la excepción no puede superar 200 caracteres.";
    }
  }

  return null;
}

function buildAvailabilityPayload(form: AvailabilityFormState): SaveAccessTicketAvailabilityInput {
  return {
    valid_from: form.validFrom,
    valid_to: form.validTo,
    weekdays: form.weekdays
      .filter((weekday) => weekday.enabled)
      .map((weekday) => ({
        iso_weekday: weekday.isoWeekday,
        stock_mode: weekday.stockMode,
        capacity: weekday.stockMode === "limited" ? Number(weekday.capacity) : null,
      })),
    exceptions: form.exceptions.map((exception) => ({
      access_date: exception.accessDate,
      exception_mode: exception.exceptionMode,
      capacity: exception.exceptionMode === "limited" ? Number(exception.capacity) : null,
      reason: exception.reason.trim() || null,
    })),
  };
}

function getAvailabilityPreview(form: AvailabilityFormState): Array<{
  accessDate: string;
  dateLabel: string;
  stockLabel: string;
  isClosed: boolean;
}> {
  if (!isValidDateKey(form.validFrom) || !isValidDateKey(form.validTo)) return [];
  if (form.validFrom > form.validTo) return [];

  const enabledWeekdays = form.weekdays.filter((weekday) => weekday.enabled);
  if (enabledWeekdays.length === 0) return [];

  const weekdaysByIso = new Map(enabledWeekdays.map((weekday) => [weekday.isoWeekday, weekday]));
  const exceptionsByDate = new Map(
    form.exceptions
      .filter((exception) => isValidDateKey(exception.accessDate))
      .map((exception) => [exception.accessDate, exception])
  );
  const preview: Array<{
    accessDate: string;
    dateLabel: string;
    stockLabel: string;
    isClosed: boolean;
  }> = [];
  const maxDays = Math.min(dateDiffInDays(form.validFrom, form.validTo), MAX_AVAILABILITY_DAYS);

  for (let offset = 0; offset <= maxDays && preview.length < 5; offset += 1) {
    const accessDate = addDays(form.validFrom, offset);
    const isoWeekday = getIsoWeekdayFromDateKey(accessDate);
    if (!isoWeekday) continue;

    const baseWeekday = weekdaysByIso.get(isoWeekday);
    const exception = exceptionsByDate.get(accessDate);

    if (exception?.exceptionMode === "closed" && baseWeekday) {
      preview.push({
        accessDate,
        dateLabel: formatPreviewDate(accessDate),
        stockLabel: "no se vende",
        isClosed: true,
      });
      continue;
    }

    if (exception?.exceptionMode === "limited") {
      preview.push({
        accessDate,
        dateLabel: formatPreviewDate(accessDate),
        stockLabel: `${exception.capacity || "0"} cupos${baseWeekday ? "" : " · fecha especial"}`,
        isClosed: false,
      });
      continue;
    }

    if (exception?.exceptionMode === "unlimited") {
      preview.push({
        accessDate,
        dateLabel: formatPreviewDate(accessDate),
        stockLabel: `stock ilimitado${baseWeekday ? "" : " · fecha especial"}`,
        isClosed: false,
      });
      continue;
    }

    if (!baseWeekday) continue;

    preview.push({
      accessDate,
      dateLabel: formatPreviewDate(accessDate),
      stockLabel:
        baseWeekday.stockMode === "limited"
          ? `${baseWeekday.capacity || "0"} cupos`
          : "stock ilimitado",
      isClosed: false,
    });
  }

  return preview;
}

function isClosedExceptionOutsideSelectedWeekdays(
  exception: ExceptionFormState,
  form: AvailabilityFormState
): boolean {
  if (exception.exceptionMode !== "closed") return false;
  const isoWeekday = getIsoWeekdayFromDateKey(exception.accessDate);
  if (!isoWeekday) return false;
  return !form.weekdays.some(
    (weekday) => weekday.enabled && weekday.isoWeekday === isoWeekday
  );
}

function TicketStatusBadge({
  active,
  withoutAvailability = false,
}: {
  active: boolean;
  withoutAvailability?: boolean;
}) {
  if (active && withoutAvailability) {
    return <Badge variant="neutral">Pendiente de configuración</Badge>;
  }

  return <Badge variant={active ? "success" : "neutral"}>{active ? "Activa" : "Inactiva"}</Badge>;
}

function AccessTicketCard({
  ticket,
  selected,
  onSelect,
  onEdit,
  canEdit,
}: {
  ticket: AccessTicketConfig;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  canEdit: boolean;
}) {
  const summary = getAvailabilitySummary(ticket);
  const footerLabel = !ticket.active
    ? "No se vende"
    : !ticket.availability.rule
      ? ""
    : ticket.availability.summary.exceptions_count > 0
      ? `${ticket.availability.summary.exceptions_count} ${
          ticket.availability.summary.exceptions_count === 1 ? "excepción" : "excepciones"
        }`
      : ticket.availability.rule
        ? `${ticket.availability.summary.sellable_weekdays.length} ${
            ticket.availability.summary.sellable_weekdays.length === 1
              ? "noche disponible"
              : "noches disponibles"
          }`
        : "Sin noches disponibles";

  return (
    <article
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      className={cn(
        "flex h-[300px] cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        selected
          ? "border-slate-500 ring-2 ring-slate-200"
          : "border-neutral-200 hover:border-neutral-300",
        panelUi.focusRing
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-xl",
              selected ? "bg-[#8d1313]/10 text-[#8d1313]" : "bg-slate-100 text-slate-600"
            )}
          >
            <Ticket className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-neutral-950">{ticket.name}</h3>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <TicketStatusBadge
                active={ticket.active}
                withoutAvailability={!ticket.availability.rule}
              />
              {ticket.has_sales ? (
                <span className="text-xs font-medium text-slate-500">
                  Tiene ventas registradas
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            className={cn(
              "shrink-0 rounded-lg border border-transparent p-1.5 text-slate-500 hover:border-neutral-200 hover:bg-neutral-50 hover:text-slate-800",
              panelUi.focusRing
            )}
            aria-label="Editar entrada"
            title="Editar entrada"
          >
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="text-xl font-semibold text-[#8d1313]">{formatPYG(ticket.price_gs)}</p>
        <p className="text-xs text-slate-500">por entrada</p>
      </div>

      <div className="mt-3 border-t border-neutral-100 pt-3">
        <div className="flex items-start gap-2 text-sm text-slate-700">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <div>
            <p className="font-medium text-slate-800">{summary.rangeLabel}</p>
            {ticket.availability.rule ? (
              <p className="mt-1 line-clamp-2 text-slate-600">{summary.nightsLabel}</p>
            ) : (
              <p className="mt-1 text-slate-600">
                Configurá disponibilidad para poder venderla.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto flex min-h-8 items-center border-t border-neutral-100 pt-3">
        {footerLabel ? (
          <p className="text-sm text-slate-600">{footerLabel}</p>
        ) : (
          <span className="sr-only">Sin acciones adicionales</span>
        )}
      </div>
    </article>
  );
}

export function AccessPageClient() {
  const { data: context, loading: contextLoading, error: contextError } = usePanelContext();
  const canEdit = context?.role === "owner";
  const isClub = context?.local.type === "club";
  const [tickets, setTickets] = useState<AccessTicketConfig[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [isTicketEditorOpen, setIsTicketEditorOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState<TicketFormState>(EMPTY_TICKET_FORM);
  const [availabilityForm, setAvailabilityForm] = useState<AvailabilityFormState>(
    getInitialAvailabilityForm
  );
  const [loading, setLoading] = useState(false);
  const [savingTicket, setSavingTicket] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const carouselDragStartXRef = useRef(0);
  const carouselDragStartScrollRef = useRef(0);
  const carouselDraggedRef = useRef(false);
  const [isCarouselDragging, setIsCarouselDragging] = useState(false);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, tickets]
  );

  const selectedWeekdays = useMemo(
    () => availabilityForm.weekdays.filter((weekday) => weekday.enabled),
    [availabilityForm.weekdays]
  );
  const availabilityPreview = useMemo(
    () => getAvailabilityPreview(availabilityForm),
    [availabilityForm]
  );
  const selectedTicketIndex = useMemo(
    () => tickets.findIndex((ticket) => ticket.id === selectedTicketId),
    [selectedTicketId, tickets]
  );
  const mobileDetailOrder =
    !isCreatingTicket && selectedTicketIndex >= 0
      ? selectedTicketIndex * 2 + 1
      : tickets.length * 2 + 1;
  const cannotActivateSelectedTicket = Boolean(
    selectedTicket && !selectedTicket.active && !selectedTicket.availability.rule
  );

  const reloadAccessConfig = useCallback(async (options?: { clearNotice?: boolean }) => {
    setLoading(true);
    if (options?.clearNotice !== false) {
      setNotice(null);
    }

    try {
      const response = await getAccessConfig();
      setTickets(response.tickets);
      setSelectedTicketId((current) => {
        if (current && response.tickets.some((ticket) => ticket.id === current)) {
          return current;
        }

        return response.tickets[0]?.id ?? "";
      });
    } catch (error) {
      setTickets([]);
      setNotice({
        type: "error",
        message: getErrorMessage(error, "No pudimos cargar las entradas."),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (contextLoading || !context || !isClub) return;
    void reloadAccessConfig();
  }, [context, contextLoading, isClub, reloadAccessConfig]);

  useEffect(() => {
    if (isCreatingTicket) return;
    setTicketForm(buildTicketForm(selectedTicket));
    setAvailabilityForm(buildAvailabilityForm(selectedTicket));
  }, [isCreatingTicket, selectedTicket]);

  const startCreateTicket = () => {
    if (!canEdit) return;
    setIsCreatingTicket(true);
    setIsTicketEditorOpen(true);
    setSelectedTicketId("");
    setTicketForm(EMPTY_TICKET_FORM);
    setAvailabilityForm(getInitialAvailabilityForm());
    setNotice(null);
  };

  const startEditTicket = (ticket: AccessTicketConfig) => {
    if (!canEdit) return;
    setIsCreatingTicket(false);
    setSelectedTicketId(ticket.id);
    setTicketForm(buildTicketForm(ticket));
    setAvailabilityForm(buildAvailabilityForm(ticket));
    setIsTicketEditorOpen(true);
    setNotice(null);
  };

  const closeTicketEditor = () => {
    setIsTicketEditorOpen(false);
    if (isCreatingTicket) {
      setIsCreatingTicket(false);
      setTicketForm(buildTicketForm(selectedTicket));
    }
  };

  const selectTicket = (ticketId: string) => {
    setIsCreatingTicket(false);
    setIsTicketEditorOpen(false);
    setSelectedTicketId(ticketId);
    setNotice(null);
  };

  const handleCarouselPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    carouselDraggedRef.current = false;
    carouselDragStartXRef.current = event.clientX;
    carouselDragStartScrollRef.current = event.currentTarget.scrollLeft;
    setIsCarouselDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCarouselPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isCarouselDragging) return;

    const deltaX = event.clientX - carouselDragStartXRef.current;
    if (Math.abs(deltaX) > 4) {
      carouselDraggedRef.current = true;
    }

    event.currentTarget.scrollLeft = carouselDragStartScrollRef.current - deltaX;
  };

  const stopCarouselDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!isCarouselDragging) return;

    setIsCarouselDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    window.setTimeout(() => {
      carouselDraggedRef.current = false;
    }, 0);
  };

  const handleCarouselClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!carouselDraggedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleSaveTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;

    const name = ticketForm.name.trim();
    const description = ticketForm.description.trim() || null;
    const priceGs = Number(ticketForm.priceGs);

    if (!name || name.length < 2) {
      setNotice({ type: "error", message: "El nombre debe tener al menos 2 caracteres." });
      return;
    }

    if (!Number.isInteger(priceGs) || priceGs <= 0) {
      setNotice({ type: "error", message: "El precio debe ser un entero mayor a 0." });
      return;
    }

    setSavingTicket(true);
    setNotice(null);

    try {
      if (selectedTicket && !isCreatingTicket) {
        await updateAccessTicketType(selectedTicket.id, {
          description,
          active: ticketForm.active,
          ...(selectedTicket.has_sales ? {} : { name, price_gs: priceGs }),
        });
        setNotice({ type: "success", message: "Datos de entrada guardados." });
        setIsTicketEditorOpen(false);
        await reloadAccessConfig({ clearNotice: false });
      } else {
        const response = await createAccessTicketType({
          name,
          description,
          price_gs: priceGs,
          active: ticketForm.active,
        });
        setNotice({ type: "success", message: "Entrada creada." });
        setIsCreatingTicket(false);
        setIsTicketEditorOpen(false);
        await reloadAccessConfig({ clearNotice: false });
        setSelectedTicketId(response.ticketType.id);
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error, "No pudimos guardar la entrada."),
      });
    } finally {
      setSavingTicket(false);
    }
  };

  const handleToggleTicket = async () => {
    if (!canEdit || !selectedTicket) return;

    if (!selectedTicket.active && !selectedTicket.availability.rule) {
      setNotice({
        type: "error",
        message: "Configurá disponibilidad antes de activar esta entrada.",
      });
      return;
    }

    setSavingTicket(true);
    setNotice(null);

    try {
      await updateAccessTicketType(selectedTicket.id, { active: !selectedTicket.active });
      setNotice({
        type: "success",
        message: selectedTicket.active ? "Entrada desactivada." : "Entrada activada.",
      });
      await reloadAccessConfig({ clearNotice: false });
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error, "No pudimos cambiar el estado de la entrada."),
      });
    } finally {
      setSavingTicket(false);
    }
  };

  const updateWeekday = (isoWeekday: number, patch: Partial<WeekdayFormState>) => {
    setAvailabilityForm((current) => ({
      ...current,
      weekdays: current.weekdays.map((weekday) =>
        weekday.isoWeekday === isoWeekday ? { ...weekday, ...patch } : weekday
      ),
    }));
  };

  const updateException = (
    localId: string,
    patch: Partial<Omit<ExceptionFormState, "localId">>
  ) => {
    setAvailabilityForm((current) => ({
      ...current,
      exceptions: current.exceptions.map((exception) =>
        exception.localId === localId ? { ...exception, ...patch } : exception
      ),
    }));
  };

  const addException = () => {
    setAvailabilityForm((current) => ({
      ...current,
      exceptions: [...current.exceptions, createLocalException(current.validFrom)],
    }));
  };

  const removeException = (localId: string) => {
    setAvailabilityForm((current) => ({
      ...current,
      exceptions: current.exceptions.filter((exception) => exception.localId !== localId),
    }));
  };

  const handleSaveAvailability = async () => {
    if (!canEdit || !selectedTicket) return;

    const validationError = validateAvailabilityForm(availabilityForm);
    if (validationError) {
      setNotice({ type: "error", message: validationError });
      return;
    }

    setSavingAvailability(true);
    setNotice(null);

    try {
      await saveAccessTicketAvailability(
        selectedTicket.id,
        buildAvailabilityPayload(availabilityForm)
      );
      setNotice({ type: "success", message: "Disponibilidad guardada." });
      await reloadAccessConfig({ clearNotice: false });
    } catch (error) {
      setNotice({
        type: "error",
        message: getAvailabilityErrorMessage(error),
      });
    } finally {
      setSavingAvailability(false);
    }
  };

  if (contextLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className={panelUi.mutedText}>Cargando...</p>
      </div>
    );
  }

  if (contextError || !context) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-sm text-red-600">
          {contextError || "Error al cargar información del panel"}
        </p>
      </div>
    );
  }

  if (!isClub) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Entradas"
          subtitle="Configuración disponible para discotecas."
        />
        <div className={cn(panelUi.card, "p-5")}>
          <p className={panelUi.mutedText}>
            Esta sección está disponible solo para locales de tipo discoteca.
          </p>
        </div>
      </div>
    );
  }

  const detailTitle = isCreatingTicket
    ? "Entrada nueva"
    : selectedTicket?.name ?? "Seleccioná una entrada";

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Entradas"
        subtitle="Configurá tus entradas, las noches disponibles y los cupos por noche."
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
              <Info className="h-4 w-4 text-[#8d1313]" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-slate-900">Cómo funciona</strong>
                <span className="ml-2 text-slate-600">
                  entrada → disponibilidad → stock por noche
                </span>
              </span>
            </div>
            {canEdit ? (
              <button
                type="button"
                onClick={startCreateTicket}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-2xl bg-[#8d1313] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#741010]",
                  panelUi.focusRing
                )}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Entrada nueva
              </button>
            ) : null}
          </div>
        }
      />

      {!canEdit ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-700">
            Tu usuario puede consultar esta configuración, pero no modificarla.
          </p>
        </section>
      ) : null}

      {notice ? (
        <section
          className={cn(
            "rounded-2xl border px-4 py-3",
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          )}
        >
          <p className="text-sm">{notice.message}</p>
        </section>
      ) : null}

      <section>
        {loading && tickets.length === 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className={cn(panelUi.card, "h-[300px] p-4")}>
                <div className={cn(panelUi.skeleton, "h-10 w-10 rounded-xl")} />
                <div className={cn(panelUi.skeleton, "mt-5 h-5 w-3/4")} />
                <div className={cn(panelUi.skeleton, "mt-4 h-8 w-1/2")} />
                <div className={cn(panelUi.skeleton, "mt-8 h-4 w-full")} />
                <div className={cn(panelUi.skeleton, "mt-3 h-4 w-2/3")} />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && tickets.length === 0 && !isCreatingTicket ? (
          <EmptyState
            title="Todavía no hay entradas"
            description="Creá la primera entrada pagada y después configurá sus noches disponibles."
            icon={<Ticket className="h-5 w-5" aria-hidden="true" />}
            action={
              canEdit ? (
                <button
                  type="button"
                  onClick={startCreateTicket}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-full bg-[#8d1313] px-4 py-2 text-sm font-semibold text-white hover:bg-[#741010]",
                    panelUi.focusRing
                  )}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Entrada nueva
                </button>
              ) : null
            }
          />
        ) : null}

        {tickets.length > 0 || selectedTicket || isCreatingTicket ? (
          <div className="flex flex-col gap-4 lg:block">
            {tickets.length > 0 ? (
              <>
                <div
                  ref={carouselRef}
                  onPointerDown={handleCarouselPointerDown}
                  onPointerMove={handleCarouselPointerMove}
                  onPointerUp={stopCarouselDrag}
                  onPointerCancel={stopCarouselDrag}
                  onClickCapture={handleCarouselClickCapture}
                  className={cn(
                    "hidden select-none gap-4 overflow-x-auto pb-2 lg:flex",
                    isCarouselDragging ? "cursor-grabbing" : "cursor-grab",
                    "[scrollbar-color:rgb(203_213_225)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300"
                  )}
                >
                  {tickets.map((ticket) => (
                    <div
                      key={`desktop-${ticket.id}`}
                      className="h-[300px] min-w-[260px] flex-[0_0_260px] xl:flex-[0_0_300px] 2xl:flex-[0_0_320px]"
                    >
                      <AccessTicketCard
                        ticket={ticket}
                        selected={!isCreatingTicket && selectedTicketId === ticket.id}
                        onSelect={() => selectTicket(ticket.id)}
                        onEdit={() => startEditTicket(ticket)}
                        canEdit={canEdit}
                      />
                    </div>
                  ))}
                </div>

                {tickets.map((ticket, index) => (
                  <div
                    key={`mobile-${ticket.id}`}
                    className="lg:hidden"
                    style={{ order: index * 2 }}
                  >
                    <AccessTicketCard
                      ticket={ticket}
                      selected={!isCreatingTicket && selectedTicketId === ticket.id}
                      onSelect={() => selectTicket(ticket.id)}
                      onEdit={() => startEditTicket(ticket)}
                      canEdit={canEdit}
                    />
                  </div>
                ))}
              </>
            ) : null}

            {selectedTicket || isCreatingTicket ? (
              <section
                className={cn(panelUi.card, "p-5 lg:mt-5")}
                style={{ order: mobileDetailOrder }}
              >
          <div className="flex flex-col gap-4 border-b border-neutral-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8d1313]/10 text-[#8d1313]">
                <Ticket className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-neutral-950">{detailTitle}</h2>
                  {selectedTicket ? (
                    <TicketStatusBadge
                      active={selectedTicket.active}
                      withoutAvailability={!selectedTicket.availability.rule}
                    />
                  ) : null}
                </div>
                <p className="max-w-3xl text-sm text-slate-600">
                  {isCreatingTicket
                    ? "Creá la entrada. Después vas a poder definir sus noches disponibles."
                    : selectedTicket?.description || "Sin descripción."}
                </p>
              </div>
            </div>

            {selectedTicket && canEdit ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void handleToggleTicket()}
                  disabled={savingTicket || cannotActivateSelectedTicket}
                  className={cn(
                    "inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60",
                    panelUi.focusRing
                  )}
                >
                  {selectedTicket.active ? "Desactivar" : "Activar"}
                </button>
                {cannotActivateSelectedTicket ? (
                  <p className="max-w-xs text-xs text-slate-500 sm:basis-full sm:text-right">
                    Configurá disponibilidad antes de activar esta entrada.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-5">
            {isTicketEditorOpen ? (
              <div
                className="fixed inset-0 z-50 flex items-end bg-slate-950/30 px-3 py-4 backdrop-blur-sm sm:items-center sm:justify-center"
                role="dialog"
                aria-modal="true"
                aria-labelledby="access-ticket-editor-title"
              >
                <form
                  className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl"
                  onSubmit={handleSaveTicket}
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h3
                        id="access-ticket-editor-title"
                        className="text-base font-semibold text-neutral-950"
                      >
                        {isCreatingTicket ? "Entrada nueva" : "Editar entrada"}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Nombre, descripción y precio que verá el cliente.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeTicketEditor}
                      className={cn(
                        "rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-neutral-50",
                        panelUi.focusRing
                      )}
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    Este apartado es para entradas pagas. Para free pass usá el flujo de
                    Free pass; no se crean entradas sin precio desde esta sección.
                  </div>

              {selectedTicket?.has_sales ? (
                <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                  Esta entrada ya tiene ventas registradas. Podés desactivarla para frenar
                  nuevas ventas, pero las entradas emitidas siguen válidas.
                </div>
              ) : null}

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className={panelUi.labelText} htmlFor="access-ticket-name">
                    Nombre
                  </label>
                  <input
                    id="access-ticket-name"
                    type="text"
                    value={ticketForm.name}
                    onChange={(event) =>
                      setTicketForm((current) => ({ ...current, name: event.target.value }))
                    }
                    disabled={!canEdit || Boolean(selectedTicket?.has_sales)}
                    className={cn(
                      "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500",
                      panelUi.focusRing
                    )}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={panelUi.labelText} htmlFor="access-ticket-price">
                    Precio Gs.
                  </label>
                  <input
                    id="access-ticket-price"
                    type="number"
                    min="1"
                    value={ticketForm.priceGs}
                    onChange={(event) =>
                      setTicketForm((current) => ({ ...current, priceGs: event.target.value }))
                    }
                    disabled={!canEdit || Boolean(selectedTicket?.has_sales)}
                    className={cn(
                      "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500",
                      panelUi.focusRing
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={panelUi.labelText} htmlFor="access-ticket-description">
                    Descripción
                  </label>
                  <textarea
                    id="access-ticket-description"
                    value={ticketForm.description}
                    onChange={(event) =>
                      setTicketForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                    rows={4}
                    maxLength={500}
                    className={cn(
                      "min-h-[112px] w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500",
                      panelUi.focusRing
                    )}
                  />
                </div>

                {isCreatingTicket ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    Primero configurá la disponibilidad. Después podés activarla para vender.
                  </div>
                ) : null}

                {canEdit ? (
                  <button
                    type="submit"
                    disabled={savingTicket}
                    className={cn(
                      "inline-flex w-full items-center justify-center rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60",
                      panelUi.focusRing
                    )}
                  >
                    {savingTicket
                      ? "Guardando..."
                      : isCreatingTicket
                        ? "Crear entrada"
                        : "Guardar datos"}
                  </button>
                ) : null}
              </div>
                </form>
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
              <section className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-neutral-950">
                    Reglas de disponibilidad
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Definí cuándo y cuántos cupos hay disponibles por noche.
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    El cliente puede comprar anticipadamente; el cupo se descuenta de la
                    fecha de acceso elegida. Ej.: compra el lunes para entrar el viernes.
                  </p>
                </div>

                {!selectedTicket ? (
                  <div className={panelUi.emptyWrap}>
                    <p className={panelUi.mutedText}>
                      Creá la entrada antes de configurar disponibilidad.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {!selectedTicket.availability.rule ? (
                      <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-slate-600">
                        Esta entrada todavía no tiene disponibilidad configurada.
                      </div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className={panelUi.labelText} htmlFor="access-valid-from">
                          Desde
                        </label>
                        <input
                          id="access-valid-from"
                          type="date"
                          value={availabilityForm.validFrom}
                          onChange={(event) =>
                            setAvailabilityForm((current) => ({
                              ...current,
                              validFrom: event.target.value,
                            }))
                          }
                          disabled={!canEdit}
                          className={cn(
                            "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500",
                            panelUi.focusRing
                          )}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className={panelUi.labelText} htmlFor="access-valid-to">
                          Hasta
                        </label>
                        <input
                          id="access-valid-to"
                          type="date"
                          value={availabilityForm.validTo}
                          onChange={(event) =>
                            setAvailabilityForm((current) => ({
                              ...current,
                              validTo: event.target.value,
                            }))
                          }
                          disabled={!canEdit}
                          className={cn(
                            "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500",
                            panelUi.focusRing
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className={panelUi.labelText}>Días de la semana</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {availabilityForm.weekdays.map((weekday) => {
                          const weekdayMeta = WEEKDAYS.find(
                            (item) => item.isoWeekday === weekday.isoWeekday
                          );
                          return (
                            <button
                              key={weekday.isoWeekday}
                              type="button"
                              disabled={!canEdit}
                              onClick={() =>
                                updateWeekday(weekday.isoWeekday, {
                                  enabled: !weekday.enabled,
                                })
                              }
                              className={cn(
                                "rounded-xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                                weekday.enabled
                                  ? "border-[#8d1313] bg-[#8d1313] text-white"
                                  : "border-neutral-200 bg-white text-slate-700 hover:bg-neutral-50",
                                panelUi.focusRing
                              )}
                            >
                              {weekdayMeta?.label ?? weekday.isoWeekday}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className={panelUi.labelText}>Stock por noche</p>
                      {selectedWeekdays.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-center text-sm text-slate-600">
                          Elegí al menos una noche para definir cupos.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedWeekdays.map((weekday) => (
                            <div
                              key={weekday.isoWeekday}
                              className="grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 sm:grid-cols-[1fr_auto]"
                            >
                              <div>
                                <p className="text-sm font-semibold text-neutral-950">
                                  {getWeekdayLabel(weekday.isoWeekday)}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {(["limited", "unlimited"] as AccessStockMode[]).map(
                                    (mode) => (
                                      <button
                                        key={mode}
                                        type="button"
                                        disabled={!canEdit}
                                        onClick={() =>
                                          updateWeekday(weekday.isoWeekday, {
                                            stockMode: mode,
                                            capacity: mode === "unlimited" ? "" : weekday.capacity,
                                          })
                                        }
                                        className={cn(
                                          "rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                                          weekday.stockMode === mode
                                            ? "border-[#8d1313]/20 bg-[#8d1313]/10 text-[#8d1313]"
                                            : "border-neutral-200 bg-white text-slate-600 hover:bg-neutral-50",
                                          panelUi.focusRing
                                        )}
                                      >
                                        {mode === "limited" ? "Limitado" : "Ilimitado"}
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                              {weekday.stockMode === "limited" ? (
                                <label className="flex items-center gap-2 justify-self-start sm:justify-self-end">
                                  <input
                                    type="number"
                                    min="1"
                                    value={weekday.capacity}
                                    onChange={(event) =>
                                      updateWeekday(weekday.isoWeekday, {
                                        capacity: event.target.value,
                                      })
                                    }
                                    disabled={!canEdit}
                                    className={cn(
                                      "w-24 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500",
                                      panelUi.focusRing
                                    )}
                                  />
                                  <span className="text-sm text-slate-600">cupos</span>
                                </label>
                              ) : (
                                <span className="self-center justify-self-start text-sm font-medium text-slate-600 sm:justify-self-end">
                                  Sin límite
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {availabilityPreview.length > 0 ? (
                      <div className="rounded-xl border border-neutral-200 bg-white px-3 py-3">
                        <p className={panelUi.labelText}>Próximas fechas</p>
                        <div className="mt-2 space-y-2">
                          {availabilityPreview.map((item) => (
                            <div
                              key={item.accessDate}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span className="font-medium text-slate-800">{item.dateLabel}</span>
                              <span
                                className={cn(
                                  "text-right font-semibold",
                                  item.isClosed ? "text-slate-500" : "text-[#8d1313]"
                                )}
                              >
                                {item.stockLabel}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => void handleSaveAvailability()}
                        disabled={savingAvailability}
                        className={cn(
                          "inline-flex w-full items-center justify-center rounded-xl bg-[#8d1313] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#741010] disabled:cursor-not-allowed disabled:opacity-60",
                          panelUi.focusRing
                        )}
                      >
                        {savingAvailability ? "Guardando..." : "Guardar disponibilidad"}
                      </button>
                    ) : null}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-neutral-950">Excepciones</h3>
                      <Info className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Usá excepciones para cerrar o modificar una fecha puntual.
                    </p>
                  </div>
                </div>

                {!selectedTicket ? (
                  <div className={panelUi.emptyWrap}>
                    <p className={panelUi.mutedText}>Creá la entrada antes de agregar excepciones.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {availabilityForm.exceptions.length === 0 ? (
                      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/60 px-6 py-10 text-center">
                        <CalendarDays className="h-9 w-9 text-slate-500" aria-hidden="true" />
                        <h4 className="mt-4 text-base font-semibold text-neutral-950">
                          Sin excepciones
                        </h4>
                        <p className="mt-2 max-w-sm text-sm text-slate-600">
                          Las excepciones permiten anular o cambiar la disponibilidad en una
                          fecha puntual.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {availabilityForm.exceptions.map((exception) => (
                          <div
                            key={exception.localId}
                            className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3"
                          >
                            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                              <div className="space-y-1.5">
                                <label className={panelUi.labelText}>Fecha</label>
                                <input
                                  type="date"
                                  value={exception.accessDate}
                                  onChange={(event) =>
                                    updateException(exception.localId, {
                                      accessDate: event.target.value,
                                    })
                                  }
                                  disabled={!canEdit}
                                  className={cn(
                                    "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500",
                                    panelUi.focusRing
                                  )}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className={panelUi.labelText}>Modo</label>
                                <select
                                  value={exception.exceptionMode}
                                  onChange={(event) =>
                                    updateException(exception.localId, {
                                      exceptionMode: event.target
                                        .value as AccessAvailabilityExceptionMode,
                                      capacity:
                                        event.target.value === "limited"
                                          ? exception.capacity
                                          : "",
                                    })
                                  }
                                  disabled={!canEdit}
                                  className={cn(
                                    "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500",
                                    panelUi.focusRing
                                  )}
                                >
                                  <option value="closed">No se vende</option>
                                  <option value="limited">Cupos limitados</option>
                                  <option value="unlimited">Stock ilimitado</option>
                                </select>
                              </div>
                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => removeException(exception.localId)}
                                  className={cn(
                                    "self-end rounded-xl border border-neutral-200 bg-white p-2 text-slate-500 hover:bg-neutral-50 hover:text-red-700",
                                    panelUi.focusRing
                                  )}
                                  aria-label="Eliminar excepción"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              ) : null}
                            </div>

                            {exception.exceptionMode === "closed" ? (
                              <div className="mt-3 space-y-1 text-xs leading-5 text-slate-500">
                                <p>
                                  Bloquea nuevas ventas para esa fecha, pero no cancela entradas
                                  ya emitidas.
                                </p>
                                {isClosedExceptionOutsideSelectedWeekdays(
                                  exception,
                                  availabilityForm
                                ) ? (
                                  <p className="font-medium text-slate-600">
                                    Esa fecha no está dentro de los días habituales de venta. No
                                    se vende solo afecta fechas que normalmente estarían
                                    disponibles.
                                  </p>
                                ) : null}
                              </div>
                            ) : null}

                            {exception.exceptionMode === "limited" ? (
                              <div className="mt-3 space-y-1.5">
                                <label className={panelUi.labelText}>Cupos</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={exception.capacity}
                                  onChange={(event) =>
                                    updateException(exception.localId, {
                                      capacity: event.target.value,
                                    })
                                  }
                                  disabled={!canEdit}
                                  className={cn(
                                    "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500",
                                    panelUi.focusRing
                                  )}
                                />
                              </div>
                            ) : null}

                            <div className="mt-3 space-y-1.5">
                              <label className={panelUi.labelText}>Motivo opcional</label>
                              <input
                                type="text"
                                value={exception.reason}
                                onChange={(event) =>
                                  updateException(exception.localId, {
                                    reason: event.target.value,
                                  })
                                }
                                disabled={!canEdit}
                                maxLength={MAX_REASON_LENGTH}
                                className={cn(
                                  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500",
                                  panelUi.focusRing
                                )}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {canEdit ? (
                      <button
                        type="button"
                        onClick={addException}
                        className={cn(
                          "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-neutral-50",
                          panelUi.focusRing
                        )}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Agregar excepción
                      </button>
                    ) : null}

                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => void handleSaveAvailability()}
                        disabled={savingAvailability}
                        className={cn(
                          "inline-flex w-full items-center justify-center rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60",
                          panelUi.focusRing
                        )}
                      >
                        {savingAvailability ? "Guardando..." : "Guardar disponibilidad"}
                      </button>
                    ) : null}
                  </div>
                )}
              </section>
            </div>
          </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
