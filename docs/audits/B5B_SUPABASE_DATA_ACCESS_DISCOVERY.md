# B5B_SUPABASE_DATA_ACCESS_DISCOVERY

## 1. Estado del documento

| Campo | Valor |
| --- | --- |
| Fecha | 2026-04-25 |
| Owner | `nosotros` |
| Estado | Discovery finalizado |
| Alcance del corte | `free_pass only` |
| Estado general | `B5b` no cerrado; cerrable por bloques |

### 1.1 Runtime validation checkpoint — `B5b-0`

| Campo | Valor |
| --- | --- |
| Fecha de registro | 2026-04-26 |
| Estado | Validacion runtime ejecutada parcialmente contra Supabase real |
| Alcance | RLS, force RLS, policies, schema/columnas, RPC/functions, roles y grants visibles |
| Resultado operativo | Evidencia suficiente para repriorizar `B5b`; no cierra `B5b` completo |

Resultados runtime confirmados:

- `service_role` tiene `rolbypassrls=true`; `anon` y `authenticated` tienen `rolbypassrls=false`.
- `orders`, `locals`, `reservations`, `panel_users`, `payment_events`, `promos`, `reviews`, `events_public`, `profile_views` y `whatsapp_clicks` tienen RLS enabled y `force_rls=false`.
- `local_daily_ops`, `ticket_types` y `table_types` tienen RLS disabled y `force_rls=false`.
- `events_public`, `profile_views` y `whatsapp_clicks` mantienen policies backend-only con `qual=false` / `with_check=false` para `anon` y `authenticated`.
- `promos` y `reviews` mantienen lectura backend-only con `qual=false`.
- `locals` mantiene `locals_select_public` con `qual=true`.
- `orders` mantiene `orders_select_by_local` con `qual=true` y `orders_insert_by_local` con `with_check=true`.
- `reservations` mantiene `reservations_select_by_local` con `qual=true` y `reservations_insert_public` con `with_check=true`.
- `local_daily_ops` conserva policies `SELECT` / `INSERT` / `UPDATE` abiertas con `true`, pero RLS esta apagado.
- `panel_users` y `payment_events` tienen RLS enabled, pero el resultado de `pg_policies` no mostro policies para esas tablas.
- `orders.customer_email_lower`, `orders.items`, `orders.valid_from`, `orders.valid_to`, `orders.valid_window_key`, `orders.is_window_legacy` y `orders.intended_date` existen en runtime.
- `ticket_types`, `table_types`, `reviews`, `panel_users`, `payment_events`, `local_daily_ops`, `locals` y `orders` existen en runtime.
- Existen las RPC `get_active_night_window(base_now timestamptz)`, `get_night_window(intended_date date)` y `get_weekend_window(selection text, base_now timestamptz)`.

Cautelas:

- El resultado de grants recibido esta parcialmente truncado y no confirma de forma completa todas las tablas del set.
- Aun con esa cautela, hay evidencia suficiente para repriorizar por exposicion directa en `locals`, `orders` y `local_daily_ops`, y para confirmar que `ticket_types` / `table_types` siguen sin RLS runtime.
- Este checkpoint no implementa mitigaciones, no toca SQL y no cierra `B5b`.

Nueva prioridad recomendada:

- primero, contencion focalizada de exposicion directa de datos en `local_daily_ops`, `orders` y `locals`;
- en paralelo o inmediatamente despues, confirmar alcance sobre `reservations`, `ticket_types` y `table_types`;
- luego, decision de blast radius de `SUPABASE_SERVICE_ROLE`;
- despues, cleanup de drift SQL/env;
- `/payments/callback` queda condicionado al alcance real de pagos;
- hardening RLS remanente queda posterior y por slices, no como una sola tanda.

### 1.2 Remediation checkpoint — `local_daily_ops`

| Campo | Valor |
| --- | --- |
| Fecha de registro | 2026-04-25 |
| Estado | Primer slice de contencion de exposicion directa aplicado y validado en Supabase live |
| Recurso | `public.local_daily_ops` |
| Migracion versionada | `infra/sql/migrations/019_harden_local_daily_ops_data_api.sql` |

Resultado confirmado:

- antes de la remediacion, `public.local_daily_ops` tenia RLS off, policies abiertas `local_daily_ops_insert_by_local`, `local_daily_ops_select_by_local` y `local_daily_ops_update_by_local`, y grants amplios para `anon` / `authenticated`;
- la remediacion live dejo RLS on, elimino esas policies y removio grants de `anon` / `authenticated`;
- post-check runtime: `rls_enabled=true`, `force_rls=false`, `pg_policies` sin filas para la tabla y grants `anon` / `authenticated` en 0 filas;
- QA live aprobado: `GET /public/locals`, `GET /public/locals/by-slug/dlirio`, `POST /orders` free pass, QR/email, `POST /reservations`, `GET /panel/calendar/month`, `GET /panel/calendar/day` y `PATCH /panel/calendar/day`;
- el backend sigue operando por `SUPABASE_SERVICE_ROLE`; este checkpoint reduce exposicion directa por Data API, no reduce todavia el blast radius del service role;
- tras este primer slice, `B5b` seguia abierto para `orders`, `locals`, `reservations`, `ticket_types` y `table_types`.

### 1.3 Remediation checkpoint — `orders`

| Campo | Valor |
| --- | --- |
| Fecha de registro | 2026-04-26 |
| Estado | Segundo slice de contencion de exposicion directa aplicado y validado en Supabase live |
| Recurso | `public.orders` |
| Migracion versionada | `infra/sql/migrations/020_harden_orders_data_api.sql` |

Resultado confirmado:

- antes de la remediacion, `public.orders` tenia RLS on, policies publicas abiertas `orders_insert_by_local` y `orders_select_by_local`, y grants amplios para `anon` / `authenticated`;
- la remediacion live mantuvo RLS on, elimino esas policies y removio grants de `anon` / `authenticated`;
- post-check runtime: `rls_enabled=true`, `force_rls=false`, `pg_policies` sin filas para la tabla y grants `anon` / `authenticated` en 0 filas;
- QA live aprobado: `POST /orders` free pass, orden creada, QR generado, email recibido, `GET /public/orders?email=...`, `GET /orders/:id`, `GET /panel/orders/summary`, `GET /panel/orders/search`, `PATCH /panel/checkin/:token`, `GET /activity`, `GET /metrics/summary`, `GET /panel/calendar/month` y `GET /panel/calendar/day`;
- los campos de ventana `intended_date`, `valid_from`, `valid_to` y `valid_window_key` siguen devolviendose correctamente;
- los endpoints publicos de ordenes se mantienen temporalmente y quedan como decision posterior; este checkpoint cierra la exposicion directa de la tabla cruda por Data API, no el diseno de esos endpoints;
- el backend sigue operando por `SUPABASE_SERVICE_ROLE`; este checkpoint reduce exposicion directa por Data API, no reduce todavia el blast radius del service role;
- `B5b` sigue abierto para `locals`, `reservations`, `ticket_types`, `table_types`, endpoints publicos de ordenes, blast radius de `SUPABASE_SERVICE_ROLE` y drift SQL/env.

Este documento formaliza el discovery final de `B5b — Supabase, datos y políticas`.

No reabre `B5a`. Los checkpoints de remediacion registran cambios ya aplicados/versionados; este documento no cambia rutas, contratos ni configuracion.

## 2. Objetivo del discovery

El objetivo fue mapear el acceso efectivo a datos en Tairet con foco en:

- uso de `SUPABASE_SERVICE_ROLE`;
- clientes Supabase privilegiados o públicos;
- RLS, policies y drift SQL;
- lookups públicos;
- tablas críticas y blast radius;
- casos mixtos donde B5a controla entrada/ruta, pero B5b sigue cubriendo acceso efectivo a datos.

## 3. Alcance exacto usado para B5b

`B5b` cubre Supabase, datos, policies, RLS, credenciales de datos, drift SQL/env y blast radius por tabla/flujo.

La separación aplicada fue:

- `B5a`: quién entra, qué ruta puede ejecutar, qué rol se exige y qué tenant puede tocar.
- `B5b`: qué datos puede leer o escribir realmente una key, cliente, policy, endpoint o helper.
- `Mixto`: el endpoint tiene enforcement de aplicación, pero debajo opera sobre datos sensibles con `SUPABASE_SERVICE_ROLE` o queries de blast radius relevante.

Este documento consume como ya cerrados:

- discovery documental de `B5a`;
- `B5a-1 Role Split Explícito`;
- `B5a-2 Shell Auth Gating`;
- decisión vigente de diferir `B5a-3`;
- precheck de `RLS ON public.panel_users` y `RLS ON public.payment_events`.

## 4. Fuentes de verdad utilizadas

- `docs/production/GO_LIVE_REMEDIATION_PLAN.md`
- `docs/production/PRODUCTION_READINESS_AND_GO_LIVE_CHECKLIST.md`
- `docs/production/B0_GO_LIVE_DECISIONS_AND_OWNERSHIP.md`
- `docs/production/B1_PRODUCTION_TOPOLOGY_AND_ENVS.md`
- `docs/production/B2_DEPLOY_ROLLBACK_AND_MIGRATIONS.md`
- `docs/production/B3_DEMO_MODE_RUNTIME_AND_RISK_ACCEPTANCE.md`
- `docs/production/B6_MINIMUM_OBSERVABILITY_AND_INCIDENT_OPERATION.md`
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`
- `docs/audits/**`
- `infra/sql/**`
- `functions/api/src/services/**`
- `functions/api/src/routes/**`
- `functions/api/src/utils/**`
- `functions/api/src/middlewares/**`
- `apps/web-next/lib/supabase.ts`
- `apps/web-b2c/src/lib/**` solo para confirmar consumidores públicos relevantes.

## 5. Superficie revisada

### 5.1 Clientes Supabase

- Backend: `functions/api/src/services/supabase.ts` crea un cliente global con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE`.
- Panel frontend: `apps/web-next/lib/supabase.ts` usa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` para Supabase Auth.
- No se observó acceso directo de B2C a tablas Supabase; B2C consume API backend.
- Drift env visible: `functions/api/.env.example` usa `SUPABASE_SERVICE_ROLE_KEY`, mientras el código backend exige `SUPABASE_SERVICE_ROLE`.

### 5.2 Helpers/backend relevantes

- `functions/api/src/server.ts`
- `functions/api/src/middlewares/panelAuth.ts`
- `functions/api/src/routes/public.ts`
- `functions/api/src/routes/orders.ts`
- `functions/api/src/routes/reservations.ts`
- `functions/api/src/routes/payments.ts`
- `functions/api/src/routes/panel.ts`
- `functions/api/src/routes/support.ts`
- `functions/api/src/routes/activity.ts`
- `functions/api/src/routes/calendar.ts`
- `functions/api/src/routes/metrics.ts`
- `functions/api/src/routes/panelCatalog.ts`
- `functions/api/src/routes/panelLocal.ts`
- `functions/api/src/routes/promos.ts`
- `functions/api/src/routes/events.ts`
- `functions/api/src/routes/reviews.ts`
- `functions/api/src/services/weekendWindow.ts`
- `functions/api/src/services/payments.ts`
- `functions/api/src/utils/idempotency.ts`

### 5.3 Tablas críticas observadas

- `panel_users`
- `payment_events`
- `orders`
- `reservations`
- `locals`
- `local_daily_ops`
- `ticket_types`
- `table_types`
- `promos`
- `reviews`
- `events_public`
- `whatsapp_clicks`
- `profile_views`

### 5.4 SQL/migraciones/docs revisados

- `infra/sql/schema.sql`
- `infra/sql/rls.sql`
- `infra/sql/README.md`
- `infra/sql/migrations/001_add_order_customer_fields.sql`
- `infra/sql/migrations/006_create_catalog_tables.sql`
- `infra/sql/migrations/010_add_local_daily_ops_tables.sql`
- `infra/sql/migrations/011_add_orders_valid_window.sql`
- `infra/sql/migrations/012_add_orders_intended_date_night_window.sql`
- `infra/sql/migrations/013_create_reviews.sql`
- `infra/sql/migrations/015_reconcile_locals_schema.sql`
- `infra/sql/migrations/016_harden_tracking_rls_backend_only.sql`
- `infra/sql/migrations/017_harden_promos_rls_backend_only.sql`
- `infra/sql/migrations/018_harden_reviews_rls_backend_only.sql`

## 6. Matriz de enforcement / blast radius B5b

| Tabla o recurso principal | Archivo + símbolo/handler/helper | Flujo | Tipo de acceso | Riesgo principal | Estado | Clasificación | Evidencia breve |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Supabase backend global | `functions/api/src/services/supabase.ts` | backend | `service_role` | blast radius transversal / bypass RLS asumido | `Confirmado` | `B5b` | Cliente único con `SUPABASE_SERVICE_ROLE`. |
| Env Supabase backend | `functions/api/.env.example` | deploy/runtime | config | drift `SUPABASE_SERVICE_ROLE_KEY` vs `SUPABASE_SERVICE_ROLE` | `Confirmado` | `B5b` | Example no coincide con nombre exigido por código. |
| `locals`, `promos`, `local_daily_ops` | `functions/api/src/routes/public.ts` — `GET /public/locals` | público | backend privilegiado | exposición pública controlada por API, no por RLS | `Confirmado` | `B5b` | Lee locales, promociones y overrides diarios. |
| `orders` | `functions/api/src/routes/public.ts` — `GET /public/orders` | público | backend privilegiado | lookup público por email, incluye `checkin_token` | `Confirmado` | `B5b` | Devuelve hasta 50 órdenes por email normalizado. |
| `orders` | `functions/api/src/routes/orders.ts` — `GET /orders/:id` | público | backend privilegiado | lookup público por UUID con `select("*")` | `Confirmado` | `B5b` | Devuelve la fila completa de `orders`. |
| `orders`, `locals`, `ticket_types`, `local_daily_ops` | `functions/api/src/routes/orders.ts` — `POST /orders` | público | backend privilegiado | escritura pública de orden + validación dependiente de datos | `Confirmado` | `B5b` | Inserta en `orders` y consulta local/catálogo/disponibilidad. |
| `reservations`, `locals`, `local_daily_ops` | `functions/api/src/routes/reservations.ts` — `POST /reservations` | público | backend privilegiado | escritura pública de PII de reservas | `Confirmado` | `B5b` | Inserta reserva pública por diseño. |
| `payment_events`, `orders` | `functions/api/src/routes/payments.ts` — `POST /payments/callback` | callback | backend privilegiado | callback público modifica estado de pago; autenticidad no cerrada | `Confirmado` | `B5b` | Inserta `payment_events` y actualiza `orders`. |
| `payment_events` | `functions/api/src/services/payments.ts` / `functions/api/src/utils/idempotency.ts` | backend/helper | backend privilegiado | idempotencia de pagos dependiente de tabla crítica | `Parcial` | `B5b` | Helpers existen; parte del servicio conserva TODOs. |
| `panel_users`, `locals` | `functions/api/src/middlewares/panelAuth.ts` / `GET /panel/me` | panel | backend privilegiado | identidad/tenant dependen de tabla crítica con service role | `Confirmado` | `Mixto` | B5a valida entrada; B5b cubre acceso efectivo a `panel_users`. |
| `panel_users` | `functions/api/src/routes/support.ts` — `GET /panel/support/access` | panel/support | backend privilegiado | listado de accesos por local | `Confirmado` | `Mixto` | Owner-only en B5a; datos `panel_users` en B5b. |
| `reservations`, `orders` | `functions/api/src/routes/panel.ts` — exports CSV/XLSX | panel/export | backend privilegiado | export de PII y datos transaccionales | `Confirmado` | `Mixto` | Consulta reservas u órdenes por local. |
| `orders` | `functions/api/src/routes/panel.ts` — check-in / orders search / summary | panel/check-in | backend privilegiado | acceso físico, tokens y estados transaccionales | `Confirmado` | `Mixto` | B5a protege ruta; B5b cubre blast radius de `orders`. |
| `orders`, `reservations`, `payment_events`, tracking | `functions/api/src/routes/activity.ts` — `GET /activity` | panel | backend privilegiado | agregación amplia de datos operativos | `Confirmado` | `Mixto` | Lee varias fuentes, incluyendo `payment_events`. |
| `local_daily_ops`, `orders`, `reservations`, `events_public` | `functions/api/src/routes/calendar.ts` — calendar month/day/update | panel | backend privilegiado | calendario operativo cruza varias tablas críticas | `Confirmado` | `Mixto` | Lee mes/día y escribe `local_daily_ops`. |
| `ticket_types`, `table_types`, `orders` | `functions/api/src/routes/panelCatalog.ts` | panel / catálogo público | backend privilegiado | catálogo cruza público, panel y compra | `Confirmado` | `B5b` | Tablas creadas por migración `006`; no aparecen en `rls.sql`. |
| `locals`, storage `local-gallery` | `functions/api/src/routes/panelLocal.ts` | panel/profile | backend privilegiado / storage | perfil público y media con signed upload | `Confirmado` | `Mixto` | Lee/actualiza `locals`, genera signed upload y borra storage. |
| `events_public`, `whatsapp_clicks`, `profile_views` | `functions/api/src/routes/events.ts` | público | backend privilegiado | tracking público acepta writes vía API | `Confirmado` | `B5b` | RLS backend-only protege SQL directo, no el endpoint público. |
| `reviews` | `functions/api/src/routes/reviews.ts` | público | backend privilegiado | reviews públicas con anti-abuso app-level | `Confirmado` | `B5b` | API pública sigue leyendo/escribiendo vía backend. |
| RPC SQL `get_*_window` | `functions/api/src/services/weekendWindow.ts` | backend | `service_role` RPC | dependencia de funciones SQL desplegadas | `Requiere validación` | `B5b` | Repo llama RPC; estado real de funciones requiere runtime. |
| RLS critical tables | `infra/sql/rls.sql` | SQL | policies | policies permisivas `USING (true)` en tablas críticas | `Parcial` | `B5b` | `orders`, `reservations`, `local_daily_ops` siguen con TODO/permisivas en repo. |
| Tracking/promos/reviews RLS | `infra/sql/migrations/016_harden_tracking_rls_backend_only.sql`, `017`, `018` | SQL | policies | slices endurecidas, no cierre general | `Confirmado` | `B5b` | Docs/audits validan solo tracking, `promos` y `reviews`. |
| Drift schema/migrations/runtime | `infra/sql/schema.sql` + migraciones | SQL/runtime | drift | baseline no representa todo runtime | `Requiere validación` | `B5b` | Catálogo, reviews y columnas de `orders` dependen de migraciones; producción real no se infiere. |

## 7. Hallazgos confirmados de B5b

- El backend usa un cliente global con `SUPABASE_SERVICE_ROLE`; por evidencia documental y de código debe asumirse bypass de RLS para rutas backend.
- Hay lookups públicos de datos sensibles: `GET /public/orders?email=...` y `GET /orders/:id`.
- `GET /orders/:id` usa `select("*")` sobre `orders` sin auth visible.
- El flujo `free_pass only` igualmente toca `orders`, `locals`, `local_daily_ops` y potencialmente `ticket_types`.
- `POST /reservations` permite escritura pública de PII de reservas por diseño.
- `/payments/callback` inserta `payment_events` y puede actualizar `orders`; la autenticidad del proveedor no queda cerrada por repo.
- RLS hardening está confirmado solo para slices acotadas: tracking público, `promos` y `reviews`.
- `orders`, `reservations`, `panel_users`, `payment_events`, `locals`, `local_daily_ops`, `ticket_types` y `table_types` siguen fuera del rollout RLS validado según `docs/audits/**`.

## 8. Hallazgos parciales o que requieren validación

- `B5b-0` ya valida materialmente schema, RLS, policies principales, RPC y roles para tomar decisiones, pero no cierra `B5b`.
- El resultado de grants recibido esta parcialmente truncado; no debe leerse como auditoria completa de grants para todas las tablas.
- Semántica efectiva de service role frente a RLS queda confirmada a nivel de rol (`service_role.rolbypassrls=true`), pero sigue requiriendo validación fina por request path si se reduce blast radius.
- Exposición productiva real de `GET /orders/:id` y `GET /public/orders?email=...` debe confirmarse contra host desplegado y decisión de producto.
- `customer_email_lower` existe en runtime, pero el drift de schema/migraciones sigue documentado como deuda de reconciliacion.
- `SUPABASE_SERVICE_ROLE_KEY` vs `SUPABASE_SERVICE_ROLE` debe cerrarse como drift operativo de env.
- Paid flows/callback quedan secundarios para `free_pass only`, pero no cerrados como seguridad de datos.

## 9. Posibles bloqueantes reales de go-live dentro de B5b

La evidencia runtime confirma que `B5b` no debe cerrarse sin mitigación o aceptación formal. Quedan candidatos reales del corte:

- `GET /orders/:id` público con `select("*")` sobre `orders`, si la ruta está accesible en producción.
- `GET /public/orders?email=...`, riesgo residual conocido que debe quedar aceptado explícitamente si se mantiene.
- exposición directa a nivel tabla/Data API sobre `local_daily_ops` por RLS apagado y sobre `orders` / `locals` por policies públicas abiertas.
- `ticket_types` y `table_types` con RLS apagado en runtime.
- `/payments/callback`, si pagos reales quedan activos fuera de `free_pass only`.
- Modelo backend con `SUPABASE_SERVICE_ROLE`, si no existe aceptación formal del blast radius o plan posterior por bloques.

## 10. Casos mixtos que deben mantenerse separados de B5a

- `/panel/me` y `panelAuth`: B5a cubre autenticación/autorización; B5b cubre dependencia de `panel_users` vía service role.
- `/panel/support/access`: B5a cubre owner-only; B5b cubre lectura efectiva de usuarios panel.
- Check-in, orders search/summary/export y reservations export: B5a cubre role/tenant; B5b cubre blast radius de `orders` y `reservations`.
- Activity, metrics y calendar: B5a controla entrada; B5b cubre agregación de varias tablas críticas bajo service role.
- Demo/live no reabre B5b salvo que el runtime demo provoque llamadas a datos reales; no se observó evidencia nueva que cambie `B3` o `B5a-3`.

## 11. Veredicto

Entra realmente en `B5b`:

- service role y blast radius backend;
- RLS/policies y drift SQL;
- lookup público de órdenes;
- callback de pagos y `payment_events`;
- acceso efectivo a tablas críticas desde endpoints públicos y panel protegidos;
- estado real desplegado de Supabase.

Queda fuera:

- `panelAuth`, `requireRole`, shell gating, redirects/login, role split y demo runtime como control de acceso frontend, salvo bordes mixtos señalados.

`B5b` no está cerrado. Parece cerrable por bloques, no como un único fix. Después de `B5b-0`, la parte más importante para este corte es contener exposición directa de datos en `local_daily_ops`, `orders` y `locals`, confirmar el alcance de `reservations`, `ticket_types` y `table_types`, y luego aceptar o reducir el modelo `SUPABASE_SERVICE_ROLE`.

## 12. Backlog mínimo posterior

- `B5b-1`: contencion focalizada de exposicion directa de datos en `local_daily_ops`, `orders` y `locals`, con confirmacion de alcance sobre `reservations`, `ticket_types` y `table_types`.
- `B5b-2`: matriz corta de aceptación/mitigación del modelo `SUPABASE_SERVICE_ROLE` por flujo crítico.
- `B5b-3`: reconciliar drift SQL/env: `schema.sql`, migraciones, `customer_email_lower`, `ticket_types`, `table_types`, `reviews`, `SUPABASE_SERVICE_ROLE`.
- `B5b-4`: cerrar autenticidad y exposición de `/payments/callback` si pagos reales entran en scope.
- `B5b-5`: hardening RLS remanente por slices, no como una sola tanda.

## 13. Relación con otros documentos / siguientes pasos

- Este documento complementa `docs/audits/B5A_APPLICATION_ACCESS_DISCOVERY.md`; no lo reemplaza ni lo reabre.
- `docs/security/SECURITY_AND_HARDENING_STATUS.md` debe referenciar este discovery como fuente del estado B5b.
- `docs/production/GO_LIVE_REMEDIATION_PLAN.md` debe mantener `B5b` como bloque pendiente de mitigación o aceptación formal.
- `B7` no debería tratar `B5b` como cerrado hasta que los riesgos de datos estén mitigados o aceptados con owner.

## 14. Cierre documental

Este documento deja trazabilidad suficiente para planificar la remediación B5b posterior sin reejecutar el discovery.

No implementa fixes. No cambia SQL. No cambia rutas. No cambia configuración. No modifica la separación vigente entre `B5a` y `B5b`.
