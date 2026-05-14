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
| Reviews publicas | `/reviews` | publica | `reviews`, `locals` read/insert | Zod, anti-abuse por fingerprint/ip | permitido temporalmente, reducible |
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
- respuesta publica de `reviews.ts`, especialmente campos tecnicos como `user_agent`;
- `GET /panel/checkins` y `GET /panel/orders/search`, sujeto a validacion de consumidores;
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

1. `panelCatalog.ts`: reemplazar selects amplios en create/update de tickets y mesas por columnas explicitas.
2. `promos.ts`: reducir selects y responses de create/update/reorder a DTOs necesarios.
3. `reviews.ts`: revisar si el frontend necesita `user_agent`; si no, removerlo de respuestas publicas.
4. `panel.ts`: auditar `GET /panel/checkins` y `GET /panel/orders/search` para remover `checkin_token`, email, phone o documento cuando no sean necesarios para la UI.
5. exports: decidir si siguen disponibles para staff o pasan a owner-only.

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

Objetivo:

- reducir selects amplios en mutaciones de catalogo y promos;
- no cambiar reglas de negocio ni permisos.

Validacion esperada:

- `pnpm -C functions/api typecheck`;
- `pnpm -C apps/web-next typecheck` si cambia contrato frontend;
- QA panel catalogo tickets/mesas;
- QA promos create/edit/reorder/delete si aplica.

### Slice 2 - Reviews public DTO cleanup

Objetivo:

- remover campos tecnicos no necesarios de respuestas publicas;
- mantener anti-abuse interno.

Validacion esperada:

- `pnpm -C functions/api typecheck`;
- `pnpm -C apps/web-b2c typecheck` si hay consumidor B2C;
- QA `GET /reviews` y `POST /reviews`.

### Slice 3 - Panel orders/checkins payload audit

Objetivo:

- revisar consumidores reales;
- reducir PII/tokens no necesarios en listados o previews;
- no tocar `PATCH /panel/checkin/:token` sin QA explicito.

Validacion esperada:

- `pnpm -C functions/api typecheck`;
- `pnpm -C apps/web-next typecheck`;
- QA scanner, orders search, orders summary, recent checkins.

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

- confirmar consumidores reales de campos sensibles en `GET /panel/checkins` y `GET /panel/orders/search`;
- decidir politica de roles para exports;
- confirmar si `PATCH /panel/orders/:id/use` conserva consumidor activo real;
- revisar `reviews.ts` antes de remover campos de respuesta;
- disenar modelo futuro de JWT/RLS/RPC por dominio;
- ejecutar gate de `/payments/callback` solo si pagos reales entran en alcance.

Requiere validacion antes de CODE:

- contratos frontend afectados por cada DTO;
- comportamiento esperado por owner/staff en exports;
- si futuras features como `Mis Entradas` reabren endpoints o DTOs cerrados;
- si paid flows cambian el alcance actual `free_pass only`.

