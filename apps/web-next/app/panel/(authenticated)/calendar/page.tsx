"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPanelUserInfo } from "@/lib/panel";
import {
  getCalendarMonth,
  getCalendarDay,
  updateCalendarDay,
  type CalendarDay as CalendarDayType,
  type CalendarDayResponse,
} from "@/lib/calendar";

export default function CalendarPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [localId, setLocalId] = useState<string | null>(null);

  // Estado del calendario
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [days, setDays] = useState<CalendarDayType[]>([]);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [errorMonth, setErrorMonth] = useState<string | null>(null);

  // Estado del día seleccionado
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<CalendarDayResponse | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);
  const [errorDay, setErrorDay] = useState<string | null>(null);

  // Estado de edición
  const [isOpen, setIsOpen] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Verificar sesión
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.push("/panel/login");
          return;
        }

        setIsAuthenticated(true);

        try {
          const userInfo = await getPanelUserInfo();
          setLocalId(userInfo.local.id);
        } catch (err) {
          console.error("Error loading panel user info:", err);
          router.push("/panel/login");
        }
      } catch (err) {
        console.error("Error checking session:", err);
        router.push("/panel/login");
      }
    };

    checkSession();
  }, [router]);

  // Cargar mes cuando cambia
  useEffect(() => {
    if (!localId) return;
    loadMonth();
  }, [localId, currentMonth]);

  // Cargar detalle del día cuando se selecciona
  useEffect(() => {
    if (!selectedDay || !localId) return;
    loadDayDetail();
  }, [selectedDay, localId]);

  // Actualizar estado de edición cuando cambia el detalle
  useEffect(() => {
    if (dayDetail) {
      setIsOpen(dayDetail.operation.is_open);
      setNote(dayDetail.operation.note ?? "");
    }
  }, [dayDetail]);

  const loadMonth = async () => {
    if (!localId) return;
    setLoadingMonth(true);
    setErrorMonth(null);
    try {
      const data = await getCalendarMonth(currentMonth);
      setDays(data.days);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al cargar el calendario";
      setErrorMonth(errorMessage);
      console.error("Error loading calendar month:", err);
    } finally {
      setLoadingMonth(false);
    }
  };

  const loadDayDetail = async () => {
    if (!selectedDay) return;
    setLoadingDay(true);
    setErrorDay(null);
    try {
      const data = await getCalendarDay(selectedDay);
      setDayDetail(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al cargar el detalle del día";
      setErrorDay(errorMessage);
      console.error("Error loading day detail:", err);
    } finally {
      setLoadingDay(false);
    }
  };

  const handleSave = async () => {
    if (!selectedDay) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await updateCalendarDay({
        day: selectedDay,
        is_open: isOpen,
        note: note.trim() || null,
      });

      setSaveSuccess(true);
      // Recargar mes y detalle
      await Promise.all([loadMonth(), loadDayDetail()]);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al guardar";
      setSaveError(errorMessage);
      console.error("Error saving day:", err);
    } finally {
      setSaving(false);
    }
  };

  const handlePrevMonth = () => {
    const [year, month] = currentMonth.split("-").map(Number);
    const date = new Date(year, month - 2, 1);
    setCurrentMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    setSelectedDay(null);
    setDayDetail(null);
  };

  const handleNextMonth = () => {
    const [year, month] = currentMonth.split("-").map(Number);
    const date = new Date(year, month, 1);
    setCurrentMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    setSelectedDay(null);
    setDayDetail(null);
  };

  const handleDayClick = (day: string) => {
    setSelectedDay(day);
  };

  // Generar grid del calendario
  const generateCalendarGrid = () => {
    const [year, month] = currentMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = domingo, 1 = lunes, etc.

    // Ajustar para que la semana empiece en lunes (1)
    const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const grid: (number | null)[] = [];
    // Días vacíos al inicio
    for (let i = 0; i < adjustedStartDay; i++) {
      grid.push(null);
    }
    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      grid.push(day);
    }

    return grid;
  };

  const getDayData = (day: number): CalendarDayType | null => {
    const dayStr = `${currentMonth}-${String(day).padStart(2, "0")}`;
    return days.find((d) => d.day === dayStr) ?? null;
  };

  const hasActivity = (day: number): boolean => {
    const data = getDayData(day);
    if (!data) return false;
    return (
      data.reservations_total > 0 ||
      data.orders_paid > 0 ||
      data.promo_opens > 0
    );
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const [year, month] = currentMonth.split("-").map(Number);
  const monthName = monthNames[month - 1];
  const grid = generateCalendarGrid();
  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Calendario / Operación</h1>
          <p className="text-gray-600 mt-1">Vista mensual con actividad y estado diario</p>
        </div>
      </div>

      {/* Controles de mes */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevMonth}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            ← Anterior
          </button>
          <h2 className="text-xl font-semibold text-gray-900">
            {monthName} {year}
          </h2>
          <button
            onClick={handleNextMonth}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Siguiente →
          </button>
        </div>
      </div>

      {/* Error del mes */}
      {errorMonth && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          {errorMonth}
        </div>
      )}

      {/* Grid del calendario */}
      {loadingMonth ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
          Cargando calendario...
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="grid grid-cols-7 border-b">
            {weekDays.map((day) => (
              <div
                key={day}
                className="p-3 text-center text-sm font-medium text-gray-700 bg-gray-50"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((day, idx) => {
              if (day === null) {
                return <div key={idx} className="p-3 border-r border-b border-gray-200" />;
              }

              const data = getDayData(day);
              const dayStr = `${currentMonth}-${String(day).padStart(2, "0")}`;
              const isSelected = selectedDay === dayStr;
              const hasAct = hasActivity(day);

              return (
                <button
                  key={idx}
                  onClick={() => handleDayClick(dayStr)}
                  className={`p-3 border-r border-b border-gray-200 text-left hover:bg-gray-50 ${
                    isSelected ? "bg-blue-50 ring-2 ring-blue-500" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{day}</span>
                    {data && (
                      <>
                        {data.is_open ? (
                          <span className="text-green-600 text-xs">✅</span>
                        ) : (
                          <span className="text-red-600 text-xs">🚫</span>
                        )}
                        {data.note && (
                          <span className="text-yellow-600 text-xs" title={data.note}>
                            📝
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {hasAct && (
                    <div className="text-xs text-gray-600 space-y-0.5">
                      {data && data.reservations_total > 0 && (
                        <div>R: {data.reservations_total}</div>
                      )}
                      {data && data.orders_paid > 0 && (
                        <div>V: {data.orders_paid}</div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Panel de detalle del día */}
      {selectedDay && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Detalle del día: {selectedDay}
          </h3>

          {loadingDay ? (
            <div className="text-gray-600">Cargando detalle...</div>
          ) : errorDay ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
              {errorDay}
            </div>
          ) : dayDetail ? (
            <div className="space-y-6">
              {/* Operación del día */}
              <div className="border-b pb-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Operación</h4>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={isOpen}
                        onChange={(e) => setIsOpen(e.target.checked)}
                        disabled={saving}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-gray-700">
                        {isOpen ? "✅ Abierto" : "🚫 Cerrado"}
                      </span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nota del día (máx. 200 caracteres)
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      disabled={saving}
                      maxLength={200}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ej: Halloween, Privado, Evento especial..."
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {note.length}/200 caracteres
                    </div>
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                  {saveSuccess && (
                    <div className="text-green-600 text-sm">✓ Guardado exitosamente</div>
                  )}
                  {saveError && (
                    <div className="text-red-600 text-sm">{saveError}</div>
                  )}
                </div>
              </div>

              {/* Reservas del día */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  Reservas ({dayDetail.reservations.length})
                </h4>
                {dayDetail.reservations.length === 0 ? (
                  <p className="text-gray-600">No hay reservas para este día</p>
                ) : (
                  <div className="space-y-2">
                    {dayDetail.reservations.map((reservation) => (
                      <div
                        key={reservation.id}
                        className="p-3 bg-gray-50 rounded-md border border-gray-200"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">
                              {reservation.name}
                              {reservation.last_name && ` ${reservation.last_name}`}
                            </div>
                            <div className="text-sm text-gray-600">
                              {reservation.guests} personas •{" "}
                              {new Date(reservation.date).toLocaleTimeString("es-PY", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                            {reservation.table_note && (
                              <div className="text-xs text-gray-500 mt-1">
                                📝 {reservation.table_note}
                              </div>
                            )}
                          </div>
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              reservation.status === "confirmed"
                                ? "bg-green-100 text-green-800"
                                : reservation.status === "cancelled"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {reservation.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumen de órdenes */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Ventas</h4>
                {dayDetail.orders_summary.count === 0 ? (
                  <p className="text-gray-600">No hay ventas para este día</p>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
                    <div className="text-sm text-gray-600">
                      <div>Órdenes pagadas: {dayDetail.orders_summary.count}</div>
                      <div className="font-medium text-gray-900 mt-1">
                        Total: PYG {dayDetail.orders_summary.total.toLocaleString("es-PY")}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
