"use client";

import * as React from "react";
import { Clock, DollarSign, QrCode, Ticket } from "lucide-react";

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

export interface DashboardClubViewProps {
  /** Handler para el CTA principal (check-in) */
  onPrimaryAction: () => void;
  /** Métricas KPI */
  kpis: {
    ticketsSold: number;
    ticketsUsed: number;
    revenuePaid: number;
  };
  /** Estado de carga de métricas */
  loading?: boolean;
  /** Data para chart de tendencia (opcional) */
  trendData?: Array<{ label: string; vendidas: number; usadas: number }>;
  /** Data para chart de visitas (opcional) */
  visitsData?: LineChartDataPoint[];
  /** Total de visitas para mostrar */
  totalVisits?: number;
  /** Métricas de resumen */
  summary?: {
    conversionRate: string;
    weeklyAverage: string;
    revenue: string;
  };
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

export function DashboardClubView({
  onPrimaryAction,
  kpis,
  loading = false,
  trendData = [],
  visitsData = [],
  totalVisits = 0,
  summary,
  whatsappClicks = 0,
  topPromo,
  range = "30d",
  onRangeChange,
}: DashboardClubViewProps) {
  const handleRangeChange = (value: RangeValue) => {
    onRangeChange?.(value);
  };

  const clubKpis: KpiItem[] = [
    {
      label: "Entradas Vendidas",
      value: kpis.ticketsSold,
      hint: kpis.ticketsSold > 0 ? undefined : undefined,
      icon: (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
          <Ticket className="h-5 w-5" />
        </span>
      ),
    },
    {
      label: "Entradas Usadas",
      value: kpis.ticketsUsed,
      hint:
        kpis.ticketsSold > 0
          ? `${((kpis.ticketsUsed / kpis.ticketsSold) * 100).toFixed(1)}% de tasa de uso`
          : undefined,
      icon: (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
          <Clock className="h-5 w-5" />
        </span>
      ),
    },
    {
      label: "Ingresos Pagados",
      value: `PYG ${kpis.revenuePaid.toLocaleString()}`,
      hint: kpis.revenuePaid === 0 ? "Pagos pendientes" : undefined,
      icon: (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
          <DollarSign className="h-5 w-5" />
        </span>
      ),
    },
  ];

  const rangeLabel = range === "7d" ? "Últimos 7 días" : "Últimos 30 días";

  // Verificar si hay datos significativos en las series temporales
  const hasTrendData = trendData.some((d) => d.vendidas > 0 || d.usadas > 0);
  const hasVisitsData = visitsData.some((d) => d.value > 0);

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
        title="Check-in de Entradas"
        subtitle="Escanea los códigos QR de tus clientes para validar su entrada."
        ctaLabel="Abrir Check-in"
        onCta={onPrimaryAction}
        tone="club"
        icon={<QrCode className="h-4 w-4" />}
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
        <KpiGrid items={clubKpis} columns={3} />
      )}

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Tendencia de Entradas"
          subtitle={`Vendidas vs usadas · ${rangeLabel}`}
          legend={
            hasTrendData ? (
              <>
                <LegendItem color="#3b82f6" label="Vendidas" />
                <LegendItem color="#10b981" label="Usadas" />
              </>
            ) : undefined
          }
        >
          {hasTrendData ? (
            <BarChartGrouped
              data={trendData}
              series={[
                { dataKey: "vendidas", name: "Vendidas", color: "#3b82f6" },
                { dataKey: "usadas", name: "Usadas", color: "#10b981" },
              ]}
              height={180}
              loading={loading}
            />
          ) : (
            <div className="flex h-[180px] items-center justify-center text-sm text-neutral-400">
              Aún no hay histórico de entradas
            </div>
          )}
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
                  { label: "Visitas → Ventas", value: summary.conversionRate, color: "success" },
                  { label: "Promedio semanal", value: summary.weeklyAverage },
                  { label: "Ingresos generados", value: summary.revenue, color: "default" },
                ]
              : [
                  { label: "Visitas → Ventas", value: "0%", color: "default" },
                  { label: "Promedio semanal", value: "0 ventas" },
                  { label: "Ingresos generados", value: "PYG 0", color: "default" },
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
