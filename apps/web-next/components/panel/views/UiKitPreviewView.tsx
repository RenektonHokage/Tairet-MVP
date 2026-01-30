import * as React from "react";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  PageHeader,
  StatCard,
  Toolbar,
  cn,
  panelUi,
} from "../ui";

const mockRows = [
  {
    id: "evt-01",
    name: "Noche Retro 90s",
    date: "Vie 14 Feb",
    status: "active",
    sales: "₲ 12.4M",
  },
  {
    id: "evt-02",
    name: "DJ Invitado: Loli",
    date: "Sáb 22 Feb",
    status: "draft",
    sales: "₲ 0",
  },
  {
    id: "evt-03",
    name: "Summer Closing",
    date: "Sáb 01 Mar",
    status: "scheduled",
    sales: "₲ 4.8M",
  },
  {
    id: "evt-04",
    name: "Fiesta Universitaria",
    date: "Vie 07 Mar",
    status: "scheduled",
    sales: "₲ 2.1M",
  },
  {
    id: "evt-05",
    name: "Noche de Bandas",
    date: "Sáb 15 Mar",
    status: "paused",
    sales: "₲ 860K",
  },
  {
    id: "evt-06",
    name: "Electro Sunset",
    date: "Sáb 22 Mar",
    status: "active",
    sales: "₲ 6.7M",
  },
  {
    id: "evt-07",
    name: "Open Mic",
    date: "Jue 27 Mar",
    status: "draft",
    sales: "₲ 0",
  },
];

const columns = [
  { key: "name", header: "Evento" },
  { key: "date", header: "Fecha" },
  {
    key: "status",
    header: "Estado",
    render: (row: (typeof mockRows)[number]) => {
      const map = {
        active: { label: "Activo", variant: "success" as const },
        draft: { label: "Borrador", variant: "neutral" as const },
        scheduled: { label: "Programado", variant: "warn" as const },
        paused: { label: "Pausado", variant: "danger" as const },
      };
      const status = map[row.status as keyof typeof map];
      return <Badge variant={status.variant}>{status.label}</Badge>;
    },
  },
  { key: "sales", header: "Ventas" },
];

export function UiKitPreviewView() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Showroom UI Kit"
        subtitle="Componentes base para el Panel B2B de Tairet."
        breadcrumbs={[
          { label: "Panel", href: "/panel" },
          { label: "Marketing", href: "/panel/marketing" },
          { label: "Lineup" },
        ]}
        actions={
          <>
            <button
              className={cn(
                "inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm",
                panelUi.focusRing
              )}
              type="button"
            >
              Exportar
            </button>
            <button
              className={cn(
                "inline-flex items-center justify-center rounded-full bg-[#8d1313] px-4 py-2 text-sm font-medium text-white shadow-sm",
                panelUi.focusRing
              )}
              type="button"
            >
              Crear evento
            </button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Eventos activos" value="12" hint="Últimos 30 días" />
        <StatCard
          label="Ingresos estimados"
          value="₲ 28.4M"
          hint="Promedio semanal"
          trend={{ value: "+12%", direction: "up" }}
        />
        <StatCard
          label="Tickets pendientes"
          value="46"
          hint="Por confirmar"
          trend={{ value: "−4%", direction: "down" }}
        />
      </div>

      <Toolbar
        left={
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-600" htmlFor="search-events">
                Buscar
              </label>
              <input
                id="search-events"
                className={cn(
                  "w-full min-w-[220px] rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-900",
                  panelUi.focusRing
                )}
                placeholder="Nombre de evento"
                type="text"
              />
            </div>
            <button
              className={cn(
                "inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm",
                panelUi.focusRing
              )}
              type="button"
            >
              Filtrar
            </button>
          </>
        }
        right={
          <>
            <Badge variant="neutral">Marzo 2026</Badge>
            <button
              className={cn(
                "inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm",
                panelUi.focusRing
              )}
              type="button"
            >
              Vista semanal
            </button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Eventos del mes</CardTitle>
          <CardDescription>
            Resumen visual del lineup con estados y ventas previstas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable
            columns={columns}
            rows={mockRows}
            rowKey={(row) => row.id}
            rowActions={() => (
              <button
                className={cn(
                  "inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-800 shadow-sm",
                  panelUi.focusRing
                )}
                type="button"
              >
                Ver
              </button>
            )}
          />
        </CardContent>
        <CardFooter>
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>Actualizado hace 2 horas.</span>
            <span className="text-neutral-300">•</span>
            <span>Todos los montos son estimados.</span>
          </div>
        </CardFooter>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Card</CardTitle>
            <CardDescription>Ideal para resumir acciones de marketing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-neutral-200/70 bg-neutral-50 px-4 py-3 text-sm">
              <span className="text-neutral-700">Promo destacada</span>
              <Badge variant="success">Activa</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-neutral-200/70 bg-neutral-50 px-4 py-3 text-sm">
              <span className="text-neutral-700">WhatsApp clicks</span>
              <span className="font-semibold text-neutral-900">421</span>
            </div>
          </CardContent>
        </Card>

        <EmptyState
          title="Aún no hay reservas"
          description="Creá tu primer evento y empezá a recibir solicitudes."
          action={
            <button
              className={cn(
                "inline-flex items-center justify-center rounded-full bg-[#8d1313] px-4 py-2 text-sm font-medium text-white shadow-sm",
                panelUi.focusRing
              )}
              type="button"
            >
              Crear evento
            </button>
          }
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#8d1313]">
              +
            </div>
          }
        />
      </div>
    </div>
  );
}
