# SYSTEM_ARCHITECTURE_OVERVIEW

## 1. Propósito del documento

Este documento resume la arquitectura observable de Tairet a partir de código y documentación vigente del repo.

Sirve como mapa base para futuras capas de:

- flujos funcionales;
- despliegue y operación;
- seguridad y hardening;
- observabilidad;
- readiness de producción.

Regla aplicada de fuente de verdad:

1. código del repo;
2. docs operativas vigentes del repo;
3. cualquier punto no verificable queda marcado como `Requiere validación`.

## 2. Resumen ejecutivo del sistema

Tairet, en el estado visible del repo, es un monorepo PNPM con tres superficies principales:

- `apps/web-b2c`: frontend B2C en React + Vite, con navegación pública basada en `HashRouter`;
- `apps/web-next`: panel B2B en Next.js App Router;
- `functions/api`: backend/API en Express + TypeScript.

La plataforma se apoya principalmente en Supabase para datos, autenticación y storage. El patrón observable es:

- B2C consume la API pública para catálogo, perfiles, reservas, órdenes y tracking;
- el panel autentica usuarios con Supabase Auth en frontend, envía `Bearer` al backend y opera sobre endpoints protegidos;
- el backend centraliza la lógica operativa y accede a Supabase con `SUPABASE_SERVICE_ROLE`.

Hay dos rasgos arquitectónicos que condicionan producción y mantenimiento:

- el B2C no es totalmente API-first: combina datos del backend con mocks/estáticos en superficies clave;
- el backend concentra gran parte del blast radius en tablas y flows transversales, especialmente `locals`, `local_daily_ops`, `orders` y el bloque `/panel`.

Estado documental relevante:

- `docs/audits/TAIRET_TECH_AUDIT_MVP.md` se autodeclara snapshot histórico y no debe usarse como fuente operativa primaria;
- la capa operativa vigente está más alineada con `docs/audits/CONTRATOS_CONGELADOS_V1.md`, `docs/audits/BASELINE_FUNCIONAL_V1.md`, `docs/audits/SMOKE_TESTS_V1.md`, `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`, `docs/audits/STATUS.md` y `docs/RUNBOOK.md`.

**Evidencia principal**

- `package.json`
- `pnpm-workspace.yaml`
- `apps/web-b2c/src/App.tsx`
- `apps/web-next/app/panel/layout.tsx`
- `functions/api/src/server.ts`
- `functions/api/src/services/supabase.ts`
- `docs/audits/TAIRET_TECH_AUDIT_MVP.md`
- `docs/audits/AGENT.md`

## 3. Mapa de aplicaciones y capas

| Capa | Ubicación | Rol observable | Dependencias/couplings visibles |
| --- | --- | --- | --- |
| B2C | `apps/web-b2c` | landing, exploración, perfiles públicos, reservas, compra free pass, tracking, páginas informativas | API pública, assets/mocks locales, Mapbox, horarios y `local_daily_ops` |
| B2B / Panel | `apps/web-next` | login, dashboard, reservas, órdenes, check-in, métricas, calendario, perfil, promos, catálogo, demo mode | Supabase Auth en frontend, API protegida, storage firmado, métricas y actividad |
| Backend / API | `functions/api` | contratos públicos y protegidos, lógica operativa, agregaciones, export, check-in, callbacks | Supabase con `SUPABASE_SERVICE_ROLE`, Resend, QR/XLSX, middleware de auth/rate-limit |
| Tipos compartidos | `packages/types` | schemas Zod y constantes de dominio compartibles | consumo visible concentrado en `apps/web-next` |
| UI compartida | `packages/ui` | librería reusable disponible | presencia visible, pero sin imports activos observables en apps |
| SQL / Infra de datos | `infra/sql` | schema base, RLS, seed y migraciones | drift entre `schema.sql`, migraciones y runtime observable |
| Workspace / CI | raíz + `.github/workflows` | build, lint, typecheck de monorepo | `pnpm -r build`, `pnpm -r lint`, `pnpm -r typecheck` |

Flujo inter-capas visible:

1. B2C y panel hablan con `functions/api`.
2. El panel además mantiene sesión de usuario en Supabase Auth.
3. La API usa Supabase como backend de datos y storage indirecto.
4. La base SQL y las migraciones definen tablas y extensiones, pero no cubren por sí solas todo el runtime actual.

**Evidencia principal**

- `pnpm-workspace.yaml`
- `.github/workflows/ci.yml`
- `apps/web-b2c/package.json`
- `apps/web-next/package.json`
- `functions/api/package.json`
- `packages/types/src/index.ts`
- `apps/web-next/types/index.ts`
- `apps/web-next/next.config.mjs`
- `infra/sql/schema.sql`
- `infra/sql/migrations/*`

## 4. B2C

### Rol y responsabilidad funcional

`apps/web-b2c` es la superficie pública de descubrimiento y conversión. En el estado actual del repo cubre:

- landing y exploración por zonas/experiencias;
- perfiles públicos de bares y discotecas;
- reserva de bares;
- compra/checkout de entradas en modalidad observable `free_pass`;
- tracking público de vistas, aperturas de promos y clics a WhatsApp;
- páginas informativas y comerciales para captar locales.

### Superficies principales

Rutas fuertes montadas en `App.tsx`:

- `/`
- `/zona/asuncion`, `/zona/san-bernardino`, `/zona/ciudad-del-este`
- `/explorar`, `/eventos`, `/zonas`
- `/club/:clubId`, `/bar/:barId`, `/evento/:eventId`
- `/discotecas`, `/bares`, `/reseñas`
- `/reservar/:barId`, `/confirmacion-compra`
- `/experiencias/rooftop`, `/experiencias/after-office`, `/experiencias/promociones`
- `/para-locales/publica-tu-local`, `/para-locales/solicitud`
- rutas informativas `/sobre/*` y `/legal/*`

`MisEntradas` sigue existiendo como archivo y contrato preservado, pero no está montada en la superficie pública actual del router.

### Cómo consume datos

Consumo observable hacia backend/API:

- catálogo y perfiles: `GET /public/locals`, `GET /public/locals/by-slug/:slug`
- catálogo de clubes: `GET /public/locals/by-slug/:slug/catalog`
- órdenes públicas preservadas: `GET /public/orders?email=...`
- compra: `POST /orders`
- reservas: `POST /reservations`
- tracking: `POST /events/profile_view`, `POST /events/whatsapp_click`, `POST /events/promo_open`
- reseñas: `GET /reviews`, `POST /reviews`

Patrón de datos observable:

- listados y perfiles intentan leer datos reales desde API pública;
- `BarProfile` y `ClubProfile` siguen dependiendo también de mocks/estáticos locales para completar render y fallback;
- `Index` y parte del contenido comercial usan assets y copy locales sin dependencia de backend;
- el mapa y el geocoding dependen de Mapbox.

### Dependencias críticas

- API pública y `VITE_API_URL`;
- Supabase, pero solo a través del backend en los flows principales observables;
- Mapbox (`mapbox-gl` y geocoding HTTP);
- `locals` y `local_daily_ops` para estado operativo y horarios;
- `orders`, `reservations`, `events_public`, `whatsapp_clicks`, `profile_views`, `reviews`;
- mantenimiento del acoplamiento híbrido API + mocks.

**Evidencia principal**

- `apps/web-b2c/src/App.tsx`
- `apps/web-b2c/src/lib/api.ts`
- `apps/web-b2c/src/lib/locals.ts`
- `apps/web-b2c/src/lib/orders.ts`
- `apps/web-b2c/src/pages/BarProfile.tsx`
- `apps/web-b2c/src/pages/ClubProfile.tsx`
- `apps/web-b2c/src/pages/Index.tsx`
- `apps/web-b2c/src/components/shared/MapSection.tsx`
- `docs/audits/STATUS.md`
- `docs/audits/SMOKE_TESTS_V1.md`

## 5. B2B / Panel

### Rol y responsabilidad funcional

`apps/web-next` es el panel B2B para operación de locales. La app separa:

- login y bootstrap de sesión;
- shell autenticado del panel;
- módulos operativos por dominio;
- modo demo para escenarios grabados.

### Rutas y módulos principales

| Ruta | Rol observable |
| --- | --- |
| `/panel/login` | login con Supabase Auth |
| `/panel` | dashboard principal, con variante bar o discoteca |
| `/panel/reservations` | operación de reservas por fecha, solo aplicable a bar |
| `/panel/orders` | operación de órdenes/entradas y export |
| `/panel/checkin` | check-in de entradas |
| `/panel/metrics` | métricas; hoy monta `LineupBarView` o `LineupClubView` |
| `/panel/calendar` | calendario operativo y overrides diarios |
| `/panel/profile` | edición de perfil del local, galería y preview pública |
| `/panel/marketing` | entrada de marketing |
| `/panel/marketing/promos` | gestión de promociones |
| `/panel/marketing/lineup` | superficie adicional que reutiliza vistas de analytics |
| `/panel/settings` | soporte, diagnóstico y accesos del panel |
| `/panel/demo/[scenario]` | modo demo |

### Flujo de auth y acceso

Flujo observable:

1. el login usa `supabase.auth.signInWithPassword(...)`;
2. el frontend obtiene `access_token` desde `supabase.auth.getSession()`;
3. el token se envía como `Authorization: Bearer ...` al backend;
4. `panelAuth` resuelve el usuario contra Supabase Auth y `panel_users`;
5. `requireRole(...)` refuerza autorización en rutas sensibles.

### Dependencias críticas

- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- `NEXT_PUBLIC_API_URL`;
- API protegida `/panel/*`, `/metrics`, `/activity`, `/locals/:id/*`;
- storage firmado para galería y promos;
- `panel_users`, `locals`, `local_daily_ops`, `orders`, `reservations`, `promos`, `ticket_types`, `table_types`;
- reuso de vistas de `lineup` en `/panel/metrics`, que introduce acoplamiento semántico entre analytics y marketing.

**Evidencia principal**

- `apps/web-next/app/panel/login/page.tsx`
- `apps/web-next/app/panel/(authenticated)/layout.tsx`
- `apps/web-next/app/panel/(authenticated)/page.tsx`
- `apps/web-next/app/panel/(authenticated)/metrics/page.tsx`
- `apps/web-next/app/panel/(authenticated)/reservations/page.tsx`
- `apps/web-next/lib/api.ts`
- `apps/web-next/lib/supabase.ts`
- `apps/web-next/lib/panelContext.tsx`
- `apps/web-next/lib/panel.ts`
- `docs/panel/PANEL_ANALYTICS_SOURCE_OF_TRUTH.md`

## 6. Backend / API

### Ubicación y rol

`functions/api` expone el backend central de Tairet en Express. Su responsabilidad observable es:

- servir contratos públicos para B2C;
- proteger y ejecutar contratos del panel;
- centralizar lógica de negocio sobre órdenes, reservas, catálogo, calendario, métricas, actividad y promos;
- agregar tracking, export y check-in;
- mediar acceso a Supabase con credenciales privilegiadas.

### Dominios principales montados en `server.ts`

| Dominio / prefijo | Rol observable | Consumidor principal |
| --- | --- | --- |
| `/health` | health check | operación |
| `/public` | catálogo público, perfil por slug, lookup de órdenes, catálogo de club | B2C |
| `/orders` | creación y consulta de órdenes; `use` público deprecado | B2C y legado |
| `/payments/callback` | callback idempotente de pagos, parcial/simulado | proveedor de pago / backend |
| `/reservations` | creación pública de reservas; `PATCH` público deprecado | B2C |
| `/locals/:id/reservations` | reservas autenticadas por local | panel |
| `/locals/:id/promos` | CRUD/reordenamiento de promos | panel |
| `/metrics` | métricas agregadas y series | panel |
| `/activity` | actividad reciente agregada | panel |
| `/events/*` | tracking público | B2C |
| `/reviews` | reseñas públicas | B2C |
| `/panel/*` | auth del panel, check-in, órdenes, export, perfil, soporte | panel |
| `/panel/local/*` | perfil/local y gallery upload | panel |
| `/panel/catalog/*` | catálogo de tickets y mesas | panel |
| `/panel/calendar/*` | calendario y operación diaria | panel |
| `/panel/support/*` | soporte del panel | panel |

### Composición interna relevante

- `panel.ts` sigue siendo un archivo de alto acoplamiento aunque ya monta subrouters para `local`, `catalog` y `calendar`;
- el backend usa middleware transversal de `cors`, `requestId`, `errorHandler` y rate limiting;
- el rate limiting visible es en memoria;
- la API depende de Supabase con `SUPABASE_SERVICE_ROLE`, lo que concentra privilegio y blast radius en el backend.

### Cómo sirve a B2C y B2B

- B2C entra por contratos públicos y por endpoints transaccionales abiertos (`/orders`, `/reservations`, `/events/*`, `/reviews`);
- B2B entra por endpoints protegidos y tenant-aware, pero casi siempre termina en el mismo backend privilegiado sobre Supabase;
- export, check-in, órdenes, métricas, catálogo y calendario cruzan datos compartidos entre múltiples superficies.

**Evidencia principal**

- `functions/api/src/server.ts`
- `functions/api/src/index.ts`
- `functions/api/src/middlewares/panelAuth.ts`
- `functions/api/src/middlewares/requireRole.ts`
- `functions/api/src/routes/public.ts`
- `functions/api/src/routes/orders.ts`
- `functions/api/src/routes/reservations.ts`
- `functions/api/src/routes/payments.ts`
- `functions/api/src/routes/panel.ts`
- `functions/api/src/routes/panelLocal.ts`
- `functions/api/src/routes/panelCatalog.ts`
- `functions/api/src/routes/calendar.ts`

## 7. Datos y contratos

### Fuentes principales de datos

| Elemento | Rol observable | Acoplamiento principal |
| --- | --- | --- |
| `locals` | entidad base de bares/discotecas | B2C, panel, catálogo, horarios, métricas, promos |
| `local_daily_ops` | override operativo por día | listados públicos, reservas, órdenes, calendario, métricas |
| `orders` | compras/entradas, check-in, export, métricas y lookup público preservado | B2C, pagos, panel, check-in, export |
| `reservations` | reservas de bares | B2C, panel, calendario, métricas, emails |
| `promos` | promociones visibles y editables | B2C, panel, métricas |
| `events_public`, `whatsapp_clicks`, `profile_views` | tracking/analytics | B2C, métricas, actividad |
| `panel_users` | vínculo entre usuario auth y local del panel | auth y tenancy del panel |
| `payment_events` | idempotencia de callbacks | pagos y órdenes |
| `ticket_types`, `table_types` | catálogo de clubes | B2C club, panel catálogo, órdenes, métricas |

### Contratos y tipos compartidos

- `packages/types` expone schemas y constantes Zod reutilizables;
- el consumo visible de `@tairet/types` está concentrado en `apps/web-next`;
- `@tairet/ui` existe y `next.config.mjs` lo transpila, pero no se observan imports activos en `apps/*` o `functions/*`;
- gran parte de las interfaces concretas del runtime siguen viviendo localmente en cada app (`web-next` y `web-b2c`).

Esto implica que la capa compartida existe, pero no es el contrato universal del sistema actual.

### Flujo general de datos entre capas

1. B2C pide catálogo/perfil al backend público.
2. El backend resuelve datos en Supabase y devuelve payloads públicos.
3. El panel autentica al usuario en Supabase Auth.
4. El panel llama al backend con `Bearer`.
5. El backend resuelve tenancy/rol y ejecuta operaciones contra Supabase con service role.
6. Para uploads, el panel obtiene signed URL desde backend y sube binarios a storage; luego persiste metadata en DB.

### Drift SQL / runtime

Hay drift observable entre `infra/sql/schema.sql`, migraciones y runtime:

- `schema.sql` no cubre completamente `ticket_types`, `table_types` ni varias columnas de `orders` usadas por runtime;
- las migraciones sí introducen parte de esas extensiones;
- por lo tanto, `schema.sql` por sí solo no alcanza como mapa fiel del estado funcional completo.

**Evidencia principal**

- `infra/sql/schema.sql`
- `infra/sql/migrations/006_create_catalog_tables.sql`
- `infra/sql/migrations/010_add_local_daily_ops_tables.sql`
- `infra/sql/migrations/011_add_orders_valid_window.sql`
- `infra/sql/migrations/012_add_orders_intended_date_night_window.sql`
- `packages/types/src/index.ts`
- `apps/web-next/types/index.ts`
- `functions/api/src/services/supabase.ts`
- `docs/audits/CONTRATOS_CONGELADOS_V1.md`
- `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`

## 8. Integraciones externas / infraestructura visible

| Integración | Uso observable | Estado visible |
| --- | --- | --- |
| Supabase | DB principal, Auth del panel, Storage para galería/promos | central y crítica |
| Resend | emails transaccionales de reservas y órdenes | implementado con fallback stub por env |
| Sentry | wiring visible en `apps/web-next`; dependencia en API | cobertura real parcial / `Requiere validación` |
| PostHog | helper de analytics en panel | integración visible, activación dependiente de env y uso parcial |
| Mapbox | mapa y geocoding en B2C | visible y activa en frontend |
| GitHub Actions CI | build/lint/typecheck del monorepo | visible en repo |
| Pagos | callback idempotente y flujo `free_pass` observable | integración real de proveedor no cerrada en repo |
| Vercel | referencias visibles en docs y links de UI | no alcanza para inferir topología productiva |

Notas operativas:

- el callback de pagos existe, pero el proveedor real queda solo parcialmente identificado por comentarios (`Bancard/Dinelco`) y docs; no hay integración productiva cerrada y verificable de punta a punta en el repo;
- Sentry y PostHog son visibles como capacidad integrada, pero su cobertura efectiva depende de env y runtime;
- la presencia de un link a preview/panel en Vercel no equivale a documentar infraestructura de deploy completa.

**Evidencia principal**

- `functions/api/src/services/emails.ts`
- `functions/api/src/routes/payments.ts`
- `functions/api/src/services/payments.ts`
- `apps/web-next/instrumentation.ts`
- `apps/web-next/sentry.client.config.ts`
- `apps/web-next/lib/posthog.ts`
- `apps/web-b2c/src/components/shared/MapSection.tsx`
- `apps/web-b2c/src/lib/geocode.ts`
- `.github/workflows/ci.yml`
- `apps/web-b2c/src/pages/para-locales/PublicaTuLocal.tsx`
- `docs/docs/CHECKLIST_MVP_PANEL.md`

## 9. Rutas / superficies principales

### B2C

- `/`
- `/zona/*`
- `/explorar`, `/eventos`, `/zonas`
- `/club/:clubId`, `/bar/:barId`, `/evento/:eventId`
- `/reservar/:barId`, `/confirmacion-compra`
- `/experiencias/*`
- `/para-locales/*`
- `/sobre/*`, `/legal/*`

### Panel

- `/panel/login`
- `/panel`
- `/panel/reservations`
- `/panel/orders`
- `/panel/checkin`
- `/panel/metrics`
- `/panel/calendar`
- `/panel/profile`
- `/panel/marketing`, `/panel/marketing/promos`, `/panel/marketing/lineup`
- `/panel/settings`
- `/panel/demo/[scenario]`

### Backend / dominios API más relevantes

- `/public/locals`
- `/public/locals/by-slug/:slug`
- `/public/locals/by-slug/:slug/catalog`
- `/public/orders`
- `/orders`
- `/reservations`
- `/payments/callback`
- `/metrics/summary`
- `/activity`
- `/events/profile_view`
- `/events/whatsapp_click`
- `/events/promo_open`
- `/reviews`
- `/panel/*`
- `/panel/local/*`
- `/panel/catalog/*`
- `/panel/calendar/*`

**Evidencia principal**

- `apps/web-b2c/src/App.tsx`
- `apps/web-next/app/panel/*`
- `functions/api/src/server.ts`
- `functions/api/src/routes/*`

## 10. Dependencias críticas y puntos sensibles

- **Supabase con `SUPABASE_SERVICE_ROLE` en backend**: el backend es el punto privilegiado de acceso a datos y concentra blast radius operativo y de seguridad.
- **`panel.ts` sigue siendo un núcleo monolítico**: aunque monta subrouters, todavía concentra lógica de auth, reservas, check-in, órdenes, export y wiring de panel.
- **`local_daily_ops` es transversal**: afecta listados públicos, validaciones de apertura, reservas, órdenes, calendario y métricas.
- **`orders` tiene blast radius alto**: lookup público preservado, compra, callback de pago, check-in, export, métricas y panel dependen del mismo dominio.
- **B2C híbrido**: perfiles y catálogo no dependen solo de API; siguen mezclando datos reales con mocks/estáticos.
- **`/panel/metrics` reutiliza vistas de `lineup`**: hay acoplamiento entre analytics y una superficie adicional de marketing.
- **Pagos están incompletos**: el repo muestra callback, idempotencia y `free_pass`, pero no una integración productiva cerrada de proveedor.
- **Observabilidad parcial**: request IDs, logger y wiring de Sentry/PostHog son visibles, pero la cobertura efectiva sigue siendo parcial o dependiente de entorno.

**Evidencia principal**

- `functions/api/src/services/supabase.ts`
- `functions/api/src/routes/panel.ts`
- `functions/api/src/routes/orders.ts`
- `functions/api/src/routes/payments.ts`
- `functions/api/src/routes/public.ts`
- `functions/api/src/routes/calendar.ts`
- `apps/web-b2c/src/pages/BarProfile.tsx`
- `apps/web-b2c/src/pages/ClubProfile.tsx`
- `apps/web-next/app/panel/(authenticated)/metrics/page.tsx`
- `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`

## 11. Riesgos o ambigüedades detectadas

- `docs/audits/TAIRET_TECH_AUDIT_MVP.md` sigue en el repo, pero el propio archivo lo clasifica como snapshot histórico; no debe leerse como fuente operativa primaria.
- `MisEntradas` existe como base de código y contrato preservado, pero ya no forma parte de la superficie pública montada del B2C actual.
- `schema.sql` no representa por sí solo todo el runtime observable; migraciones y código agregan tablas/campos críticos no cubiertos allí.
- `packages/ui` está disponible pero no muestra adopción visible real en apps; no debe asumirse como capa activa de UI productiva.
- la topología real de despliegue en Vercel no se puede derivar solo desde este repo.
- la integración de pagos real queda abierta: el repo permite afirmar callback/idempotencia y `free_pass`, no un proveedor productivo end-to-end.
- la cobertura real de Sentry/PostHog y la exposición productiva final de algunas superficies públicas quedan en `Requiere validación`.

**Evidencia principal**

- `docs/audits/TAIRET_TECH_AUDIT_MVP.md`
- `docs/audits/STATUS.md`
- `docs/audits/SMOKE_TESTS_V1.md`
- `apps/web-b2c/src/App.tsx`
- `apps/web-b2c/src/pages/MisEntradas.tsx`
- `infra/sql/schema.sql`
- `infra/sql/migrations/*`
- `apps/web-next/next.config.mjs`
- `apps/web-b2c/src/pages/para-locales/PublicaTuLocal.tsx`

## 12. Qué documentos deberían escribirse después de este

- **Mapa de flujos funcionales**: journeys B2C y panel por dominio (`exploración`, `reserva`, `compra`, `check-in`, `promos`, `perfil`, `métricas`). Documento ya disponible: `docs/architecture/FUNCTIONAL_FLOWS_E2E.md`.
- **Arquitectura de despliegue y operación**: entornos, dominios, env vars críticas, arranque local, health checks, CI y responsabilidades operativas.
- **Mapa de seguridad y hardening**: auth, tenancy, RLS, service role, superficies públicas, storage y callbacks.
- **Mapa de observabilidad**: logging, request IDs, Sentry, PostHog, señales mínimas y puntos ciegos.
- **Readiness de producción**: checklist por superficie y por dependencia crítica.

Documentos base ya útiles para ese siguiente paso:

- `docs/RUNBOOK.md`
- `docs/audits/CONTRATOS_CONGELADOS_V1.md`
- `docs/audits/BASELINE_FUNCIONAL_V1.md`
- `docs/audits/SMOKE_TESTS_V1.md`
- `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`
- `docs/panel/PANEL_ANALYTICS_SOURCE_OF_TRUTH.md`
