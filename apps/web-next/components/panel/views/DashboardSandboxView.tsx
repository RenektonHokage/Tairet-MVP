"use client";

import * as React from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  QrCode,
  Ticket,
  Users,
} from "lucide-react";

import { PageHeader } from "../ui";
import {
  LineChartSimple,
  BarChartGrouped,
  type LineChartDataPoint,
} from "../ui/charts";
import {
  PrimaryActionBanner,
  KpiGrid,
  ChartCard,
  LegendItem,
  SummaryCard,
  EngagementCard,
  type KpiItem,
  type RangeValue,
} from "./dashboard";

// =============================================================================
// Mock Data para Charts (sandbox)
// =============================================================================

const mockClubTrendData = [
  { label: "Sem 1", vendidas: 5, usadas: 1 },
  { label: "Sem 2", vendidas: 8, usadas: 3 },
  { label: "Sem 3", vendidas: 6, usadas: 0 },
  { label: "Sem 4", vendidas: 4, usadas: 1 },
];

const mockBarTrendData = [
  { label: "Sem 1", confirmadas: 3, canceladas: 1, pendientes: 2 },
  { label: "Sem 2", confirmadas: 5, canceladas: 2, pendientes: 3 },
  { label: "Sem 3", confirmadas: 6, canceladas: 1, pendientes: 4 },
  { label: "Sem 4", confirmadas: 7, canceladas: 3, pendientes: 5 },
];

const mockVisitsData: LineChartDataPoint[] = [
  { label: "Lun", value: 2 },
  { label: "Mar", value: 4 },
  { label: "Mié", value: 5 },
  { label: "Jue", value: 4 },
  { label: "Vie", value: 6 },
  { label: "Sáb", value: 7 },
  { label: "Dom", value: 4 },
];

const mockVisitsDataBar: LineChartDataPoint[] = [
  { label: "Lun", value: 80 },
  { label: "Mar", value: 95 },
  { label: "Mié", value: 110 },
  { label: "Jue", value: 105 },
  { label: "Vie", value: 130 },
  { label: "Sáb", value: 120 },
  { label: "Dom", value: 77 },
];

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

// =============================================================================
// Dashboard CLUB Section
// =============================================================================

function DashboardClubSection() {
  const [summaryRange, setSummaryRange] = React.useState<RangeValue>("30d");
  const [engagementRange, setEngagementRange] = React.useState<RangeValue>("30d");

  const clubKpis: KpiItem[] = [
    {
      label: "Entradas Vendidas",
      value: 23,
      hint: "+12% vs mes anterior",
      trend: { value: "+12%", direction: "up" },
      icon: (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
          <Ticket className="h-5 w-5" />
        </span>
      ),
    },
    {
      label: "Entradas Usadas",
      value: 4,
      hint: "17.4% de tasa de uso",
      icon: (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
          <Clock className="h-5 w-5" />
        </span>
      ),
    },
    {
      label: "Ingresos Pagados",
      value: "PYG 0",
      hint: "Pagos pendientes",
      icon: (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
          <DollarSign className="h-5 w-5" />
        </span>
      ),
    },
  ];

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-bold text-neutral-800 border-b pb-2">
        Dashboard Club (Preview)
      </h2>

      {/* Primary Action Banner */}
      <PrimaryActionBanner
        title="Check-in de Entradas"
        subtitle="Escanea los códigos QR de tus clientes para validar su entrada."
        ctaLabel="Abrir Check-in"
        onCta={() => console.log("[Sandbox] Navigate to /panel/checkin")}
        tone="club"
        icon={<QrCode className="h-4 w-4" />}
      />

      {/* KPIs */}
      <KpiGrid items={clubKpis} columns={3} />

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Tendencia de Entradas"
          subtitle="Vendidas vs usadas"
          legend={
            <>
              <LegendItem color="#3b82f6" label="Vendidas" />
              <LegendItem color="#10b981" label="Usadas" />
            </>
          }
        >
          <BarChartGrouped
            data={mockClubTrendData}
            series={[
              { dataKey: "vendidas", name: "Vendidas", color: "#3b82f6" },
              { dataKey: "usadas", name: "Usadas", color: "#10b981" },
            ]}
            height={180}
          />
        </ChartCard>

        <ChartCard title="Visitas al Perfil" subtitle="Últimos 30 días">
          <VisitsChartWithTotal data={mockVisitsData} total={23} />
        </ChartCard>
      </div>

      {/* Summary + Engagement Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard
          range={summaryRange}
          onRangeChange={setSummaryRange}
          metrics={[
            { label: "Visitas → Ventas", value: "4.3%", color: "success" },
            { label: "Promedio semanal", value: "0.77 ventas" },
            { label: "Ingresos generados", value: "PYG 0", color: "default" },
          ]}
        />
        <EngagementCard
          range={engagementRange}
          onRangeChange={setEngagementRange}
          whatsappClicks={3}
          topPromo={null}
        />
      </div>
    </section>
  );
}

// =============================================================================
// Dashboard BAR Section
// =============================================================================

function DashboardBarSection() {
  const [summaryRange, setSummaryRange] = React.useState<RangeValue>("30d");
  const [engagementRange, setEngagementRange] = React.useState<RangeValue>("30d");

  const barKpis: KpiItem[] = [
    {
      label: "Reservas Totales",
      value: 14,
      hint: "+17% vs mes anterior",
      trend: { value: "+17%", direction: "up" },
      icon: (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
          <Calendar className="h-5 w-5" />
        </span>
      ),
    },
    {
      label: "Confirmadas",
      value: 7,
      hint: "50% tasa de confirmación",
      icon: (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-5 w-5" />
        </span>
      ),
    },
    {
      label: "Pendientes",
      value: 6,
      hint: "Esperando aprobación",
      icon: (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <Clock className="h-5 w-5" />
        </span>
      ),
    },
  ];

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-bold text-neutral-800 border-b pb-2">
        Dashboard Bar (Preview)
      </h2>

      {/* Primary Action Banner */}
      <PrimaryActionBanner
        title="Gestión de Reservas"
        subtitle="Revisa y confirma las reservas pendientes de tu local."
        ctaLabel="Ver Reservas"
        onCta={() => console.log("[Sandbox] Scroll to reservations section")}
        tone="bar"
        icon={<Users className="h-4 w-4" />}
      />

      {/* KPIs */}
      <KpiGrid items={barKpis} columns={3} />

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Tendencia de Reservas"
          subtitle="Por estado"
          legend={
            <>
              <LegendItem color="#10b981" label="Confirmadas" />
              <LegendItem color="#ef4444" label="Canceladas" />
              <LegendItem color="#facc15" label="Pendientes" />
            </>
          }
        >
          <BarChartGrouped
            data={mockBarTrendData}
            series={[
              { dataKey: "confirmadas", name: "Confirmadas", color: "#10b981" },
              { dataKey: "canceladas", name: "Canceladas", color: "#ef4444" },
              { dataKey: "pendientes", name: "Pendientes", color: "#facc15" },
            ]}
            height={180}
          />
        </ChartCard>

        <ChartCard title="Visitas al Perfil" subtitle="Últimos 30 días">
          <VisitsChartWithTotal data={mockVisitsDataBar} total={717} />
        </ChartCard>
      </div>

      {/* Summary + Engagement Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard
          range={summaryRange}
          onRangeChange={setSummaryRange}
          metrics={[
            { label: "Visitas → Reservas", value: "1.95%", color: "success" },
            { label: "Promedio semanal", value: "0.77 reservas" },
            { label: "Promedio de personas", value: "3.5" },
          ]}
        />
        <EngagementCard
          range={engagementRange}
          onRangeChange={setEngagementRange}
          whatsappClicks={2}
          topPromo={{ title: "Analizando...", viewCount: undefined }}
        />
      </div>
    </section>
  );
}

// =============================================================================
// Main Sandbox View
// =============================================================================

export function DashboardSandboxView() {
  return (
    <div className="space-y-12">
      <PageHeader
        title="Dashboard Sandbox"
        subtitle="Preview de los componentes del dashboard para Club y Bar."
        breadcrumbs={[
          { label: "Panel", href: "/panel" },
          { label: "Sandbox" },
        ]}
      />

      <DashboardClubSection />
      <DashboardBarSection />
    </div>
  );
}
