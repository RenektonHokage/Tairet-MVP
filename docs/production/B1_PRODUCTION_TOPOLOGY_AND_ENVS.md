# B1_PRODUCTION_TOPOLOGY_AND_ENVS

## 1. Propósito del documento

Este documento cierra documentalmente el bloque `B1 — Topología productiva y envs` del remediation plan de Tairet.

Su función es dejar explícitos:

- la topología objetivo conocida para este corte;
- los hosts por superficie;
- el inventario funcional de variables de entorno críticas;
- los drifts y pendientes que siguen abiertos;
- el criterio de cierre verificable para pasar a `B2`.

No cubre deploy, rollback, migraciones ni release operativo detallado. Eso queda fuera de `B1`.

## 2. Alcance de B1

Este bloque consume como decisiones de entrada del corte:

- alcance del go-live: `free_pass only`;
- B2C: host objetivo decidido para `B1` `https://tairet.com.py`;
- panel: host temporal aceptado `https://tairet-mvp-web-next.vercel.app/`;
- API: host real definido para este corte `https://tairetapi-production.up.railway.app/`;
- demo aceptado en producción por ruta no enlazada;
- rutas demo válidas: `/panel/demo/bar`, `/panel/demo/discoteca`, `/panel/demo/off`.

Fuentes base consumidas:

- `docs/production/GO_LIVE_REMEDIATION_PLAN.md`
- `docs/production/B0_GO_LIVE_DECISIONS_AND_OWNERSHIP.md`
- `docs/production/PRODUCTION_READINESS_AND_GO_LIVE_CHECKLIST.md`
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`
- `docs/audits/**`
- código visible en `apps/web-b2c/**`, `apps/web-next/**`, `functions/api/**`

Tratamiento de auditorías:

- `docs/audits/STATUS.md`, `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md` y docs v1 derivados se usan como soporte operativo vigente;
- `docs/audits/TAIRET_TECH_AUDIT_MVP.md` se trata solo como `snapshot histórico`, no como fuente operativa primaria para cerrar topología o envs.

## 3. Topología productiva conocida hoy

La topología objetivo para este corte queda documentada así:

- B2C público en `https://tairet.com.py`;
- panel en `https://tairet-mvp-web-next.vercel.app/` como host temporal aceptado;
- API en `https://tairetapi-production.up.railway.app/`;
- el B2C consume backend vía `VITE_API_URL`;
- el panel consume backend vía `NEXT_PUBLIC_API_URL`;
- la API debe permitir por `FRONTEND_ORIGIN` los origins browser reales del B2C y del panel;
- el demo no vive en un host aparte: comparte host del panel y se expone solo por rutas no enlazadas.

Lectura operativa de esta topología:

- el alcance productivo confirmado para este corte sigue siendo `free_pass only`;
- el host de panel es válido para cerrar `B1`, pero sigue siendo temporal desde el punto de vista del remediation plan;
- el host B2C queda decidido para `B1`, pero el runtime/canonical visible hoy en repo/docs todavía apunta a `https://www.tairet.com.py`, por lo que el estado efectivo del host queda en `Requiere validación`;
- el host de API queda fijado como destino operativo de este corte, aunque el repo no exponga metadata de plataforma suficiente para demostrar Railway por sí solo.

**Evidencia principal**

- `apps/web-b2c/index.html`
- `apps/web-b2c/public/robots.txt`
- `apps/web-b2c/public/sitemap.xml`
- `apps/web-b2c/src/pages/para-locales/PublicaTuLocal.tsx`
- `apps/web-next/lib/api.ts`
- `apps/web-next/lib/panel-demo/runtime.ts`
- `functions/api/src/middlewares/cors.ts`
- `functions/api/src/services/emails.ts`
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`
- `docs/audits/STATUS.md`

## 4. Superficies y hosts

| Superficie | Host decidido o visible | Rol | Estado | Nota operativa |
| --- | --- | --- | --- | --- |
| B2C | `https://tairet.com.py` | frontend público | `Definido para B1 / Requiere validación runtime` | la decisión de este corte usa apex; repo y docs SEO siguen fijando `https://www.tairet.com.py` como canonical visible |
| Panel | `https://tairet-mvp-web-next.vercel.app/` | panel B2B | `Temporal pero cerrado para B1` | suficiente para cerrar topología del bloque; no implica que sea dominio final |
| API | `https://tairetapi-production.up.railway.app/` | backend/API | `Cerrado para B1` | host definido para este corte; la plataforma real no queda demostrada solo por metadata del repo |
| Demo panel | mismo host del panel bajo `/panel/demo/*` | demo comercial/controlada | `Aceptado con riesgo` | no agrega origin separado; comparte origin con el panel live |

Notas de interpretación:

- `B1` cierra topología objetivo y relación entre superficies; no valida todavía que cada host responda con el build correcto.
- el estado del B2C no queda como `Cerrado` porque la publicación efectiva del host todavía debe validarse en runtime.
- el demo aceptado por ruta no enlazada sigue siendo una decisión operativa de este corte, no una eliminación del riesgo.

## 5. Variables de entorno críticas por superficie

### 5.1 B2C

| Variable | Rol funcional | Criticidad | Obligatoria para go-live | Evidencia principal |
| --- | --- | --- | --- | --- |
| `VITE_API_URL` | base URL de la API consumida por el B2C | Alta | Sí | `apps/web-b2c/src/constants.ts`, `apps/web-b2c/src/lib/api.ts`, `apps/web-b2c/src/lib/locals.ts`, `apps/web-b2c/.env.example` |
| `VITE_MAPBOX_TOKEN` | habilita mapas reales en perfiles y vistas con mapa | Media/Alta | Sí, si el mapa sigue activo en producción | `apps/web-b2c/src/components/shared/MapSection.tsx`, `apps/web-b2c/.env.example` |
| `VITE_MAPBOX_DIAGNOSTICS` | habilita diagnósticos de mapa en dev/runtime | Baja | No | `apps/web-b2c/src/components/shared/MapSection.tsx` |

### 5.2 Panel

| Variable | Rol funcional | Criticidad | Obligatoria para go-live | Evidencia principal |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | bootstrap cliente Supabase del panel | Alta | Sí | `apps/web-next/lib/supabase.ts`, `apps/web-next/.env.example` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | auth y cliente público Supabase del panel | Alta | Sí | `apps/web-next/lib/supabase.ts`, `apps/web-next/.env.example` |
| `NEXT_PUBLIC_API_URL` | base URL del backend desde el panel | Alta | Sí | `apps/web-next/lib/api.ts`, `apps/web-next/lib/panel.ts` |
| `NEXT_PUBLIC_ENABLE_PANEL_DEMO` | habilita runtime demo y rutas `/panel/demo/*` | Alta | Condicionada: debe quedar explícita según la decisión de mantener demo | `apps/web-next/lib/panel-demo/runtime.ts`, `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry client-side del panel | Media | Condicionada: solo si Sentry se declara operativo | `apps/web-next/sentry.client.config.ts`, `apps/web-next/.env.example` |
| `SENTRY_DSN` | wiring Sentry server/edge del panel | Media | Condicionada: solo si Sentry se declara operativo | `apps/web-next/instrumentation.ts`, `apps/web-next/.env.example` |
| `NEXT_PUBLIC_POSTHOG_KEY` | analytics PostHog del panel | Media | No gate directo | `apps/web-next/lib/posthog.ts`, `apps/web-next/.env.example` |
| `NEXT_PUBLIC_POSTHOG_HOST` | host de PostHog | Media | No gate directo | `apps/web-next/lib/posthog.ts`, `apps/web-next/.env.example` |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | contacto de soporte en settings | Media | No gate directo | `apps/web-next/app/panel/(authenticated)/settings/page.tsx` |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | contacto de soporte en settings | Media | No gate directo | `apps/web-next/app/panel/(authenticated)/settings/page.tsx` |
| `NEXT_PUBLIC_SITE_URL` | presente en example, sin uso visible confirmado | Baja | No | `apps/web-next/.env.example`, `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | presente en example, sin uso visible confirmado | Baja | No | `apps/web-next/.env.example`, `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md` |

### 5.3 API

| Variable | Rol funcional | Criticidad | Obligatoria para go-live | Evidencia principal |
| --- | --- | --- | --- | --- |
| `SUPABASE_URL` | base URL de Supabase en backend | Alta | Sí | `functions/api/src/services/supabase.ts`, `functions/api/.env.example` |
| `SUPABASE_SERVICE_ROLE` | credencial privilegiada del backend | Alta | Sí | `functions/api/src/services/supabase.ts`, `docs/security/SECURITY_AND_HARDENING_STATUS.md` |
| `FRONTEND_ORIGIN` | allowlist CORS de orígenes browser autorizados | Alta | Sí | `functions/api/src/middlewares/cors.ts`, `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md` |
| `PORT` | puerto de escucha del servicio | Media | Sí | `functions/api/src/index.ts`, `functions/api/.env.example` |
| `TRUST_PROXY_HOPS` | número de proxies de confianza en producción | Media | Sí, si la API queda detrás de proxy/CDN | `functions/api/src/server.ts`, `functions/api/src/routes/support.ts` |
| `RATE_LIMIT_PANEL` | activa rate limit sobre superficie `/panel` | Media | Sí, si el hardening de panel se opera con este control | `functions/api/src/middlewares/rateLimit.ts`, `functions/api/src/routes/support.ts` |
| `NODE_ENV` | activa trust proxy y shape de errores | Media | Sí | `functions/api/src/server.ts`, `functions/api/src/middlewares/error.ts` |
| `CLUB_VALID_WINDOW_CUTOFF_ISO` | cutoff funcional para ventana de check-in/compatibilidad | Media | Sí, si la lógica de ventana sigue vigente | `functions/api/src/services/weekendWindow.ts`, `functions/api/.env.example` |
| `REVIEW_HASH_PEPPER` | pepper para hashing de reviews | Media | Sí | `functions/api/src/routes/reviews.ts` |
| `RESEND_API_KEY` | envío real de emails | Media/Alta | Condicionada: obligatoria si email productivo sale del gate stub | `functions/api/src/services/emails.ts`, `functions/api/.env.example` |
| `EMAIL_FROM_ADDRESS` | remitente operativo de emails | Media | Condicionada: junto a email productivo | `functions/api/src/services/emails.ts`, `functions/api/.env.example` |
| `EMAIL_ENABLED` | activa envío real vs stub | Media/Alta | Condicionada: junto a email productivo | `functions/api/src/services/emails.ts`, `functions/api/src/routes/support.ts`, `functions/api/.env.example` |
| `B2C_BASE_URL` | base URL usada en enlaces de email | Media | Sí si el correo debe apuntar al host productivo correcto | `functions/api/src/services/emails.ts`, `functions/api/.env.example` |

### 5.4 Aclaración operativa sobre `FRONTEND_ORIGIN`

`FRONTEND_ORIGIN` no representa el host del backend. Representa la allowlist CORS de los orígenes browser que pueden invocar la API.

Para este corte:

- su forma operativa esperable es una lista separada por comas;
- debe cubrir al menos el origin live del B2C y el origin live del panel;
- el demo no agrega un origin nuevo porque vive bajo el mismo host del panel;
- si `https://www.tairet.com.py` sigue sirviendo tráfico browser real y no solo redirección, eso debe resolverse como validación adicional del allowlist.

**Evidencia principal**

- `functions/api/src/middlewares/cors.ts`
- `functions/api/.env.example`
- `apps/web-b2c/src/constants.ts`
- `apps/web-next/lib/api.ts`
- `docs/audits/TAIRET_TECH_AUDIT_MVP.md` solo como contexto histórico para drift de CORS

## 6. Drifts y pendientes

- decisión de `B1`: `https://tairet.com.py` como host objetivo B2C; repo y docs SEO visibles siguen fijando `https://www.tairet.com.py`;
- drift local `5173` vs `5174`: `apps/web-b2c/vite.config.ts` fija `5174`, mientras `docs/RUNBOOK.md` y defaults CORS siguen en `5173`;
- mismatch `SUPABASE_SERVICE_ROLE_KEY` vs `SUPABASE_SERVICE_ROLE` resuelto en `functions/api/.env.example`; `SUPABASE_SERVICE_ROLE` queda como nombre canonical del backend/API;
- `.env.example` de API no cubre `FRONTEND_ORIGIN`, `RATE_LIMIT_PANEL`, `TRUST_PROXY_HOPS` ni `REVIEW_HASH_PEPPER`;
- `.env.example` del panel no cubre `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ENABLE_PANEL_DEMO`, `NEXT_PUBLIC_SUPPORT_WHATSAPP` ni `NEXT_PUBLIC_SUPPORT_EMAIL`;
- defaults CORS locales no están alineados con topología live;
- el host del panel se cierra como temporal, no como dominio final;
- el demo sigue expuesto por ruta no enlazada con riesgo aceptado explícitamente;
- las decisiones de entrada usadas en este corte para `B1` no están reflejadas íntegramente en el archivo actual de `docs/production/B0_GO_LIVE_DECISIONS_AND_OWNERSHIP.md`; si `B0` sigue siendo fuente viva, esa sincronización documental queda pendiente.

**Evidencia principal**

- `apps/web-b2c/vite.config.ts`
- `docs/RUNBOOK.md`
- `functions/api/.env.example`
- `apps/web-next/.env.example`
- `functions/api/src/middlewares/cors.ts`
- `docs/production/B0_GO_LIVE_DECISIONS_AND_OWNERSHIP.md`
- `docs/seo/SEO_FASE3_RUNBOOK.md`
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`

## 7. Criterio de cierre de B1

`B1` puede considerarse cerrado documentalmente cuando este documento deja explícitos y verificables los siguientes puntos:

- topología objetivo documentada por superficie;
- estado de cada host distinguido entre `definido para B1`, `temporal`, `cerrado para B1` y `requiere validación runtime`;
- inventario funcional de variables críticas por superficie;
- `FRONTEND_ORIGIN` descrito como allowlist CORS objetivo de origins browser, no como host único;
- drifts y pendientes documentados sin esconder contradicciones;
- dependencias externas visibles mapeadas para destrabar `B2`.

Este cierre no implica que el runtime ya esté validado en producción. Implica que el bloque deja una base operativa suficientemente clara para pasar a deploy/rollback/migraciones con menos ambigüedad.

## 8. Requiere validación

- que `https://tairet.com.py` sea efectivamente el host servido del B2C y no solo el host objetivo decidido para este corte;
- si `https://www.tairet.com.py` seguirá como redirect-only o si todavía sirve contenido browser real;
- que el panel host `https://tairet-mvp-web-next.vercel.app/` responda con el build esperado para el entorno objetivo;
- que la API host `https://tairetapi-production.up.railway.app/` responda con el servicio esperado;
- que `FRONTEND_ORIGIN` desplegado cubra exactamente los origins browser requeridos;
- que las envs reales cargadas en B2C, panel y API coincidan con el inventario documentado;
- que `NEXT_PUBLIC_ENABLE_PANEL_DEMO` y las rutas `/panel/demo/*` estén en el estado aceptado por este corte;
- que Sentry, si se declara operativo, tenga DSN activo y captura efectiva.

## 9. Dependencias que destraba B1

- destraba `B2` al dejar definidos hosts objetivo, bases URL y variables críticas por superficie;
- destraba `B3` al dejar explícito que el demo comparte host del panel y depende de `NEXT_PUBLIC_ENABLE_PANEL_DEMO`;
- destraba `B6` al dejar claro qué host/API/origins deben observarse y cómo entra `FRONTEND_ORIGIN` en la operación;
- destraba `B7` al dejar identificados los endpoints y hosts que deben entrar en smoke y validación manual.
