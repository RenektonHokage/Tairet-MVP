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
| MVP-MAT-05A | Despublicación temporal de `MisEntradas` en pre-relanzamiento | Mixto      | Que `/mis-entradas` ya no está montada en el routing público actual, que se quitaron los accesos visibles desktop/mobile y el CTA post-compra, y que el archivo base se preserva para futura reintroducción con login/cuenta | Lectura estática en `apps/web-b2c/src/App.tsx:103`, `apps/web-b2c/src/components/layout/Navbar.tsx:128`, `apps/web-b2c/src/components/layout/BottomNavbar.tsx:17`, `apps/web-b2c/src/components/shared/CheckoutBase.tsx:415`, `apps/web-b2c/src/pages/MisEntradas.tsx:1`, más validación manual visual final PASS del ajuste de navegación | Confirmado por código + runtime manual observado |
| MVP-MAT-05B | Reclasificación posterior del residual `/public/orders?email` + `checkin_token` | Mixto | Que, tras la despublicación temporal de `MisEntradas`, el lookup público preservado y `checkin_token` ya no bloquean el cierre de `F4` y quedan ligados a futura reintroducción con login/cuenta o eventual reexposición real del bloque | Consolidación de `MVP-MAT-04`, `MVP-MAT-05`, `MVP-MAT-05A` y del estado vigente en `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md` / `docs/audits/SMOKE_TESTS_V1.md`, con base en `functions/api/src/routes/public.ts:289`, `functions/api/src/routes/public.ts:296`, `apps/web-b2c/src/lib/orders.ts:22`, `apps/web-b2c/src/pages/MisEntradas.tsx:43`, `apps/web-b2c/src/App.tsx:103` | Residual posterior / no bloqueante para cierre de `F4` |
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
| MVP-MAT-22 | Logout panel observado desde código                      | Código          | Que en `SidebarUserInfo` el logout usa `supabase.auth.signOut({ scope: "local" })`, limpia `panel_token` residual y redirige con `replace("/panel/login")` | Lectura estática en `apps/web-next/components/panel/SidebarUserInfo.tsx:14`, `apps/web-next/components/panel/SidebarUserInfo.tsx:15`, `apps/web-next/components/panel/SidebarUserInfo.tsx:21`, `apps/web-next/components/panel/SidebarUserInfo.tsx:22` | Confirmado por código       |
| MVP-MAT-23 | Efectividad real del logout en runtime manual observado   | Runtime         | Si en el runtime manual observado el logout invalida realmente la sesión del panel y alinea el estado visual con el acceso efectivo | Validación runtime manual sobre `login → logout → back → refresh /panel → refresh /panel/reservations`, con base en `apps/web-next/app/panel/(authenticated)/page.tsx:307`, `apps/web-next/lib/api.ts:22`, `functions/api/src/middlewares/panelAuth.ts:86` | Confirmado por runtime manual observado      |
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
| MVP-MAT-44 | Suficiencia operativa de timeout / retry en check-in     | Runtime         | Si `5500ms` + `1` retry + `450ms` base son suficientes en operación real                                | Validación runtime usando la configuración observable en `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:57`, `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:58`, `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:59` | Requiere validación (residual posterior / no bloqueante para cierre de `F5B`) |
| MVP-MAT-45 | Cobertura real del export con datasets grandes           | Runtime         | Si el export mantiene consistencia con límites, zonas horarias y volumen alto                           | Validación runtime sobre `functions/api/src/routes/panel.ts:1808`, `functions/api/src/routes/panel.ts:1914`, `functions/api/src/routes/panel.ts:1941` y consumidores FE confirmados         | Requiere validación (residual posterior / no bloqueante para cierre de `F5B`) |
| MVP-MAT-46 | Alcance contractual de `GET /panel/checkins`             | Input humano    | Si `GET /panel/checkins` entra o no en el mismo contrato visible del bloque check-in/export             | Decisión documental/producto con base en la ruta relacionada observada en `functions/api/src/routes/panel.ts:1460`                                                                             | Requiere validación (residual posterior / no bloqueante para cierre de `F5B`) |
| MVP-MAT-47 | Contrato compartido de export entre reservas y órdenes   | Input humano    | Si el export debe tratarse como contrato compartido más allá de los dos consumidores ya confirmados     | Decisión documental/producto con base en `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:151` y `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx:265`   | Requiere validación (residual posterior / no bloqueante para cierre de `F5B`) |
| MVP-MAT-48 | Tablas relevantes observadas para F7                     | Código          | Qué tablas aparecen en `schema.sql` y qué tablas/columnas usadas por runtime quedan fuera del baseline SQL observado | Lectura estática en `infra/sql/schema.sql:9`, `infra/sql/schema.sql:53`, `infra/sql/schema.sql:129`, `infra/sql/migrations/006_create_catalog_tables.sql:7`, `infra/sql/migrations/006_create_catalog_tables.sql:26`, `infra/sql/migrations/011_add_orders_valid_window.sql:8`, `infra/sql/migrations/012_add_orders_intended_date_night_window.sql:9`, `functions/api/src/routes/public.ts:297` | Confirmado por código       |
| MVP-MAT-49 | Policies RLS observables por tabla en el archivo revisado | Código        | Qué tablas tienen `ENABLE ROW LEVEL SECURITY` y qué operaciones muestran policies observables           | Lectura estática en `infra/sql/rls.sql:5`, `infra/sql/rls.sql:12`, `infra/sql/rls.sql:19`, `infra/sql/rls.sql:24`, `infra/sql/rls.sql:28`, `infra/sql/rls.sql:33`, `infra/sql/rls.sql:37`, `infra/sql/rls.sql:42`, `infra/sql/rls.sql:46`, `infra/sql/rls.sql:51`, `infra/sql/rls.sql:55`, `infra/sql/rls.sql:60`, `infra/sql/rls.sql:64`, `infra/sql/rls.sql:69`, `infra/sql/rls.sql:73`, `infra/sql/rls.sql:77` | Confirmado por código       |
| MVP-MAT-50 | Camino observable de acceso con `SUPABASE_SERVICE_ROLE` | Código          | Que el backend API usa cliente con `SUPABASE_SERVICE_ROLE` y concentra el acceso a datos observado      | Lectura estática en `functions/api/src/services/supabase.ts:4`, `functions/api/src/services/supabase.ts:12`, `functions/api/src/routes/public.ts:295`, `functions/api/src/routes/orders.ts:218`, `functions/api/src/routes/panel.ts:1369` | Confirmado por código       |
| MVP-MAT-51 | Tablas críticas sin coverage RLS observable en el archivo revisado | Código | Que `panel_users`, `payment_events`, `ticket_types` y `table_types` no muestran coverage RLS observable en el SQL observado del repo | Contraste estático entre `infra/sql/schema.sql:74`, `infra/sql/schema.sql:129`, `infra/sql/migrations/006_create_catalog_tables.sql:7`, `infra/sql/migrations/006_create_catalog_tables.sql:26` y el contenido observable de `infra/sql/rls.sql:5`, `infra/sql/rls.sql:12` | Confirmado por código       |
| MVP-MAT-52 | Alcance exacto por flujo real e implicancias de rollout de `SUPABASE_SERVICE_ROLE` en backend | Runtime | Si la lectura operativa actual del backend con cliente global `SUPABASE_SERVICE_ROLE` se sostiene de forma consistente por request path / credencial efectiva y cómo condiciona el rollout de RLS por tabla/flow | Validación runtime por request path / credencial efectiva; código + entorno ya permiten asumir bypass de RLS en backend, pero no cierran todavía el alcance exacto por flujo real en deploy | Parcialmente confirmado — Requiere validación |
| MVP-MAT-53 | Esquema efectivo real de producción vs SQL observado del repo | Runtime      | Si producción refleja `schema.sql`, migraciones observadas y columnas/tablas usadas por runtime         | Validación runtime o introspección en entorno; no inferible solo desde los archivos del repo                                                                                                  | Requiere validación         |
| MVP-MAT-54 | Impacto operativo real de endurecer policies por tabla crítica | Runtime      | Qué rompe o no rompe por actor/tabla crítica al endurecer RLS                                           | Validación runtime por actor/tabla/operación con smoke controlado sobre `orders`, `reservations`, `locals`, `local_daily_ops`, `panel_users`, `ticket_types` y `table_types`               | Requiere validación         |
| MVP-MAT-55 | Intencionalidad de tablas sin coverage RLS observable    | Input humano    | Si la ausencia observable en el SQL observado del repo es deuda temporal, alcance omitido o modelo intencional | Decisión documental/operativa posterior a reconciliar SQL observado y runtime                                                                                                                | Requiere validación         |
| MVP-MAT-56 | Existencia/uso real de `customer_email_lower` en producción | Runtime      | Si la columna usada por runtime existe y se mantiene operativa en la base real                          | Validación runtime o introspección; `customer_email_lower` no aparece en `infra/sql` observado y sí en `functions/api/src/routes/public.ts:297`, `functions/api/src/routes/panel.ts:1616`   | Requiere validación         |
| MVP-MAT-57 | Logout panel fuera del runtime manual observado           | Runtime         | Si navegación directa a `/panel`, request autenticada posterior y otros entornos/navegadores mantienen el mismo comportamiento correcto tras `F5A-2 CODE 01` | Validación runtime adicional fuera del entorno manual observado; no inferible solo desde `apps/web-next/components/panel/SidebarUserInfo.tsx:15`, `apps/web-next/lib/supabase.ts:31`, `apps/web-next/app/panel/(authenticated)/page.tsx:307` | Requiere validación         |
| MVP-MAT-58 | Severidad global residual del contrato legacy de reservas | Runtime         | Qué tan frecuente o severo es el ocultamiento potencial del modo legacy sin `date` por subset de `20` en otros locales, datasets, zonas horarias y entornos | Validación runtime adicional fuera del caso local observado; no inferible solo desde `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:93`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:165`, `functions/api/src/routes/reservations.ts:184`, `functions/api/src/routes/reservations.ts:185` | Requiere validación (residual posterior / no bloqueante para cierre de `F5A`)         |
| MVP-MAT-59 | Comportamiento runtime local observado del export CSV    | Runtime         | Si el export funciona desde reservas y orders, qué headers devuelve la red, qué filename final usa la descarga y si el `400` por rango inválido es visible en UI | Validación runtime local observada sobre `GET /panel/exports/reservations-clients.csv?from=2026-02-27&to=2026-02-27` desde reservas y `GET /panel/exports/reservations-clients.csv?from=2026-02-22&to=2026-02-22` desde orders, con `200`, headers de red `Content-Type`, `Content-Disposition`, `Cache-Control`, filename final descargado `tairet_reservas_clientes_<from>_a_<to>.csv` y caso inválido `400` visible en UI | Confirmado por runtime local observado |
| MVP-MAT-60 | Export CSV fuera del runtime local observado             | Runtime         | Si el comportamiento del export cambia en otros navegadores/entornos, si el helper puede leer `Content-Disposition` en otros despliegues y cómo responde ante `500` o datasets grandes | Validación runtime adicional fuera del entorno local observado; no inferible solo desde `apps/web-next/lib/panelExport.ts:57`, `apps/web-next/lib/panelExport.ts:77`, `functions/api/src/routes/panel.ts:1773`, `functions/api/src/routes/panel.ts:1810`, `functions/api/src/routes/panel.ts:1896`, `functions/api/src/routes/panel.ts:1916` | Requiere validación (residual posterior / no bloqueante para cierre de `F5B`) |
| MVP-MAT-61 | Acceso base al bloque de check-in en runtime local observado | Runtime     | Si `/panel/checkin` carga correctamente para un local `club` con rol permitido y expone la sección `Token Manual` sin bloqueo visible | Validación runtime local observada con usuario `staff` de `Dlirio`, pantalla `Check-in en Puerta` y sección `Token Manual` visibles en `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:874` | Confirmado por runtime local observado |
| MVP-MAT-62 | Residual menor del check-in tras cierre de Fase A        | Runtime         | Si `scanner + expired` se observa directamente en una corrida scanner, sin depender solo de la cobertura manual previa | Validación runtime adicional en scanner sobre un caso de ventana vencida; en esta consolidación la rama `expired` quedó confirmada por modo manual y `not_yet_valid` por scanner, pero no `scanner + expired` de forma directa | Requiere validación (residual posterior / no bloqueante para cierre de `F5B`) |
| MVP-MAT-63 | Cierre de Fase A del check-in por cobertura combinada    | Runtime         | Si la cobertura combinada de modo manual + scanner ya reduce suficientemente la incertidumbre operativa del wiring principal | Consolidación de hallazgos runtime locales observados: manual (`invalid_token`, `already_used`, `forbidden`, `window_invalid/expired`) + scanner (`success`, `not_yet_valid`, `already_used`, `otro local`) | Confirmado por runtime local observado |
| MVP-MAT-64 | Slice `F5A-1 CODE 01` date-scoped sin romper contrato legacy | Código     | Que la página de reservas usa helper nuevo date-scoped, que `GET /locals/:id/reservations` acepta `date` opcional y que el helper legacy sigue intacto para lineup | Lectura estática en `functions/api/src/routes/reservations.ts:250`, `functions/api/src/routes/reservations.ts:282`, `functions/api/src/routes/reservations.ts:289`, `apps/web-next/lib/reservations.ts:54`, `apps/web-next/lib/reservations.ts:60`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:8`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:92`, `apps/web-next/components/panel/views/lineup/LineupCalendarView.tsx:459` | Confirmado por código       |
| MVP-MAT-65 | Mitigación runtime manual observada del bug de reservas  | Runtime         | Si el slice date-scoped evita el ocultamiento en el caso manual observado y preserva el contexto del día seleccionado en acciones visibles | Validación manual observada en `date=2026-01-28`, con aparición de las `2` reservas reales del día, una `confirmed` y otra `en_revision` / pendiente, `refresh` preservando fecha, `cancel` preservando contexto del día y guardado de `table_note` sin perder el día seleccionado | Confirmado por runtime manual observado |
| MVP-MAT-66 | Extracción estructural del dominio club catalog de `panel.ts` | Código | Que las rutas CRUD de `tickets` y `tables` ya no están inline en `panel.ts`, que el subrouter se monta bajo `/catalog` y que los consumidores frontend siguen apuntando a los mismos endpoints públicos | Lectura estática en `functions/api/src/routes/panel.ts:7`, `functions/api/src/routes/panel.ts:2024`, `functions/api/src/routes/panelCatalog.ts:7`, `functions/api/src/routes/panelCatalog.ts:61`, `functions/api/src/routes/panelCatalog.ts:100`, `functions/api/src/routes/panelCatalog.ts:194`, `functions/api/src/routes/panelCatalog.ts:308`, `functions/api/src/routes/panelCatalog.ts:363`, `functions/api/src/routes/panelCatalog.ts:402`, `functions/api/src/routes/panelCatalog.ts:496`, `functions/api/src/routes/panelCatalog.ts:602`, `apps/web-next/lib/panel.ts:301`, `apps/web-next/lib/panel.ts:325`, `apps/web-next/app/panel/(authenticated)/profile/page.tsx:10`, `apps/web-next/app/panel/(authenticated)/profile/page.tsx:553` | Confirmado por código |
| MVP-MAT-67 | Validación runtime manual observada del club catalog extraído | Runtime | Si el dominio extraído sigue cargando `tickets` y `tables`, permite creación de ticket y no muestra error visible en el uso manual observado | Validación runtime manual observada sobre el flujo de catálogo del panel: carga de `tickets`, carga de `tables`, creación de ticket OK y uso operativo posterior sin error visible; más validación runtime mínima no autenticada (`GET /panel/catalog/tickets` y `GET /panel/catalog/tables` → `401`) | Confirmado por código + runtime manual observado |
| MVP-MAT-68 | Duplicación temporal de `verifyClubOnly` tras `F6 CODE 01` | Código | Si la duplicación de `verifyClubOnly` quedó acotada a `panel.ts` y `panelCatalog.ts` como residual temporal aceptable para no ampliar el slice a `orders/search` y `orders/summary` | Lectura estática en `functions/api/src/routes/panel.ts:277`, `functions/api/src/routes/panel.ts:1641`, `functions/api/src/routes/panel.ts:1685`, `functions/api/src/routes/panelCatalog.ts:13`, `functions/api/src/routes/panelCatalog.ts:71`, `functions/api/src/routes/panelCatalog.ts:373` | Residual temporal aceptable / no bloqueante |
| MVP-MAT-69 | Extracción estructural del dominio local profile + gallery de `panel.ts` | Código | Que `GET/PATCH /panel/local` y `POST/DELETE /panel/local/gallery/*` ya no están inline en `panel.ts`, que el subrouter se monta bajo `/local` y que los consumidores frontend siguen apuntando a los mismos endpoints públicos | Lectura estática en `functions/api/src/routes/panel.ts:7`, `functions/api/src/routes/panel.ts:343`, `functions/api/src/routes/panelLocal.ts:15`, `functions/api/src/routes/panelLocal.ts:118`, `functions/api/src/routes/panelLocal.ts:171`, `functions/api/src/routes/panelLocal.ts:465`, `functions/api/src/routes/panelLocal.ts:553`, `apps/web-next/lib/panel.ts:121`, `apps/web-next/lib/panel.ts:132`, `apps/web-next/lib/panel.ts:158`, `apps/web-next/lib/panel.ts:208`, `apps/web-next/app/panel/(authenticated)/profile/page.tsx:516`, `apps/web-next/app/panel/(authenticated)/profile/page.tsx:882`, `apps/web-next/app/panel/(authenticated)/profile/page.tsx:970`, `apps/web-next/app/panel/(authenticated)/profile/page.tsx:1001` | Confirmado por código |
| MVP-MAT-70 | Validación runtime manual observada del dominio local profile + gallery extraído | Runtime | Si el dominio extraído sigue cargando profile, permite guardar profile, hacer upload de gallery y delete de gallery sin error visible, manteniendo además el borde protegido no autenticado | Validación runtime manual observada sobre el flujo de profile/gallery del panel: profile load PASS, profile save PASS, gallery upload PASS, gallery delete PASS, sin errores visibles; más validación runtime mínima no autenticada (`GET /panel/local` y `POST /panel/local/gallery/signed-upload` → `401`) | Confirmado por código + runtime manual observado |
| MVP-MAT-71 | `GET /panel/me` fuera del slice `F6 CODE 02` | Código | Si `GET /panel/me` quedó fuera del slice como residual estructural aceptable para no ampliar la extracción de local profile + gallery al borde de identidad/sesión panel | Lectura estática en `functions/api/src/routes/panel.ts:302`, `functions/api/src/routes/panel.ts:343`, `functions/api/src/routes/panelLocal.ts:118`, `functions/api/src/routes/panelLocal.ts:171`, `functions/api/src/routes/panelLocal.ts:465`, `functions/api/src/routes/panelLocal.ts:553` | Residual temporal aceptable / no bloqueante |
| MVP-MAT-72 | Reconciliación operativa de superficie SQL relevante para `F7` | Código + migraciones | Si el repo permite reconstruir una superficie SQL efectiva para `F7` a partir del runtime realmente usado, las migraciones observadas y `schema.sql` como baseline parcial | Contraste estático entre `infra/sql/schema.sql`, `infra/sql/migrations/**` y runtime en `functions/api/src/routes/**`: drift confirmado para `ticket_types`, `table_types`, `orders.items`, `orders.valid_from`, `orders.valid_to`, `orders.valid_window_key`, `orders.is_window_legacy` y `orders.intended_date`; `customer_email_lower` sigue fuera del SQL observado del repo | Parcialmente cerrado |
| MVP-MAT-73 | Semántica operativa observable del backend con `SUPABASE_SERVICE_ROLE` | Código + entorno | Si el backend observable usa un cliente global `SUPABASE_SERVICE_ROLE` para operar datos y si el diseño actual de `F7` debe asumir bypass de RLS en backend hasta prueba en contrario por flujo real | Lectura estática en `functions/api/src/services/supabase.ts:4`, `functions/api/src/services/supabase.ts:12`, `functions/api/src/middlewares/panelAuth.ts:86`, `functions/api/src/middlewares/panelAuth.ts:100`, `functions/api/src/routes/public.ts:295`, `functions/api/src/routes/orders.ts:218`, `functions/api/src/routes/panel.ts:535`, `functions/api/src/routes/reservations.ts:179`, `functions/api/src/routes/metrics.ts:59`, `functions/api/src/routes/payments.ts:24`; evidencia real de entorno: `service_role` con `rolbypassrls = true`, `anon` y `authenticated` con `rolbypassrls = false`, `orders` con RLS activa y `ticket_types` / `table_types` sin RLS activa | Parcialmente confirmado |
| MVP-MAT-74 | Matriz operativa por flujo real e implicancias de rollout de `F7` | Código + entorno | Si los flows observables que tocan `orders`, `reservations`, `panel_users`, `payments/callback`, `check-in`, `orders/search`, `orders/summary` y `export` ya pueden clasificarse por criticidad para el rollout de RLS | Lectura estática en `functions/api/src/routes/public.ts`, `functions/api/src/routes/orders.ts`, `functions/api/src/routes/panel.ts`, `functions/api/src/routes/reservations.ts`, `functions/api/src/routes/metrics.ts`, `functions/api/src/routes/payments.ts`, `functions/api/src/middlewares/panelAuth.ts` y evidencia real consolidada sobre `SUPABASE_SERVICE_ROLE`; esos flows quedan como de alta o muy alta criticidad y no deben entrar en el primer CODE de `F7` | Parcialmente confirmado |
| MVP-MAT-75 | Selección congelada del primer bloque de rollout de `F7` | Código + SQL observado + docs operativos | Si ya puede fijarse qué tablas entran en `F7 CODE 01` y cuáles quedan explícitamente fuera del primer rollout | `infra/sql/schema.sql:101`, `infra/sql/schema.sql:110`, `infra/sql/schema.sql:119`, `infra/sql/rls.sql:42`, `infra/sql/rls.sql:46`, `infra/sql/rls.sql:51`, `infra/sql/rls.sql:55`, `infra/sql/rls.sql:60`, `infra/sql/rls.sql:64`, `functions/api/src/routes/events.ts:43`, `functions/api/src/routes/events.ts:99`, `functions/api/src/routes/events.ts:130`, `functions/api/src/routes/metrics.ts:59`, `functions/api/src/routes/metrics.ts:122`, `functions/api/src/routes/metrics.ts:143`, `docs/audits/STATUS.md`, `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md` | Confirmado por código + SQL observado + docs operativos |
| MVP-MAT-76 | Validación post-apply de `F7 CODE 01` sobre tracking público | Código + SQL observado + entorno real | Si el rollout aplicado al bloque `events_public`, `whatsapp_clicks` y `profile_views` quedó efectivamente endurecido en Supabase sin expandirse a otras tablas o flows | `infra/sql/rls.sql:41`, `infra/sql/rls.sql:44`, `infra/sql/rls.sql:49`, `infra/sql/rls.sql:54`, `infra/sql/rls.sql:59`, `infra/sql/rls.sql:64`, `infra/sql/migrations/016_harden_tracking_rls_backend_only.sql:1`, `functions/api/src/routes/events.ts:43`, `functions/api/src/routes/events.ts:99`, `functions/api/src/routes/events.ts:130`, `functions/api/src/routes/metrics.ts:59`, `functions/api/src/routes/metrics.ts:122`, `functions/api/src/routes/metrics.ts:143`, `functions/api/src/routes/activity.ts:63`, `functions/api/src/routes/promos.ts:99`; verificación real post-apply en Supabase: `rls_enabled = true` preservado para las tres tablas, desaparición de las policies permisivas previas y presencia de `events_public_select_backend_only`, `events_public_insert_backend_only`, `whatsapp_clicks_select_backend_only`, `whatsapp_clicks_insert_backend_only`, `profile_views_select_backend_only` y `profile_views_insert_backend_only` con `qual = false` / `with_check = false` para `anon` y `authenticated` | Confirmado por código + runtime/entorno real |
| MVP-MAT-77 | Selección congelada del segundo bloque de rollout de `F7` | Código + SQL observado + docs operativos | Si ya puede fijarse que `promos` entra en `F7 CODE 02` y que cualquier otra tabla o flow queda explícitamente fuera del segundo rollout | `infra/sql/schema.sql:40`, `infra/sql/rls.sql:19`, `infra/sql/migrations/008_add_promos_active_sort.sql:1`, `functions/api/src/routes/public.ts:225`, `functions/api/src/routes/metrics.ts:110`, `functions/api/src/routes/promos.ts:46`, `docs/audits/STATUS.md`, `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md` | Confirmado por código + SQL observado + docs operativos |

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

1. Tratar `F2` como **materialmente y formalmente cerrada** para esta matriz:

   * `MVP-MAT-57` queda como cobertura residual posterior del logout fuera del runtime manual observado
   * `MVP-MAT-58` queda como residual posterior del contrato legacy de reservas sin `date`
   * `MVP-MAT-60` y `MVP-MAT-62` quedan como residuales posteriores de `F5B`
   * `MVP-MAT-28`, `MVP-MAT-52`, `MVP-MAT-53` y `MVP-MAT-56` siguen abiertos, pero corresponden al frente estructural de `F7`, no a `F2`

2. Tratar la reconciliación operativa de superficie SQL de `F7` como **parcialmente cerrada**:

   * `MVP-MAT-48` y `MVP-MAT-72` ya identifican el drift principal entre `schema.sql`, migraciones y runtime
   * `MVP-MAT-27` ya no debe leerse como el primer bloqueo de `F7`; la matriz actor → tabla → operación queda suficientemente madura por código y debe releerse sobre la superficie reconciliada
   * `MVP-MAT-56` sigue abierto como `Requiere validación` para `customer_email_lower`

3. Tratar la semántica backend observable de `F7` como **parcialmente confirmada**:

   * `MVP-MAT-50` y `MVP-MAT-73` ya sostienen por código + entorno que el backend observable usa un cliente global `SUPABASE_SERVICE_ROLE`
   * cualquier diseño del bloque debe asumir bypass de RLS en backend hasta que se demuestre lo contrario por flujo real
   * `MVP-MAT-52` y `MVP-MAT-74` ya no deben leerse como duda sobre si el backend usa o no `SUPABASE_SERVICE_ROLE`, sino como lectura operativa por flujo real y criticidad de rollout sobre la superficie reconciliada

4. El siguiente paso operativo de `F7` pasa a ser:

   * tratar `F7 CODE 01` como validado para tracking público usando `MVP-MAT-52`, `MVP-MAT-73`, `MVP-MAT-74`, `MVP-MAT-75` y `MVP-MAT-76` como base
   * `F7 CODE 01` queda validado únicamente para `events_public`, `whatsapp_clicks` y `profile_views`
   * `orders`, `reservations`, `panel_users`, `payment_events`, `locals`, `local_daily_ops`, `ticket_types`, `table_types` y los flows derivados de alta criticidad quedan fuera del primer rollout
   * el segundo bloque prudente de rollout de `F7` queda congelado en `promos`
   * **`F7 CODE 02` queda habilitado únicamente para `promos`. Cualquier otra tabla o flow queda fuera de scope del segundo rollout.**
   * `orders`, `reservations`, `panel_users`, `payment_events`, `locals`, `local_daily_ops`, `ticket_types`, `table_types` y los flows derivados de alta criticidad (`payments/callback`, `check-in`, `orders/search`, `orders/summary`, `export`, bootstrap auth panel) quedan explícitamente fuera del segundo rollout
   * el siguiente paso ya no es seleccionar el segundo bloque, sino la apertura controlada de `F7 CODE 02` con scope congelado en `promos`

5. Mantener esta matriz como referencia obligatoria antes de:

   * abrir nuevos ASK sensibles
   * redactar prompts CODE
   * tocar contratos o flujos críticos

3. Reemitir esta matriz en una siguiente versión solo cuando cambie uno de estos estados:

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


Nota importante: El backend observable usa hoy un cliente global SUPABASE_SERVICE_ROLE; cualquier diseño de F7 debe asumir bypass de RLS en backend hasta que se demuestre lo contrario por flujo real.




