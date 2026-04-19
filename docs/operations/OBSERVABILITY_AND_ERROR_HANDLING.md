# OBSERVABILITY_AND_ERROR_HANDLING

## 1. Proposito del documento

Este documento resume la capa observable de observabilidad y manejo de errores de Tairet a partir de codigo y documentacion vigente del repo.

Sirve como base para:

- troubleshooting;
- operacion real;
- hardening final;
- readiness de produccion;
- checklist de salida a produccion.

Regla aplicada de fuente de verdad:

1. codigo del repo;
2. `docs/audits/**` y documentacion operativa vigente;
3. runtime/entorno solo cuando el codigo no alcanza;
4. todo lo no demostrable queda como `Requiere validacion`.

Este documento no afirma que Sentry, PostHog o cualquier herramienta externa esten operativas en produccion si el repo solo muestra wiring, helpers o variables.

## 2. Como leer este documento

Estados usados:

- `Confirmado`: existe evidencia directa en codigo o docs vigentes.
- `Parcial`: hay implementacion o wiring real, pero la cobertura depende de entorno, runtime o no cubre todas las capas.
- `Requiere validacion`: el repo no alcanza para cerrar efectividad real, despliegue, captura productiva o uso operativo.

Convencion importante:

- "wiring visible" no equivale a "herramienta operativa".
- "log visible" no equivale a "alerta, dashboard o agregacion centralizada".
- "tracking de producto" en este documento incluye eventos propios guardados en backend, no solo herramientas SaaS externas.

## 3. Resumen ejecutivo de observabilidad y errores

La postura observable actual es parcial:

- el backend tiene el bloque mas concreto: `x-request-id`, logger JSON basico, `errorHandler`, logs estructurados en `panelAuth` y `requireRole(...)`, `/health` y rutas de soporte del panel;
- el panel Next tiene wiring minimo de Sentry en `instrumentation.ts`, `sentry.client.config.ts` y `app/global-error.tsx`, pero la captura real depende de DSN y runtime;
- el B2C no muestra Sentry/PostHog ni error boundary dedicado; maneja errores principalmente con `toast`, estados locales, `console.error` y `console.warn`;
- existen senales propias de producto en backend: `events_public`, `whatsapp_clicks`, `profile_views`, `/activity` y `/metrics`;
- PostHog existe como dependencia/helper del panel, pero no hay llamadas confirmadas a `initPostHog(...)` o `trackEvent(...)`;
- no hay evidencia de agregacion centralizada de logs, alertas, dashboards operativos, incident runbook o correlacion visible para soporte desde frontend.

Lectura corta:

- backend request tracing: `Confirmado`;
- backend observabilidad end-to-end: `Parcial`;
- Sentry panel: `Parcial`;
- Sentry productivo con DSN activo: `Requiere validacion`;
- B2C error tracking: `Requiere validacion`;
- PostHog/analytics SaaS: `Requiere validacion`.

## 4. Fuentes revisadas

### 4.1 Fuentes obligatorias de `docs/audits/**`

| Fuente | Estado para observabilidad | Uso en este documento |
| --- | --- | --- |
| `docs/audits/STATUS.md` | vigente | fuente principal de estado `F3`, Sentry remanente, `requestId` y residuales |
| `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md` | vigente | fuente de `RC-05`, `RV-13` a `RV-16` y `PN-04` |
| `docs/audits/HARDENING_ROADMAP.md` | vigente | marco de observabilidad y guardrails |
| `docs/audits/BASELINE_FUNCIONAL_V1.md` | parcialmente vigente | baseline historico inmediato; error middleware y Sentry ya fueron parcialmente mitigados |
| `docs/audits/MATRIZ_VALIDACION_PREVIA_V1.md` | parcialmente vigente | separa confirmaciones por codigo de validaciones runtime |
| `docs/audits/SMOKE_TESTS_V1.md` | parcialmente vigente | evidencia de validaciones locales, no reemplaza produccion |
| `docs/audits/CONTRATOS_CONGELADOS_V1.md` | vigente para contexto | confirma modelo de acceso y contratos que condicionan observabilidad |
| `docs/audits/TAIRET_TECH_AUDIT_MVP.md` | snapshot historico | no es fuente operativa primaria; algunos findings fueron superados parcialmente |
| `docs/audits/AGENT.md` | guia de trabajo | no se usa como evidencia primaria |

Hallazgos de auditoria que siguen vigentes:

- `F3` esta activa con `CODE 01`, `CODE 02`, `CODE 03` y `CODE 04A` implementados/validados segun `STATUS.md`;
- `RV-13`, `RV-14` y `RV-15` siguen como validacion posterior de cobertura mas amplia;
- `RV-16` sigue como dependencia de entorno para captura real de Sentry con DSN activo;
- `PN-04` sigue como residual no bloqueante por warning de `require-in-the-middle` / OpenTelemetry / `@sentry/nextjs`;
- `RC-05` sigue parcialmente mitigado, no cerrado como observabilidad completa.

### 4.2 Fuentes de codigo y docs operativas

- `docs/architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md`
- `docs/architecture/FUNCTIONAL_FLOWS_E2E.md`
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`
- `docs/RUNBOOK.md`
- `docs/panel/PANEL_ANALYTICS_SOURCE_OF_TRUTH.md`
- `docs/docs/CHECKLIST_MVP_PANEL.md`
- `apps/web-next/instrumentation.ts`
- `apps/web-next/sentry.client.config.ts`
- `apps/web-next/app/global-error.tsx`
- `apps/web-next/lib/sentry.ts`
- `apps/web-next/lib/posthog.ts`
- `apps/web-next/lib/api.ts`
- `apps/web-next/lib/panelContext.tsx`
- `apps/web-next/lib/support.ts`
- `apps/web-next/lib/activity.ts`
- `apps/web-b2c/src/lib/api.ts`
- `apps/web-b2c/src/lib/locals.ts`
- `apps/web-b2c/src/hooks/useProfileViewOnce.ts`
- `apps/web-b2c/src/hooks/useReviews.ts`
- `apps/web-b2c/src/pages/ReservaForm.tsx`
- `apps/web-b2c/src/components/shared/CheckoutBase.tsx`
- `functions/api/src/server.ts`
- `functions/api/src/utils/logger.ts`
- `functions/api/src/middlewares/requestId.ts`
- `functions/api/src/middlewares/error.ts`
- `functions/api/src/middlewares/panelAuth.ts`
- `functions/api/src/middlewares/requireRole.ts`
- `functions/api/src/routes/events.ts`
- `functions/api/src/routes/activity.ts`
- `functions/api/src/routes/public.ts`
- `functions/api/src/routes/orders.ts`
- `functions/api/src/routes/payments.ts`
- `functions/api/src/routes/support.ts`

## 5. Observabilidad por superficie

### 5.1 B2C

Lo confirmado:

- no se ve Sentry, PostHog ni error boundary dedicado en `apps/web-b2c`;
- las fallas de UI/flow se manejan con estados locales, `toast`, `console.error` y `console.warn`;
- `trackProfileView`, `trackWhatsappClick` y `trackPromoOpen` envian senales fire-and-forget hacia `/events/*`;
- `useProfileViewOnce` deduplica `profile_view` por sesion/local en `sessionStorage`;
- perfiles y catalogo tienen comportamiento DB-first con fallback a mocks/estaticos en zonas relevantes.

Limites:

- no hay evidencia de captura centralizada de errores B2C;
- el tracking fire-and-forget no bloquea UI, pero tampoco garantiza entrega observable al usuario u operador;
- los errores visibles al usuario dependen de cada pantalla/componente, no de un boundary global.

Evidencia principal:

- `apps/web-b2c/src/lib/api.ts`
- `apps/web-b2c/src/hooks/useProfileViewOnce.ts`
- `apps/web-b2c/src/lib/locals.ts`
- `apps/web-b2c/src/pages/ReservaForm.tsx`
- `apps/web-b2c/src/components/shared/CheckoutBase.tsx`
- `apps/web-b2c/src/hooks/useReviews.ts`

Estado del bloque: `Parcial`.

### 5.2 B2B / panel

Lo confirmado:

- `apps/web-next/instrumentation.ts` inicializa Sentry server/edge solo si existe `SENTRY_DSN` o `NEXT_PUBLIC_SENTRY_DSN`;
- `apps/web-next/sentry.client.config.ts` inicializa Sentry client-side solo si existe `NEXT_PUBLIC_SENTRY_DSN`;
- `apps/web-next/app/global-error.tsx` llama `Sentry.captureException(error)`;
- `next.config.mjs` ya no usa `withSentryConfig(...)`;
- el panel usa estados locales de error/loading en paginas como dashboard, orders, check-in y contexto del panel;
- `/panel/settings` consume `/panel/support/status` y `/panel/support/access` como diagnostico operativo minimo.

Limites:

- no hay evidencia de route-specific `error.tsx` por modulo del panel;
- `global-error` no prueba captura efectiva sin DSN activo;
- los errores de fetch se muestran con mensajes locales, pero no se ve que propaguen `x-request-id` hacia UI;
- `apps/web-next/lib/sentry.ts` conserva TODO legacy y no representa el wiring activo.

Evidencia principal:

- `apps/web-next/instrumentation.ts`
- `apps/web-next/sentry.client.config.ts`
- `apps/web-next/app/global-error.tsx`
- `apps/web-next/lib/sentry.ts`
- `apps/web-next/lib/panelContext.tsx`
- `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx`
- `apps/web-next/app/panel/(authenticated)/checkin/page.tsx`
- `apps/web-next/lib/support.ts`

Estado del bloque: `Parcial`.

### 5.3 Backend / API

Lo confirmado:

- `requestId` genera o preserva `x-request-id`, lo agrega al request y lo devuelve en response;
- `logger` emite JSON por `console.log(JSON.stringify(...))`;
- `errorHandler` loguea `requestId`, metodo, path, status, nombre y mensaje de error; incluye stack solo para `>=500` en log y solo en responses de `development`;
- `panelAuth` y `requireRole(...)` tienen logging estructurado de auth/authz con `requestId`;
- `/health` existe como health check basico;
- `/panel/support/status` expone diagnostico de tenant, email, rate limit y trust proxy para usuarios panel autorizados;
- rutas publicas y de panel tienen manejo local de errores con `logger.error`/`logger.warn` y responses JSON.

Limites:

- no hay evidencia de agregacion centralizada, retencion, alertas, dashboards o drains de logs;
- no hay evidencia de Sentry backend inicializado, aunque `@sentry/node` aparezca como dependencia;
- parte de los errores se manejan dentro de cada ruta y no necesariamente pasan por `errorHandler`;
- la cobertura de `500` naturales y ramas menos frecuentes sigue en validacion posterior segun auditoria.

Evidencia principal:

- `functions/api/src/server.ts`
- `functions/api/src/utils/logger.ts`
- `functions/api/src/middlewares/requestId.ts`
- `functions/api/src/middlewares/error.ts`
- `functions/api/src/middlewares/panelAuth.ts`
- `functions/api/src/middlewares/requireRole.ts`
- `functions/api/src/routes/support.ts`
- `docs/audits/STATUS.md`
- `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`

Estado del bloque: `Parcial`.

## 6. Captura de errores frontend

### 6.1 B2C

Patron visible:

- validaciones de formulario con feedback al usuario via `toast`;
- errores de reserva y checkout convertidos en mensajes visibles;
- errores de API en perfiles/catalogo con fallback o navegacion a `NotFound`;
- tracking de eventos envuelto en `try/catch` y `console.warn` para no bloquear UI;
- mapa y storage/localStorage con `try/catch` y errores en consola cuando aplica.

No confirmado:

- captura externa tipo Sentry en B2C;
- error boundary global;
- correlacion con backend por `x-request-id`;
- reporte operativo de excepciones de render.

Estado del bloque: `Parcial`.

### 6.2 B2B / panel

Patron visible:

- `global-error.tsx` captura errores globales de Next con Sentry;
- `PanelProvider` guarda `error` cuando falla el contexto del panel;
- paginas como dashboard, orders y check-in manejan errores de fetch con estado local y mensajes inline;
- check-in distingue tipos operativos de error: `invalid_token`, `already_used`, `window_invalid`, `forbidden`, `timeout`, `network`, `server`, `unknown`;
- login/sesion fallida redirige al operador a `/panel/login`.

No confirmado:

- captura efectiva de Sentry sin DSN activo;
- cobertura por ruta con `error.tsx` dedicado;
- inclusion de `requestId` backend en mensajes de UI;
- seguimiento centralizado de errores de fetch.

Estado del bloque: `Parcial`.

## 7. Captura de errores backend

El backend tiene tres capas visibles:

1. middleware transversal de request:
   - `requestId` propaga `x-request-id`;
   - CORS y rate limiting viven antes de rutas principales.

2. middleware de error:
   - `errorHandler` centraliza excepciones que llegan por `next(error)`;
   - loguea metadata operativa estructurada;
   - no expone stack salvo en `NODE_ENV === "development"`.

3. manejo local por rutas:
   - rutas como `public`, `orders`, `payments`, `reviews`, `events`, `activity`, `calendar`, `metrics`, `support` loguean fallas puntuales;
   - algunas ramas devuelven errores de negocio (`400`, `404`, `409`, `410`) sin pasar por `errorHandler`;
   - `payments` y `orders` usan logs en fallas de DB/callback/email.

Gaps:

- no hay trazas distribuidas;
- no hay captura backend externa confirmada;
- no hay runbook que indique como buscar un `requestId` en una plataforma de logs productiva;
- no se ve redaccion uniforme de error codes en todas las rutas.

Estado del bloque: `Parcial`.

## 8. Analytics y senales operativas visibles

### 8.1 Senales propias del sistema

Confirmado:

- B2C envia `profile_view`, `whatsapp_click` y `promo_open` a `/events/*`;
- backend persiste senales en `profile_views`, `whatsapp_clicks` y `events_public`;
- `/activity` compone actividad para panel desde `orders`, `reservations`, `payment_events`, `whatsapp_clicks`, `events_public`, `promos` y `profile_views`;
- `/metrics` alimenta dashboard/metricas con KPIs y series;
- `docs/panel/PANEL_ANALYTICS_SOURCE_OF_TRUTH.md` mapea dashboard, metricas, orders y reservas como superficies analiticas/operativas.

Estado: `Confirmado` para existencia de senales propias; `Parcial` para cobertura operativa total.

### 8.2 PostHog / GA4

Confirmado:

- `posthog-js` esta en `apps/web-next/package.json`;
- `apps/web-next/lib/posthog.ts` define `initPostHog()` y `trackEvent(...)`;
- `NEXT_PUBLIC_POSTHOG_KEY` y `NEXT_PUBLIC_POSTHOG_HOST` aparecen en el mapa operativo de envs.

No confirmado:

- no se ven llamadas reales a `initPostHog(...)` o `trackEvent(...)` en el arbol del panel;
- `docs/docs/CHECKLIST_MVP_PANEL.md` marca PostHog/GA4 como no realmente instrumentados;
- no hay evidencia de dashboards, eventos productivos ni validacion runtime.

Estado: `Requiere validacion`.

## 9. Logs, trazabilidad y debugging operativo

Lo que ayuda hoy:

- `x-request-id` permite correlacionar response y logs backend si el equipo tecnico puede acceder a la salida del proceso;
- `panelAuth` agrega `authStage`, `rejectionReason`, `localId` y rol en logs de auth/authz;
- `requireRole(...)` agrega `authorizationStage`, `requiredRoles`, `actualRole` y `rejectionReason`;
- `/health` sirve como check basico de API;
- `/panel/support/status` expone un diagnostico minimo de tenant, email, rate limit y trust proxy;
- `docs/RUNBOOK.md` incluye troubleshooting local basico y health check.

Lo que falta para operacion real:

- UI no muestra `requestId` al usuario/operador;
- frontends no parecen leer `response.headers.get("x-request-id")`;
- no hay procedimiento documentado para pedir un `requestId`, buscarlo en logs y cerrar incidente;
- no hay evidencia de log aggregation, retention, alerting ni dashboards;
- no hay severidad/alertas definidas para callbacks de pagos, check-in, export, reservas u ordenes.

Estado del bloque: `Parcial`.

## 10. Gaps y puntos ciegos

Gaps mas criticos:

1. Sentry panel tiene wiring minimo, pero la captura real con DSN activo sigue en `Requiere validacion`.
2. B2C no tiene error tracking dedicado visible.
3. PostHog existe como helper/dependencia, pero no hay uso confirmado; GA4 aparece como no instrumentado en checklist.
4. `x-request-id` existe en backend, pero no se ve consumido por frontend ni usado en un runbook de incidentes.
5. Los logs son JSON por stdout, sin evidencia de plataforma central, alertas, retencion o dashboards.
6. `@sentry/node` aparece en backend, pero no hay inicializacion backend visible.
7. `apps/web-next/lib/sentry.ts` mantiene TODO legacy, mientras el wiring activo vive en `instrumentation.ts`, `sentry.client.config.ts` y `global-error.tsx`.
8. El manejo de errores frontend es por pantalla/componente; no hay un contrato transversal de error UX.
9. Pagos/callback, check-in, export, reservas y orders no tienen alertas operativas visibles en repo.

Estado del bloque: `Parcial`.

## 11. Drift o ambiguedades detectados

- `TAIRET_TECH_AUDIT_MVP.md` y partes de `BASELINE_FUNCIONAL_V1.md` decian que el middleware de error usaba `console.error`; el codigo actual tiene `logger.error` en `errorHandler`, por lo que ese hallazgo quedo parcialmente superado.
- audits viejos marcaban Sentry panel como TODO en `apps/web-next/lib/sentry.ts`; el archivo legacy sigue con TODO, pero el wiring activo actual esta en `instrumentation.ts`, `sentry.client.config.ts` y `app/global-error.tsx`.
- `F3 CODE 04` original no quedo validado; `F3 CODE 04A` corrigio la regresion visible y dejo wiring minimo, pero no captura real confirmada.
- el warning local de `require-in-the-middle` / OpenTelemetry / `@sentry/nextjs` sigue clasificado como residual no bloqueante si no rompe arranque ni rutas del panel.
- `SYSTEM_ARCHITECTURE_OVERVIEW.md` y `ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md` ya advierten que Sentry/PostHog dependen de envs y runtime; este documento mantiene esa lectura.
- `docs/docs/CHECKLIST_MVP_PANEL.md` marca PostHog/GA4 como no realmente instrumentados, lo que limita cualquier afirmacion de analytics SaaS operativa.

Estado del bloque: `Confirmado`.

## 12. Estado por bloque

| Bloque | Estado | Lectura corta |
| --- | --- | --- |
| B2C observabilidad | `Parcial` | tracking propio y manejo local de errores, sin error tracking dedicado visible |
| Panel Sentry | `Parcial` | wiring minimo presente, captura real depende de DSN/runtime |
| Panel manejo de errores | `Parcial` | estados locales y `global-error`, sin boundaries por ruta visibles |
| Backend request tracing | `Confirmado` | `x-request-id` generado/preservado y devuelto en response |
| Backend logs | `Parcial` | logger JSON basico, sin agregacion/alertas visibles |
| `panelAuth` / `requireRole` observability | `Confirmado` | logs estructurados con stages y reasons |
| Analytics propias | `Parcial` | eventos y metricas existen, cobertura operativa total no cerrada |
| PostHog/GA4 | `Requiere validacion` | helper/envs visibles, uso real no confirmado |
| Runbooks de incidentes | `Requiere validacion` | hay troubleshooting local, no proceso de incidente end-to-end |

## 13. Que documentos deberian escribirse despues de este

- runbook de incidentes por flujo critico: reservas, orders, check-in, pagos/callback y soporte;
- matriz de senales por flujo: evento, log, requestId, UI visible, owner, severidad y accion esperada;
- checklist de validacion con DSN Sentry activo y entorno real;
- contrato operativo de errores frontend/backend, incluyendo si el `requestId` debe mostrarse al operador o soporte;
- mapa de analytics productivas reales si se activa PostHog/GA4 u otra herramienta.
