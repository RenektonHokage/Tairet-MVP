"use client";

import { useMemo } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  MessageCircle,
  Minus,
  Plus,
  Table,
  Users,
} from "lucide-react";

import { type ReservationDetail } from "@/lib/calendar";
import { Card, CardContent, CardHeader, CardTitle, cn, panelUi } from "@/components/panel/ui";

type LocalType = "bar" | "club";

export type DayState = {
  isOpen: boolean;
  note: string;
  tablesWhatsapp: number;
  tablesTairet: number;
};

export const defaultDayState: DayState = {
  isOpen: true,
  note: "",
  tablesWhatsapp: 0,
  tablesTairet: 0,
};

const weekdayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildCalendarCells = (monthDate: Date) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - startWeekday + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) return null;
    return new Date(year, month, dayNumber);
  });
};

const getMonthLabel = (date: Date) =>
  date.toLocaleDateString("es-PY", { month: "long", year: "numeric" });

function parseDate(dateStr: string): Date | null {
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

const formatReservationTime = (dateStr: string) => {
  const parsed = parseDate(dateStr);
  if (!parsed) return "—";
  return parsed.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" });
};

const CalendarLegend = () => (
  <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500">
    <span className="inline-flex items-center gap-2">
      <span className="h-3 w-3 rounded-sm bg-emerald-600" />
      Seleccionado
    </span>
    <span className="inline-flex items-center gap-2">
      <span className="h-3 w-3 rounded-sm bg-rose-200" />
      Cerrado
    </span>
  </div>
);

const CalendarToggle = ({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={isOpen}
    className={cn(
      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
      isOpen ? "bg-emerald-600 focus-visible:outline-emerald-600" : "bg-rose-300 focus-visible:outline-rose-400"
    )}
  >
    <span
      className={cn(
        "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
        isOpen ? "translate-x-5" : "translate-x-1"
      )}
    />
  </button>
);

const CalendarCounterRow = ({
  icon,
  label,
  value,
  onDecrease,
  onIncrease,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2 text-sm text-neutral-800">
      <span className="text-emerald-600">{icon}</span>
      {label}
    </div>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onDecrease}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[20px] text-center text-sm font-semibold text-neutral-900">
        {value}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);

const ClubDetailSection = ({
  draft,
  onUpdateDraft,
  checkinsValue,
  checkinsError,
}: {
  draft: DayState;
  onUpdateDraft: (patch: Partial<DayState>) => void;
  checkinsValue: React.ReactNode;
  checkinsError?: string | null;
}) => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <CheckCircle2 className="h-4 w-4" />
          Check-ins
        </div>
        <div className="mt-2 text-2xl font-semibold text-neutral-950">{checkinsValue}</div>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Table className="h-4 w-4" />
          Mesas (manual)
        </div>
        <div className="mt-2 text-2xl font-semibold text-neutral-950">
          {draft.tablesWhatsapp + draft.tablesTairet}
        </div>
      </div>
    </div>
    {checkinsError ? <p className="text-xs text-rose-600">{checkinsError}</p> : null}

    <a
      className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:underline"
      href="/panel/orders"
    >
      Ir a Órdenes
      <ExternalLink className="h-4 w-4" />
    </a>

    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Mesas confirmadas manualmente
      </p>
      <CalendarCounterRow
        icon={<MessageCircle className="h-4 w-4" />}
        label="Mesas reservadas por WhatsApp"
        value={draft.tablesWhatsapp}
        onDecrease={() =>
          onUpdateDraft({
            tablesWhatsapp: Math.max(0, draft.tablesWhatsapp - 1),
          })
        }
        onIncrease={() =>
          onUpdateDraft({
            tablesWhatsapp: draft.tablesWhatsapp + 1,
          })
        }
      />
      <CalendarCounterRow
        icon={<CheckCircle2 className="h-4 w-4" />}
        label="Mesas reservadas por Tairet"
        value={draft.tablesTairet}
        onDecrease={() =>
          onUpdateDraft({
            tablesTairet: Math.max(0, draft.tablesTairet - 1),
          })
        }
        onIncrease={() =>
          onUpdateDraft({
            tablesTairet: draft.tablesTairet + 1,
          })
        }
      />
    </div>
  </div>
);

const BarDetailSection = ({
  reservations,
  loading,
  error,
}: {
  reservations: ReservationDetail[];
  loading: boolean;
  error: string | null;
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold text-neutral-900">
        Reservas del día ({reservations.length})
      </p>
      <a
        className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:underline"
        href="/panel/reservations"
      >
        Ver todas las reservas
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
    {error ? (
      <p className="text-sm text-rose-600">{error}</p>
    ) : loading ? (
      <p className="text-sm text-neutral-500">Cargando reservas...</p>
    ) : reservations.length === 0 ? (
      <p className="text-sm text-neutral-500">Aún no hay reservas</p>
    ) : (
      <div className="space-y-2">
        {reservations.slice(0, 3).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
          >
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                {[item.name, item.last_name].filter(Boolean).join(" ")}
              </p>
              <p className="text-xs text-neutral-500">
                {item.table_note ?? item.notes ?? "—"}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-neutral-500">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatReservationTime(item.date)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {item.guests}
              </span>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export type CalendarViewProps = {
  loading: boolean;
  error: string | null;
  localType: LocalType;
  currentMonth: Date;
  selectedDate: Date;
  dayState: Record<string, DayState>;
  draft: DayState;
  monthStatus: { loading: boolean; error: string | null };
  detailStatus: { loading: boolean; error: string | null };
  reservations: ReservationDetail[];
  checkinsValue: React.ReactNode;
  checkinsError?: string | null;
  onSelectDate: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onUpdateDraft: (patch: Partial<DayState>) => void;
  onMarkClosed: () => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
};

export function CalendarView({
  loading,
  error,
  localType,
  currentMonth,
  selectedDate,
  dayState,
  draft,
  monthStatus,
  detailStatus,
  reservations,
  checkinsValue,
  checkinsError,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onUpdateDraft,
  onMarkClosed,
  onSave,
  saving,
  saveError,
}: CalendarViewProps) {
  const selectedKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);
  const monthLabel = useMemo(() => getMonthLabel(currentMonth), [currentMonth]);
  const calendarCells = useMemo(() => buildCalendarCells(currentMonth), [currentMonth]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 rounded bg-neutral-200/70 animate-pulse" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="h-[560px] rounded-3xl bg-neutral-200/70 animate-pulse" />
          <div className="h-[560px] rounded-3xl bg-neutral-200/70 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={panelUi.emptyWrap}>
        <p className="text-sm text-neutral-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CalendarDays className="h-5 w-5" />
        </span>
        <div>
          <h1 className={panelUi.pageTitle}>Calendario</h1>
          <p className={panelUi.pageSubtitle}>Programación mensual y detalle operativo</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="capitalize">{monthLabel}</CardTitle>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPrevMonth}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onNextMonth}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {monthStatus.loading ? (
              <p className="mb-3 text-xs text-neutral-500">Cargando calendario...</p>
            ) : monthStatus.error ? (
              <p className="mb-3 text-xs text-rose-600">{monthStatus.error}</p>
            ) : null}
            <div className="grid grid-cols-7 gap-2 text-xs font-medium text-neutral-500">
              {weekdayLabels.map((label) => (
                <div key={label} className="text-center">
                  {label}
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-7 gap-3">
              {calendarCells.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="h-20 rounded-2xl" />;
                }
                const key = formatDateKey(date);
                const state = dayState[key] ?? defaultDayState;
                const isSelected = key === selectedKey;
                const isClosed = !state.isOpen;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSelectDate(date)}
                    className={cn(
                      "flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                      isSelected
                        ? "border-emerald-600 bg-emerald-600 text-white focus-visible:outline-emerald-600"
                        : isClosed
                        ? "border-rose-100 bg-rose-100 text-rose-700 focus-visible:outline-rose-300"
                        : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 focus-visible:outline-neutral-400"
                    )}
                  >
                    <span>{date.getDate()}</span>
                    {isClosed ? (
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wide",
                          isSelected ? "text-white/90" : "text-rose-500"
                        )}
                      >
                        Cerrado
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col gap-4 border-t border-neutral-200 pt-4 md:flex-row md:items-center md:justify-between">
              <CalendarLegend />
              <button
                type="button"
                onClick={onMarkClosed}
                className={cn(
                  "inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                  draft.isOpen
                    ? "border-rose-300 text-rose-600 hover:bg-rose-50 focus-visible:outline-rose-300"
                    : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 focus-visible:outline-emerald-300"
                )}
              >
                {draft.isOpen ? "Marcar Cerrado" : "Marcar Abierto"}
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Detalle del día: {selectedKey}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Operación
              </p>
              <div className="flex items-center gap-3">
                <CalendarToggle
                  isOpen={draft.isOpen}
                  onToggle={() => onUpdateDraft({ isOpen: !draft.isOpen })}
                />
                <span className="text-sm font-medium text-neutral-800">
                  {draft.isOpen ? "Abierto" : "Cerrado"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Nota del día (máx. 200 caracteres)
              </label>
              <textarea
                value={draft.note}
                onChange={(event) => onUpdateDraft({ note: event.target.value.slice(0, 200) })}
                rows={4}
                maxLength={200}
                placeholder="Ej: Halloween, Privado, Evento especial..."
                className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none transition focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-200"
              />
              <p className="text-xs text-neutral-500">{draft.note.length}/200 caracteres</p>
            </div>

            {localType === "club" ? (
              <ClubDetailSection
                draft={draft}
                onUpdateDraft={onUpdateDraft}
                checkinsValue={detailStatus.loading ? "Cargando..." : checkinsValue}
                checkinsError={checkinsError}
              />
            ) : (
              <BarDetailSection
                reservations={reservations}
                loading={detailStatus.loading}
                error={detailStatus.error}
              />
            )}

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className={cn(
                "inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600",
                saving ? "bg-emerald-400" : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
            {saveError ? <p className="text-xs text-rose-600">{saveError}</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
