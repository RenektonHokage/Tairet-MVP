"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { usePanelContext } from "@/lib/panelContext";
import {
  getCalendarMonth,
  getCalendarDay,
  updateCalendarDay,
  type CalendarDay as CalendarDayType,
  type CalendarDayResponse,
} from "@/lib/calendar";
import {
  CalendarView,
  defaultDayState,
  type DayState,
} from "@/components/panel/views/calendar/CalendarView";

type LocalType = "bar" | "club";

type MonthStatus = {
  loading: boolean;
  error: string | null;
};

type DetailStatus = {
  loading: boolean;
  error: string | null;
};

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

export default function CalendarPage() {
  const { data: panelData, loading: panelLoading } = usePanelContext();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [dayState, setDayState] = useState<Record<string, DayState>>({});
  const [draft, setDraft] = useState<DayState>(defaultDayState);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<CalendarDayResponse | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const monthCacheRef = useRef<Map<string, CalendarDayType[]>>(new Map());
  const monthFetchKeyRef = useRef<string | null>(null);
  const dayFetchKeyRef = useRef<string | null>(null);
  const saveInFlightRef = useRef(false);

  const selectedKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);
  const monthKey = useMemo(
    () => `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`,
    [currentMonth]
  );
  const selectedState = useMemo(
    () => dayState[selectedKey] ?? defaultDayState,
    [dayState, selectedKey]
  );

  const localType: LocalType = panelData?.local.type === "bar" ? "bar" : "club";
  const localId = panelData?.local.id ?? null;

  useEffect(() => {
    setDraft({ ...selectedState });
  }, [selectedState]);

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
    if (!localId) return;
    const cacheKey = `${localId}-${monthKey}`;
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
    if (panelLoading || !localId) return;
    const cacheKey = `${localId}-${monthKey}`;
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
  }, [panelLoading, localId, monthKey]);

  useEffect(() => {
    if (panelLoading || !localId) return;
    const fetchKey = `${localId}-${selectedKey}`;
    if (dayFetchKeyRef.current === fetchKey) return;
    dayFetchKeyRef.current = fetchKey;
    let cancelled = false;
    setLoadingDay(true);
    setDayError(null);
    setDayDetail(null);

    const fetchDay = async () => {
      try {
        const data = await getCalendarDay(selectedKey);
        if (!cancelled) {
          setDayDetail(data);
        }
      } catch (err) {
        if (!cancelled) {
          setDayError(err instanceof Error ? err.message : "Error al cargar el detalle del día");
        }
      } finally {
        if (!cancelled) {
          setLoadingDay(false);
        }
      }
    };

    fetchDay();

    return () => {
      cancelled = true;
    };
  }, [panelLoading, localId, selectedKey]);

  const setSelectedDateAndReset = (date: Date) => {
    setSelectedDate(date);
    setLoadingDay(true);
    setDayError(null);
    setDayDetail(null);
  };

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
    setSelectedDateAndReset(nextSelected);
  };

  const commitDayState = (next: DayState) => {
    setDraft(next);
    setDayState((prev) => ({ ...prev, [selectedKey]: next }));
  };

  const updateDraft = (patch: Partial<DayState>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const handleMarkClosed = () => {
    if (!localId || saveInFlightRef.current) return;
    const saved = dayState[selectedKey] ?? defaultDayState;
    const prevDraft = draft;
    const nextSaved = { ...saved, isOpen: !draft.isOpen };
    const nextDraft = { ...draft, isOpen: nextSaved.isOpen };
    const prevSaved = saved;

    saveInFlightRef.current = true;
    setSaving(true);
    setSaveError(null);
    commitDayState(nextSaved);
    setDraft(nextDraft);
    updateCachedDay(selectedKey, { is_open: nextSaved.isOpen });

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
    if (!localId || saveInFlightRef.current) return;
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

  const reservations = dayDetail?.reservations ?? [];
  const checkinsValue = loadingDay ? "Cargando..." : dayDetail?.checkins_count ?? 0;
  const monthStatus: MonthStatus = { loading: loadingMonth, error: monthError };
  const detailStatus: DetailStatus = { loading: loadingDay, error: dayError };
  const error = panelData ? null : "No se pudo cargar la información del panel.";

  return (
    <CalendarView
      loading={panelLoading}
      error={error}
      localType={localType}
      currentMonth={currentMonth}
      selectedDate={selectedDate}
      dayState={dayState}
      draft={draft}
      monthStatus={monthStatus}
      detailStatus={detailStatus}
      reservations={reservations}
      checkinsValue={checkinsValue}
      checkinsError={localType === "club" ? dayError : null}
      onSelectDate={setSelectedDateAndReset}
      onPrevMonth={() => updateMonth(-1)}
      onNextMonth={() => updateMonth(1)}
      onUpdateDraft={updateDraft}
      onMarkClosed={handleMarkClosed}
      onSave={handleSave}
      saving={saving}
      saveError={saveError}
    />
  );
}
