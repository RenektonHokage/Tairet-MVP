# SERVICE_ROLE_MINIMIZATION_PLAN

## 1. Proposito

Este documento formaliza la allowlist temporal de usos de `SUPABASE_SERVICE_ROLE` en el backend/API de Tairet y define un plan de minimizacion por slices pequenos.

No implementa cambios de codigo, SQL, migraciones, configs ni runtime. Tampoco activa paid flows ni modifica `/payments/callback`.

El objetivo de este corte no es eliminar completamente `SUPABASE_SERVICE_ROLE`, sino convertir su uso en un riesgo inventariado, justificado y reducible sin romper el go-live `free_pass only`.

## 2. Contexto del riesgo `SUPABASE_SERVICE_ROLE`

El backend/API instancia un cliente Supabase global con `SUPABASE_SERVICE_ROLE` en `functions/api/src/services/supabase.ts`.

Hechos vigentes:

- `SUPABASE_SERVICE_ROLE` es el nombre canonical del backend/API.
- `service_role.rolbypassrls=true` fue confirmado previamente en runtime.
- High-Risk Data Exposure Containment quedo cerrado para las tablas revisadas en el corte `free_pass only`.
- Data API directa fue contenida para `local_daily_ops`, `orders`, `locals`, `reservations`, `ticket_types`, `table_types`, `panel_users` y `payment_events`.
- `SUPABASE_SERVICE_ROLE` fue aceptado formalmente como riesgo residual temporal para `free_pass only`.
- El Slice 1 de minimizacion (`panelCatalog.ts` / `promos.ts`) fue implementado y validado en runtime; reduce parcialmente el blast radius de respuestas panel sin eliminar `SUPABASE_SERVICE_ROLE`.
- El Slice 2 de minimizacion (`reviews.ts`) fue implementado y validado en runtime; remueve `user_agent` del DTO publico de reviews sin tocar anti-abuse interno ni eliminar `SUPABASE_SERVICE_ROLE`.
- El Slice 3B de minimizacion (`GET /panel/orders/search`) fue implementado y validado en runtime; remueve `created_at`, `valid_from` y `valid_to` del DTO normal del panel, conservando `checkin_state`, `checkin_token` y PII operativa vigente.
- El Slice 3C de minimizacion (`GET /panel/checkins`) fue implementado y validado en runtime para su objetivo central; remueve `checkin_token` y `customer_email` de `items`, conservando metadata y el endpoint protegido.
- El Slice 3D de minimizacion (`PATCH /panel/checkin/:token`) fue implementado y validado en runtime; remueve `checkin_token` del fetch interno y `local_id` del success payload, conservando el scanner y las reglas vigentes.
- Paid flows siguen fuera del corte actual.
- `/payments/callback` queda condicionado a un gate futuro antes de activar pagos reales.

El riesgo residual principal ya no es exposicion directa por Data API anon/authenticated sobre tablas crudas, sino blast radius del backend privilegiado:

- rutas publicas que consultan o escriben datos usando service role;
- rutas panel que dependen de auth, roles y tenant checks correctos;
- payloads o selects que devuelven mas datos de los necesarios;
- callbacks o flujos futuros de pago que podrian modificar `orders` con privilegio amplio.

## 3. Alcance del discovery

Fuentes revisadas:

- `functions/api/src/services/supabase.ts`
- `functions/api/src/server.ts`
- `functions/api/src/routes/**`
- `functions/api/src/middlewares/**`
- `functions/api/src/services/**`
- `functions/api/src/utils/**`
- `functions/api/.env.example`
- `infra/sql/schema.sql`
- `infra/sql/rls.sql`
- `infra/sql/migrations/**`
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`
- `docs/audits/B5B_SUPABASE_DATA_ACCESS_DISCOVERY.md`
- `docs/audits/**`
- `docs/production/GO_LIVE_REMEDIATION_PLAN.md`
- `docs/production/B2_DEPLOY_ROLLBACK_AND_MIGRATIONS.md`
- `docs/production/B6_MINIMUM_OBSERVABILITY_AND_INCIDENT_OPERATION.md`
- `docs/production/B7_FINAL_SMOKE_AND_GO_NO_GO.md`

Alcance incluido:

- creacion del cliente Supabase backend;
- rutas publicas;
- rutas panel;
- orders, reservations, check-in, calendar, catalog, local/profile, metrics/activity, support, tracking;
- pagos solo como paid-flow futuro, sin modificar ni activar `/payments/callback`.

Alcance excluido:

- cambios de codigo;
- cambios SQL/RLS;
- migraciones nuevas;
- cambios de configuracion o runtime envs;
- paid flows reales;
- redisenar auth o RLS en este paso.

## 4. Allowlist temporal de usos actuales

Esta allowlist describe los usos permitidos temporalmente de `SUPABASE_SERVICE_ROLE` para el corte `free_pass only`.

| Uso | Archivo/ruta | Superficie | Tablas/operaciones | Controles actuales | Estado temporal |
| --- | --- | --- | --- | --- | --- |
| Cliente global Supabase | `functions/api/src/services/supabase.ts` | backend interno | cliente service role unico | env `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE` | permitido temporalmente |
| Auth panel | `functions/api/src/middlewares/panelAuth.ts` | panel | `auth.getUser`, `panel_users` read | bearer token, lookup por `auth_user_id` | permitido temporalmente |
| Free pass | `POST /orders` | publica | `locals`, `local_daily_ops`, `ticket_types` read; `orders` insert | Zod, rate limit, DTO minimo | permitido temporalmente |
| Reservas publicas | `POST /reservations` | publica | `locals`, `local_daily_ops` read; `reservations` insert | Zod, rate limit, DTO minimo | permitido temporalmente |
| Catalogo y perfiles publicos | `/public/locals*` | publica | `locals`, `local_daily_ops`, `promos`, `ticket_types`, `table_types` read | API shapeada, campos minimos por endpoint | permitido temporalmente |
| Tracking publico | `/events/*` | publica | `whatsapp_clicks`, `events_public`, `profile_views` insert/read count | Zod, rate limit, UUID validation en count | permitido temporalmente |
| Reviews publicas | `/reviews` | publica | `reviews`, `locals` read/insert | Zod, anti-abuse por fingerprint/ip, DTO publico reducido en Slice 2 | permitido temporalmente |
| Panel reservas | `/panel/reservations*`, `/locals/:id/reservations` | panel | `reservations` read/update/export | `panelAuth`, role, tenant check | permitido temporalmente |
| Panel orders/check-in | `/panel/orders*`, `/panel/checkin/:token`, `/panel/checkins` | panel | `orders`, `locals` read/update/export | `panelAuth`, role, tenant check, validacion de ventana | permitido temporalmente |
| Panel catalogo | `/panel/catalog/*` | panel | `ticket_types`, `table_types` CRUD | `panelAuth`, role, tenant/local checks | permitido temporalmente, reducible |
| Perfil local y storage | `/panel/local*` | panel | `locals`, Supabase Storage signed upload/delete | owner/staff, path scoped por `local_id` | permitido temporalmente |
| Promos | `/locals/:id/promos*` | panel | `promos`, `events_public` read/write | `panelAuth`, role, tenant check | permitido temporalmente, reducible |
| Calendar | `/panel/calendar/*` | panel | `local_daily_ops`, `orders`, `reservations`, `events_public` | `panelAuth`, role, tenant check | permitido temporalmente |
| Metrics/activity | `/metrics/*`, `/activity` | panel | aggregates sobre orders, reservations, events, payments | `panelAuth`, role, tenant scope | permitido temporalmente |
| Support | `/panel/support/*` | panel | `locals`, `panel_users` read | role-gated | permitido temporalmente |
| Weekend window RPCs | `functions/api/src/services/weekendWindow.ts` | backend helper | `get_weekend_window`, `get_night_window`, `get_active_night_window` | helper interno backend | permitido temporalmente |
| Payments callback | `/payments/callback` | paid-flow futuro | `payment_events`, `orders` write | gate futuro pendiente | fuera del corte actual |

## 5. Clasificacion por uso

### A. Mantener temporalmente

Usos necesarios para el corte `free_pass only` o cuyo cambio seria riesgoso antes de un slice dedicado:

- `panelAuth`;
- `POST /orders`;
- `POST /reservations`;
- endpoints publicos shapeados de locales/catalogo;
- tracking publico vigente;
- panel reservations;
- panel orders/check-in;
- calendar;
- metrics/activity;
- panel local/storage;
- support;
- weekend window RPCs.

### B. Migrable a JWT/RLS

Usos candidatos a una arquitectura futura con privilegios menores:

- rutas panel por `local_id` usando JWT/RLS, claims o RPCs acotadas;
- public catalog/local reads mediante views/RPCs de solo lectura;
- public writes (`orders`, `reservations`, tracking, reviews) mediante RPCs especificas;
- storage uploads con policies acotadas, si se decide redisenar el flujo.

Esto requiere diseno, migraciones, QA y no debe mezclarse con el corte `free_pass only`.

### C. Reducible por DTO/shape

Usos que pueden mantener service role por ahora, pero devolver o seleccionar menos datos:

- mutaciones de panel catalogo en `panelCatalog.ts`;
- mutaciones de promos en `promos.ts`;
- respuesta publica de `reviews.ts`, ya reducida en Slice 2 para no seleccionar ni devolver `user_agent`;
- `GET /panel/orders/search`, ya reducido en Slice 3B para no devolver campos internos de ventana ni `created_at`;
- `GET /panel/checkins`, ya reducido en Slice 3C para no devolver `checkin_token` ni `customer_email` en `items`;
- `PATCH /panel/checkin/:token`, ya reducido en Slice 3D para no seleccionar `checkin_token` internamente ni devolver `local_id` en success;
- exports de reservas/orders, sujeto a decision de negocio sobre roles.

### D. Cerrable/eliminable

Usos o rutas que ya no deberian exponer datos o que requieren decision antes de conservarse:

- `GET /orders/:id` ya esta cerrado con `410 Gone`;
- `GET /public/orders?email=...` ya esta cerrado con `410 Gone`;
- `PATCH /reservations/:id` publico ya esta cerrado con `410 Gone`;
- `PATCH /panel/orders/:id/use` debe revisarse si no tiene consumidor activo real antes de mantenerlo indefinidamente.

### E. Paid-flow futuro

Usos que no pertenecen al corte actual:

- `/payments/callback`;
- helpers de `payment_events`;
- idempotency de pagos;
- actualizacion de `orders` por pagos reales.

Estos puntos quedan fuera hasta ejecutar el gate especifico de paid flows.

## 6. Riesgos actuales y mitigaciones ya aplicadas por B5a/B5b

Riesgos actuales:

- un bug en una ruta backend podria consultar o modificar datos con bypass de RLS;
- una ruta publica podria devolver demasiado si no aplica DTO minimo;
- una ruta panel podria depender de tenant check incompleto;
- un callback de pagos sin gate podria modificar `orders` si paid flows se activan;
- exports y listados panel concentran PII legitima, pero sensible.

Mitigaciones ya aplicadas o documentadas:

- Data API directa contenida para las tablas criticas revisadas;
- endpoints publicos de lectura de ordenes cerrados con `410 Gone`;
- `POST /orders` y `POST /reservations` devuelven DTOs minimos;
- mutaciones panel puntuales redujeron payloads;
- `GET /events/whatsapp_clicks/count` valida `localId` como UUID;
- `SUPABASE_SERVICE_ROLE` fue aceptado formalmente solo para `free_pass only`;
- `/payments/callback` quedo en stand by y no aprobado para paid flows;
- B7 registro `GO con riesgos aceptados` para `free_pass only`, no para pagos reales.

## 7. Usos reducibles con bajo riesgo

Orden recomendado de reduccion:

1. `panelCatalog.ts`: reemplazar selects amplios en create/update de tickets y mesas por columnas explicitas. Estado: `Implementado y validado en runtime`.
2. `promos.ts`: reducir selects y responses de create/update a DTOs necesarios. Estado: `Implementado y validado en runtime`.
3. `reviews.ts`: remover `user_agent` de respuestas publicas y evitar seleccionar `locals.type` en el join. Estado: `Implementado y validado en runtime`.
4. `panel.ts` / `GET /panel/orders/search`: remover campos internos `created_at`, `valid_from` y `valid_to` del DTO normal, conservando `checkin_state` calculado. Estado: `Implementado y validado en runtime`.
5. `panel.ts` / `GET /panel/checkins`: remover `checkin_token` y `customer_email` de `items`, conservando metadata. Estado: `Implementado y validado en runtime para el objetivo central`.
6. `panel.ts` / `PATCH /panel/checkin/:token`: remover `checkin_token` del fetch interno y `local_id` del success payload, conservando scanner y validaciones. Estado: `Implementado y validado en runtime`.
7. exports: decidir si siguen disponibles para staff o pasan a owner-only.

Cada punto debe ejecutarse como slice separado, con typecheck y QA especifico.

## 8. Usos que se mantienen temporalmente

Se mantienen temporalmente por necesidad funcional o riesgo de regresion:

- `POST /orders` para free pass;
- `POST /reservations` para reservas publicas;
- `PATCH /panel/checkin/:token` como flujo operativo real del scanner;
- `panelAuth` como frontera de autenticacion panel;
- calendar, metrics y activity por operacion diaria del panel;
- panel local/storage por signed uploads y manejo de galeria;
- support/status y support/access por diagnostico operativo;
- public locals/catalog por B2C shapeado;
- weekend window RPCs por validacion de ventanas.

Estos usos no se consideran arquitectura final. Permanecen aceptados mientras conserven validacion de input, auth/role cuando aplique, tenant checks y DTOs controlados.

## 9. Slices recomendados de minimizacion

### Slice 0 - Documento de allowlist

Estado: este documento.

Objetivo:

- dejar inventario y criterios antes de tocar codigo;
- evitar que service role quede como aceptacion implicita.

### Slice 1 - DTO cleanup de panel catalogo y promos

Estado: `Implementado y validado en runtime`.

Fecha de registro: 2026-05-14.

Archivos tocados:

- `functions/api/src/routes/panelCatalog.ts`
- `functions/api/src/routes/promos.ts`

Objetivo:

- reducir selects amplios en mutaciones de catalogo y promos;
- no cambiar reglas de negocio ni permisos.

Resultado implementado:

- reemplazo de `.select().single()` amplios por selects explicitos en mutaciones de catalogo de tickets;
- reemplazo de `.select().single()` amplios por selects explicitos en mutaciones de catalogo de mesas;
- reemplazo de `.select().single()` amplios por selects explicitos en mutaciones de promos;
- no se tocaron SQL, RLS, migraciones, configs, paid flows ni `/payments/callback`;
- no se cambiaron permisos, reglas de negocio ni `SUPABASE_SERVICE_ROLE`.

Validacion tecnica registrada:

- `pnpm -C functions/api typecheck` OK;
- `pnpm -C apps/web-next typecheck` OK;
- `git diff --check` OK.

Validacion runtime registrada:

- tickets: listar, crear, editar y activar/desactivar -> PASS;
- mesas: listar, crear, editar y activar/desactivar -> PASS;
- promos: listar, crear, editar y activar/desactivar -> PASS;
- preview/listado de promos no rompe -> PASS;
- panel consume API sin errores visibles de CORS/consola/network durante las mutaciones -> PASS;
- `GET /public/locals/by-slug/dlirio/catalog` -> 200 OK;
- `GET /public/locals/by-slug/mambo/catalog` -> 200 OK;
- `GET /health` -> 200 OK con `{ "ok": true }`;
- `x-request-id` presente.

Efecto sobre el riesgo:

- reduce parcialmente el blast radius de `SUPABASE_SERVICE_ROLE` en respuestas panel de catalogo y promos;
- no elimina `SUPABASE_SERVICE_ROLE`;
- no cierra los slices pendientes de orders/checkins, exports, JWT/RLS/RPC ni paid-flow gate.

### Slice 2 - Reviews public DTO cleanup

Estado: `Implementado y validado en runtime`.

Fecha de registro: 2026-05-14.

Archivo tocado:

- `functions/api/src/routes/reviews.ts`

Objetivo:

- remover campos tecnicos no necesarios de respuestas publicas;
- mantener anti-abuse interno.

Resultado implementado:

- `GET /reviews` ya no selecciona ni devuelve `user_agent`;
- `POST /reviews` ya no selecciona ni devuelve `user_agent`;
- el join de `locals` ya no selecciona `type`;
- el DTO publico conserva `id`, `venue_id`, `venue_type`, `display_name`, `rating`, `title`, `comment`, `created_at`, `venue_name` y `venue_slug`;
- `user_agent`, `fingerprint` e `ip_hash` siguen internos para anti-abuse;
- no se tocaron SQL, RLS, migraciones, configs, paid flows ni `/payments/callback`;
- no se cambiaron reglas de negocio de reviews.

Validacion tecnica registrada:

- `pnpm -C functions/api typecheck` OK;
- `pnpm -C apps/web-b2c typecheck` OK;
- `git diff --check` OK.

Validacion runtime registrada:

- `GET /reviews` funciona sin exponer `user_agent` -> PASS;
- `POST /reviews` funciona sin exponer `user_agent` -> PASS;
- B2C consume reviews sin errores visibles tras el DTO cleanup -> PASS;
- la logica interna de anti-abuse se conserva.

Efecto sobre el riesgo:

- reduce parcialmente el blast radius de `SUPABASE_SERVICE_ROLE` en respuestas publicas de reviews;
- no elimina `SUPABASE_SERVICE_ROLE`;
- no cierra los slices pendientes de orders/checkins, exports, JWT/RLS/RPC ni paid-flow gate.

### Slice 3 - Panel orders/checkins payload audit

Estado: `Parcialmente implementado`.

Objetivo:

- revisar consumidores reales;
- reducir PII/tokens no necesarios en listados o previews;
- no tocar `PATCH /panel/checkin/:token` sin QA explicito.

Avance:

- Slice 3B implementado y validado en runtime para `GET /panel/orders/search`;
- Slice 3C implementado y validado en runtime para el objetivo central de `GET /panel/checkins`;
- Slice 3D implementado y validado en runtime para `PATCH /panel/checkin/:token`;
- exports quedan fuera de Slice 3B/3C/3D.

### Slice 3B - Orders search DTO cleanup

Estado: `Implementado y validado en runtime`.

Fecha de registro: 2026-05-14.

Archivo tocado previamente:

- `functions/api/src/routes/panel.ts`

Endpoint afectado:

- `GET /panel/orders/search`

Resultado implementado:

- se reemplazo el spread `...order` por un DTO explicito;
- `created_at`, `valid_from` y `valid_to` ya no salen en el DTO de search;
- `checkin_state` se mantiene y sigue calculandose en backend;
- `checkin_token` se mantiene porque la UI actual lo muestra/copia;
- PII visible actual se mantiene porque forma parte de la operacion vigente del panel;
- paginacion, filtros por email/documento/fecha/estado, `panelAuth`, `requireRole(["owner", "staff"])` y tenant check se mantienen sin cambios.

DTO final:

- `id`;
- `status`;
- `used_at`;
- `checkin_token`;
- `customer_name`;
- `customer_last_name`;
- `customer_email`;
- `customer_phone`;
- `customer_document`;
- `quantity`;
- `intended_date`;
- `checkin_state`.

Campos removidos del DTO:

- `created_at`;
- `valid_from`;
- `valid_to`.

Validacion tecnica registrada:

- `pnpm -C functions/api typecheck` OK;
- `pnpm -C apps/web-next typecheck` OK;
- `git diff --check` OK.

Validacion runtime registrada:

- login owner/staff -> PASS;
- `GET /panel/me` -> PASS;
- abrir ordenes/search -> PASS;
- buscar por email -> PASS;
- buscar por documento/cedula -> PASS;
- buscar por nombre/telefono -> N/A, el panel solo permite busqueda por cedula y correo;
- filtros por fecha/estado -> PASS;
- paginacion -> N/A, no hay paginacion visible/aplicable;
- token visible/copiable -> PASS;
- `checkin_state` visible -> PASS;
- orders summary -> PASS;
- activity / metrics / calendar -> PASS;
- scanner/check-in QR basico -> PASS;
- `GET /health` -> 200 OK con `{ "ok": true }` y `x-request-id` presente.

Efecto sobre el riesgo:

- reduce parcialmente el blast radius de `SUPABASE_SERVICE_ROLE` en search/listado operativo de ordenes;
- no elimina `SUPABASE_SERVICE_ROLE`;
- no reduce todavia `checkin_token` ni PII visible porque siguen siendo parte de la operacion vigente;
- no toca scanner/check-in, exports, SQL, RLS, migraciones, paid flows ni `/payments/callback`.

Validacion pendiente para futuros sub-slices:

- politica de `checkin_token` en search/export;
- politica owner/staff para exports.

### Slice 3C - Checkins DTO cleanup

Estado: `Implementado y validado en runtime para el objetivo central`.

Fecha de registro: 2026-05-14.

Archivo tocado previamente:

- `functions/api/src/routes/panel.ts`

Endpoint afectado:

- `GET /panel/checkins`

Resultado implementado:

- el endpoint sigue activo y protegido por `panelAuth` y `requireRole(["owner", "staff"])`;
- se redujo el select de `orders`;
- `checkin_token` ya no sale en `items`;
- `customer_email` ya no sale en `items`;
- `count`, `pending_count`, `unused_count` y `current_window` se mantienen;
- no se depreco el endpoint;
- no se tocaron scanner, `PATCH /panel/checkin/:token`, exports, SQL, RLS, migraciones, configs, paid flows ni `/payments/callback`.

DTO final:

- `items[].id`;
- `items[].status`;
- `items[].used_at`;
- `items[].customer_name`;
- `items[].customer_last_name`;
- `items[].customer_document`;
- `count`;
- `pending_count`;
- `unused_count`;
- `current_window`.

Campos removidos de `items`:

- `checkin_token`;
- `customer_email`.

Validacion tecnica registrada:

- `pnpm -C functions/api typecheck` OK;
- `pnpm -C apps/web-next typecheck` OK;
- `git diff --check` OK.

Validacion runtime registrada:

- `GET /panel/checkins` autenticado como owner -> 200 OK;
- response incluye `items`, `count`, `pending_count`, `unused_count` y `current_window`;
- `items` ya no expone `checkin_token`;
- `items` ya no expone `customer_email`;
- `items` mantiene `id`, `status`, `used_at`, `customer_name`, `customer_last_name` y `customer_document`;
- `count` presente;
- `pending_count` presente;
- `unused_count` presente;
- `current_window` presente con `intended_date`, `valid_from`, `valid_to` y `window_key`;
- request sin `Authorization` a `GET /panel/checkins` -> 401;
- error controlado: `Missing or invalid Authorization header`;
- no devuelve datos sin auth;
- `PATCH /panel/checkin/<token_invalido>` -> 404 `Order not found`;
- `PATCH /panel/checkin/<token_expirado>` -> 409 con `code: expired`;
- `GET /health` -> 200 OK con `{ "ok": true }`;
- `x-request-id` presente.

Limitacion de validacion:

- el objetivo central de Slice 3C queda validado;
- no se marca scanner completo como PASS por este slice;
- token valido y token ya usado quedan pendientes para una ventana activa o prueba especifica futura;
- scanner no fue modificado en este slice.

Efecto sobre el riesgo:

- reduce parcialmente el blast radius de `SUPABASE_SERVICE_ROLE` en el listado de check-ins;
- no elimina `SUPABASE_SERVICE_ROLE`;
- mantiene el endpoint temporalmente por posible uso manual/legacy protegido;
- no cierra la politica de exports ni la decision futura sobre payload sensible en otros endpoints.

### Slice 3D - Scanner response cleanup

Estado: `Implementado y validado en runtime`.

Fecha de registro: 2026-05-14.

Archivos tocados previamente:

- `functions/api/src/routes/panel.ts`;
- `apps/web-next/app/panel/(authenticated)/checkin/page.tsx`.

Endpoint afectado:

- `PATCH /panel/checkin/:token`

Resultado implementado:

- en el fetch interno por token se removio `checkin_token` del select;
- en el update success se removio `local_id` del select;
- en frontend se removio `local_id` del tipo `CheckinSuccess`;
- no se cambio UI, mensajes, camara, input manual ni mapeo de errores;
- no se cambio validacion de ventana, tenant checks, reglas de negocio ni errores;
- no se tocaron exports, SQL, RLS, migraciones, configs, paid flows ni `/payments/callback`.

DTO final de success:

- `id`;
- `status`;
- `used_at`;
- `customer_name`;
- `customer_last_name`;
- `customer_document`.

Campos removidos:

- `checkin_token` del fetch interno;
- `local_id` del success payload.

Validacion tecnica registrada:

- `pnpm -C functions/api typecheck` OK;
- `pnpm -C apps/web-next typecheck` OK;
- `git diff --check` OK.

Validacion runtime registrada:

- `PATCH /panel/checkin/:token` dentro de ventana activa con token valido -> 200 OK;
- success payload ya no incluye `local_id`;
- success payload mantiene `id`, `status`, `used_at`, `customer_name`, `customer_last_name` y `customer_document`;
- repetir el mismo token despues del check-in -> 409 Conflict;
- response de token ya usado: `Order already used` con `usedAt`;
- token inventado -> 404 Not Found;
- response de token invalido: `Order not found`;
- `GET /panel/checkins` -> 200 OK;
- `GET /panel/checkins` `items` ya no incluye `checkin_token`;
- `GET /panel/checkins` `items` ya no incluye `customer_email`;
- `GET /panel/checkins` mantiene `id`, `status`, `used_at`, `customer_name`, `customer_last_name` y `customer_document`;
- `GET /panel/checkins` mantiene metadata `count`, `pending_count`, `unused_count` y `current_window`;
- `GET /panel/orders/summary` -> 200 OK;
- scanner UI -> PASS;
- input manual -> PASS;
- no hay error visual nuevo.

Limitacion de QA:

- token expirado/fuera de ventana no queda marcado como PASS en este cierre de Slice 3D si no hay evidencia posterior al cambio;
- la rama expirado/fuera de ventana debe probarse en una ventana o fixture especifico antes de usarla como evidencia nueva de scanner completo.

Efecto sobre el riesgo:

- reduce parcialmente el blast radius de `SUPABASE_SERVICE_ROLE` en el flujo operativo de scanner;
- no elimina `SUPABASE_SERVICE_ROLE`;
- mantiene datos de comprador necesarios para feedback de puerta;
- no cambia reglas de negocio ni validaciones de check-in.

### Slice 4 - Export policy decision

Objetivo:

- decidir si exports de reservas/orders siguen permitidos para staff o pasan a owner-only;
- documentar aceptacion si se mantiene staff.

Validacion esperada:

- QA export CSV/XLSX por rol;
- confirmacion de owner del negocio.

### Slice 5 - Arquitectura JWT/RLS/RPC futura

Objetivo:

- disenar migracion de service role global a permisos por dominio;
- no ejecutar sin plan de migraciones y QA amplio.

Validacion esperada:

- prechecks SQL read-only;
- diseno de claims/RLS/RPC;
- migraciones por slice;
- smoke completo B7 relevante.

### Slice 6 - Paid-flow gate

Objetivo:

- validar `/payments/callback` antes de pagos reales;
- cubrir firma/autenticidad, idempotencia, replay, update seguro de `orders`, registro en `payment_events` y QA sandbox/controlado.

Este slice no pertenece al corte `free_pass only`.

## 10. Validacion/QA por slice

Validaciones tecnicas base:

- `git diff --check`;
- `pnpm -C functions/api typecheck`;
- `pnpm -C apps/web-next typecheck` si cambia contrato panel;
- `pnpm -C apps/web-b2c typecheck` si cambia contrato B2C.

Validaciones funcionales por superficie:

- free pass: `POST /orders`, QR/token, email si envio real esta habilitado;
- reservas: `POST /reservations`, panel reservas, confirmar/cancelar, `table_note`;
- panel: login, `/panel/me`, dashboard, catalogo, promos, metrics, activity, calendar;
- check-in: `PATCH /panel/checkin/:token` con token valido e invalido;
- API: `/health`, `x-request-id`, CORS, endpoints sensibles en `410 Gone`;
- tracking: `POST /events/whatsapp_click`, `GET /events/whatsapp_clicks/count` valido e invalido;
- observabilidad: Sentry panel, fallback logs/requestId/support.

## 11. Fuera de alcance hasta paid-flow gate

Quedan fuera de este plan inicial:

- activar paid flows;
- declarar pagos reales listos;
- modificar `/payments/callback`;
- agregar firma o validacion de proveedor en este paso;
- modificar `payment_events` funcionalmente;
- cambiar estado de `orders` por pagos reales;
- QA de pagos reales fuera de sandbox/controlado.

Antes de activar pagos reales debe existir un gate dedicado que cubra:

- autenticidad/firma del proveedor;
- idempotencia;
- replay;
- actualizacion segura de `orders`;
- registro en `payment_events`;
- QA con evento controlado/sandbox.

## 12. Criterio para considerar reducido el riesgo

El riesgo de `SUPABASE_SERVICE_ROLE` puede considerarse reducido, sin exigir cero service role, cuando:

- exista una allowlist vigente de rutas/helpers que usan service role;
- no exista service role en frontend ni envs publicas;
- todo endpoint publico exponga solo DTOs minimos y no filas crudas;
- las rutas panel criticas conserven `panelAuth`, `requireRole`, tenant checks, input validation y DTOs controlados;
- los usos restantes tengan justificacion documentada;
- los usos reducibles hayan sido ejecutados o aceptados formalmente;
- paid flows sigan bloqueados hasta gate especifico;
- cualquier migracion a JWT/RLS/RPC se ejecute por slices con rollback y QA.

## 13. Pendientes / requiere validacion

Pendientes:

- decidir si `checkin_token` y PII visible en `GET /panel/orders/search` se mantienen como operacion vigente o pasan a endpoint mas especifico;
- validar rama scanner de token expirado/fuera de ventana con evidencia posterior al Slice 3D;
- decidir mantenimiento/deprecacion formal de `GET /panel/checkins` si se confirma que no tiene consumidor operativo real;
- decidir politica de roles para exports;
- confirmar si `PATCH /panel/orders/:id/use` conserva consumidor activo real;
- disenar modelo futuro de JWT/RLS/RPC por dominio;
- ejecutar gate de `/payments/callback` solo si pagos reales entran en alcance.

Requiere validacion antes de CODE:

- contratos frontend afectados por cada DTO;
- comportamiento esperado por owner/staff en exports;
- si futuras features como `Mis Entradas` reabren endpoints o DTOs cerrados;
- si paid flows cambian el alcance actual `free_pass only`.
