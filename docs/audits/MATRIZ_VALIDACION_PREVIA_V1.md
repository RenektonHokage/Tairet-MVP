# TAIRET — MATRIZ_VALIDACION_PREVIA_V1

## 0) Ruta canónica

Este documento pertenece a:

* `docs/audits/`

Mientras no se decida otra cosa explícitamente, esta es la ruta documental canónica para la capa v1 de auditoría/hardening.

---

## 1) Propósito

Definir, antes de cualquier fase CODE, qué temas del hardening MVP quedan:

* **confirmados por código**
* cuáles **requieren validación runtime**
* y cuáles dependen de **input humano permitido**

El objetivo es evitar suposiciones, separar claramente ASK de CODE y proteger flujos críticos sin breaking changes.

---

## 2) Regla de fuente de verdad

La prioridad de verdad operativa en esta matriz es:

1. **Código**
2. **Runtime** (solo cuando el código no alcanza para confirmar comportamiento real)
3. **Input humano** (solo negocio, riesgo aceptado o comportamiento esperado)

Todo lo no demostrable en código debe quedar en estado:

* **Requiere validación**

---

## 3) Matriz de validación previa

| ID         | Tema                                                     | Fuente primaria | Qué validar                                                                                             | Método                                                                                                                                                                                        | Estado                      |
| ---------- | -------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| MVP-MAT-01 | Existencia de `GET /public/orders?email`                 | Código          | Que la ruta pública existe, valida `email` y parsea el query param                                      | Lectura estática en `functions/api/src/routes/public.ts:163`, `functions/api/src/routes/public.ts:289`, `functions/api/src/routes/public.ts:291`, `functions/api/src/routes/public.ts:292` | Confirmado por código       |
| MVP-MAT-02 | Payload observable actual de órdenes públicas            | Código          | Qué campos selecciona hoy el backend y qué ramas visibles del contrato expone                           | Lectura estática en `functions/api/src/routes/public.ts:296`, `functions/api/src/routes/public.ts:298`, `functions/api/src/routes/public.ts:299`, `functions/api/src/routes/public.ts:306` | Confirmado por código       |
| MVP-MAT-03 | Campos exactos consumidos por B2C desde órdenes públicas | Código          | Qué campos usa realmente `MisEntradas` del payload de órdenes públicas                                  | Extracción estática desde `apps/web-b2c/src/lib/orders.ts:4` y `apps/web-b2c/src/pages/MisEntradas.tsx:156`, `:165`, `:168`, `:174`, `:178`, `:183`, `:227`, `:253`, `:275`               | Confirmado por código       |
| MVP-MAT-04 | Consumo B2C del lookup público por email                 | Código          | Que B2C llama `/public/orders?email` y no adapta el payload antes de usarlo                             | Lectura estática en `apps/web-b2c/src/lib/orders.ts:20`, `apps/web-b2c/src/lib/orders.ts:22`, `apps/web-b2c/src/lib/orders.ts:36`                                                          | Confirmado por código       |
| MVP-MAT-05 | Exposición de `checkin_token` en `MisEntradas`           | Código          | Que `MisEntradas` renderiza QR y permite copiar token                                                   | Lectura estática en `apps/web-b2c/src/pages/MisEntradas.tsx:227`, `apps/web-b2c/src/pages/MisEntradas.tsx:253`, `apps/web-b2c/src/pages/MisEntradas.tsx:258`                               | Confirmado por código       |
| MVP-MAT-06 | Uso de `setHTML(...)` en mapa                            | Código          | Que el popup usa HTML interpolado                                                                       | Lectura estática en `apps/web-b2c/src/components/shared/MapSection.tsx:343`, `apps/web-b2c/src/components/shared/MapSection.tsx:389`                                                          | Confirmado por código       |
| MVP-MAT-07 | Origen de datos que llegan a `setHTML(...)`              | Código          | De dónde salen `venue/address/location` y cómo llegan al popup                                          | Trazar cadena de datos desde componentes/perfiles/origen hasta `MapSection` (base: `apps/web-b2c/src/pages/BarProfile.tsx:331`, `apps/web-b2c/src/pages/ClubProfile.tsx:423`)                 | Requiere validación         |
| MVP-MAT-08 | Comportamiento runtime observado del bloque mapa/popup   | Runtime         | Si el bloque de ubicación muestra comportamiento anómalo visible en runtime cuando existe ubicación y si cae correctamente a fallback cuando no existe | Validación runtime local observada en `/#/club/dlirio` (mapa operativo, ubicación visible, arrastre/zoom correctos y sin anomalías visibles reportadas) y `/#/bar/mckharthys-bar` (fallback `Ubicación no disponible` cuando no hay ubicación cargada) | Fase B cerrada en runtime local observado |
| MVP-MAT-09 | Filtrado remanente de reservas en cliente (panel)        | Código          | Que tras `F5A-1 CODE 01` la búsqueda y el `status` siguen aplicándose localmente, mientras la fecha seleccionada ya dispara carga date-scoped en backend | Lectura estática en `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:92`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:166`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:175` | Confirmado por código       |
| MVP-MAT-10 | Modo legacy del listado de reservas (`.limit(20)` sin `date`) | Código      | Que backend sigue restringiendo cantidad al listar reservas por local cuando no se envía `date`        | Lectura estática en `functions/api/src/routes/reservations.ts:250`, `functions/api/src/routes/reservations.ts:289`, `functions/api/src/routes/reservations.ts:296`                            | Confirmado por código       |
| MVP-MAT-11 | Contrato observable actual de reservas en panel          | Código          | Ruta real de carga/update, shape observable, acciones visibles y restricciones observadas               | Extracción estática desde `apps/web-next/app/panel/(authenticated)/reservations/page.tsx`, `apps/web-next/lib/reservations.ts`, `functions/api/src/routes/reservations.ts` y `functions/api/src/routes/panel.ts`               | Confirmado por código       |
| MVP-MAT-12 | Riesgo runtime original de ocultamiento en reservas por subset | Runtime     | Si el diseño original de subset backend de `20` filas más filtro local por fecha podía ocultar reservas reales del día seleccionado | Validación runtime local observada sobre `mckharthys-bar` (`38` reservas, zona `America/Asuncion`), con `GET /locals/:id/reservations` devolviendo `20` filas y `date=2026-01-28` mostrando empty state pese a existir `2` reservas reales de ese día local fuera del top `20` | Confirmado por runtime local observado |
| MVP-MAT-13 | Inconsistencia `/panel/metrics`                          | Código          | Que la página de métricas renderiza vistas lineup                                                       | Lectura estática en `apps/web-next/app/panel/(authenticated)/metrics/page.tsx:4`, `apps/web-next/app/panel/(authenticated)/metrics/page.tsx:11`                                               | Confirmado por código       |
| MVP-MAT-14 | `panel.ts` monolítico                                    | Código          | Concentración de dominios/rutas en un solo archivo                                                      | Lectura estática en `functions/api/src/routes/panel.ts:425`, `functions/api/src/routes/panel.ts:1767`, `functions/api/src/routes/panel.ts:2729`                                               | Confirmado por código       |
| MVP-MAT-15 | Ruta real y auth observable del check-in panel           | Código          | Que el flujo actual usa `PATCH /panel/checkin/:token` protegido por `panelAuth + requireRole(["owner","staff"])` | Lectura estática en `functions/api/src/routes/panel.ts:1355` y `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:529`                                                                | Confirmado por código       |
| MVP-MAT-16 | Mapping frontend observable del check-in                 | Código          | Que el frontend mapea `success`, `already_used`, `window_invalid`, `invalid_token`, `forbidden`, `error` sobre las ramas actuales | Extracción estática desde `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:554`, `:556`, `:578`, `:583`, `:585`, `:593`, `:1075`, `:1104`, `:1116`, `:1138`, `:1148`, `:1158`      | Confirmado por código       |
| MVP-MAT-17 | Ruta real y auth observable del export CSV              | Código          | Que el bloque actual usa `GET /panel/exports/reservations-clients.csv` protegido por `panelAuth + requireRole(["owner","staff"])` | Lectura estática en `functions/api/src/routes/panel.ts:1767`, `apps/web-next/lib/panelExport.ts:57`, `apps/web-next/lib/panelExport.ts:61`                                                  | Confirmado por código       |
| MVP-MAT-18 | Headers / filename / fallback observable del export     | Código          | Que el export tiene headers backend observables, filename backend/fallback frontend y consumidores confirmados   | Extracción estática desde `functions/api/src/routes/panel.ts:1859`, `functions/api/src/routes/panel.ts:1862`, `functions/api/src/routes/panel.ts:1991`, `functions/api/src/routes/panel.ts:1994`, `apps/web-next/lib/panelExport.ts:78`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:151`, `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx:265` | Confirmado por código       |
| MVP-MAT-19 | Trazabilidad por `requestId`                             | Código          | Que `requestId` existe y se propaga por header                                                          | Lectura estática en `functions/api/src/middlewares/requestId.ts:9`, `functions/api/src/middlewares/requestId.ts:11`                                                                           | Confirmado por código       |
| MVP-MAT-20 | Error middleware sin logger unificado                    | Código          | Que se usa `console.error` y no logger estructurado en middleware de error                              | Lectura estática en `functions/api/src/middlewares/error.ts:16`, `functions/api/src/middlewares/error.ts:17`                                                                                  | Confirmado por código       |
| MVP-MAT-21 | Estado Sentry en panel                                   | Código          | Que está pendiente (TODO)                                                                               | Lectura estática en `apps/web-next/lib/sentry.ts:1`, `apps/web-next/lib/sentry.ts:5`                                                                                                          | Confirmado por código       |
| MVP-MAT-22 | Logout panel observado desde código                      | Código          | Que en `SidebarUserInfo` se limpia `panel_token` y se redirige a `/panel/login`, sin `supabase.auth.signOut()` allí | Lectura estática en `apps/web-next/components/panel/SidebarUserInfo.tsx:13`, `apps/web-next/components/panel/SidebarUserInfo.tsx:15`, `apps/web-next/components/panel/SidebarUserInfo.tsx:16` | Confirmado por código       |
| MVP-MAT-23 | Efectividad real del logout en runtime local observado   | Runtime         | Si en el runtime local observado el logout invalida realmente la sesión o solo ejecuta logout visible/UI | Validación runtime local sobre `login → logout → back → refresh /panel → nueva navegación /panel → GET /panel/me`, con base en `apps/web-next/app/panel/(authenticated)/page.tsx:307`, `apps/web-next/lib/api.ts:22`, `functions/api/src/middlewares/panelAuth.ts:86` | Confirmado por runtime      |
| MVP-MAT-24 | Enforzamiento auth panel en backend                      | Código          | Bearer token + `getUser` + resolución `panel_users`                                                     | Lectura estática en `functions/api/src/middlewares/panelAuth.ts:63`, `functions/api/src/middlewares/panelAuth.ts:86`, `functions/api/src/middlewares/panelAuth.ts:101`                        | Confirmado por código       |
| MVP-MAT-25 | Cobertura auth observable del bloque reservas            | Código          | Qué middleware protege load/update/search/export del bloque y qué tenant checks aplica                   | Lectura estática en `functions/api/src/routes/reservations.ts:161`, `functions/api/src/routes/reservations.ts:174`, `functions/api/src/routes/panel.ts:1063`, `functions/api/src/routes/panel.ts:1107`, `functions/api/src/routes/panel.ts:1137`, `functions/api/src/routes/panel.ts:1767` | Confirmado por código       |
| MVP-MAT-26 | RLS permisivo en SQL                                     | Código          | Policies observables con `USING (true)` / `WITH CHECK (true)` en el archivo revisado                    | Lectura estática en `infra/sql/rls.sql:21`, `infra/sql/rls.sql:30`, `infra/sql/rls.sql:35`, `infra/sql/rls.sql:79`                                                                            | Confirmado por código       |
| MVP-MAT-27 | Matriz actor → tabla → operación demostrable por código  | Código          | Qué actores, paths, tablas y operaciones quedaron efectivamente demostrados en el código observado      | Extracción estática desde `infra/sql/rls.sql`, `infra/sql/schema.sql`, migraciones observadas y wiring de acceso en backend/frontend                                                         | Confirmado por código       |
| MVP-MAT-28 | Efecto real de RLS en entorno operativo                  | Runtime         | Si el modelo real de acceso (roles/keys) depende o no de estas policies en operación                    | Validación runtime por actor/credencial, no inferible solo del archivo RLS                                                                                                                    | Requiere validación         |
| MVP-MAT-29 | Riesgo aceptado del lookup público temporal              | Input humano    | Confirmación documental de aceptación de riesgo y vigencia temporal                                     | Input de negocio explícito ya fijado en esta fase documental                                                                                                                                  | Confirmado por input humano |
| MVP-MAT-30 | Dominio runtime real de `status` en órdenes públicas     | Runtime         | Qué valores reales devuelve hoy `status` y si todos son absorbidos por `MisEntradas`                    | Validación runtime sobre respuestas reales del endpoint y contraste con `getStatusLabel()` / `getStatusColor()`                                                                              | Requiere validación         |
| MVP-MAT-31 | Nulabilidad real de `checkin_token` en órdenes públicas  | Runtime         | Si `checkin_token` puede llegar vacío o nulo en datos reales que hoy consume `MisEntradas`              | Validación runtime sobre dataset real; no inferible solo desde `select(...)` y tipos TS                                                                                                       | Requiere validación         |
| MVP-MAT-32 | Shape runtime real de campos usados por B2C              | Runtime         | Si `quantity`, `total_amount`, `currency`, `created_at` y `used_at` llegan siempre con el shape esperado | Validación runtime del JSON devuelto por `/public/orders?email` frente al uso directo en `apps/web-b2c/src/lib/orders.ts:36` y `apps/web-b2c/src/pages/MisEntradas.tsx`                     | Requiere validación         |
| MVP-MAT-33 | Comportamiento real con más de `50` órdenes por email    | Runtime         | Si el límite backend observado corta casos reales relevantes para el flujo actual                        | Validación runtime con email de alto volumen; base de código en `functions/api/src/routes/public.ts:299`                                                                                     | Requiere validación         |
| MVP-MAT-34 | Consumidores adicionales del contrato público            | Código          | si existe algún consumidor adicional relevante de `getOrdersByEmail()` o del contrato de `/public/orders?email` fuera de `MisEntradas`; en esta extracción solo quedó confirmado el uso directo de `getOrdersByEmail()` en `MisEntradas` | Búsqueda estática de referencias a `getOrdersByEmail` y del contrato público en el workspace; base confirmada en `apps/web-b2c/src/pages/MisEntradas.tsx:7`, `apps/web-b2c/src/pages/MisEntradas.tsx:43` | Requiere validación         |
| MVP-MAT-35 | Rutas relacionadas de reservas existentes pero no usadas | Código          | Que `/panel/reservations/search` existe pero no la usa la vista actual, y que `/reservations/:id` está deprecated | Lectura estática en `functions/api/src/routes/panel.ts:1063`, `apps/web-next/lib/reservations.ts:64`, `functions/api/src/routes/reservations.ts:151`, `apps/web-next/lib/reservations.ts:77` | Confirmado por código       |
| MVP-MAT-36 | Campos usados por la vista actual de reservas panel      | Código          | Qué campos son no-breaking para la vista actual observada y cuáles están presentes pero no se leen      | Extracción estática desde `apps/web-next/app/panel/(authenticated)/reservations/page.tsx`, `apps/web-next/components/panel/views/ReservationsView.tsx`, `apps/web-next/components/panel/views/ReservationCard.tsx` | Confirmado por código       |
| MVP-MAT-37 | Consumidor adicional del GET de reservas                 | Código          | Que `getPanelReservationsByLocalId()` también alimenta lineup y amplía cautela no-breaking              | Lectura estática en `apps/web-next/components/panel/views/lineup/LineupCalendarView.tsx:459` y `apps/web-next/lib/reservations.ts:54`                                                       | Confirmado por código       |
| MVP-MAT-38 | Intencionalidad de ausencia de `requireRole(...)`        | Input humano    | Si load/update de reservas deben seguir solo con `panelAuth` + tenant o requerir rol explícito          | No inferible solo desde código; el código observado muestra ausencia de `requireRole(...)` en `functions/api/src/routes/reservations.ts:161` y `functions/api/src/routes/panel.ts:1107`     | Requiere validación         |
| MVP-MAT-39 | Suficiencia del filtro local por fecha                   | Runtime         | Si filtrar por fecha en frontend sobre un subset backend mantiene cobertura operativa correcta           | Validación runtime con fechas y datasets reales; base estática en `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:173` y `functions/api/src/routes/reservations.ts:185`     | Requiere validación         |
| MVP-MAT-40 | `LineupCalendarView` dentro del no-breaking contractual  | Input humano    | Si el GET de reservas debe tratarse como contrato compartido entre la vista de reservas y lineup        | Requiere decisión documental/producto luego de confirmar alcance del uso observado en `apps/web-next/components/panel/views/lineup/LineupCalendarView.tsx:459`                               | Requiere validación         |
| MVP-MAT-41 | Cobertura runtime local observada del scanner/check-in   | Runtime         | Si el modo scanner confirma ramas reales del flujo actual del check-in en un local `club`               | Validación runtime local observada en `Dlirio` y `Mambo`, con scanner reproduciendo `success`, `not_yet_valid`, `already_used` y `otro local`, sobre `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:554`, `:556`, `:566`, `:583`, `:1075`, `:1104`, `:1116`, `:1148` | Confirmado por runtime local observado |
| MVP-MAT-42 | Mapping runtime local observado de `404 -> invalid_token` | Runtime        | Si el modo manual actual clasifica correctamente como `invalid_token` el caso observado de token inexistente | Validación runtime local observada con `PATCH /panel/checkin/00000000-0000-4000-8000-000000000000`, `404 {"error":"Order not found"}` y UI visible `QR inválido` / `No se encontró una entrada válida para ese QR.` sobre `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:578`, `:1138` | Confirmado por runtime local observado |
| MVP-MAT-43 | Mapping runtime local observado de `403/409` en check-in | Runtime         | Si el modo manual actual discrimina correctamente `forbidden`, `already_used` y `window_invalid` en las ramas observadas | Validación runtime local observada con token de otro local (`403` → `Token de Otro Local`), token ya usado (`409 + usedAt` → `Ya Usado`) y token expirado (`409 + code=expired` → `Fuera de ventana`) sobre `functions/api/src/routes/panel.ts:1398`, `functions/api/src/routes/panel.ts:1421`, `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:556`, `:566`, `:583`, `:1104`, `:1116`, `:1148` | Confirmado por runtime local observado |
| MVP-MAT-44 | Suficiencia operativa de timeout / retry en check-in     | Runtime         | Si `5500ms` + `1` retry + `450ms` base son suficientes en operación real                                | Validación runtime usando la configuración observable en `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:57`, `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:58`, `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:59` | Requiere validación         |
| MVP-MAT-45 | Cobertura real del export con datasets grandes           | Runtime         | Si el export mantiene consistencia con límites, zonas horarias y volumen alto                           | Validación runtime sobre `functions/api/src/routes/panel.ts:1808`, `functions/api/src/routes/panel.ts:1914`, `functions/api/src/routes/panel.ts:1941` y consumidores FE confirmados         | Requiere validación         |
| MVP-MAT-46 | Alcance contractual de `GET /panel/checkins`             | Input humano    | Si `GET /panel/checkins` entra o no en el mismo contrato visible del bloque check-in/export             | Decisión documental/producto con base en la ruta relacionada observada en `functions/api/src/routes/panel.ts:1460`                                                                             | Requiere validación         |
| MVP-MAT-47 | Contrato compartido de export entre reservas y órdenes   | Input humano    | Si el export debe tratarse como contrato compartido más allá de los dos consumidores ya confirmados     | Decisión documental/producto con base en `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:151` y `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx:265`   | Requiere validación         |
| MVP-MAT-48 | Tablas relevantes observadas para F7                     | Código          | Qué tablas aparecen en `schema.sql` y qué tablas/columnas usadas por runtime quedan fuera del baseline SQL observado | Lectura estática en `infra/sql/schema.sql:9`, `infra/sql/schema.sql:53`, `infra/sql/schema.sql:129`, `infra/sql/migrations/006_create_catalog_tables.sql:7`, `infra/sql/migrations/006_create_catalog_tables.sql:26`, `infra/sql/migrations/011_add_orders_valid_window.sql:8`, `infra/sql/migrations/012_add_orders_intended_date_night_window.sql:9`, `functions/api/src/routes/public.ts:297` | Confirmado por código       |
| MVP-MAT-49 | Policies RLS observables por tabla en el archivo revisado | Código        | Qué tablas tienen `ENABLE ROW LEVEL SECURITY` y qué operaciones muestran policies observables           | Lectura estática en `infra/sql/rls.sql:5`, `infra/sql/rls.sql:12`, `infra/sql/rls.sql:19`, `infra/sql/rls.sql:24`, `infra/sql/rls.sql:28`, `infra/sql/rls.sql:33`, `infra/sql/rls.sql:37`, `infra/sql/rls.sql:42`, `infra/sql/rls.sql:46`, `infra/sql/rls.sql:51`, `infra/sql/rls.sql:55`, `infra/sql/rls.sql:60`, `infra/sql/rls.sql:64`, `infra/sql/rls.sql:69`, `infra/sql/rls.sql:73`, `infra/sql/rls.sql:77` | Confirmado por código       |
| MVP-MAT-50 | Camino observable de acceso con `SUPABASE_SERVICE_ROLE` | Código          | Que el backend API usa cliente con `SUPABASE_SERVICE_ROLE` y concentra el acceso a datos observado      | Lectura estática en `functions/api/src/services/supabase.ts:4`, `functions/api/src/services/supabase.ts:12`, `functions/api/src/routes/public.ts:295`, `functions/api/src/routes/orders.ts:218`, `functions/api/src/routes/panel.ts:1369` | Confirmado por código       |
| MVP-MAT-51 | Tablas críticas sin coverage RLS observable en el archivo revisado | Código | Que `panel_users`, `payment_events`, `ticket_types` y `table_types` no muestran coverage RLS observable en el SQL observado del repo | Contraste estático entre `infra/sql/schema.sql:74`, `infra/sql/schema.sql:129`, `infra/sql/migrations/006_create_catalog_tables.sql:7`, `infra/sql/migrations/006_create_catalog_tables.sql:26` y el contenido observable de `infra/sql/rls.sql:5`, `infra/sql/rls.sql:12` | Confirmado por código       |
| MVP-MAT-52 | Semántica efectiva de service role en entorno real       | Runtime         | Si el camino observable con `SUPABASE_SERVICE_ROLE` termina o no dependiendo de RLS en despliegue real | Validación runtime por credencial/actor; no inferible solo desde `functions/api/src/services/supabase.ts`                                                                                   | Requiere validación         |
| MVP-MAT-53 | Esquema efectivo real de producción vs SQL observado del repo | Runtime      | Si producción refleja `schema.sql`, migraciones observadas y columnas/tablas usadas por runtime         | Validación runtime o introspección en entorno; no inferible solo desde los archivos del repo                                                                                                  | Requiere validación         |
| MVP-MAT-54 | Impacto operativo real de endurecer policies por tabla crítica | Runtime      | Qué rompe o no rompe por actor/tabla crítica al endurecer RLS                                           | Validación runtime por actor/tabla/operación con smoke controlado sobre `orders`, `reservations`, `locals`, `local_daily_ops`, `panel_users`, `ticket_types` y `table_types`               | Requiere validación         |
| MVP-MAT-55 | Intencionalidad de tablas sin coverage RLS observable    | Input humano    | Si la ausencia observable en el SQL observado del repo es deuda temporal, alcance omitido o modelo intencional | Decisión documental/operativa posterior a reconciliar SQL observado y runtime                                                                                                                | Requiere validación         |
| MVP-MAT-56 | Existencia/uso real de `customer_email_lower` en producción | Runtime      | Si la columna usada por runtime existe y se mantiene operativa en la base real                          | Validación runtime o introspección; `customer_email_lower` no aparece en `infra/sql` observado y sí en `functions/api/src/routes/public.ts:297`, `functions/api/src/routes/panel.ts:1616`   | Requiere validación         |
| MVP-MAT-57 | Logout panel fuera del runtime local observado           | Runtime         | Si el hallazgo local de logout visible sin invalidación efectiva de sesión se reproduce o cambia en otros entornos, navegadores o escenarios de persistencia | Validación runtime adicional fuera del entorno local observado; no inferible solo desde `apps/web-next/components/panel/SidebarUserInfo.tsx:15`, `apps/web-next/lib/supabase.ts:31`, `apps/web-next/app/panel/(authenticated)/page.tsx:307` | Requiere validación         |
| MVP-MAT-58 | Severidad global del truncamiento de reservas            | Runtime         | Qué tan frecuente o severo es el ocultamiento de reservas por subset de `20` en otros locales, datasets, zonas horarias y entornos | Validación runtime adicional fuera del caso local observado; no inferible solo desde `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:93`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:165`, `functions/api/src/routes/reservations.ts:184`, `functions/api/src/routes/reservations.ts:185` | Requiere validación         |
| MVP-MAT-59 | Comportamiento runtime local observado del export CSV    | Runtime         | Si el export funciona desde reservas y orders, qué headers devuelve la red, qué filename final usa la descarga y si el `400` por rango inválido es visible en UI | Validación runtime local observada sobre `GET /panel/exports/reservations-clients.csv?from=2026-02-27&to=2026-02-27` desde reservas y `GET /panel/exports/reservations-clients.csv?from=2026-02-22&to=2026-02-22` desde orders, con `200`, headers de red `Content-Type`, `Content-Disposition`, `Cache-Control`, filename final descargado `tairet_reservas_clientes_<from>_a_<to>.csv` y caso inválido `400` visible en UI | Confirmado por runtime local observado |
| MVP-MAT-60 | Export CSV fuera del runtime local observado             | Runtime         | Si el comportamiento del export cambia en otros navegadores/entornos, si el helper puede leer `Content-Disposition` en otros despliegues y cómo responde ante `500` o datasets grandes | Validación runtime adicional fuera del entorno local observado; no inferible solo desde `apps/web-next/lib/panelExport.ts:57`, `apps/web-next/lib/panelExport.ts:77`, `functions/api/src/routes/panel.ts:1773`, `functions/api/src/routes/panel.ts:1810`, `functions/api/src/routes/panel.ts:1896`, `functions/api/src/routes/panel.ts:1916` | Requiere validación         |
| MVP-MAT-61 | Acceso base al bloque de check-in en runtime local observado | Runtime     | Si `/panel/checkin` carga correctamente para un local `club` con rol permitido y expone la sección `Token Manual` sin bloqueo visible | Validación runtime local observada con usuario `staff` de `Dlirio`, pantalla `Check-in en Puerta` y sección `Token Manual` visibles en `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:874` | Confirmado por runtime local observado |
| MVP-MAT-62 | Residual menor del check-in tras cierre de Fase A        | Runtime         | Si `scanner + expired` se observa directamente en una corrida scanner, sin depender solo de la cobertura manual previa | Validación runtime adicional en scanner sobre un caso de ventana vencida; en esta consolidación la rama `expired` quedó confirmada por modo manual y `not_yet_valid` por scanner, pero no `scanner + expired` de forma directa | Requiere validación         |
| MVP-MAT-63 | Cierre de Fase A del check-in por cobertura combinada    | Runtime         | Si la cobertura combinada de modo manual + scanner ya reduce suficientemente la incertidumbre operativa del wiring principal | Consolidación de hallazgos runtime locales observados: manual (`invalid_token`, `already_used`, `forbidden`, `window_invalid/expired`) + scanner (`success`, `not_yet_valid`, `already_used`, `otro local`) | Confirmado por runtime local observado |
| MVP-MAT-64 | Slice `F5A-1 CODE 01` date-scoped sin romper contrato legacy | Código     | Que la página de reservas usa helper nuevo date-scoped, que `GET /locals/:id/reservations` acepta `date` opcional y que el helper legacy sigue intacto para lineup | Lectura estática en `functions/api/src/routes/reservations.ts:250`, `functions/api/src/routes/reservations.ts:282`, `functions/api/src/routes/reservations.ts:289`, `apps/web-next/lib/reservations.ts:54`, `apps/web-next/lib/reservations.ts:60`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:8`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:92`, `apps/web-next/components/panel/views/lineup/LineupCalendarView.tsx:459` | Confirmado por código       |
| MVP-MAT-65 | Mitigación runtime manual observada del bug de reservas  | Runtime         | Si el slice date-scoped evita el ocultamiento en el caso manual observado y preserva el contexto del día seleccionado en acciones visibles | Validación manual observada en `date=2026-01-28`, con aparición de las `2` reservas reales del día, una `confirmed` y otra `en_revision` / pendiente, `refresh` preservando fecha, `cancel` preservando contexto del día y guardado de `table_note` sin perder el día seleccionado | Confirmado por runtime manual observado |

---

## 4) Bloque de gobierno documental

| ID         | Tema                     | Fuente primaria | Qué validar                                   | Método                                                                 | Estado                      |
| ---------- | ------------------------ | --------------- | --------------------------------------------- | ---------------------------------------------------------------------- | --------------------------- |
| MVP-DOC-01 | Ruta documental canónica | Input humano    | Confirmar carpeta canónica para documentos v1 | Decisión explícita del usuario: usar `docs/audits/` como ruta canónica | Confirmado por input humano |

---

## 5) Gates previos obligatorios antes de CODE

* [ ] **Gate G1 (Código):** todas las filas marcadas como “Confirmado por código” deben tener evidencia trazable por archivo/línea.
* [ ] **Gate G2 (Runtime crítico por bloque):** deben quedar validados en runtime, **antes de CODE del bloque correspondiente**, los temas `MVP-MAT-08`, `MVP-MAT-12`, `MVP-MAT-23` y `MVP-MAT-28`.
* [ ] **Gate G3 (Negocio):** debe mantenerse documentada la vigencia del riesgo aceptado para `/public/orders?email`.
* [ ] **Gate G4 (Docs):** la ruta documental canónica debe permanecer consistente en todos los docs v1 (`docs/audits/`).
* [ ] **Gate G5 (No-breaking):** debe existir checklist explícito de preservación para `MisEntradas`, reservas panel, check-in, export CSV y auth panel antes de tocar cualquier bloque sensible.

---

## 6) Input humano estrictamente permitido

Solo se acepta input humano para:

1. **Negocio**

   * riesgo aceptado temporal del endpoint público `/public/orders?email`
   * vigencia temporal de esa aceptación

2. **Comportamiento esperado**

   * qué significa “logout correcto”
   * qué se considera regresión UX visible en flujos críticos

3. **Gobierno documental**

   * ruta canónica de los docs v1 (`docs/audits/`)

4. **Priorización operativa**

   * orden de ejecución de ASK/CODE una vez cerrada la capa documental

Todo lo demás debe salir de:

* código, o
* runtime verificable

---

## 7) Bloques que necesitan extracción adicional desde código

1. **Campos exactos consumidos por B2C desde órdenes públicas**

   * hoy está confirmado `checkin_token`
   * falta freeze completo del payload mínimo realmente usado por `MisEntradas`

2. **Contrato actual de reservas en panel**

   * ruta exacta consumida
   * shape de respuesta
   * filtros
   * búsqueda/edición
   * dependencias con backend

3. **Residual menor del check-in tras cierre de Fase A**

   * `scanner + expired` no observado directamente en esta corrida

4. **Residual técnico/documental del popup de mapa**

   * trazabilidad completa de origen/sanitización hasta `setHTML(...)`
   * confirmación adicional solo si aparece evidencia nueva de comportamiento anómalo

5. **Cobertura exacta de rutas protegidas por auth panel**

   * mapa de endpoints críticos y middleware aplicado

6. **Validación adicional del bloque export CSV**

   * comportamiento ante `500`
   * lectura efectiva de `Content-Disposition` en otros entornos/navegadores
   * consistencia con datasets grandes y límites operativos

7. **Validación adicional del bloque RLS**

   * reconciliación entre `schema.sql`, migraciones observadas y runtime
   * validación por actor/credencial de la semántica efectiva de acceso
   * separación entre cobertura observable, drift documental e impacto real

---

## 8) Siguiente paso recomendado

1. Ejecutar una **ASK de extracción contractual** (sin implementación) solo para los bloques que todavía dependen de cierre adicional desde código:

   * payload mínimo de órdenes públicas consumido por B2C
   * contrato actual de reservas panel
   * cobertura exacta de rutas protegidas
2. Ejecutar una **ASK/runtime mínima** solo para los temas que no pueden resolverse por código:

   * severidad global del truncamiento de reservas (`MVP-MAT-58`)
   * comportamiento de logout fuera del runtime local observado (`MVP-MAT-57`)
   * comportamiento del export fuera del runtime local observado (`MVP-MAT-60`, `MVP-MAT-45`)
   * efecto operativo real de RLS (`MVP-MAT-28`)
   * semántica efectiva de `SUPABASE_SERVICE_ROLE` y esquema real (`MVP-MAT-52`, `MVP-MAT-53`, `MVP-MAT-56`)

3. Mantener esta matriz como referencia obligatoria antes de:

   * abrir nuevos ASK sensibles
   * redactar prompts CODE
   * tocar contratos o flujos críticos

4. Reemitir esta matriz en una siguiente versión solo cuando cambie uno de estos estados:

   * una fila “Requiere validación” pase a “Confirmado por código”
   * una fila “Requiere validación” pase a “Confirmado por runtime”
   * cambie una decisión explícita de negocio o gobierno documental

---

## 9) Regla de uso de este documento

Este documento debe usarse antes de cualquier fase CODE para verificar:

* qué ya está suficientemente demostrado
* qué todavía depende de extracción adicional
* qué necesita runtime real
* qué sí puede decidirse por input humano
* qué no debe asumirse

Este documento no reemplaza:

* `CONTRATOS_CONGELADOS_V1.md`
* `BASELINE_FUNCIONAL_V1.md`

Los complementa.
