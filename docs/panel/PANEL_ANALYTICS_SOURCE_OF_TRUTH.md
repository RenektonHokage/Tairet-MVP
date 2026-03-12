# PANEL ANALYTICS SOURCE OF TRUTH

## Estado

Documento tecnico de referencia para las superficies analiticas del panel B2B bajo el scope actual de video grabado.

Este archivo no redefine producto ni arquitectura. Su funcion es:

- mapear donde vive hoy cada bloque analitico;
- dejar claro que helper, vista y chart lo alimenta;
- identificar el seam minimo para los proximos bloques;
- separar que cambios futuros son visuales, de datos o de shape minima.

Documentos relacionados:

- `docs/panel/PANEL_DEMO_DISCOVERY.md`
- `docs/panel/PANEL_DEMO_BLOQUE_1_CIERRE.md`
- `docs/panel/PANEL_DEMO_VIDEO_SCOPE.md`
- `docs/panel/PANEL_DEMO_UI_POLISH_RESERVAS_ORDERS_CIERRE.md`
- `docs/panel/PANEL_DEMO_BLOQUE_3_ORDERS_DISCOTECA_CIERRE.md`

## Contexto

El panel demo ya tiene cubiertas las pantallas del video en estas superficies:

- Dashboard `bar`
- Dashboard `discoteca`
- Reservas `bar`
- Entradas `discoteca`
- Metricas `bar`
- Metricas `discoteca`

El siguiente trabajo ya no es de infraestructura demo, sino de implementacion puntual sobre analytics y semantica de lectura.

## Alcance de este discovery

Este discovery cubre:

- Dashboard `bar`
- Dashboard `discoteca`
- Metricas `bar`
- Metricas `discoteca`
- Visitas al perfil como bloque transversal
- Entradas / preventa por fecha
- Reservas / operacion por fecha

Este discovery no cubre:

- `marketing/lineup` como objetivo funcional;
- limpieza arquitectonica amplia;
- backend, DB o layout como frente de trabajo principal;
- roadmap de producto.

## Enfoque funcional ya cerrado

Estas decisiones ya estan cerradas y este documento no las reabre:

- Dashboard responde que esta pasando.
- Metricas responde por que esta pasando.
- Entradas queda como modulo operativo por fecha concreta.
- Visitas al perfil se mantiene como KPI + sparkline, no como grafico protagonista.
- Dashboard `bar` se queda con barras de reservas.
- Metricas `bar` debe reemplazar el grafico repetido por una visual de distribucion por dia/franja.
- Dashboard `discoteca` se queda con vendidas vs usadas.
- Metricas `discoteca` mantiene entradas por tipo + tabla + tendencia + ingresos, con lineas mas firmes y menos cosmeticas.
- Preventa vive en Entradas, no como tercer grafico grande del dashboard.
- Si el grafico muestra rolling real de 7 dias, no se debe forzar Lun->Dom artificialmente.

## Mapa tecnico global

| Superficie | Ruta real | Entry point | Vista principal | Fuente live | Fuente demo |
| --- | --- | --- | --- | --- | --- |
| Dashboard bar | `/panel` | `apps/web-next/app/panel/(authenticated)/page.tsx` | `DashboardBarView` | `getPanelMetricsSummaryWithSeries` | `getPanelDemoMetricsSummaryWithSeries("bar", ...)` |
| Dashboard discoteca | `/panel` | `apps/web-next/app/panel/(authenticated)/page.tsx` | `DashboardClubView` | `getPanelMetricsSummaryWithSeries` | `getPanelDemoMetricsSummaryWithSeries("discoteca", ...)` |
| Metricas bar | `/panel/metrics` | `apps/web-next/app/panel/(authenticated)/metrics/page.tsx` | `LineupBarView` | `getPanelMetricsSummaryWithSeries` + `getPanelActivity` | `getPanelDemoMetricsSummaryWithSeries("bar", ...)` + `getPanelDemoBarActivity` |
| Metricas discoteca | `/panel/metrics` | `apps/web-next/app/panel/(authenticated)/metrics/page.tsx` | `LineupClubView` | `getPanelMetricsSummaryWithSeries` + `getPanelActivity` + `getClubBreakdown` | `getPanelDemoMetricsSummaryWithSeries("discoteca", ...)` + `getPanelDemoClubActivity` + `getPanelDemoClubBreakdown` |
| Entradas / preventa | `/panel/orders` | `apps/web-next/app/panel/(authenticated)/orders/page.tsx` -> `OrdersPageClient.tsx` | `OrdersPageClient` | `fetch /panel/orders/summary` + `fetch /panel/orders/search` + `downloadPanelReservationsClientsCsv` | `getPanelDemoDiscotecaOrdersSummary` + `searchPanelDemoDiscotecaOrders` |
| Reservas / operacion | `/panel/reservations` | `apps/web-next/app/panel/(authenticated)/reservations/page.tsx` | `ReservationsView` | `getPanelReservationsByLocalIdAndDate` + `updatePanelReservationStatus` + `downloadPanelReservationsClientsCsv` | `getPanelDemoBarReservationsByDate` + `updatePanelDemoBarReservation` |

## Reutilizacion y acoplamientos relevantes

- `apps/web-next/app/panel/(authenticated)/metrics/page.tsx` no tiene data propia. Solo branch por `local.type` y monta `LineupBarView` o `LineupClubView`.
- `apps/web-next/app/panel/(authenticated)/marketing/lineup/page.tsx` monta `LineupView`, que a su vez monta las mismas vistas `LineupBarView` / `LineupClubView`.
- Resultado: cualquier cambio en metricas hoy impacta tecnicamente `marketing/lineup`, aunque `marketing/lineup` siga fuera del alcance funcional.
- `apps/web-next/components/panel/views/metrics/TicketsByTypeCard.tsx` existe como card reutilizable, pero hoy no aparece importada en el arbol del panel. No es source of truth activa de la pantalla.
- `LineChartSimple.tsx` y `BarChartGrouped.tsx` son compartidos. Cambios ahi impactan dashboards y otras cards reutilizables.
- `OrdersPageClient.tsx` sigue concentrando UI, estado, fetches directos, export y semantica de estados en un solo archivo. Es el modulo operativo mas acoplado del panel actual.

## Mapa tecnico por superficie

### Dashboard bar

**Ruta**

- `/panel`

**Archivo de entrada**

- `apps/web-next/app/panel/(authenticated)/page.tsx`

**Vista principal**

- `apps/web-next/components/panel/views/dashboard/DashboardBarView.tsx`

**Subcomponentes y bloques reales**

- `BarChartGrouped` para `Tendencia de Reservas`
- `LineChartSimple` para `Visitas al Perfil`
- `PrimaryActionBanner`
- `KpiGrid`
- `SummaryCard`
- `EngagementCard`

**Helper / source of truth de data**

- Live:
  - `apps/web-next/lib/metrics.ts` -> `getPanelMetricsSummaryWithSeries`
  - `apps/web-next/lib/dashboardHelpers.ts` -> `calculateBarSummaryFromKpis`
- Demo:
  - `apps/web-next/lib/panel-demo/dashboard.ts` -> `getPanelDemoMetricsSummaryWithSeries("bar", ...)`
  - rango demo desde `apps/web-next/lib/panel-demo/time.ts`

**Que consume hoy**

- `kpis.reservations_total`
- `kpis.reservations_confirmed`
- `kpis.reservations_en_revision`
- `kpis.profile_views`
- `kpis.whatsapp_clicks`
- `kpis.top_promo`
- `kpis_range.avg_party_size_confirmed`
- `series.reservations_by_status`
- `series.profile_views`

**Cambio futuro cerrado**

- No hay cambio estructural del chart principal.
- `Visitas al perfil` se mantiene como KPI + sparkline.

**Tipo de cambio futuro**

- Mayormente visual si se mejora legibilidad del sparkline.
- No requiere nueva shape para mantener el enfoque ya cerrado.

**Seam minimo recomendado**

- `apps/web-next/components/panel/views/dashboard/DashboardBarView.tsx`
- solo si la mejora es compartida: `apps/web-next/components/panel/ui/charts/LineChartSimple.tsx`

**Riesgo**

- Bajo si el cambio queda en la vista.
- Medio si toca `LineChartSimple.tsx`, porque es compartido.

### Dashboard discoteca

**Ruta**

- `/panel`

**Archivo de entrada**

- `apps/web-next/app/panel/(authenticated)/page.tsx`

**Vista principal**

- `apps/web-next/components/panel/views/dashboard/DashboardClubView.tsx`

**Subcomponentes y bloques reales**

- `BarChartGrouped` para `Tendencia de Entradas`
- `LineChartSimple` para `Visitas al Perfil`
- `PrimaryActionBanner`
- `KpiGrid`
- `SummaryCard`
- `EngagementCard`

**Helper / source of truth de data**

- Live:
  - `apps/web-next/lib/metrics.ts` -> `getPanelMetricsSummaryWithSeries`
  - `apps/web-next/lib/dashboardHelpers.ts` -> `calculateClubSummary`
- Demo:
  - `apps/web-next/lib/panel-demo/dashboard.ts` -> `getPanelDemoMetricsSummaryWithSeries("discoteca", ...)`
  - rango demo desde `apps/web-next/lib/panel-demo/time.ts`

**Que consume hoy**

- `kpis_range.tickets_sold`
- `kpis_range.tickets_used`
- `kpis.revenue_paid`
- `kpis.profile_views`
- `kpis.whatsapp_clicks`
- `kpis.top_promo`
- `series.orders_sold_used`
- `series.profile_views`

**Cambio futuro cerrado**

- El dashboard se queda con vendidas vs usadas.
- Preventa no se mueve aca.
- `Visitas al perfil` sigue como KPI + sparkline.

**Tipo de cambio futuro**

- Mayormente visual si se mejora legibilidad del sparkline.
- Datos solo si se recalibran fixtures.

**Seam minimo recomendado**

- `apps/web-next/components/panel/views/dashboard/DashboardClubView.tsx`
- solo si la mejora es compartida: `apps/web-next/components/panel/ui/charts/LineChartSimple.tsx`

**Riesgo**

- Bajo a medio.

### Metricas bar

**Ruta**

- `/panel/metrics`

**Archivo de entrada**

- `apps/web-next/app/panel/(authenticated)/metrics/page.tsx`

**Vista principal**

- `apps/web-next/components/panel/views/lineup/LineupBarView.tsx`

**Subcomponentes y bloques reales**

- `BarKpiGrid` local dentro de `LineupBarView`
- `ReservationsTrendChart` como grafico protagonista
- lista `Recent Activity`

**Helper / source of truth de data**

- Live:
  - `apps/web-next/lib/metrics.ts` -> `getPanelMetricsSummaryWithSeries`
  - `apps/web-next/lib/activity.ts` -> `getPanelActivity`
- Demo:
  - `apps/web-next/lib/panel-demo/dashboard.ts` -> `getPanelDemoMetricsSummaryWithSeries("bar", ...)`
  - `apps/web-next/lib/panel-demo/activity.ts` -> `getPanelDemoBarActivity`
  - rangos desde `apps/web-next/lib/panel-demo/time.ts`

**Que consume hoy**

- `kpis.profile_views`
- `kpis.whatsapp_clicks`
- `kpis.promo_open_count`
- `kpis.top_promo`
- `kpis.reservations_total`
- `kpis.reservations_en_revision`
- `kpis.reservations_confirmed`
- `kpis.reservations_cancelled`
- `series.reservations_by_status`
- `series.bucket_mode`
- `activity.items`

**Cambio futuro cerrado**

- Reemplazar el grafico repetido por una visual de distribucion por dia/franja.

**Diagnostico tecnico**

- Hoy `LineupBarView` solo recibe `reservations_by_status` por bucket diario o semanal.
- No existe en `MetricsSummaryWithSeries` una serie de distribucion por franja horaria.
- `panel-demo/reservations.ts` tiene reservas con horario para fechas operativas, pero no es la source of truth de metricas agregadas `7d/30d/90d`.
- En live tampoco existe un helper actual que exponga distribucion por dia/franja.

**Tipo de cambio futuro**

- No alcanza con cambio visual.
- Requiere shape minima nueva o derivacion minima nueva.

**Seam minimo recomendado**

- Vista:
  - `apps/web-next/components/panel/views/lineup/LineupBarView.tsx`
- Fuente live:
  - extender `apps/web-next/lib/metrics.ts` o el contrato que devuelve `/metrics/summary?includeSeries=1`
- Fuente demo:
  - extender `apps/web-next/lib/panel-demo/dashboard.ts`
  - o crear helper demo analitico especifico para distribucion `bar`

**Riesgo**

- Medio/alto.
- Conviene en bloque propio.

### Metricas discoteca

**Ruta**

- `/panel/metrics`

**Archivo de entrada**

- `apps/web-next/app/panel/(authenticated)/metrics/page.tsx`

**Vista principal**

- `apps/web-next/components/panel/views/lineup/LineupClubView.tsx`

**Subcomponentes y bloques reales**

- `LineupKpiGrid` local dentro de `LineupClubView`
- tabla `Entradas por tipo`
- `MultiLineChart` local para series por tipo
- `LineChartSimple` para ingresos
- cards `Mesas con mas interes`
- lista `Actividad reciente`

**Helper / source of truth de data**

- Live:
  - `apps/web-next/lib/metrics.ts` -> `getPanelMetricsSummaryWithSeries`
  - `apps/web-next/lib/activity.ts` -> `getPanelActivity`
  - `apps/web-next/lib/metricsBreakdown.ts` -> `getClubBreakdown`
- Demo:
  - `apps/web-next/lib/panel-demo/dashboard.ts` -> `getPanelDemoMetricsSummaryWithSeries("discoteca", ...)`
  - `apps/web-next/lib/panel-demo/activity.ts` -> `getPanelDemoClubActivity`
  - `apps/web-next/lib/panel-demo/metricsBreakdown.ts` -> `getPanelDemoClubBreakdown`
  - rangos desde `apps/web-next/lib/panel-demo/time.ts`

**Que consume hoy**

- `kpis.profile_views`
- `kpis.whatsapp_clicks`
- `kpis.promo_open_count`
- `kpis.top_promo`
- `kpis.orders_total`
- `kpis_range.tickets_sold`
- `kpis_range.tickets_used`
- `kpis_range.revenue_paid`
- `series.tickets_sold_by_type`
- `series.ticket_types_meta`
- `series.revenue_paid`
- `breakdown.tickets_top`
- `breakdown.tables_interest_top`
- `activity.items`

**Cambio futuro cerrado**

- Mantener la estructura actual.
- Volver las lineas mas firmes y menos cosmeticas.

**Diagnostico tecnico**

- El chart principal por tipo ya es local a `LineupClubView` via `MultiLineChart`.
- Esa parte se puede ajustar sin tocar componentes compartidos.
- El chart de ingresos usa `LineChartSimple`, que si se toca impacta mas superficies.

**Tipo de cambio futuro**

- Mayormente visual.
- No necesita nueva shape si se mantiene la estructura actual.

**Seam minimo recomendado**

- Primero intentar resolver todo en:
  - `apps/web-next/components/panel/views/lineup/LineupClubView.tsx`
- Solo si tambien se quiere endurecer el sparkline/revenue line compartido:
  - `apps/web-next/components/panel/ui/charts/LineChartSimple.tsx`

**Riesgo**

- Bajo si queda local a `LineupClubView`
- Medio si toca `LineChartSimple`

### Visitas al perfil

**Rutas donde aparece**

- Dashboard `bar`
- Dashboard `discoteca`
- Metricas `bar` como KPI
- Metricas `discoteca` como KPI

**Vistas / componentes reales**

- `apps/web-next/components/panel/views/dashboard/DashboardBarView.tsx`
- `apps/web-next/components/panel/views/dashboard/DashboardClubView.tsx`
- `apps/web-next/components/panel/ui/charts/LineChartSimple.tsx`
- KPI en:
  - `apps/web-next/components/panel/views/lineup/LineupBarView.tsx`
  - `apps/web-next/components/panel/views/lineup/LineupClubView.tsx`

**Helper / source of truth de data**

- Dashboard y metricas leen `kpis.profile_views`
- Dashboard ademas lee `series.profile_views`
- Source live/demo viene del mismo `MetricsSummaryWithSeries`

**Cambio futuro cerrado**

- Se mantiene como KPI + sparkline.
- No se convierte en grafico protagonista.

**Tipo de cambio futuro**

- Visual/local, salvo que se quiera cambiar comportamiento base del line chart compartido.

**Seam minimo recomendado**

- Si el ajuste es solo de copy o layout del wrapper:
  - `DashboardBarView.tsx`
  - `DashboardClubView.tsx`
- Si el ajuste es de legibilidad del sparkline:
  - `LineChartSimple.tsx` con props opcionales, evitando cambiar defaults globales mas de la cuenta

**Riesgo**

- Bajo a medio.

### Entradas / preventa por fecha

**Ruta**

- `/panel/orders`

**Archivo de entrada**

- `apps/web-next/app/panel/(authenticated)/orders/page.tsx`

**Vista principal**

- `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx`

**Subcomponentes y bloques reales**

- `PageHeader`
- summary cards locales via `summaryCards`
- listado de cards locales via `renderEntryCard`
- export menu local

**Helper / source of truth de data**

- Live:
  - `fetch /panel/orders/summary`
  - `fetch /panel/orders/search`
  - `downloadPanelReservationsClientsCsv`
- Demo:
  - `apps/web-next/lib/panel-demo/orders.ts`
    - `getPanelDemoDiscotecaOrdersSummary`
    - `searchPanelDemoDiscotecaOrders`

**Que consume hoy**

- Summary actual:
  - `total_qty`
  - `used_qty`
  - `pending_qty`
  - `unused_qty`
  - `current_window`
- Search/listado:
  - `quantity`
  - `created_at`
  - `intended_date`
  - `valid_from`
  - `valid_to`
  - `used_at`
  - `checkin_state`

**Cambios futuros cerrados**

- `Total entradas` -> `Vendidas para esta fecha`
- agregar `Ingresos de entradas`
- anclar mejor la lectura a la fecha seleccionada
- evaluar logica futura vs pasada
- evaluar microindicador de ritmo reciente de venta

**Diagnostico tecnico**

- Renombrar `Total entradas` y reforzar fecha seleccionada es local a `OrdersPageClient.tsx`.
- `Ingresos de entradas` no existe hoy en `OrdersSummaryResponse`.
- `OrderItem` tampoco expone un monto por compra.
- El ritmo reciente de venta no se puede calcular bien con el search actual:
  - el endpoint devuelve maximo `20`
  - la lista es un listado operativo, no una base completa para ritmo

**Tipo de cambio futuro**

- Copy / anclaje a fecha: visual/local
- `Ingresos de entradas`: shape minima nueva
- microindicador de ritmo: shape minima nueva
- logica futura vs pasada: derivacion minima / semantica local

**Seam minimo recomendado**

- Visual/local:
  - `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx`
- Si se agrega `Ingresos de entradas` o ritmo:
  - ampliar contrato live de `/panel/orders/summary`
  - ampliar helper demo en `apps/web-next/lib/panel-demo/orders.ts`

**Riesgo**

- Bajo para copy/UI local
- Medio para cualquier agregado que necesite nuevo dato resumen

### Reservas / operacion por fecha

**Ruta**

- `/panel/reservations`

**Archivo de entrada**

- `apps/web-next/app/panel/(authenticated)/reservations/page.tsx`

**Vista principal**

- `apps/web-next/components/panel/views/ReservationsView.tsx`

**Subcomponentes y bloques reales**

- `PageHeader`
- `StatCard`
- `Toolbar`
- `ReservationCard`
- export menu local

**Helper / source of truth de data**

- Live:
  - `apps/web-next/lib/reservations.ts`
    - `getPanelReservationsByLocalIdAndDate`
    - `updatePanelReservationStatus`
  - `apps/web-next/lib/panelExport.ts`
- Demo:
  - `apps/web-next/lib/panel-demo/reservations.ts`
    - `getPanelDemoBarReservationsByDate`
    - `updatePanelDemoBarReservation`

**Que consume hoy**

- dataset operativo acotado por fecha
- stats locales derivadas del listado filtrado
- acciones confirm/cancel/edit note

**Cambio futuro cerrado**

- No hay cambio analitico estructural decidido aca.
- Este modulo queda operativo por fecha y solo debe conservar coherencia con dashboard/metricas.

**Tipo de cambio futuro**

- Si aparece alguno, deberia ser local.
- No requiere nueva shape para el enfoque ya cerrado.

**Seam minimo recomendado**

- `reservations/page.tsx` para data/acciones
- `ReservationsView.tsx` y `ReservationCard.tsx` para copy/UI

**Riesgo**

- Bajo.

## Source of truth tecnica por bloque futuro

### Bloque: Bares metricas -> distribucion por dia/franja

**Decision cerrada**

- Reemplazar el grafico repetido de metricas por una visual de distribucion por dia/franja.

**Source of truth actual**

- Vista: `LineupBarView.tsx`
- Data actual: `MetricsSummaryWithSeries.series.reservations_by_status`

**Lectura tecnica**

- La data actual no alcanza para una distribucion por franja.
- Hace falta una shape minima nueva.

**Clasificacion**

- Visual: si
- Datos: si
- Shape minima nueva: si

**Archivos probables a tocar**

- `apps/web-next/components/panel/views/lineup/LineupBarView.tsx`
- `apps/web-next/lib/metrics.ts`
- `apps/web-next/lib/panel-demo/dashboard.ts`
- eventualmente un chart local nuevo o una card local nueva en la misma vista

**Riesgo**

- Medio/alto

**Recomendacion**

- Resolver en bloque propio.

### Bloque: Discotecas metricas -> lineas mas firmes / legibles

**Decision cerrada**

- Mantener estructura actual y endurecer la lectura visual.

**Source of truth actual**

- Vista: `LineupClubView.tsx`
- Chart por tipo: `MultiLineChart` local
- Chart de ingresos: `LineChartSimple`

**Clasificacion**

- Visual: si
- Datos: no necesariamente
- Shape minima nueva: no

**Archivos probables a tocar**

- `apps/web-next/components/panel/views/lineup/LineupClubView.tsx`
- opcionalmente `apps/web-next/components/panel/ui/charts/LineChartSimple.tsx`

**Riesgo**

- Bajo si queda local
- Medio si toca el chart compartido

**Recomendacion**

- Se puede agrupar con mejoras de legibilidad de `Visitas al perfil`.

### Bloque: Visitas al perfil -> KPI + sparkline mas legible

**Decision cerrada**

- Mantener KPI + sparkline. No promover a grafico principal.

**Source of truth actual**

- Dashboards `DashboardBarView.tsx` y `DashboardClubView.tsx`
- chart compartido `LineChartSimple.tsx`
- labels armados en `page.tsx` del dashboard

**Clasificacion**

- Visual: si
- Datos: no
- Shape minima nueva: no

**Archivos probables a tocar**

- `apps/web-next/components/panel/views/dashboard/DashboardBarView.tsx`
- `apps/web-next/components/panel/views/dashboard/DashboardClubView.tsx`
- opcionalmente `apps/web-next/components/panel/ui/charts/LineChartSimple.tsx`

**Riesgo**

- Bajo a medio

**Recomendacion**

- Agrupar con el bloque visual de metricas `discoteca` si se quiere una pasada unica de legibilidad.

### Bloque: Entradas / preventa por fecha

**Decisiones cerradas**

- `Total entradas` -> `Vendidas para esta fecha`
- agregar `Ingresos de entradas`
- anclar mejor lectura a la fecha seleccionada
- evaluar futura vs pasada
- evaluar microindicador de ritmo reciente

**Source of truth actual**

- `OrdersPageClient.tsx`
- live fetch directo a `/panel/orders/summary` y `/panel/orders/search`
- demo helper en `panel-demo/orders.ts`

**Clasificacion**

- Copy/UI local: si
- Datos: si, si se suma ingresos o ritmo
- Shape minima nueva: si, para ingresos y ritmo

**Archivos probables a tocar**

- `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx`
- `apps/web-next/lib/panel-demo/orders.ts`
- y si se quiere parity real:
  - contrato de `/panel/orders/summary`

**Riesgo**

- Bajo para copy local
- Medio para agregados dependientes de dato nuevo

**Recomendacion**

- Resolver el bloque operativo de Entradas separado de metricas.

## Riesgos y acoplamientos relevantes

- `metricas` y `marketing/lineup` comparten exactamente las mismas vistas (`LineupBarView` y `LineupClubView`).
- Hay tres formatters de bucket/labels distintos:
  - dashboard en `page.tsx`
  - metricas bar en `LineupBarView.tsx`
  - metricas club en `LineupClubView.tsx`
- `OrdersPageClient.tsx` sigue con fetch directo y semantica local; no hay service layer live equivalente a la demo.
- `TicketsByTypeCard.tsx` existe pero hoy no es source of truth activa del panel. Adoptarla ahora seria un mini-refactor, no un seam minimo.
- `Visitas al perfil` y la linea de ingresos comparten `LineChartSimple.tsx`; cualquier cambio ahi afecta mas de una superficie.
- El cambio de distribucion por dia/franja en `bar` no sale gratis de la data actual; necesita shape nueva o derivacion dedicada.

## Orden sugerido de implementacion

Orden sugerido por riesgo y superficie de cambio:

1. Entradas / preventa por fecha
   - Motivo: bloque operativo aislado, sin tocar charts compartidos.
   - Parte baja de riesgo: copy y anclaje a fecha.
   - Parte media de riesgo: `Ingresos de entradas` y microindicador de ritmo si se confirma shape nueva.

2. Metricas discoteca + legibilidad de `Visitas al perfil`
   - Motivo: mayormente visual, casi todo puede quedar local a vistas.
   - Se puede hacer sin abrir nueva shape.

3. Metricas bar -> distribucion por dia/franja
   - Motivo: es el bloque con mayor dependencia de shape minima nueva.
   - Conviene dejarlo para un bloque propio, con foco en dataset y visual juntos.

## Resumen de clasificacion por cambio

| Cambio futuro | Visual | Datos | Shape minima nueva | Riesgo | Bloque propio |
| --- | --- | --- | --- | --- | --- |
| Bar metricas -> distribucion por dia/franja | Si | Si | Si | Medio/alto | Si |
| Discoteca metricas -> lineas mas firmes | Si | No | No | Bajo/medio | Se puede agrupar |
| Visitas al perfil -> sparkline mas legible | Si | No | No | Bajo/medio | Se puede agrupar |
| Entradas -> `Vendidas para esta fecha` | Si | No | No | Bajo | No necesariamente |
| Entradas -> `Ingresos de entradas` | No | Si | Si | Medio | Si o sub-bloque |
| Entradas -> microindicador de ritmo reciente | No | Si | Si | Medio | Si o sub-bloque |
| Reservas -> ajustes operativos futuros | Si | Eventual | No | Bajo | Solo si aparece necesidad concreta |

## Fuera de alcance explicito

Queda fuera de este documento:

- rediscutir el enfoque funcional ya cerrado;
- tratar `marketing/lineup` como objetivo funcional;
- limpieza arquitectonica amplia de `lineup`;
- backend, DB, provider, runtime o layout como frente principal de trabajo;
- roadmap de producto o priorizacion comercial general.

## Checkpoint operativo

Si se retoma la implementacion mas adelante, este documento debe usarse asi:

- partir del bloque sugerido por menor riesgo;
- tocar primero el seam minimo documentado aca;
- evitar mover charts compartidos si una vista local alcanza;
- aceptar el acoplamiento tecnico con `marketing/lineup` sin convertirlo en alcance funcional;
- no volver a inspeccionar desde cero las rutas, helpers y vistas mapeadas arriba.
