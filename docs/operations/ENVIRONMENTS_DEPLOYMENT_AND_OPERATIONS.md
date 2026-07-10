# ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS

## 1. Propósito del documento

Este documento resume la capa observable de entornos, despliegue y operación de Tairet a partir de código y documentación vigente del repo.

Sirve como base para:

- hardening;
- observabilidad;
- readiness de producción;
- operación diaria;
- troubleshooting;
- cleanup de demo y pre-producción.

Regla aplicada de fuente de verdad:

1. código del repo;
2. documentación operativa vigente del repo;
3. cualquier punto no demostrable queda marcado como `Requiere validación`.

No se listan secretos ni valores de entorno reales. Solo se documentan nombres de variables, rol funcional y criticidad operativa.

## 2. Resumen ejecutivo

La evidencia actual del repo muestra un monorepo PNPM con tres superficies principales:

- `apps/web-b2c`: frontend público B2C en React + Vite;
- `apps/web-next`: panel B2B en Next.js;
- `functions/api`: backend/API en Express + TypeScript.

La base operativa visible hoy es:

- arranque local manual por terminal separada;
- CI en GitHub Actions para install, build, lint y typecheck;
- integración principal con Supabase para auth, datos y storage;
- dependencias adicionales visibles para email, analytics, observabilidad y mapas;
- documentación operativa parcial para dominio público B2C y panel demo.

La base de operación no está cerrada end-to-end desde el repo:

- no hay deploy automation visible;
- no hay topología de hosting verificable para panel y API;
- no hay rollback general documentado;
- staging/preview existen solo como referencias parciales en docs o links puntuales;
- la capa de ejemplos `.env.example` tiene drift relevante respecto al runtime real del código.

**Evidencia principal**

- `package.json`
- `pnpm-workspace.yaml`
- `.github/workflows/ci.yml`
- `docs/RUNBOOK.md`
- `docs/architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md`
- `docs/architecture/FUNCTIONAL_FLOWS_E2E.md`

## 3. Entornos identificados

| Entorno | Evidencia observable | Qué cubre | Estado |
| --- | --- | --- | --- |
| Local | scripts `dev`, `RUNBOOK`, puertos por app, `.env.example` | desarrollo y troubleshooting manual | Confirmado por código/docs |
| CI | `.github/workflows/ci.yml`, `process.env.CI === "true"` en panel | install, build, lint, typecheck | Confirmado por código/docs |
| Demo panel | `NEXT_PUBLIC_ENABLE_PANEL_DEMO`, rutas `/panel/demo/*`, docs demo | escenarios demo front-only del panel | Confirmado por código/docs |
| Producción pública B2C | `index.html`, `robots.txt`, `sitemap.xml`, docs SEO | dominio canónico público B2C | Confirmado parcialmente por código/docs |
| Preview / staging | links Vercel en docs y referencias a preview | no alcanza para cerrar topología real | `Requiere validación` |
| Producción panel / API | no hay metadata de plataforma ni dominios explícitos en repo | hostnames y despliegue final | `Requiere validación` |

Diferencias operativas visibles:

- `local` usa puertos locales y defaults de fallback a `localhost`.
- `CI` permite build del panel aun sin envs de Supabase mediante un cliente dummy.
- `demo` altera el comportamiento del panel solo cuando la flag pública está encendida.
- `producción pública B2C` tiene evidencia fuerte de branding, canonical, robots y sitemap para `https://www.tairet.com.py`.
- `preview/staging` no tienen contrato de entorno verificable en repo.

### Autorizacion actual para QA controlado

`Tairet-DB` (`omteyctmrgahavgfaodw`) es el entorno actualmente autorizado para
QA controlado con fixtures sinteticos. Estas pruebas deben evitar datos
preexistentes, registrar todos los UUIDs creados y limpiar exclusivamente sus
propios fixtures al finalizar. Esta autorizacion operativa no define por si sola
un contrato formal de produccion o staging.

**Evidencia principal**

- `docs/RUNBOOK.md`
- `apps/web-next/lib/supabase.ts`
- `apps/web-next/lib/panel-demo/runtime.ts`
- `apps/web-b2c/index.html`
- `apps/web-b2c/public/robots.txt`
- `apps/web-b2c/public/sitemap.xml`
- `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md`
- `docs/seo/SEO_FASE3_RUNBOOK.md`

## 4. Despliegue por superficie

### B2C

`apps/web-b2c` es una app Vite con scripts `dev`, `build`, `build:dev` y `preview`.

Lo verificable hoy:

- en local corre con Vite;
- build de producción observable vía `vite build`;
- preview local observable vía `vite preview`;
- la app pública usa `HashRouter`;
- existe evidencia documental de dominio público B2C canónico en `https://www.tairet.com.py`.

Lo que no puede cerrarse desde el repo:

- la plataforma final de hosting;
- si el build sale desde Vercel, otro hosting estático o una combinación manual;
- cómo se publican rutas internas más allá del dominio home ya documentado.

### B2B / Panel

`apps/web-next` es una app Next.js con scripts `dev`, `build` y `start`.

Lo verificable hoy:

- el panel puede correr localmente con `next dev`;
- el runtime productivo esperado sería `next build` + `next start`;
- usa variables `NEXT_PUBLIC_*` en cliente y `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` para instrumentation;
- existe modo demo front-only activable por env.

Lo que no puede cerrarse desde el repo:

- si el panel está en Vercel, Node tradicional u otra plataforma;
- el dominio productivo real del panel;
- la relación exacta entre panel live y panel demo en deploy real.

### Backend / API

`functions/api` es un servicio Express/Node con scripts `dev`, `build` y `start`.

Lo verificable hoy:

- en local usa `tsx watch` con `.env`;
- en runtime compilado usa `tsc` + `node dist/index.js`;
- expone `/health`;
- usa CORS propio, trust proxy solo en producción y rate limiting opcional para `/panel`;
- depende de Supabase con `SUPABASE_SERVICE_ROLE`, email con Resend y utilidades operativas como QR/XLSX.

Lo que no puede cerrarse desde el repo:

- si está desplegado como servicio separado, función serverless o parte de otra plataforma;
- el hostname real de la API;
- la estrategia real de scaling, almacenamiento de logs y store distribuido para rate limit.

### Integraciones e infraestructura visibles

Integraciones visibles desde código/docs:

- Supabase;
- Resend;
- Sentry;
- PostHog;
- Mapbox;
- referencias parciales a Vercel.

No hay evidencia visible de:

- `vercel.json`;
- `.vercel/project.json`;
- Docker;
- Docker Compose;
- Railway/Fly/Render config;
- pipeline de deploy.

**Evidencia principal**

- `apps/web-b2c/package.json`
- `apps/web-next/package.json`
- `functions/api/package.json`
- `functions/api/src/server.ts`
- `functions/api/src/index.ts`
- `apps/web-next/next.config.mjs`

## 5. Variables y configuración de entorno

### B2C

| Variable | Rol funcional | Criticidad | Estado observable |
| --- | --- | --- | --- |
| `VITE_API_URL` | base URL de la API pública para B2C | Alta | Confirmada en código y `.env.example` |
| `VITE_MAPBOX_TOKEN` | token para mapa y geocapa visual | Media/Alta | Confirmada en código y `.env.example` |
| `VITE_MAPBOX_DIAGNOSTICS` | diagnósticos de mapa en dev | Baja | Confirmada en código |

### Panel

| Variable | Rol funcional | Criticidad | Estado observable |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | bootstrap cliente Supabase del panel | Alta | Confirmada en código y `.env.example` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | bootstrap auth del panel | Alta | Confirmada en código y `.env.example` |
| `NEXT_PUBLIC_API_URL` | base URL de la API desde panel | Alta | Confirmada en código, ausente en `.env.example` |
| `NEXT_PUBLIC_POSTHOG_KEY` | tracking PostHog del panel | Media | Confirmada en código y `.env.example` |
| `NEXT_PUBLIC_POSTHOG_HOST` | host de PostHog | Media | Confirmada en código y `.env.example` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry client-side del panel | Media | Confirmada en código y `.env.example` |
| `SENTRY_DSN` | Sentry server/edge instrumentation del panel | Media | Confirmada en código y `.env.example` |
| `NEXT_PUBLIC_ENABLE_PANEL_DEMO` | habilita runtime demo y rutas demo | Alta si demo sigue desplegado | Confirmada en código y docs, ausente en `.env.example` |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | contacto de soporte en `/panel/settings` | Media | Confirmada en código, ausente en `.env.example` |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | contacto de soporte en `/panel/settings` | Media | Confirmada en código, ausente en `.env.example` |
| `NEXT_PUBLIC_SITE_URL` | presente en `.env.example` | Baja / uso no confirmado | No se observa consumo visible relevante |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | presente en `.env.example` | Baja / uso no confirmado | No se observa consumo visible relevante |

### API

| Variable | Rol funcional | Criticidad | Estado observable |
| --- | --- | --- | --- |
| `SUPABASE_URL` | base URL de Supabase en backend | Alta | Confirmada en código y `.env.example` |
| `SUPABASE_SERVICE_ROLE` | credencial privilegiada de backend | Alta | Confirmada en código y `.env.example`; nombre canonical del backend/API |
| `FRONTEND_ORIGIN` | allowlist CORS de frontend(s) | Alta | Confirmada en código y docs, ausente en `.env.example` |
| `PORT` | puerto del backend | Media | Confirmada en código y `.env.example` |
| `TRUST_PROXY_HOPS` | trust proxy en producción | Media | Confirmada en código, ausente en `.env.example` |
| `RATE_LIMIT_PANEL` | activa rate limit sobre `/panel` | Media | Confirmada en código, ausente en `.env.example` |
| `CLUB_VALID_WINDOW_CUTOFF_ISO` | cutoff de compatibilidad para ventanas de check-in | Media/Alta | Confirmada en código y `.env.example` |
| `RESEND_API_KEY` | envío real de emails | Media/Alta | Confirmada en código y `.env.example` |
| `EMAIL_FROM_ADDRESS` | remitente de emails | Media | Confirmada en código y `.env.example` |
| `EMAIL_ENABLED` | activa envío real vs stub | Media/Alta | Confirmada en código y `.env.example` |
| `B2C_BASE_URL` | link base usado en emails | Media | Confirmada en código y `.env.example` |
| `REVIEW_HASH_PEPPER` | hash/pepper para reviews | Media | Confirmada en código, ausente en `.env.example` |
| `NODE_ENV` | activa trust proxy y shape de errores | Media | Confirmada en código |

Notas operativas importantes:

- no se documentan valores reales ni secretos;
- el panel usa cliente Supabase dummy en CI si faltan `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- el backend hace fallback a stubs o defaults en algunos dominios, pero eso no elimina la criticidad operativa de las envs.

### Drift documental/config visible

- `apps/web-b2c/vite.config.ts` fija `5174`, pero `docs/RUNBOOK.md` y defaults CORS del backend siguen usando `5173`.
- `functions/api/.env.example` ya usa `SUPABASE_SERVICE_ROLE`, alineado con `functions/api/src/services/supabase.ts`; `SUPABASE_SERVICE_ROLE_KEY` queda como nombre historico/no canonical.
- `functions/api/.env.example` no cubre `FRONTEND_ORIGIN`, `RATE_LIMIT_PANEL`, `TRUST_PROXY_HOPS` ni `REVIEW_HASH_PEPPER`.
- `apps/web-next/.env.example` no incluye `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ENABLE_PANEL_DEMO`, `NEXT_PUBLIC_SUPPORT_WHATSAPP` ni `NEXT_PUBLIC_SUPPORT_EMAIL`.
- `apps/web-next/.env.example` incluye `NEXT_PUBLIC_SITE_URL` y `NEXT_PUBLIC_GA_MEASUREMENT_ID`, pero su uso no está confirmado por código visible.

**Evidencia principal**

- `apps/web-b2c/.env.example`
- `apps/web-next/.env.example`
- `functions/api/.env.example`
- `apps/web-b2c/src/constants.ts`
- `apps/web-b2c/src/components/shared/MapSection.tsx`
- `apps/web-next/lib/api.ts`
- `apps/web-next/lib/supabase.ts`
- `apps/web-next/lib/posthog.ts`
- `apps/web-next/instrumentation.ts`
- `apps/web-next/app/panel/(authenticated)/settings/page.tsx`
- `functions/api/src/services/supabase.ts`
- `functions/api/src/middlewares/cors.ts`
- `functions/api/src/middlewares/rateLimit.ts`
- `functions/api/src/services/emails.ts`
- `functions/api/src/services/weekendWindow.ts`
- `functions/api/src/routes/reviews.ts`

## 6. CI/CD y automatización

La evidencia visible de CI/CD es limitada a un único workflow:

- `.github/workflows/ci.yml`

Qué hace hoy:

- corre en `push` y `pull_request`;
- observa ramas `main` y `develop`;
- instala dependencias con `pnpm install --frozen-lockfile`;
- ejecuta `pnpm -r build`;
- ejecuta `pnpm -r lint || true`;
- ejecuta `pnpm -r typecheck`.

Lectura operativa:

- `build` y `typecheck` son controles efectivos;
- `lint` es informativo, no bloqueante;
- no hay tests visibles;
- no hay deploy automático;
- no hay migraciones automáticas;
- no hay promoción entre entornos;
- no hay rollback automatizado.

Drift visible:

- la raíz declara `node >=20`, pero CI fija `node-version: '22'`.

También hay automatización local por scripts de workspace:

- raíz: `build`, `lint`, `typecheck`, `dev:web-b2c`, `build:web-b2c`, `typecheck:web-b2c`;
- apps/servicios: scripts `dev`, `build`, `preview` o `start` por superficie.

**Evidencia principal**

- `.github/workflows/ci.yml`
- `package.json`
- `apps/web-b2c/package.json`
- `apps/web-next/package.json`
- `functions/api/package.json`
- `pnpm-workspace.yaml`

## 7. Dominios y exposición pública

### Confirmado por código/docs

- el B2C define canonical, OG y Twitter contra `https://www.tairet.com.py`;
- `robots.txt` y `sitemap.xml` públicos del B2C también apuntan a `https://www.tairet.com.py`;
- docs SEO describen validación operativa sobre ese dominio como home pública canónica.

### Confirmado parcialmente

- la home pública B2C existe y está pensada para exponerse en ese dominio;
- al usar `HashRouter`, la estrategia de exposición pública de rutas internas depende del deploy real y no queda completamente cerrada solo desde repo.

### Evidencia parcial, no autoritativa

- aparece un link a `https://tairet-mvp-web-next.vercel.app/` en una página B2C;
- `docs/landing/LANDING_DISCOVERY.md` menciona `https://v0-tairet-landing-page.vercel.app/` como referencia visual;
- eso prueba referencias o previews puntuales, no la topología productiva final.

### Requiere validación

- dominio productivo real del panel;
- dominio productivo real de la API;
- si existen entornos `staging` o `preview` permanentes;
- reglas reales de routing entre B2C, panel y API en producción.

**Evidencia principal**

- `apps/web-b2c/index.html`
- `apps/web-b2c/public/robots.txt`
- `apps/web-b2c/public/sitemap.xml`
- `docs/seo/SEO_FASE3_RUNBOOK.md`
- `docs/seo/SEO_ROLLOUT_PLAN.md`
- `apps/web-b2c/src/pages/para-locales/PublicaTuLocal.tsx`
- `docs/landing/LANDING_DISCOVERY.md`

## 8. Operación básica y runbooks

La base operativa más clara del repo es `docs/RUNBOOK.md`.

Ese runbook documenta:

- arranque local de API, panel y B2C;
- health check en `/health`;
- orden manual de bootstrap SQL en Supabase;
- creación manual de usuario en Supabase Auth;
- inserción manual en `panel_users`;
- verificaciones de API, panel y B2C;
- troubleshooting básico.

Señales operativas adicionales visibles:

- `/panel/support/status` entrega estado mínimo de tenant, email, rate limit y trust proxy;
- `/panel/support/access` lista accesos del panel para owner;
- el panel expone canales de soporte por env en `/panel/settings`.

Dependencias operativas fuertes:

- Supabase;
- consistencia entre `VITE_API_URL` y `NEXT_PUBLIC_API_URL` contra la API real;
- `FRONTEND_ORIGIN` para que CORS no bloquee frontend(s);
- `SUPABASE_SERVICE_ROLE` en backend;
- Mapbox para mapa real;
- Resend si se quiere email productivo;
- DSN y keys si se quiere observabilidad efectiva con Sentry/PostHog.

Drift operativo importante:

- el runbook y CORS default siguen orientados a `5173`, mientras Vite B2C hoy fija `5174`.

**Evidencia principal**

- `docs/RUNBOOK.md`
- `functions/api/src/server.ts`
- `functions/api/src/routes/support.ts`
- `apps/web-next/app/panel/(authenticated)/settings/page.tsx`
- `apps/web-b2c/vite.config.ts`
- `functions/api/src/middlewares/cors.ts`

## 9. Rollback, release y cleanup

### Lo que sí está visible

- hay disciplina mínima de ramas en CI: `main` y `develop`;
- el build del sistema es repetible por scripts;
- hay documentación específica de cleanup demo en `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md`;
- el panel demo puede apagarse por flag y rutas demo pueden dejarse inaccesibles.

### Lo que no está visible o no queda cerrado

- no hay proceso formal de release;
- no hay convención de versionado/release notes operativas en repo;
- no hay rollback general documentado por superficie;
- no hay pipeline de promotion entre entornos;
- no hay estrategia documentada de deploy de migraciones;
- no hay evidencia de backup/restore, maintenance windows o runbook de incidente productivo.

### Cleanup demo visible

Antes de operación real, la propia documentación demo recomienda revisar:

- `NEXT_PUBLIC_ENABLE_PANEL_DEMO`;
- rutas `/panel/demo/*`;
- overrides visuales de video;
- datasets demo;
- separación explícita entre demo y live.

Estado operativo razonable:

- rollback y release existen solo de forma inferible como proceso manual de código + plataforma;
- cualquier afirmación más fuerte que esa queda en `Requiere validación`.

**Evidencia principal**

- `.github/workflows/ci.yml`
- `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md`
- `docs/panel/PANEL_DEMO_DISCOVERY.md`
- `docs/seo/SEO_FASE3_RUNBOOK.md`

## 10. Dependencias críticas y riesgos de entorno

- **Supabase con `SUPABASE_SERVICE_ROLE` en backend**: concentra privilegio y blast radius operativo.
- **`VITE_API_URL` y `NEXT_PUBLIC_API_URL`**: si no apuntan al backend correcto, B2C y panel quedan degradados o rotos.
- **`FRONTEND_ORIGIN`**: mala configuración bloquea operación por CORS.
- **drift `5173` vs `5174`**: ya existe inconsistencia entre Vite B2C, RUNBOOK y defaults CORS.
- **panel demo por flag pública**: si `NEXT_PUBLIC_ENABLE_PANEL_DEMO` queda activo sin aislamiento adecuado, puede confundir operación real.
- **email productivo depende de `EMAIL_ENABLED` + `RESEND_API_KEY`**: sin eso, el backend cae en stub.
- **trust proxy y rate limit panel**: afectan IP real, limitación y diagnóstico; están controlados por env y no por config estática externa visible.
- **Mapbox**: ausencia de token degrada mapas del B2C.
- **Sentry y PostHog**: wiring existe, pero la cobertura real depende de envs y runtime; no debe asumirse operativa sin validación.
- **no hay CD visible**: el despliegue real depende de procesos externos no documentados en repo.

## 11. Ambigüedades o puntos que requieren validación

- topología real de hosting para panel y API;
- plataforma real de deploy del B2C, aunque el dominio público esté documentado;
- existencia de staging/preview persistentes y su estrategia de promotion;
- mapping real de dominios entre B2C, panel y API;
- valores reales y vigencia operativa de soporte por WhatsApp/email;
- cobertura real de Sentry/PostHog en entornos desplegados;
- store real del rate limit si existe despliegue multi-instancia;
- procedimiento real de rollback y release;
- estado productivo real del panel demo y si debe permanecer habilitado;
- exposición pública efectiva final de toda la superficie B2C más allá de la home y assets SEO ya visibles.

## 12. Qué documentos deberían escribirse después de este

- runbook de operación productiva por superficie: B2C, panel y API;
- playbook de release y rollback;
- inventario canónico de env vars por entorno con ownership y rotación;
- mapa de observabilidad operativa real por entorno;
- documento de topología de hosting y routing entre dominios;
- checklist de cleanup demo/pre-producción antes de operación real.
