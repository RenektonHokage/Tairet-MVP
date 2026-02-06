"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

import { usePanelContext } from "@/lib/panelContext";
import { getPanelReservationsByLocalId, type Reservation as ApiReservation } from "@/lib/reservations";
import { getPanelMetricsSummaryWithSeries } from "@/lib/metrics";
import {
  getCalendarMonth,
  updateCalendarDay,
  type CalendarDay as CalendarDayType,
} from "@/lib/calendar";
import { Card, CardContent, CardHeader, CardTitle, cn, panelUi } from "@/components/panel/ui";

type LocalType = "bar" | "club";

type DayState = {
  isOpen: boolean;
  note: string;
  tablesWhatsapp: number;
  tablesTairet: number;
};

const defaultDayState: DayState = {
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

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

// Helpers: mismos que /panel/reservations
function parseDate(dateStr: string): Date | null {
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

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

const getDayRangeIso = (dayKey: string) => {
  const dayStart = `${dayKey}T00:00:00Z`;
  const [yearStr, monthStr, dayStr] = dayKey.split("-");
  const nextDate = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr) + 1));
  const nextDayStart = nextDate.toISOString().split("T")[0] + "T00:00:00Z";
  return { from: dayStart, to: nextDayStart };
};

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
  onUpdateDraft: (next: DayState) => void;
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
    {checkinsError ? (
      <p className="text-xs text-rose-600">{checkinsError}</p>
    ) : null}

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
            ...draft,
            tablesWhatsapp: Math.max(0, draft.tablesWhatsapp - 1),
          })
        }
        onIncrease={() => onUpdateDraft({ ...draft, tablesWhatsapp: draft.tablesWhatsapp + 1 })}
      />
      <CalendarCounterRow
        icon={<CheckCircle2 className="h-4 w-4" />}
        label="Mesas reservadas por Tairet"
        value={draft.tablesTairet}
        onDecrease={() =>
          onUpdateDraft({
            ...draft,
            tablesTairet: Math.max(0, draft.tablesTairet - 1),
          })
        }
        onIncrease={() => onUpdateDraft({ ...draft, tablesTairet: draft.tablesTairet + 1 })}
      />
    </div>
  </div>
);

const BarDetailSection = ({
  reservations,
  loading,
  error,
}: {
  reservations: ApiReservation[];
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
              <p className="text-xs text-neutral-500">{item.phone ?? "—"}</p>
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

export function LineupCalendarView() {
  const { data: context, loading, error } = usePanelContext();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [dayState, setDayState] = useState<Record<string, DayState>>({});
  const [draft, setDraft] = useState<DayState>(defaultDayState);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);
  const [reservations, setReservations] = useState<ApiReservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [reservationsError, setReservationsError] = useState<string | null>(null);
  const [checkinsCount, setCheckinsCount] = useState(0);
  const [loadingCheckins, setLoadingCheckins] = useState(false);
  const [checkinsError, setCheckinsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const monthCacheRef = useRef<Map<string, CalendarDayType[]>>(new Map());
  const monthFetchKeyRef = useRef<string | null>(null);
  const reservationsFetchKeyRef = useRef<string | null>(null);
  const checkinsFetchKeyRef = useRef<string | null>(null);
  const saveInFlightRef = useRef(false);

  const selectedKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);
  const selectedState = useMemo(
    () => dayState[selectedKey] ?? defaultDayState,
    [dayState, selectedKey]
  );
  const monthKey = useMemo(
    () =>
      `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`,
    [currentMonth]
  );
  const monthLabel = useMemo(() => getMonthLabel(currentMonth), [currentMonth]);
  const calendarCells = useMemo(() => buildCalendarCells(currentMonth), [currentMonth]);
  const selectedDateValue = useMemo(
    () => new Date(`${selectedKey}T00:00:00`),
    [selectedKey]
  );
  const filteredReservations = useMemo(() => {
    return reservations
      .filter((reservation) => {
        const reservationDate = parseDate(reservation.date);
        return reservationDate ? isSameDay(reservationDate, selectedDateValue) : false;
      })
      .sort((a, b) => {
        const dateA = parseDate(a.date)?.getTime() ?? 0;
        const dateB = parseDate(b.date)?.getTime() ?? 0;
        return dateA - dateB;
      });
  }, [reservations, selectedDateValue]);

  useEffect(() => {
    setDraft({ ...selectedState });
  }, [selectedState]);

  const localType: LocalType = context?.local.type === "bar" ? "bar" : "club";
  const checkinsValue = loadingCheckins ? "Cargando..." : checkinsCount;

  const applyMonthDays = (days: CalendarDayType[]) => {
    setDayState((prev) => {
      const next = { ...prev };
      for (const day of days) {
        next[day.day] = {
          isOpen: day.is_open ?? true,
          note: day.note ?? "",
          tablesWhatsapp: day.tables_whatsapp ?? 0,
          tablesTairet: day.tables_tairet ?? 0,
        };
      }
      return next;
    });
  };

  const updateCachedDay = (
    dayKey: string,
    patch: { is_open?: boolean; note?: string | null; tables_whatsapp?: number; tables_tairet?: number }
  ) => {
    if (!context) return;
    const cacheKey = `${context.local.id}-${monthKey}`;
    const cached = monthCacheRef.current.get(cacheKey);
    if (!cached) return;
    const next = cached.map((day) =>
      day.day === dayKey
        ? {
            ...day,
            ...patch,
          }
        : day
    );
    monthCacheRef.current.set(cacheKey, next);
  };

  useEffect(() => {
    if (loading || !context) return;
    const cacheKey = `${context.local.id}-${monthKey}`;
    const cached = monthCacheRef.current.get(cacheKey);
    if (cached) {
      setMonthError(null);
      applyMonthDays(cached);
      return;
    }
    if (monthFetchKeyRef.current === cacheKey) return;
    monthFetchKeyRef.current = cacheKey;
    let cancelled = false;
    setLoadingMonth(true);
    setMonthError(null);

    const fetchMonth = async () => {
      try {
        const data = await getCalendarMonth(monthKey);
        if (cancelled) return;
        const days = data.days ?? [];
        monthCacheRef.current.set(cacheKey, days);
        applyMonthDays(days);
      } catch (err) {
        if (!cancelled) {
          setMonthError(err instanceof Error ? err.message : "Error al cargar el calendario");
        }
      } finally {
        if (!cancelled) {
          setLoadingMonth(false);
        }
      }
    };

    fetchMonth();

    return () => {
      cancelled = true;
    };
  }, [loading, context, monthKey]);

  useEffect(() => {
    if (loading || !context) return;
    if (context.local.type !== "bar") return;
    const fetchKey = context.local.id;
    if (reservationsFetchKeyRef.current === fetchKey) return;
    reservationsFetchKeyRef.current = fetchKey;
    let cancelled = false;

    const fetchReservations = async () => {
      setLoadingReservations(true);
      setReservationsError(null);
      try {
        const data = await getPanelReservationsByLocalId(context.local.id);
        if (!cancelled) {
          setReservations(data);
        }
      } catch (err) {
        if (!cancelled) {
          setReservationsError(
            err instanceof Error ? err.message : "Error al cargar reservas"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingReservations(false);
        }
      }
    };

    fetchReservations();

    return () => {
      cancelled = true;
    };
  }, [loading, context]);

  useEffect(() => {
    if (loading || !context) return;
    if (context.local.type !== "club") return;
    const fetchKey = `${context.local.id}-${selectedKey}`;
    if (checkinsFetchKeyRef.current === fetchKey) return;
    checkinsFetchKeyRef.current = fetchKey;
    let cancelled = false;
    const range = getDayRangeIso(selectedKey);

    const fetchCheckins = async () => {
      setLoadingCheckins(true);
      setCheckinsError(null);
      setCheckinsCount(0);
      try {
        const summary = await getPanelMetricsSummaryWithSeries(range);
        const value =
          summary?.kpis_range?.tickets_used ?? summary?.kpis?.tickets_used ?? 0;
        if (!cancelled) {
          setCheckinsCount(typeof value === "number" ? value : 0);
        }
      } catch {
        if (!cancelled) {
          setCheckinsError("Error al cargar check-ins");
          setCheckinsCount(0);
        }
      } finally {
        if (!cancelled) {
          setLoadingCheckins(false);
        }
      }
    };

    fetchCheckins();

    return () => {
      cancelled = true;
    };
  }, [loading, context, selectedKey]);

  const updateMonth = (offset: number) => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
    setCurrentMonth(nextMonth);

    const isSameMonth =
      selectedDate.getFullYear() === nextMonth.getFullYear() &&
      selectedDate.getMonth() === nextMonth.getMonth();
    if (isSameMonth) return;

    const today = new Date();
    const nextSelected =
      today.getFullYear() === nextMonth.getFullYear() && today.getMonth() === nextMonth.getMonth()
        ? today
        : new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    setSelectedDate(nextSelected);
  };

  const handleSelectDate = (date: Date) => setSelectedDate(date);

  const commitDayState = (next: DayState) => {
    setDraft(next);
    setDayState((prev) => ({ ...prev, [selectedKey]: next }));
  };

  const updateDraft = (patch: Partial<DayState>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const handleMarkClosed = () => {
    if (!context || saveInFlightRef.current) return;
    const saved = dayState[selectedKey] ?? defaultDayState;
    const prevDraft = draft;
    const nextSaved = { ...saved, isOpen: !draft.isOpen };
    const nextDraft = { ...draft, isOpen: nextSaved.isOpen };
    const cachePatch = {
      is_open: nextSaved.isOpen,
    };
    const prevSaved = saved;

    saveInFlightRef.current = true;
    setSaving(true);
    setSaveError(null);
    commitDayState(nextSaved);
    setDraft(nextDraft);
    updateCachedDay(selectedKey, cachePatch);

    updateCalendarDay({ day: selectedKey, is_open: nextSaved.isOpen })
      .catch((err) => {
        setSaveError(err instanceof Error ? err.message : "Error al guardar");
        setDayState((prev) => ({ ...prev, [selectedKey]: prevSaved }));
        setDraft(prevDraft);
        updateCachedDay(selectedKey, { is_open: prevSaved.isOpen });
      })
      .finally(() => {
        saveInFlightRef.current = false;
        setSaving(false);
      });
  };

  const handleSave = () => {
    if (!context || saveInFlightRef.current) return;
    const prevSaved = dayState[selectedKey] ?? defaultDayState;
    const normalizedNote = draft.note.trim().slice(0, 200);
    const payload = {
      day: selectedKey,
      is_open: draft.isOpen,
      note: normalizedNote.length > 0 ? normalizedNote : null,
      tables_whatsapp: localType === "club" ? Math.max(0, draft.tablesWhatsapp) : undefined,
      tables_tairet: localType === "club" ? Math.max(0, draft.tablesTairet) : undefined,
      club_manual_tables:
        localType === "club"
          ? Math.max(0, draft.tablesWhatsapp) + Math.max(0, draft.tablesTairet)
          : undefined,
    };

    saveInFlightRef.current = true;
    setSaving(true);
    setSaveError(null);
    commitDayState({
      ...draft,
      note: normalizedNote,
      tablesWhatsapp: Math.max(0, draft.tablesWhatsapp),
      tablesTairet: Math.max(0, draft.tablesTairet),
    });
    updateCachedDay(selectedKey, {
      is_open: payload.is_open,
      note: payload.note,
      tables_whatsapp: payload.tables_whatsapp,
      tables_tairet: payload.tables_tairet,
    });

    updateCalendarDay(payload)
      .then((response) => {
        const nextSaved: DayState = {
          isOpen: response.is_open,
          note: response.note ?? "",
          tablesWhatsapp: response.tables_whatsapp ?? draft.tablesWhatsapp,
          tablesTairet: response.tables_tairet ?? draft.tablesTairet,
        };
        commitDayState(nextSaved);
        updateCachedDay(selectedKey, {
          is_open: response.is_open,
          note: response.note ?? null,
          tables_whatsapp: response.tables_whatsapp ?? nextSaved.tablesWhatsapp,
          tables_tairet: response.tables_tairet ?? nextSaved.tablesTairet,
        });
      })
      .catch((err) => {
        setSaveError(err instanceof Error ? err.message : "Error al guardar");
        setDayState((prev) => ({ ...prev, [selectedKey]: prevSaved }));
        updateCachedDay(selectedKey, {
          is_open: prevSaved.isOpen,
          note: prevSaved.note || null,
          tables_whatsapp: prevSaved.tablesWhatsapp,
          tables_tairet: prevSaved.tablesTairet,
        });
      })
      .finally(() => {
        saveInFlightRef.current = false;
        setSaving(false);
      });
  };

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

  if (error || !context) {
    return (
      <div className={panelUi.emptyWrap}>
        <p className="text-sm text-neutral-600">
          {error || "No se pudo cargar la información del panel."}
        </p>
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
                onClick={() => updateMonth(-1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => updateMonth(1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingMonth ? (
              <p className="mb-3 text-xs text-neutral-500">Cargando calendario...</p>
            ) : monthError ? (
              <p className="mb-3 text-xs text-rose-600">{monthError}</p>
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
                    onClick={() => handleSelectDate(date)}
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
                onClick={handleMarkClosed}
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
                  onToggle={() => updateDraft({ isOpen: !draft.isOpen })}
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
                onChange={(event) => updateDraft({ note: event.target.value.slice(0, 200) })}
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
                onUpdateDraft={setDraft}
                checkinsValue={checkinsValue}
                checkinsError={checkinsError}
              />
            ) : (
              <BarDetailSection
                reservations={filteredReservations}
                loading={loadingReservations}
                error={reservationsError}
              />
            )}

            <button
              type="button"
              onClick={handleSave}
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
