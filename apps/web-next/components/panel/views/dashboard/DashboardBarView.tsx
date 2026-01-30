"use client";

import * as React from "react";
import { Calendar, CheckCircle2, Clock, Users } from "lucide-react";

import {
  LineChartSimple,
  BarChartGrouped,
  type LineChartDataPoint,
} from "../../ui/charts";
import {
  PrimaryActionBanner,
  KpiGrid,
  ChartCard,
  LegendItem,
  SummaryCard,
  EngagementCard,
  RangeToggle,
  type KpiItem,
  type RangeValue,
} from "./index";

export interface DashboardBarViewProps {
  /** Handler para el CTA principal (scroll a reservas) */
  onPrimaryAction: () => void;
  /** Métricas KPI */
  kpis: {
    reservationsTotal: number;
    reservationsConfirmed: number;
    reservationsEnRevision: number;
  };
  /** Estado de carga de métricas */
  loading?: boolean;
  /** Data para chart de tendencia (opcional) */
  trendData?: Array<{
    label: string;
    confirmadas: number;
    canceladas: number;
    pendientes: number;
  }>;
  /** Data para chart de visitas (opcional) */
  visitsData?: LineChartDataPoint[];
  /** Total de visitas para mostrar */
  totalVisits?: number;
  /** Métricas de resumen */
  summary?: {
    conversionRate: string;
    weeklyAverage: string;
    avgPersons: string;
  };
  /** Indica si avgPersons viene de datos reales (true) o es fallback (false/undefined) */
  hasAvgPartySizeData?: boolean;
  /** WhatsApp clicks */
  whatsappClicks?: number;
  /** Top promo */
  topPromo?: { title: string; viewCount?: number } | null;
  /** Rango seleccionado */
  range?: RangeValue;
  /** Handler para cambiar rango */
  onRangeChange?: (value: RangeValue) => void;
}

// Componente para mostrar total de visitas sobre el chart
function VisitsChartWithTotal({
  data,
  total,
}: {
  data: LineChartDataPoint[];
  total: number;
}) {
  return (
    <div className="space-y-2">
      <div className="text-3xl font-bold text-neutral-950">
        {total}{" "}
        <span className="text-base font-normal text-neutral-500">visitas</span>
      </div>
      <LineChartSimple data={data} color="#8b5cf6" height={120} />
    </div>
  );
}

export function DashboardBarView({
  onPrimaryAction,
  kpis,
  loading = false,
  trendData = [],
  visitsData = [],
  totalVisits = 0,
  summary,
  hasAvgPartySizeData,
  whatsappClicks = 0,
  topPromo,
  range = "30d",
  onRangeChange,
}: DashboardBarViewProps) {
  const handleRangeChange = (value: RangeValue) => {
    onRangeChange?.(value);
  };

  const pendingCount = kpis.reservationsEnRevision;
  const rangeLabel = range === "7d" ? "Últimos 7 días" : "Últimos 30 días";

  // Verificar si hay datos significativos en las series temporales
  const hasVisitsData = visitsData.some((d) => d.value > 0);

  const barKpis: KpiItem[] = [
    {
      label: "Reservas Totales",
      value: kpis.reservationsTotal,
      icon: (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
          <Calendar className="h-5 w-5" />
        </span>
      ),
    },
    {
      label: "Confirmadas",
      value: kpis.reservationsConfirmed,
      hint:
        kpis.reservationsTotal > 0
          ? `${((kpis.reservationsConfirmed / kpis.reservationsTotal) * 100).toFixed(0)}% tasa de confirmación`
          : undefined,
      icon: (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-5 w-5" />
        </span>
      ),
    },
    {
      label: "Pendientes",
      value: kpis.reservationsEnRevision,
      hint: "Esperando aprobación",
      icon: (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <Clock className="h-5 w-5" />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toggle global de rango */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-900">Dashboard</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500">Período:</span>
          <RangeToggle value={range} onChange={handleRangeChange} />
        </div>
      </div>

      {/* Primary Action Banner */}
      <PrimaryActionBanner
        title="Gestión de Reservas"
        subtitle={
          pendingCount > 0
            ? `Tienes ${pendingCount} reserva(s) pendiente(s) de confirmación`
            : "Todas las reservas están gestionadas"
        }
        ctaLabel="Ver Reservas"
        onCta={onPrimaryAction}
        tone="bar"
        icon={<Users className="h-4 w-4" />}
      />

      {/* KPIs */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[120px] animate-pulse rounded-2xl bg-neutral-200/70"
            />
          ))}
        </div>
      ) : (
        <KpiGrid items={barKpis} columns={3} />
      )}

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Tendencia de Reservas"
          subtitle={`Por estado · ${rangeLabel}`}
          legend={
            <>
              <LegendItem color="#10b981" label="Confirmadas" />
              <LegendItem color="#ef4444" label="Canceladas" />
              <LegendItem color="#facc15" label="Pendientes" />
            </>
          }
        >
          <BarChartGrouped
            data={trendData}
            series={[
              { dataKey: "confirmadas", name: "Confirmadas", color: "#10b981" },
              { dataKey: "canceladas", name: "Canceladas", color: "#ef4444" },
              { dataKey: "pendientes", name: "Pendientes", color: "#facc15" },
            ]}
            height={180}
            loading={loading}
          />
        </ChartCard>

        <ChartCard title="Visitas al Perfil" subtitle={rangeLabel}>
          {hasVisitsData ? (
            <VisitsChartWithTotal data={visitsData} total={totalVisits} />
          ) : (
            <div className="flex h-[180px] flex-col items-center justify-center text-center">
              <div className="text-3xl font-bold text-neutral-950">
                {totalVisits}{" "}
                <span className="text-base font-normal text-neutral-500">visitas</span>
              </div>
              <div className="mt-2 text-sm text-neutral-400">
                Aún no hay histórico diario
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Summary + Engagement Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard
          range={range}
          showToggle={false}
          metrics={
            summary
              ? [
                  {
                    label: "Visitas → Reservas",
                    value: summary.conversionRate,
                    color: "success",
                    tooltip: "Conversión = reservas creadas / visitas al perfil en el período.",
                  },
                  { label: "Promedio semanal", value: summary.weeklyAverage },
                  {
                    label: "Promedio de personas",
                    value: hasAvgPartySizeData ? summary.avgPersons : "Aún no hay datos",
                    hint: hasAvgPartySizeData ? "Solo confirmadas" : undefined,
                    tooltip: "Promedio de invitados por reserva confirmada en el período.",
                  },
                ]
              : [
                  {
                    label: "Visitas → Reservas",
                    value: "0%",
                    color: "default",
                    tooltip: "Conversión = reservas creadas / visitas al perfil en el período.",
                  },
                  { label: "Promedio semanal", value: "0 reservas" },
                  {
                    label: "Promedio de personas",
                    value: "Aún no hay datos",
                    tooltip: "Promedio de invitados por reserva confirmada en el período.",
                  },
                ]
          }
        />
        <EngagementCard
          range={range}
          showToggle={false}
          whatsappClicks={whatsappClicks}
          topPromo={topPromo ?? null}
        />
      </div>
    </div>
  );
}
