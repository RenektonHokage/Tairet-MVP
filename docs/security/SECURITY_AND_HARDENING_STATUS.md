# SECURITY_AND_HARDENING_STATUS

## 1. Proposito del documento

Este documento resume la postura observable de seguridad y hardening de Tairet a partir de codigo y documentacion vigente del repo.

Sirve como base para:

- readiness de produccion;
- cleanup pre-produccion;
- observabilidad y manejo de errores;
- checklist final de hardening;
- futuros prompts tecnicos.

Regla aplicada de fuente de verdad:

1. codigo del repo;
2. `docs/audits/**` y documentacion operativa vigente;
3. runtime/entorno solo cuando el codigo no alcanza;
4. todo lo no demostrable queda como `Requiere validacion`.

No se listan secretos ni valores reales.

## 2. Como leer este documento

Este documento usa dos ejes de estado:

- estado del bloque: `Confirmado`, `Parcial`, `Requiere validacion`;
- estado de la fuente documental de auditoria: `vigente`, `parcialmente vigente`, `snapshot historico`, `superado por el codigo actual`.

Convenciones:

- `Confirmado`: el control o riesgo esta visible hoy en codigo o docs operativas consistentes.
- `Parcial`: existe evidencia real, pero el alcance esta incompleto, depende de entorno o convive con gaps abiertos.
- `Requiere validacion`: el repo no alcanza para cerrar comportamiento productivo, cobertura real o exposicion final.

Este documento no debe leerse como cierre de hardening. La evidencia actual muestra controles reales, pero tambien pendientes estructurales importantes.

## 3. Resumen ejecutivo de seguridad/hardening

La postura observable hoy en Tairet es mixta:

- el panel B2B tiene una base de auth y autorizacion real con `Supabase Auth` en frontend, `Bearer` al backend, `panelAuth`, `requireRole(...)` y chequeos por `local_id`;
- el backend ya expone guardrails concretos de request tracing, logging estructurado, CORS y rate limiting;
- existen slices endurecidas de RLS para tracking, promos y reviews;
- el backend concentra blast radius alto porque opera con `SUPABASE_SERVICE_ROLE`;
- la capa SQL visible sigue mostrando politicas permisivas en tablas criticas fuera de esas slices endurecidas;
- la superficie publica B2C mantiene endpoints anonimos sensibles por diseno o por contrato preservado, en especial `POST /orders`, `POST /reservations`, `POST /reviews` y el lookup `GET /public/orders?email=...`;
- la observabilidad mejoro, pero la captura real con DSN activo y el estado productivo final siguen parcialmente no verificables desde repo;
- el modo demo del panel sigue siendo un pendiente de hardening mientras existan flag y rutas demo.

Lectura operativa corta:

- auth panel: `Confirmado`;
- guardrails backend: `Parcial`;
- RLS/data layer: `Parcial`;
- observabilidad productiva: `Requiere validacion`;
- despliegue hardening final: `Requiere validacion`.

## 4. Fuentes revisadas

### 4.1 Fuentes obligatorias de `docs/audits/**`

| Fuente | Estado de la fuente | Uso en este documento |
| --- | --- | --- |
| `docs/audits/STATUS.md` | `vigente` | tablero canonico del estado actual de hardening y residuales abiertos |
| `docs/audits/HARDENING_ROADMAP.md` | `vigente` | marco de fases, prerequisitos y principio de no-breaking |
| `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md` | `vigente` | fuente principal de riesgos abiertos, aceptados y residuales |
| `docs/audits/CONTRATOS_CONGELADOS_V1.md` | `vigente` | contratos y modelo observable de acceso/auth que siguen operativos |
| `docs/audits/MATRIZ_VALIDACION_PREVIA_V1.md` | `parcialmente vigente` | separa lo confirmado por codigo de lo que aun requiere runtime |
| `docs/audits/SMOKE_TESTS_V1.md` | `parcialmente vigente` | valida cortes funcionales concretos, pero no reemplaza estado productivo actual |
| `docs/audits/BASELINE_FUNCIONAL_V1.md` | `parcialmente vigente` | baseline util para superficies y riesgos, con partes ya reencuadradas por docs posteriores |
| `docs/audits/TAIRET_TECH_AUDIT_MVP.md` | `snapshot historico` | contexto inicial; no es fuente operativa primaria |
| `docs/audits/AGENT.md` | guia de trabajo | no se usa como evidencia primaria del sistema |

### 4.2 Otras fuentes operativas usadas

- `docs/architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md`
- `docs/architecture/FUNCTIONAL_FLOWS_E2E.md`
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`
- `functions/api/src/middlewares/panelAuth.ts`
- `functions/api/src/middlewares/requireRole.ts`
- `functions/api/src/middlewares/requestId.ts`
- `functions/api/src/middlewares/error.ts`
- `functions/api/src/routes/public.ts`
- `functions/api/src/routes/orders.ts`
- `functions/api/src/routes/payments.ts`
- `functions/api/src/routes/reviews.ts`
- `functions/api/src/routes/panel.ts`
- `functions/api/src/routes/panelCatalog.ts`
- `functions/api/src/routes/panelLocal.ts`
- `functions/api/src/routes/reservations.ts`
- `functions/api/src/routes/support.ts`
- `infra/sql/rls.sql`
- `infra/sql/migrations/016_harden_tracking_rls_backend_only.sql`
- `infra/sql/migrations/017_harden_promos_rls_backend_only.sql`
- `infra/sql/migrations/018_harden_reviews_rls_backend_only.sql`
- `apps/web-next/lib/panel-demo/runtime.ts`
- `apps/web-next/components/panel/SidebarUserInfo.tsx`
- `apps/web-next/instrumentation.ts`
- `apps/web-next/sentry.client.config.ts`
- `apps/web-next/app/global-error.tsx`

## 5. Superficies de seguridad por capa

### 5.1 B2C publico

- descubrimiento, perfiles y catalogo operan sin auth de usuario final; la sensibilidad principal esta en exposicion de datos, tracking y consistencia de respuestas publicas;
- `POST /reservations` y `POST /orders` son superficies anonimas transaccionales;
- `GET /public/orders?email=...` sigue existiendo como contrato/backend preservado y riesgo residual aceptado;
- `GET /reviews` y `POST /reviews` son publicos, con controles anti-abuso visibles pero no con cierre total demostrable desde entorno;
- tracking y lectura publica de promos/perfiles dependen de slices SQL endurecidas y del backend.

Estado del bloque: `Parcial`.

### 5.2 B2B / panel

- login y sesion dependen de `Supabase Auth` en frontend y validacion posterior en backend;
- rutas autenticadas del panel concentran operaciones sensibles de reservas, ordenes, check-in, export, perfil del local y soporte;
- `orders`, `checkin` y export son las superficies de mayor sensibilidad operativa por impacto directo en acceso fisico, tickets y estados transaccionales;
- `settings` y `support/status` son superficies utiles para diagnostico, pero no equivalen a un plano completo de operacion segura;
- el runtime demo del panel sigue existiendo bajo flag publico.

Estado del bloque: `Confirmado` para existencia de protecciones base, `Parcial` para hardening total.

### 5.3 Backend / API

- la API separa rutas publicas de rutas panel mediante middlewares y composicion de routers;
- `panelAuth`, `requireRole(...)`, `requestId`, `error middleware`, CORS y rate limiting son guardrails visibles;
- `/payments/callback` es superficie critica por pagos e idempotencia;
- `/health` y `support/status` aportan soporte operativo, no aislamiento de seguridad por si solos;
- el backend centraliza el mayor blast radius al usar `SUPABASE_SERVICE_ROLE`.

Estado del bloque: `Parcial`.

### 5.4 Datos / DB / SQL visible

- `panel_users`, `orders`, `reservations`, `locals`, `local_daily_ops`, `payment_events`, `ticket_types` y `table_types` son las zonas de mayor sensibilidad;
- la evidencia SQL visible muestra coexistencia de politicas permisivas en `infra/sql/rls.sql` y migraciones endurecidas para slices acotadas;
- las slices endurecidas confirmadas hoy son tracking, promos y reviews;
- el repo no alcanza para cerrar el estado exacto del esquema ni de las policies desplegadas en produccion.

Estado del bloque: `Parcial`.

### 5.5 Integraciones externas criticas

- `Supabase` es dependencia critica para auth, datos y storage;
- `Resend` impacta confirmaciones transaccionales;
- `Sentry` y `PostHog` forman parte de la capa visible de observabilidad/analytics;
- `Mapbox` participa en superficie publica, pero no es un control de seguridad;
- `NEXT_PUBLIC_ENABLE_PANEL_DEMO` introduce una superficie demo que debe tratarse como pendiente de hardening.

Estado del bloque: `Parcial`.

## 6. Autenticacion y autorizacion

El modelo observable hoy es:

- el panel autentica en frontend con `Supabase Auth`;
- el frontend envia `Authorization: Bearer <token>` al backend;
- `panelAuth` valida el token con `supabase.auth.getUser(...)`, resuelve `panel_users` y arma `req.panelUser`;
- `requireRole(...)` corta acceso cuando el rol no coincide;
- varias rutas panel aplican tenant enforcement con `local_id = req.panelUser.localId` o comparacion explicita de path/local;
- dominios solo-club agregan guardas tipo `verifyClubOnly(...)`.

Puntos mas sensibles:

- `/panel/orders`
- `/panel/checkin`
- `/payments/callback`
- tabla `panel_users`
- lookup publico `GET /public/orders?email=...`

Limites actuales:

- la superficie B2C publica no usa auth de usuario final en los flows actuales;
- el mayor control esta en backend, no en acceso SQL distribuido;
- el repo no demuestra por si solo la cobertura productiva final de hosts, cookies, dominios o sesion fuera del panel.

Evidencia principal:

- `functions/api/src/middlewares/panelAuth.ts`
- `functions/api/src/middlewares/requireRole.ts`
- `functions/api/src/routes/panel.ts`
- `functions/api/src/routes/panelCatalog.ts`
- `functions/api/src/routes/panelLocal.ts`
- `docs/audits/CONTRATOS_CONGELADOS_V1.md`
- `docs/audits/MATRIZ_VALIDACION_PREVIA_V1.md`
- `docs/audits/SMOKE_TESTS_V1.md`

Estado del bloque: `Confirmado` para el modelo base de authz; `Parcial` para cobertura/hardening final.

### 6.1 Estado documental de `B5a`

- el discovery final de `B5a` quedó documentado en `docs/audits/B5A_APPLICATION_ACCESS_DISCOVERY.md`;
- el enforcement principal observado en `B5a` está en backend mediante `panelAuth`, `requireRole(...)` y tenant checks por `local_id`;
- no se identificaron bypasses confirmados ni bloqueantes confirmados de go-live dentro de `B5a`;
- `B5a-1 Role Split Explicito` quedo implementado y validado para este corte: las rutas backend parciales identificadas por el discovery ahora aplican `requireRole(["owner","staff"])` sin cambiar tenant enforcement;
- rutas cubiertas por `B5a-1`: `PATCH /panel/reservations/:id`, `GET /locals/:id/reservations`, `GET /activity`, `GET /panel/calendar/month`, `GET /panel/calendar/day` y `PATCH /panel/calendar/day`;
- validacion de `B5a-1`: `pnpm -C functions/api typecheck` OK y verificaciones manuales cortas de runtime OK;
- `B5a-1` queda cerrado como checkpoint implementado para este corte;
- `B5a-2 Shell Auth Gating` quedo implementado y validado para este corte: el shell autenticado de `app/panel/(authenticated)` centraliza el gate, distingue estados uniformes de acceso y el dashboard ya no mantiene verificacion local dispersa de sesion;
- archivos frontend cubiertos por `B5a-2`: `apps/web-next/app/panel/(authenticated)/layout.tsx`, `apps/web-next/app/panel/(authenticated)/page.tsx`, `apps/web-next/lib/panelContext.tsx` y `apps/web-next/lib/api.ts`;
- validacion de `B5a-2`: `pnpm -C apps/web-next typecheck` OK y verificaciones manuales cortas de runtime OK para redirect sin sesion, sesion valida, refresh directo y panel live normal;
- `B5a-2` queda cerrado como checkpoint implementado para este corte;
- `B5a-3 Demo/Runtime Boundary` queda diferido y no prioritario en este corte: el demo actual sigue cumpliendo su funcion comercial con perfiles ficticios y numeros inflados, no hay bypass backend confirmado y no se justifica aumentar superficie de cambio ahora;
- la separación con `B5b` sigue siendo explícita: este estado resume seguridad de aplicación y control de acceso, no policies/RLS/datos.

### 6.2 Estado documental de `B5b`

- el discovery final de `B5b` quedó documentado en `docs/audits/B5B_SUPABASE_DATA_ACCESS_DISCOVERY.md`;
- `B5b` no se considera cerrado todavía para este corte;
- el riesgo principal sigue concentrado en el acceso efectivo a datos con `SUPABASE_SERVICE_ROLE` y el blast radius transversal del backend;
- los lookups públicos, `/payments/callback`, el drift SQL/env y la validación runtime de Supabase siguen abiertos como decisiones de mitigación o aceptación formal;
- `B5b-0 Runtime Supabase Validation` ya fue ejecutado parcialmente contra Supabase real y aporta evidencia suficiente para repriorizar el bloque;
- hallazgos runtime principales de `B5b-0`: `local_daily_ops` tenia RLS off; `orders` mantenia RLS on con policies publicas `SELECT` / `INSERT`; `locals` mantiene RLS on con `SELECT` publico; `ticket_types` y `table_types` tienen RLS off; `service_role` tiene `rolbypassrls=true`; RPC y columnas criticas existen en runtime;
- los grants observados indican exposicion amplia para `anon` y `authenticated` al menos en parte del set, pero el resultado recibido esta parcialmente truncado y no debe leerse como auditoria completa de grants;
- tras los checkpoints `local_daily_ops` y `orders`, la prioridad actual pasa a ser contencion focalizada de exposicion directa de datos en `locals`, con confirmacion de alcance sobre `reservations`, `ticket_types` y `table_types`;
- `SUPABASE_SERVICE_ROLE` sigue siendo importante, pero la decision de blast radius queda despues de contener la exposicion directa a nivel tabla/Data API;
- `/payments/callback` queda condicionado al alcance real de pagos del corte y el hardening RLS amplio no debe ejecutarse como una sola tanda;
- `B5b` debe trabajarse por bloques y mantenerse separado de `B5a`: este estado resume Supabase, datos, policies, RLS y blast radius, no auth/routing de aplicación.

### 6.3 Checkpoint `B5b-1 local_daily_ops`

- `public.local_daily_ops` fue remediado como primer slice de High-Risk Data Exposure Containment y versionado en `infra/sql/migrations/019_harden_local_daily_ops_data_api.sql`;
- el cambio aplicado y validado en Supabase live deja RLS on, elimina las policies abiertas previas y remueve grants de `anon` / `authenticated`;
- post-checks confirmados: `rls_enabled=true`, `force_rls=false`, `pg_policies` sin filas para la tabla y grants `anon` / `authenticated` en 0 filas;
- QA live aprobado: `GET /public/locals`, `GET /public/locals/by-slug/dlirio`, `POST /orders` free pass con QR/email, `POST /reservations`, `GET /panel/calendar/month`, `GET /panel/calendar/day` y `PATCH /panel/calendar/day`;
- el backend sigue operando via `SUPABASE_SERVICE_ROLE`; este checkpoint reduce exposicion directa por Data API, pero no cierra todavia el blast radius del service role;
- tras este primer slice, seguian pendientes `orders`, `locals`, `reservations`, `ticket_types` y `table_types`.

### 6.4 Checkpoint `B5b-2 orders`

- `public.orders` fue remediado como segundo slice de High-Risk Data Exposure Containment y versionado en `infra/sql/migrations/020_harden_orders_data_api.sql`;
- el cambio aplicado y validado en Supabase live mantiene RLS on, elimina las policies publicas abiertas `orders_insert_by_local` / `orders_select_by_local` y remueve grants de `anon` / `authenticated`;
- post-checks confirmados: `rls_enabled=true`, `force_rls=false`, `pg_policies` sin filas para la tabla y grants `anon` / `authenticated` en 0 filas;
- QA live aprobado: `POST /orders` free pass, orden creada, QR/email, `GET /public/orders?email=...`, `GET /orders/:id`, `GET /panel/orders/summary`, `GET /panel/orders/search`, `PATCH /panel/checkin/:token`, `GET /activity`, `GET /metrics/summary`, `GET /panel/calendar/month` y `GET /panel/calendar/day`;
- los campos de ventana `intended_date`, `valid_from`, `valid_to` y `valid_window_key` siguen devolviendose correctamente;
- los endpoints publicos de ordenes se mantienen temporalmente y quedan para un slice posterior; este checkpoint reduce exposicion directa por Data API sobre la tabla cruda `orders`;
- el backend sigue operando via `SUPABASE_SERVICE_ROLE`; este checkpoint no cierra el blast radius del service role;
- `B5b` no queda cerrado completo: siguen pendientes `locals`, `reservations`, `ticket_types`, `table_types`, endpoints publicos de ordenes, blast radius de `SUPABASE_SERVICE_ROLE` y drift SQL/env.

## 7. Controles visibles existentes

| Control visible | Capa | Lectura operativa | Estado |
| --- | --- | --- | --- |
| `panelAuth` | backend/panel | valida bearer, resuelve `panel_users`, devuelve `401/403` y loguea eventos | `Confirmado` |
| `requireRole(...)` | backend/panel | restringe rutas por rol y loguea fallos | `Confirmado` |
| tenant checks por `local_id` | backend/panel | reducen acceso cruzado entre locales | `Confirmado` |
| guardas `verifyClubOnly(...)` | backend/panel | acotan rutas sensibles al tipo de local correcto | `Confirmado` |
| CORS por `FRONTEND_ORIGIN` | backend | allowlist visible, pero con drift local `5173` vs `5174` | `Parcial` |
| rate limiting | backend | publico activo; panel depende de `RATE_LIMIT_PANEL`; store en memoria | `Parcial` |
| `x-request-id` | backend | correlaciona requests y respuestas | `Confirmado` |
| error logging estructurado | backend | stack solo en `development` para respuestas | `Confirmado` |
| validaciones de input | rutas publicas | visibles en lookup de ordenes, ordenes publicas, pagos y reviews | `Confirmado` |
| `PATCH /orders/:id/use` publico en `410` | backend | evita seguir usando el flujo legacy publico de check-in/uso | `Confirmado` |
| soporte panel con roles y logs acotados | backend/panel | `support/status` y `support/access` exigen rol y evitan loguear emails en errores de acceso | `Confirmado` |
| demo gating por `NEXT_PUBLIC_ENABLE_PANEL_DEMO` | panel | limita demo runtime a flag explicito, pero no elimina la superficie | `Parcial` |
| RLS endurecida para tracking/promos/reviews | SQL | backend-only para slices `016`/`017`/`018` | `Confirmado` |
| wiring minimo de Sentry panel | panel | existe en codigo, pero captura real depende de DSN/runtime | `Parcial` |

Evidencia principal:

- `functions/api/src/middlewares/requestId.ts`
- `functions/api/src/middlewares/error.ts`
- `functions/api/src/routes/orders.ts`
- `functions/api/src/routes/public.ts`
- `functions/api/src/routes/payments.ts`
- `functions/api/src/routes/reviews.ts`
- `functions/api/src/routes/support.ts`
- `apps/web-next/lib/panel-demo/runtime.ts`
- `apps/web-next/instrumentation.ts`
- `apps/web-next/sentry.client.config.ts`
- `apps/web-next/app/global-error.tsx`
- `infra/sql/migrations/016_harden_tracking_rls_backend_only.sql`
- `infra/sql/migrations/017_harden_promos_rls_backend_only.sql`
- `infra/sql/migrations/018_harden_reviews_rls_backend_only.sql`
- `docs/audits/STATUS.md`
- `docs/audits/SMOKE_TESTS_V1.md`

Estado del bloque: `Parcial`.

## 8. Datos, secretos y dependencias criticas

### 8.1 Secretos y variables de mayor impacto

| Item | Capa | Impacto si falla o se expone | Estado |
| --- | --- | --- | --- |
| `SUPABASE_SERVICE_ROLE` | backend | acceso amplio a datos y mayor blast radius transversal | `Confirmado` |
| `RESEND_API_KEY` | backend | afecta correo transaccional y confianza operacional | `Confirmado` |
| `REVIEW_HASH_PEPPER` | backend | impacta anti-abuso y consistencia de reviews | `Confirmado` |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | panel | afecta observabilidad real de errores | `Parcial` |
| `NEXT_PUBLIC_API_URL` / `VITE_API_URL` | panel/B2C | definen a que backend se expone cada superficie | `Confirmado` |
| `NEXT_PUBLIC_SUPABASE_*` | panel | bootstrap de auth y acceso frontend | `Confirmado` |
| `FRONTEND_ORIGIN` | backend | define allowlist CORS real | `Parcial` |
| `TRUST_PROXY_HOPS` | backend | influye en IP/origen y logs tras proxy | `Parcial` |
| `RATE_LIMIT_PANEL` | backend | puede dejar panel sin limiter activo si no se configura | `Parcial` |
| `NEXT_PUBLIC_ENABLE_PANEL_DEMO` | panel | mantiene o cierra la superficie demo | `Parcial` |

### 8.2 Tablas y dominios de mayor sensibilidad

- `panel_users`: auth-critica porque traduce identidad Supabase a acceso panel y `local_id`;
- `orders`: cruza compra, lookup publico, callback de pagos, panel, check-in, export y metricas;
- `reservations`: cruza reserva publica, panel y export;
- `locals` y `local_daily_ops`: afectan disponibilidad, ventanas operativas y multiples flows;
- `payment_events`: clave para callback e idempotencia;
- `ticket_types` y `table_types`: contratos de catalogo criticos con cobertura SQL visible incompleta.

Evidencia principal:

- `functions/api/src/services/supabase.ts`
- `functions/api/src/routes/orders.ts`
- `functions/api/src/routes/payments.ts`
- `functions/api/src/routes/reservations.ts`
- `infra/sql/rls.sql`
- `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`

Estado del bloque: `Parcial`.

## 9. Riesgos y blast radius

Los riesgos mas criticos que siguen visibles hoy son:

1. `SUPABASE_SERVICE_ROLE` amplifica el blast radius del backend completo. El control real esta centralizado en codigo backend y no en una capa SQL ya cerrada por tabla/flujo.
2. `GET /public/orders?email=...` sigue existiendo como contrato/backend preservado. Aunque `MisEntradas` no este hoy en la superficie publica activa, el endpoint sigue siendo un riesgo residual aceptado.
3. `/payments/callback` y `payment_events` son superficies criticas. El repo muestra callback e idempotencia, pero no alcanza para cerrar autenticidad del proveedor ni exposicion productiva final.
4. La postura RLS general sigue `Parcial`. Las migraciones `016`/`017`/`018` endurecen slices concretas, pero `infra/sql/rls.sql` sigue mostrando politicas permisivas en zonas criticas.
5. `orders`, `reservations`, `locals` y `local_daily_ops` tienen blast radius alto por acople transversal entre B2C, panel, metricas y operacion diaria.
6. `panel.ts` sigue concentrando dominios sensibles aunque ya hubo extracciones parciales a `panelCatalog.ts` y `panelLocal.ts`.
7. La observabilidad visible en codigo no equivale a cobertura productiva confirmada. La captura real con DSN activo sigue dependiendo de entorno.
8. El modo demo del panel permanece como residual de hardening mientras el flag y las rutas demo sigan disponibles.

Evidencia principal:

- `docs/audits/STATUS.md`
- `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`
- `docs/audits/HARDENING_ROADMAP.md`
- `functions/api/src/routes/public.ts`
- `functions/api/src/routes/orders.ts`
- `functions/api/src/routes/payments.ts`
- `functions/api/src/routes/panel.ts`
- `infra/sql/rls.sql`

Estado del bloque: `Parcial`.

## 10. Hardening pendiente

Pendientes sustentados hoy por repo y docs:

- cerrar o acotar mejor el blast radius del modelo backend basado en `SUPABASE_SERVICE_ROLE`;
- completar o validar cobertura RLS de tablas criticas fuera de tracking/promos/reviews;
- definir el destino final del lookup publico de ordenes y de la base preservada de `MisEntradas`;
- validar autenticidad/proveedor y exposicion final de `/payments/callback`;
- decidir cleanup de demo-only: flag, rutas y overrides visuales del panel demo;
- alinear `.env.example`, CORS y despliegue visible con el runtime real;
- validar captura real de Sentry y cobertura operativa de observabilidad;
- mejorar disciplina de release/rollback y troubleshooting productivo, hoy documentada de forma parcial.

Lo que no aparece sustentado como cerrado no debe venderse como hardening resuelto.

Evidencia principal:

- `docs/audits/HARDENING_ROADMAP.md`
- `docs/audits/STATUS.md`
- `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`
- `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md`

Estado del bloque: `Parcial`.

## 11. Drift o ambiguedades detectados

- `docs/audits/TAIRET_TECH_AUDIT_MVP.md` se declara historico y no debe leerse como fuente operativa primaria.
- hallazgos viejos del audit historico sobre logout ya quedaron superados por codigo actual y por docs posteriores; hoy el panel usa `supabase.auth.signOut(...)` y limpia el cookie legacy.
- coexisten `infra/sql/rls.sql` permisivo y migraciones endurecidas para slices concretas; el repo no cierra por si solo que esta desplegado exactamente en cada entorno.
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md` ya documenta drift de entorno relevante para seguridad operativa: `5173` vs `5174`, examples de env incompletos y mismatch `SUPABASE_SERVICE_ROLE_KEY` vs `SUPABASE_SERVICE_ROLE`.
- el estado final de exposicion publica productiva para panel/API y la cobertura real de Sentry siguen en `Requiere validacion`.
- `SMOKE_TESTS_V1.md` y `MATRIZ_VALIDACION_PREVIA_V1.md` siguen siendo utiles, pero parte de su valor depende del corte runtime en que fueron ejecutados; no reemplazan verificacion productiva.

Estado del bloque: `Confirmado`.

## 12. Estado por bloque

| Bloque | Estado | Lectura corta |
| --- | --- | --- |
| Superficies B2C publicas | `Parcial` | existen controles puntuales, pero siguen siendo anonimas y con riesgos residuales |
| Auth y autorizacion panel | `Confirmado` | el modelo base esta implementado y visible en codigo |
| Guardrails backend | `Parcial` | request tracing, logging, CORS y limiter existen, pero no cierran por si solos la postura final |
| SQL / RLS / acceso a datos | `Parcial` | hay endurecimiento por slices, no cierre general |
| Observabilidad y error handling | `Parcial` | wiring visible; captura real productiva aun no demostrada |
| Demo isolation | `Parcial` | hay flag, pero la superficie demo sigue presente |
| Entorno y despliegue | `Requiere validacion` | la topologia final y parte del wiring operativo no son cerrables solo desde repo |

## 13. Que documentos deberian escribirse despues de este

- una matriz de acceso a datos por tabla y flujo real, con foco en `SUPABASE_SERVICE_ROLE`, `panel_users`, `orders`, `reservations`, `locals` y `local_daily_ops`;
- un runbook de incidentes y errores operativos que conecte `requestId`, Sentry, soporte y troubleshooting;
- un checklist final de go-live de hardening con gates claros para demo cleanup, envs, callback de pagos, observabilidad y rollout.
