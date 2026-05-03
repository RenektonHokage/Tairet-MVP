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
- en ese momento, los endpoints publicos de ordenes se mantenian temporalmente y quedaban como decision posterior; este checkpoint cierra la exposicion directa de la tabla cruda por Data API, no el diseno de esos endpoints;
- el backend sigue operando por `SUPABASE_SERVICE_ROLE`; este checkpoint reduce exposicion directa por Data API, no reduce todavia el blast radius del service role;
- en ese momento, `locals`, `reservations` y endpoints publicos de ordenes seguian pendientes; checkpoints posteriores documentan sus cierres;
- `B5b` sigue abierto para `ticket_types`, `table_types`, blast radius de `SUPABASE_SERVICE_ROLE` y drift SQL/env.

### 1.4 Remediation checkpoint — `GET /orders/:id`

| Campo | Valor |
| --- | --- |
| Fecha de registro | 2026-04-26 |
| Estado | Primer mini-slice de Public Orders Endpoint Containment aplicado y validado en produccion |
| Recurso | `GET /orders/:id` |
| Archivo de aplicacion | `functions/api/src/routes/orders.ts` |

Resultado confirmado:

- antes de la remediacion, `GET /orders/:id` era publico, usaba `select("*")` sobre `public.orders` y podia devolver la fila completa de la orden;
- no se encontro consumidor activo real en el repo; solo existia un helper legacy no importado en `apps/web-next/lib/orders.ts`;
- el endpoint ahora responde `410 Gone` con `{ "error": "Order lookup by id is no longer available" }`;
- el handler ya no consulta Supabase y ya no usa `select("*")`;
- typecheck backend quedo OK;
- QA live aprobado: `GET /orders/:id` devuelve `410 Gone`; `POST /orders` free pass, email/QR, `GET /public/orders?email=...`, panel orders/search/summary, check-in, activity, metrics y calendario siguen OK;
- no se tocaron `POST /orders`, `GET /public/orders?email=...`, panel routes, frontend, SQL, migraciones, RLS, grants ni policies;
- en ese momento, `GET /public/orders?email=...` quedaba como riesgo residual separado y decision posterior; el checkpoint `1.5` documenta su cierre posterior;
- en ese momento, `locals` y `reservations` seguian pendientes; checkpoints posteriores documentan sus cierres;
- `B5b` sigue abierto para `ticket_types`, `table_types`, blast radius de `SUPABASE_SERVICE_ROLE`, drift SQL/env y `/payments/callback` si aplica.

### 1.5 Remediation checkpoint — `GET /public/orders?email=...`

| Campo | Valor |
| --- | --- |
| Fecha de registro | 2026-04-26 |
| Estado | Segundo mini-slice de Public Orders Endpoint Containment aplicado y validado en produccion |
| Recurso | `GET /public/orders?email=...` |
| Archivo de aplicacion | `functions/api/src/routes/public.ts` |

Resultado confirmado:

- antes de la remediacion, `GET /public/orders?email=...` era publico, validaba email, consultaba `orders` por `customer_email_lower`, devolvia hasta 50 ordenes y exponia `checkin_token`;
- el unico consumidor visible en repo era `MisEntradas`; esa pagina existe en codigo, pero no esta montada como ruta activa del B2C;
- decision de producto del corte: `Mis Entradas` no es feature activo y queda diferido para futuro con usuarios reales/auth por correo y contrasena;
- el endpoint ahora responde `410 Gone` con `{ "error": "Public order lookup by email is no longer available" }`;
- el handler ya no valida email, no consulta Supabase, no busca por `customer_email_lower`, no devuelve historial y no expone `checkin_token`;
- typecheck backend quedo OK;
- QA live aprobado: `GET /public/orders?email=...` devuelve `410 Gone`; `GET /orders/:id` sigue `410 Gone`; `POST /orders` free pass, email/QR post-compra, panel orders/search/summary, check-in, activity, metrics y calendario siguen OK;
- no se tocaron `POST /orders`, `GET /orders/:id`, panel routes, check-in, activity, metrics, calendar, frontend, SQL, migraciones, RLS, grants ni policies;
- con este checkpoint, los endpoints publicos de lectura de ordenes quedan cerrados para este corte: `GET /orders/:id` -> `410 Gone` y `GET /public/orders?email=...` -> `410 Gone`;
- `POST /orders` sigue activo para `free_pass`;
- en ese momento, `locals` seguia pendiente; el checkpoint `1.6` documenta su cierre posterior;
- en ese momento, `reservations` seguia pendiente; el checkpoint `1.7` documenta su cierre posterior;
- `B5b` sigue abierto para `ticket_types`, `table_types`, blast radius de `SUPABASE_SERVICE_ROLE`, drift SQL/env y `/payments/callback` si aplica.

### 1.6 Remediation checkpoint — `locals`

| Campo | Valor |
| --- | --- |
| Fecha de registro | 2026-04-26 |
| Estado | Siguiente slice de contencion de exposicion directa aplicado y validado en Supabase live |
| Recurso | `public.locals` |
| Migracion versionada | `infra/sql/migrations/021_harden_locals_data_api.sql` |

Resultado confirmado:

- antes de la remediacion, `public.locals` tenia RLS on, policy publica abierta `locals_select_public` y grants amplios para `anon` / `authenticated`;
- la tabla cruda incluia datos publicos legitimos y tambien campos no necesarios para Data API directa, como `email`, `panel_handle`, `created_at` y `updated_at`;
- la remediacion live mantuvo RLS on, elimino `locals_select_public` y removio grants de `anon` / `authenticated`;
- post-check runtime: `rls_enabled=true`, `force_rls=false`, `pg_policies` sin filas para la tabla y grants `anon` / `authenticated` en 0 filas;
- QA live aprobado: `GET /public/locals`, `GET /public/locals/by-slug/dlirio`, `GET /public/locals/by-slug/dlirio/catalog`, home/listados/explorar, perfil publico con mapa/contacto/galeria/horarios/promociones, `POST /orders` free pass, `POST /reservations`, bootstrap panel, `/panel/local`, soporte y edicion de perfil/galeria;
- los endpoints publicos shapeados siguen funcionando; este checkpoint cierra solo la exposicion directa de la tabla cruda `locals` por Data API;
- el backend sigue operando por `SUPABASE_SERVICE_ROLE`; este checkpoint reduce exposicion directa por Data API, no reduce todavia el blast radius del service role;
- en ese momento, `reservations` seguia pendiente; el checkpoint `1.7` documenta su cierre posterior;
- `B5b` sigue abierto para `ticket_types`, `table_types`, blast radius de `SUPABASE_SERVICE_ROLE`, drift SQL/env y `/payments/callback` si aplica.

### 1.7 Remediation checkpoint — `reservations`

| Campo | Valor |
| --- | --- |
| Fecha de registro | 2026-04-26 |
| Estado | Siguiente slice de contencion de exposicion directa aplicado y validado en Supabase live |
| Recurso | `public.reservations` |
| Migracion versionada | `infra/sql/migrations/022_harden_reservations_data_api.sql` |

Resultado confirmado:

- antes de la remediacion, `public.reservations` tenia RLS on, policies publicas abiertas `reservations_insert_public` y `reservations_select_by_local`, y grants amplios para `anon` / `authenticated`;
- la tabla contiene PII y datos operativos: `name`, `last_name`, `email`, `phone`, `date`, `guests`, `status`, `notes`, `table_note`, `created_at` y `updated_at`;
- la remediacion live mantuvo RLS on, elimino `reservations_insert_public` / `reservations_select_by_local` y removio grants de `anon` / `authenticated`;
- post-check runtime: `relrowsecurity=true`, `relforcerowsecurity=false`, `pg_policies` sin filas para la tabla y grants `anon` / `authenticated` en 0 filas;
- QA live aprobado: `POST /reservations` B2C, email/notificacion de reserva, `PATCH /reservations/:id` publico en `410 Gone`, panel de reservas/listado del local, `GET /panel/reservations/search`, `PATCH /panel/reservations/:id`, `GET /panel/calendar/month`, `GET /panel/calendar/day`, `GET /metrics/summary`, `GET /activity` y exports de reservas;
- los endpoints publicos y panel siguen funcionando via backend/API; este checkpoint cierra solo la exposicion directa de la tabla cruda `reservations` por Data API;
- el backend sigue operando por `SUPABASE_SERVICE_ROLE`; este checkpoint reduce exposicion directa por Data API, no reduce todavia el blast radius del service role;
- en ese momento, `ticket_types` y `table_types` seguian pendientes; el checkpoint `1.8` documenta su cierre posterior.

### 1.8 Remediation checkpoint — `ticket_types` / `table_types`

| Campo | Valor |
| --- | --- |
| Fecha de registro | 2026-05-01 |
| Estado | Slice de catalog Data API containment aplicado y validado en Supabase live |
| Recurso | `public.ticket_types`, `public.table_types` |
| Migracion versionada | `infra/sql/migrations/023_harden_catalog_types_data_api.sql` |

Resultado confirmado:

- antes de la remediacion, `public.ticket_types` y `public.table_types` tenian RLS off, sin policies activas, y grants amplios para `anon` / `authenticated`;
- ambas tablas contienen catalogo publico/comercial, pero tambien campos no necesarios para Data API cruda, como `local_id`, `is_active`, `sort_order`, `created_at` y `updated_at`;
- la remediacion live dejo RLS on en ambas tablas y removio grants de `anon` / `authenticated`; no se crearon policies nuevas;
- post-check runtime: `relrowsecurity=true`, `relforcerowsecurity=false`, `pg_policies` en 0 filas y grants `anon` / `authenticated` en 0 filas para ambas tablas;
- conteos conservados: `ticket_types` total 4, active 3, inactive 1; `table_types` total 3, active 3, inactive 0;
- QA live aprobado: `GET /public/locals/by-slug/dlirio/catalog`, tickets, mesas, perfil publico de club, selector free pass, selector de mesas, `POST /orders` free pass con `ticket_type_id`, QR/email, WhatsApp tracking, panel catalogo tickets/mesas y metricas/lineup;
- el catalogo publico sigue funcionando via backend/API shapeada; este checkpoint cierra solo la exposicion directa de las tablas crudas de catalogo por Data API;
- no se tocaron endpoints publicos, panel catalogo, frontend, backend, otras tablas ni `SUPABASE_SERVICE_ROLE`;
- en ese momento, el cleanup final de grants en `panel_users` y `payment_events` seguia pendiente; el checkpoint `1.9` documenta su cierre posterior;
- `B5b` sigue abierto para blast radius de `SUPABASE_SERVICE_ROLE`, drift SQL/env y `/payments/callback` si aplica.

### 1.9 Remediation checkpoint — `panel_users` / `payment_events` grants cleanup

| Campo | Valor |
| --- | --- |
| Fecha de registro | 2026-05-01 |
| Estado | Mini-slice final de Data API grants cleanup aplicado y validado en Supabase live |
| Recurso | `public.panel_users`, `public.payment_events` |
| Migracion versionada | `infra/sql/migrations/024_harden_panel_users_payment_events_grants.sql` |

Resultado confirmado:

- antes del cleanup, `public.panel_users` y `public.payment_events` ya tenian RLS on, `force_rls=false` y `pg_policies` en 0 filas;
- el pendiente era grants directos amplios para `anon` / `authenticated`: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` y `TRIGGER`;
- la remediacion live revoco grants de `anon` / `authenticated` sobre ambas tablas; no se tocaron RLS, policies, backend, endpoints ni otras tablas;
- post-check runtime: RLS sigue on, `force_rls=false`, `pg_policies` sigue en 0 filas y grants `anon` / `authenticated` en 0 filas para ambas tablas;
- con esto, el Check C del mini-check global queda resuelto y High-Risk Data Exposure Containment queda limpio para las tablas revisadas en este corte;
- `B5b` sigue abierto para blast radius de `SUPABASE_SERVICE_ROLE`, drift SQL/env y `/payments/callback` si aplica.

### 1.10 Decision checkpoint — `SUPABASE_SERVICE_ROLE` blast radius

| Campo | Valor |
| --- | --- |
| Fecha de registro | 2026-05-01 |
| Estado | Aceptacion formal temporal para este corte `free_pass only` |
| Recurso | Cliente backend global con `SUPABASE_SERVICE_ROLE` |
| Alcance | Decision operativa; no implementa codigo, SQL, migraciones ni cambios de entorno |

Resultado confirmado:

- el backend usa un cliente Supabase privilegiado con `SUPABASE_SERVICE_ROLE`;
- `service_role.rolbypassrls=true` fue confirmado en runtime;
- High-Risk Data Exposure Containment ya quedo limpio para las tablas revisadas en este corte;
- el riesgo residual ya no es principalmente Data API directa, sino blast radius del backend privilegiado;
- para `free_pass only`, no se identifico blocker inmediato por mantener el cliente backend global con `SUPABASE_SERVICE_ROLE`;
- no se eliminara `SUPABASE_SERVICE_ROLE` en este corte;
- la frontera efectiva queda en backend/API shapeada: validacion de input, DTOs/payloads shapeados, `panelAuth`, `requireRole`, tenant checks y rate limits donde existen;
- la aceptacion es temporal y operativa, no una arquitectura final ni reduccion real de privilegios;
- en ese momento quedaban como mitigaciones pequenas pendientes: reducir DTOs/selects en `POST /orders`, reducir DTOs/selects en `POST /reservations`, reemplazar `select("*")` en mutaciones panel puntuales y validar `localId` en `GET /events/whatsapp_clicks/count`;
- `/payments/callback` queda como validacion separada si pagos reales entran en scope;
- refactors mayores diferidos: clientes privilegiados por dominio, roles/RPCs de menor privilegio y eliminacion del service role global;
- los checkpoints `1.11` y `1.12` documentan el cierre posterior de los DTO/selects publicos y de las mutaciones panel puntuales;
- `B5b` sigue abierto para tracking validation, drift SQL/env y `/payments/callback` si aplica.

### 1.11 Remediation checkpoint — Public DTO/selects hardening

| Campo | Valor |
| --- | --- |
| Fecha de registro | 2026-05-02 |
| Estado | Sub-slice implementado y validado en produccion |
| Recurso | `POST /orders`, `POST /reservations` |
| Alcance | Reduccion de payload publico; no toca SQL, RLS, migraciones, panel, payments/callback ni service role |

Resultado confirmado:

- `POST /orders` dejo de usar select amplio/fila completa y ahora devuelve DTO publico minimo: `id`, `checkin_token`, `quantity`, `total_amount`, `currency`, `status`, `payment_method`, `created_at`, `intended_date`;
- `POST /orders` ya no devuelve PII ni campos internos como `customer_email`, `customer_name`, `customer_last_name`, `customer_phone`, `customer_document`, `transaction_id`, `used_at`, `items`, `updated_at` o `is_window_legacy`;
- `POST /reservations` dejo de usar select amplio/fila completa y ahora devuelve DTO publico minimo: `id`, `status`, `date`, `guests`, `created_at`;
- `POST /reservations` ya no devuelve PII ni campos internos como `name`, `last_name`, `email`, `phone`, `notes`, `table_note`, `local_id` o `updated_at`;
- verificaciones registradas: `pnpm -C functions/api typecheck` OK, `pnpm -C apps/web-b2c typecheck` OK y `git diff --check` OK;
- QA live aprobado: `POST /orders` free pass, response minimo, modal de exito, QR generado correctamente, token disponible/copiable, email con QR/token, compra con `ticket_type_id`, `intended_date`, `POST /reservations`, response minimo, toast/navegacion, email/notificacion de reserva, panel orders/search, check-in, panel reservas/confirmacion, activity, metrics y calendario month/day;
- el sub-slice reduce blast radius del backend con `SUPABASE_SERVICE_ROLE` en endpoints publicos, pero no elimina `SUPABASE_SERVICE_ROLE`, no cambia reglas de negocio y no toca Data API containment;
- `B5b` sigue abierto para tracking validation, drift SQL/env y `/payments/callback` si pagos reales aplican.

### 1.12 Remediation checkpoint — Panel mutation selects hardening

| Campo | Valor |
| --- | --- |
| Fecha de registro | 2026-05-02 |
| Estado | Sub-slice implementado y validado en produccion |
| Recurso | `PATCH /panel/reservations/:id`, `PATCH /panel/orders/:id/use` |
| Alcance | Reduccion de selects/payloads en mutaciones panel puntuales; no toca SQL, RLS, migraciones, endpoints publicos, payments/callback ni service role |

Resultado confirmado:

- `PATCH /panel/reservations/:id` redujo fetch interno a `id`, `local_id`, `status`, `email`, `name`, `date` y `guests`;
- `PATCH /panel/reservations/:id` redujo response/update DTO a `id`, `status`, `table_note` y `updated_at`;
- se conservaron tenant check, validacion de estado y datos internos necesarios para email de confirmacion/cancelacion;
- `PATCH /panel/orders/:id/use` redujo fetch interno a `id`, `local_id`, `status`, `used_at`, `valid_from`, `valid_to`, `is_window_legacy` y `created_at`;
- `PATCH /panel/orders/:id/use` redujo response/update DTO a `id`, `status` y `used_at`;
- se conservaron tenant check y validacion de ventana;
- `PATCH /panel/checkin/:token` no fue modificado y queda intacto como flujo operativo real del scanner;
- `apps/web-next/lib/reservations.ts` quedo alineado con `PanelReservationMutationResponse`; `Reservation` usado por listados no fue modificado;
- verificaciones registradas: `pnpm -C functions/api typecheck` OK y `pnpm -C apps/web-next typecheck` OK;
- QA live aprobado: confirmar/cancelar reserva, editar `table_note`, nota visible en UI, listar/buscar reservas, email de confirmacion/cancelacion, check-in QR/token, scanner con datos necesarios, `GET /panel/orders/search`, `GET /panel/orders/summary`, `GET /activity`, `GET /metrics/summary` y calendario month/day;
- `PATCH /panel/orders/:id/use` no se forzo por ID porque no hay consumidor activo claro y no conviene afectar datos reales innecesariamente;
- el sub-slice reduce blast radius del backend con `SUPABASE_SERVICE_ROLE` en mutaciones panel puntuales, pero no elimina `SUPABASE_SERVICE_ROLE`, no cambia reglas de negocio y no toca Data API containment;
- `B5b` sigue abierto para tracking validation, drift SQL/env y `/payments/callback` si pagos reales aplican.

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
| `orders` | `functions/api/src/routes/public.ts` — `GET /public/orders` | público | backend privilegiado | lookup público historico por email, incluia `checkin_token` | `Confirmado` | `B5b` | El checkpoint `1.5` documenta su cierre con `410 Gone`. |
| `orders` | `functions/api/src/routes/orders.ts` — `GET /orders/:id` | público | backend privilegiado | lookup público por UUID con `select("*")` | `Confirmado` | `B5b` | Devuelve la fila completa de `orders`. |
| `orders`, `locals`, `ticket_types`, `local_daily_ops` | `functions/api/src/routes/orders.ts` — `POST /orders` | público | backend privilegiado | escritura pública de orden + validación dependiente de datos | `Mitigado parcialmente` | `B5b` | Inserta en `orders`; checkpoint `1.11` reduce respuesta publica a DTO minimo sin PII. |
| `reservations`, `locals`, `local_daily_ops` | `functions/api/src/routes/reservations.ts` — `POST /reservations` | público | backend privilegiado | escritura pública de PII de reservas | `Mitigado parcialmente` | `B5b` | Inserta reserva publica; checkpoint `1.11` reduce respuesta publica a DTO minimo sin PII. |
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
- Los lookups publicos de lectura de ordenes fueron contenidos despues del discovery: `GET /orders/:id` y `GET /public/orders?email=...` responden `410 Gone`.
- `GET /orders/:id` historicamente usaba `select("*")` sobre `orders` sin auth visible; el checkpoint `1.4` documenta su cierre con `410 Gone`.
- `GET /public/orders?email=...` historicamente exponia historial por email y `checkin_token`; el checkpoint `1.5` documenta su cierre con `410 Gone`.
- El flujo `free_pass only` igualmente toca `orders`, `locals`, `local_daily_ops` y `ticket_types`; la Data API directa de esas tablas ya fue contenida por slices.
- `POST /reservations` permite escritura pública de PII de reservas por diseño, pero la Data API directa de `public.reservations` ya fue contenida por el checkpoint `1.7`.
- `ticket_types` y `table_types` mantienen catalogo publico legitimo via backend/API shapeada, pero la exposicion directa de tablas crudas por Data API ya fue contenida por el checkpoint `1.8`.
- `panel_users` y `payment_events` ya tenian RLS on y 0 policies; el cleanup final de grants directos de `anon` / `authenticated` fue contenido por el checkpoint `1.9`.
- El cliente backend global con `SUPABASE_SERVICE_ROLE` queda aceptado formalmente para este corte `free_pass only` por el checkpoint `1.10`, sin eliminar el riesgo residual ni cerrar `B5b` completo.
- `POST /orders` y `POST /reservations` ya no devuelven filas completas ni PII por respuesta publica; el checkpoint `1.11` documenta el DTO minimo y QA live aprobado.
- `PATCH /panel/reservations/:id` y `PATCH /panel/orders/:id/use` ya no devuelven filas amplias; el checkpoint `1.12` documenta los DTOs minimos, que `PATCH /panel/checkin/:token` quedo intacto y que QA live aprobo.
- `/payments/callback` inserta `payment_events` y puede actualizar `orders`; la autenticidad del proveedor no queda cerrada por repo.
- RLS hardening está confirmado solo para slices acotadas: tracking público, `promos`, `reviews` y contenciones Data API focalizadas documentadas en checkpoints.
- Los flows derivados de alta criticidad siguen fuera de una reduccion de blast radius de `SUPABASE_SERVICE_ROLE`; `panel_users`, `payment_events`, `ticket_types` y `table_types` ya tienen contencion Data API por checkpoints acotados.

## 8. Hallazgos parciales o que requieren validación

- `B5b-0` ya valida materialmente schema, RLS, policies principales, RPC y roles para tomar decisiones, pero no cierra `B5b`.
- El resultado de grants recibido esta parcialmente truncado; no debe leerse como auditoria completa de grants para todas las tablas.
- Semántica efectiva de service role frente a RLS queda confirmada a nivel de rol (`service_role.rolbypassrls=true`), pero sigue requiriendo validación fina por request path si se reduce blast radius.
- Exposicion productiva real de endpoints publicos de lectura de ordenes queda contenida para este corte por checkpoints `1.4` y `1.5`; cualquier reactivacion de `Mis Entradas` debe tratarse como decision futura con usuarios reales/auth.
- `customer_email_lower` existe en runtime, pero el drift de schema/migraciones sigue documentado como deuda de reconciliacion.
- `SUPABASE_SERVICE_ROLE_KEY` vs `SUPABASE_SERVICE_ROLE` debe cerrarse como drift operativo de env.
- Paid flows/callback quedan secundarios para `free_pass only`, pero no cerrados como seguridad de datos.

## 9. Posibles bloqueantes reales de go-live dentro de B5b

La evidencia runtime confirma que `B5b` no debe cerrarse sin mitigación o aceptación formal. Quedan candidatos reales del corte:

- `/payments/callback`, si pagos reales quedan activos fuera de `free_pass only`.
- Modelo backend con `SUPABASE_SERVICE_ROLE`, si se intenta cerrar `B5b` completo sin ejecutar o aceptar las mitigaciones pequenas restantes de tracking validation, drift y pagos.

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

`B5b` no está cerrado completo. Parece cerrable por bloques, no como un único fix. Para este corte ya quedaron contenidos `local_daily_ops`, la Data API cruda de `orders`, los endpoints publicos de lectura de ordenes, la Data API cruda de `locals`, la Data API cruda de `reservations`, la Data API cruda de `ticket_types` / `table_types`, el cleanup final de grants en `panel_users` / `payment_events`, los DTO/selects publicos de `POST /orders` / `POST /reservations` y las mutaciones panel puntuales `PATCH /panel/reservations/:id` / `PATCH /panel/orders/:id/use`. El modelo backend global con `SUPABASE_SERVICE_ROLE` queda aceptado formalmente para `free_pass only`, pero siguen pendientes tracking validation, drift SQL/env y `/payments/callback` si pagos reales aplican.

## 12. Backlog mínimo posterior

- `B5b-2a`: mitigaciones pequenas posteriores a la aceptacion de `SUPABASE_SERVICE_ROLE`: `GET /events/whatsapp_clicks/count`; DTO/selects publicos de `POST /orders` y `POST /reservations` ya quedaron documentados en checkpoint `1.11`, y las mutaciones panel puntuales quedaron documentadas en checkpoint `1.12`.
- `B5b-3`: reconciliar drift SQL/env: `schema.sql`, migraciones, `customer_email_lower`, `ticket_types`, `table_types`, `reviews`, `SUPABASE_SERVICE_ROLE`.
- `B5b-4`: cerrar autenticidad y exposición de `/payments/callback` si pagos reales entran en scope.
- `B5b-6`: hardening RLS remanente por slices, no como una sola tanda.

## 13. Relación con otros documentos / siguientes pasos

- Este documento complementa `docs/audits/B5A_APPLICATION_ACCESS_DISCOVERY.md`; no lo reemplaza ni lo reabre.
- `docs/security/SECURITY_AND_HARDENING_STATUS.md` debe referenciar este discovery como fuente del estado B5b.
- `docs/production/GO_LIVE_REMEDIATION_PLAN.md` debe mantener `B5b` como bloque pendiente de mitigación o aceptación formal.
- `B7` no debería tratar `B5b` como cerrado hasta que los riesgos de datos estén mitigados o aceptados con owner.

## 14. Cierre documental

Este documento deja trazabilidad suficiente para planificar la remediación B5b posterior sin reejecutar el discovery.

No implementa fixes. No cambia SQL. No cambia rutas. No cambia configuración. No modifica la separación vigente entre `B5a` y `B5b`.
