# B5A_APPLICATION_ACCESS_DISCOVERY

## 1. Título

Discovery final de `B5a — Seguridad de aplicación y control de acceso`.

## 2. Estado del documento

- Fecha: `2026-04-18`
- Owner documental del corte: `nosotros`
- Estado: `Discovery finalizado`
- Alcance del corte: `free_pass only`
- Estado general: `sin bloqueantes confirmados de go-live en B5a`

Lectura importante:

- este documento fija el resultado final del discovery de `B5a` y no reabre su análisis;
- el demo del panel en producción sigue siendo un riesgo aceptado del bloque `B3`;
- este documento consume `B3` como decisión vigente y no la reinterpreta;
- este documento no cubre `B5b`, que sigue reservado para `Supabase`, datos y policies.

## 3. Objetivo del discovery

El objetivo de este discovery fue cerrar el alcance real de `B5a` para el corte actual de Tairet, con foco en:

- auth por ruta y bootstrap del panel;
- enforcement real de authz por rol;
- tenant checks efectivos vs parciales vs ausentes;
- separación real entre público, panel live y demo runtime;
- settings, support, access y otras superficies sensibles desde la capa aplicación.

El discovery no tuvo como objetivo:

- reauditar `RLS` o policies;
- medir blast radius de `SUPABASE_SERVICE_ROLE`;
- implementar fixes;
- reabrir el precheck de `panel_users` / `payment_events`.

## 4. Alcance exacto usado para B5a

Se tomó `B5a` con esta separación operativa:

- sí entra: `panelAuth`, `requireRole(...)`, `req.panelUser`, tenant checks, settings/support/access, rutas sensibles del panel, separación público/panel y borde demo/live en frontend;
- no entra: `RLS`, policies, privilegio efectivo en Supabase, lookup público como problema de datos y blast radius sobre tablas;
- si un caso toca ambas capas, se marca como `Mixto` y se explica dónde termina `B5a` y dónde empieza `B5b`.

Reglas aplicadas durante el discovery:

- no se asumió que ocultar UI equivalga a enforcement real;
- no se asumió que un helper exista en runtime solo por estar cableado;
- no se marcó nada como `Bloqueante` sin evidencia clara de gap de aplicación en un flujo sensible del corte;
- cuando la evidencia no alcanzó, se dejó `Parcial` o `Requiere validación`.

## 5. Fuentes de verdad utilizadas

### 5.1 Documentación base

- `docs/production/GO_LIVE_REMEDIATION_PLAN.md`
- `docs/production/PRODUCTION_READINESS_AND_GO_LIVE_CHECKLIST.md`
- `docs/production/B0_GO_LIVE_DECISIONS_AND_OWNERSHIP.md`
- `docs/production/B1_PRODUCTION_TOPOLOGY_AND_ENVS.md`
- `docs/production/B2_DEPLOY_ROLLBACK_AND_MIGRATIONS.md`
- `docs/production/B3_DEMO_MODE_RUNTIME_AND_RISK_ACCEPTANCE.md`
- `docs/production/B6_MINIMUM_OBSERVABILITY_AND_INCIDENT_OPERATION.md`
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`
- `docs/architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md`
- `docs/architecture/FUNCTIONAL_FLOWS_E2E.md`
- `docs/operations/**`
- `docs/audits/**`

### 5.2 Código revisado

Backend/API:

- `functions/api/src/server.ts`
- `functions/api/src/middlewares/panelAuth.ts`
- `functions/api/src/middlewares/requireRole.ts`
- `functions/api/src/routes/panel.ts`
- `functions/api/src/routes/panelLocal.ts`
- `functions/api/src/routes/panelCatalog.ts`
- `functions/api/src/routes/calendar.ts`
- `functions/api/src/routes/metrics.ts`
- `functions/api/src/routes/support.ts`
- `functions/api/src/routes/activity.ts`
- `functions/api/src/routes/promos.ts`
- `functions/api/src/routes/reservations.ts`
- `functions/api/src/routes/orders.ts`
- `functions/api/src/routes/public.ts`
- `functions/api/src/routes/payments.ts`
- `functions/api/src/routes/events.ts`
- `functions/api/src/routes/reviews.ts`

Frontend panel:

- `apps/web-next/app/panel/**`
- `apps/web-next/lib/api.ts`
- `apps/web-next/lib/panel.ts`
- `apps/web-next/lib/panelContext.tsx`
- `apps/web-next/lib/support.ts`
- `apps/web-next/lib/activity.ts`
- `apps/web-next/lib/reservations.ts`
- `apps/web-next/lib/promos.ts`
- `apps/web-next/lib/metrics.ts`
- `apps/web-next/lib/metricsBreakdown.ts`
- `apps/web-next/lib/panelExport.ts`
- `apps/web-next/lib/panel-demo/runtime.ts`
- `apps/web-next/components/panel/SidebarNav.tsx`

## 6. Superficie revisada

### 6.1 Panel / frontend

- `/panel/login`
- `/panel`
- `/panel/checkin`
- `/panel/orders`
- `/panel/reservations`
- `/panel/calendar`
- `/panel/metrics`
- `/panel/profile`
- `/panel/settings`
- `/panel/marketing/promos`
- `/panel/demo/bar`
- `/panel/demo/discoteca`
- `/panel/demo/off`

### 6.2 Backend / API

Namespaces montados en `functions/api/src/server.ts`:

- `/panel`
- `/panel/support`
- `/activity`
- `/metrics`
- `/locals`
- `/orders`
- `/payments`
- `/public`
- `/events`
- `/reservations`
- `/reviews`

### 6.3 Middlewares y enforcement relevantes

- `panelAuth`
- `requireRole(...)`
- `req.panelUser.localId`
- `req.panelUser.role`
- gating por sesión Supabase en frontend
- runtime demo en `PanelProvider`

## 7. Matriz de enforcement B5a

| Ruta/endpoint | Archivo + símbolo/handler | Flujo | Auth aplicado | Authz/role check aplicado | Tenant check aplicado | Estado | Clasificación | Evidencia breve |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /panel/me` | `functions/api/src/routes/panel.ts` `panelRouter.get("/me")` | `panel` | `panelAuth` | usuario de panel válido; sin `requireRole` | implícito: `req.panelUser.localId` -> `locals.id` | `Confirmado` | `Mixto` | bootstrap desde `apps/web-next/lib/panel.ts` y `apps/web-next/lib/panelContext.tsx`; backend no toma `localId` ni `role` del cliente |
| `GET /panel/support/status` | `functions/api/src/routes/support.ts` `supportRouter.get("/status")` | `panel` | `panelAuth` | `requireRole(["owner","staff"])` | implícito: `req.panelUser.localId` | `Confirmado` | `B5a` | consumido por `apps/web-next/app/panel/(authenticated)/settings/page.tsx`; backend limita por rol y tenant |
| `GET /panel/support/access` | `functions/api/src/routes/support.ts` `supportRouter.get("/access")` | `panel/admin` | `panelAuth` | `requireRole(["owner"])` | implícito: `req.panelUser.localId` | `Confirmado` | `Mixto` | UI solo lo pide si `isOwner`, pero backend también restringe a owner y lista `panel_users` |
| `GET /panel/reservations/search` | `functions/api/src/routes/panel.ts` `panelRouter.get("/reservations/search")` | `panel` | `panelAuth` | `requireRole(["owner","staff"])` | explícito: `.eq("local_id", req.panelUser.localId)` | `Confirmado` | `B5a` | el buscador del panel usa `apps/web-next/lib/reservations.ts` con auth |
| `PATCH /panel/reservations/:id` | `functions/api/src/routes/panel.ts` `panelRouter.patch("/reservations/:id")` | `panel` | `panelAuth` | sin `requireRole` visible | explícito: compara `reservation.local_id !== req.panelUser.localId` | `Parcial` | `B5a` | hay enforcement real de auth + tenant; no aparece split explícito owner/staff |
| `GET /locals/:id/reservations` | `functions/api/src/routes/reservations.ts` `localsReservationsRouter.get("/:id/reservations")` | `panel` | `panelAuth` | sin `requireRole` visible | explícito: `id === req.panelUser.localId` | `Parcial` | `B5a` | ruta fuera de `/panel`, pero protegida; consumida por `apps/web-next/lib/reservations.ts` vía `apiGetWithAuth` |
| `PATCH /panel/orders/:id/use` | `functions/api/src/routes/panel.ts` `panelRouter.patch("/orders/:id/use")` | `panel` | `panelAuth` | `requireRole(["owner","staff"])` | explícito: compara `order.local_id` con `req.panelUser.localId` | `Confirmado` | `B5a` | check-in por orden con authz real en backend |
| `PATCH /panel/checkin/:token` | `functions/api/src/routes/panel.ts` `panelRouter.patch("/checkin/:token")` | `panel` | `panelAuth` | `requireRole(["owner","staff"])` | explícito: compara `order.local_id` con `req.panelUser.localId` | `Confirmado` | `B5a` | `apps/web-next/app/panel/(authenticated)/checkin/page.tsx` manda bearer; backend no depende del gating visual |
| `GET /panel/checkins` | `functions/api/src/routes/panel.ts` `panelRouter.get("/checkins")` | `panel` | `panelAuth` | `requireRole(["owner","staff"])` | implícito: queries con `req.panelUser.localId` | `Confirmado` | `B5a` | flujo live de check-ins protegido server-side |
| `GET /panel/orders/search` | `functions/api/src/routes/panel.ts` `panelRouter.get("/orders/search")` | `panel` | `panelAuth` | `requireRole(["owner","staff"])` | implícito: `.eq("local_id", localId)` tomado de `req.panelUser` | `Confirmado` | `B5a` | `OrdersPageClient.tsx` agrega bearer manualmente |
| `GET /panel/orders/summary` | `functions/api/src/routes/panel.ts` `panelRouter.get("/orders/summary")` | `panel` | `panelAuth` | `requireRole(["owner","staff"])` | implícito: `localId = req.panelUser.localId` | `Confirmado` | `B5a` | el resumen usa tenant del backend; no acepta `localId` del cliente |
| `GET /panel/exports/reservations-clients.csv` y `.xlsx` | `functions/api/src/routes/panel.ts` export handlers | `panel` | `panelAuth` | `requireRole(["owner","staff"])` | implícito: exporta por `req.panelUser.localId` | `Confirmado` | `B5a` | `apps/web-next/lib/panelExport.ts` manda bearer; el archivo se genera por tenant autenticado |
| `GET/PATCH /panel/local`, `POST /panel/local/gallery/signed-upload`, `DELETE /panel/local/gallery/:id` | `functions/api/src/routes/panelLocal.ts` | `panel/admin` | `panelAuth` | GET `owner|staff`; writes `owner` | implícito: todo usa `req.panelUser.localId`; storage path lo genera backend | `Confirmado` | `B5a` | el cliente oculta botones por `canEdit`, pero el backend también exige owner para mutaciones |
| `GET/POST/PATCH/DELETE /panel/catalog/tickets*` y `/panel/catalog/tables*` | `functions/api/src/routes/panelCatalog.ts` | `panel/admin` | `panelAuth` | reads `owner|staff`; writes `owner` | implícito por `req.panelUser.localId` y explícito en `existing.local_id`/`.eq("local_id", ...)` | `Confirmado` | `B5a` | además hay check `club-only`; la UI no es la barrera final |
| `GET /panel/calendar/month`, `GET /panel/calendar/day`, `PATCH /panel/calendar/day` | `functions/api/src/routes/calendar.ts` | `panel` | `panelAuth` | sin `requireRole` visible | implícito: todo usa `req.panelUser.localId` | `Parcial` | `B5a` | hay tenant enforcement real, pero no aparece diferenciación explícita owner/staff |
| `GET /metrics/summary`, `GET /metrics/club/breakdown` | `functions/api/src/routes/metrics.ts` | `panel` | `panelAuth` | `requireRole(["owner","staff"])` | implícito: ignora `localId` del query y usa `req.panelUser.localId` | `Confirmado` | `B5a` | consumido por dashboard y lineup vía `apps/web-next/lib/metrics.ts` y `apps/web-next/lib/metricsBreakdown.ts` |
| `GET /activity` | `functions/api/src/routes/activity.ts` `activityRouter.get("/")` | `panel` | `panelAuth` | sin `requireRole` visible | implícito: ignora `localId` del query y usa `req.panelUser.localId` | `Parcial` | `Mixto` | auth/tenant son de aplicación, pero el contenido toca `payment_events`; frontend live usa `apps/web-next/lib/activity.ts` con auth |
| `GET/POST/PATCH/DELETE /locals/:id/promos*` | `functions/api/src/routes/promos.ts` | `panel/admin` | `panelAuth` | GET `owner|staff`; writes `owner` | explícito: `validateTenant(req,res)` y checks extra de pertenencia de promo | `Confirmado` | `B5a` | aunque la ruta no vive bajo `/panel`, no es pública |
| `PATCH /orders/:id/use` público deprecated y `PATCH /reservations/:id` público deprecated | `functions/api/src/routes/orders.ts`, `functions/api/src/routes/reservations.ts` | `público` | ninguno; endpoint deshabilitado | n/a | n/a | `Confirmado` | `B5a` | ambos devuelven `410` y empujan al caller a rutas autenticadas del panel |
| `/panel/login`, `/panel`, layout autenticado | `apps/web-next/app/panel/login/page.tsx`, `apps/web-next/app/panel/(authenticated)/layout.tsx`, `apps/web-next/app/panel/(authenticated)/page.tsx` | `panel` | sesión Supabase en cliente | UI solamente | ninguno en UI | `Parcial` | `B5a` | el layout solo envuelve `PanelProvider`; la redirección a login está en cliente; el backend sigue siendo la barrera real |
| `/panel/demo/bar`, `/panel/demo/discoteca`, `/panel/demo/off` + `PanelProvider` | `apps/web-next/app/panel/demo/[scenario]/page.tsx`, `apps/web-next/lib/panelContext.tsx`, `apps/web-next/lib/panel-demo/runtime.ts` | `demo/panel` | runtime demo por `localStorage` + `NEXT_PUBLIC_ENABLE_PANEL_DEMO` | reemplazo de identidad solo en UI | ninguno en UI | `Parcial` | `B5a` | si hay demo runtime, `PanelProvider` no llama `/panel/me`; no se observó bypass backend confirmado |
| Gating UI por owner/tipo de local | `apps/web-next/components/panel/SidebarNav.tsx`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx`, `apps/web-next/app/panel/(authenticated)/checkin/page.tsx`, `apps/web-next/app/panel/(authenticated)/profile/page.tsx`, `apps/web-next/app/panel/(authenticated)/marketing/promos/page.tsx`, `apps/web-next/app/panel/(authenticated)/settings/page.tsx` | `panel/demo` | contexto UI | `isOwner` / `local.type` en UI | UI solo | `Parcial` | `B5a` | oculta acciones o vistas, pero las mutaciones/reads sensibles revisados arriba sí tienen enforcement backend visible |

## 8. Hallazgos confirmados de B5a

- la barrera principal de acceso del panel está en backend: `panelAuth` valida bearer, resuelve `req.panelUser` y desde ahí los handlers derivan `role` y `localId`;
- `requireRole(...)` está aplicado de forma consistente en soporte/admin, métricas, check-in, órdenes de panel, exports, catálogo, promos y mutaciones owner-only de perfil/local;
- el tenant check está bien anclado, sobre todo en mutaciones: `reservation.local_id`, `order.local_id`, `promo.local_id` o filtros directos por `req.panelUser.localId`;
- hay separación real entre público y panel aunque algunas rutas no empiecen con `/panel`: `/locals/:id/reservations`, `/locals/:id/promos*`, `/metrics/*` y `/activity` siguen protegidas por backend;
- los endpoints públicos que antes podían tocar acciones de panel quedaron cortados en capa aplicación: `PATCH /orders/:id/use` y `PATCH /reservations/:id` responden `410`;
- no se observó un bypass confirmado de auth/authz en los flujos sensibles del corte.

## 9. Hallazgos parciales o que requieren validación

- `PATCH /panel/reservations/:id`, `GET /locals/:id/reservations`, `GET /activity` y las rutas de calendario usan `panelAuth` + tenant enforcement, pero no muestran `requireRole(...)`; si el negocio quería separar owner vs staff ahí, esa granularidad no está explícita en código;
- el shell autenticado de Next no tiene guard server-side: `apps/web-next/app/panel/(authenticated)/layout.tsx` solo envuelve `PanelProvider`, y el redirect fuerte a login está en cliente;
- el demo runtime altera la lectura de identidad en frontend: `apps/web-next/lib/panelContext.tsx` puede sustituir `/panel/me` por identidad demo local; no se observó bypass backend, pero sí superficie de confusión operativa/auth UX;
- hay helpers legacy o públicos sin consumidores activos claramente trazados en el repo revisado, por ejemplo versiones sin auth en `apps/web-next/lib/activity.ts`, `apps/web-next/lib/metrics.ts`, `apps/web-next/lib/reservations.ts` y `apps/web-next/lib/orders.ts`;
- cuando la evidencia no alcanzó para cerrar uso runtime real, se mantuvo la lectura en `Parcial`, no como gap confirmado.

## 10. Posibles bloqueantes reales de go-live dentro de B5a

Resultado del discovery:

- no se identificaron bloqueantes confirmados de go-live dentro de `B5a`;
- el enforcement principal ya observable está en backend;
- los pendientes abiertos son acotados y de lectura parcial, no bypasses confirmados.

Watch items que deben seguir bajo control:

- ausencia de `requireRole(...)` explícito en algunas rutas si se necesitara separar owner/staff con mayor rigor;
- dependencia del bootstrap cliente para parte del gating del shell del panel;
- confusión operativa posible en el borde demo/runtime del frontend.

## 11. Casos mixtos que deben empujarse a B5b

- `GET /panel/me`: `B5a` termina en bearer válido + `panelAuth` + construcción de `req.panelUser`; que esa identidad venga de `panel_users` y del cliente privilegiado de Supabase ya es borde con `B5b`;
- `GET /panel/support/access`: `B5a` cubre owner-only + tenant scope; que la lista salga de `panel_users` vuelve a tocar datos/policies y por eso el caso es `Mixto`;
- `GET /activity`: `B5a` cubre `panelAuth` + tenant scoping e ignorar `localId` del query; el uso de `payment_events` y su semántica de datos queda del lado `B5b`;
- `GET /orders/:id` y `GET /public/orders`: no se tratan aquí como hallazgo central de `B5a`; el problema ahí no es quién entra a una ruta de panel, sino exposición/alcance de datos públicos;
- `POST /payments/callback`: no se clasifica como problema de acceso panel; el borde relevante es idempotencia/estado de datos.

## 12. Veredicto

- `B5a` queda acotado a bootstrap/auth del panel, `panelAuth`, `requireRole(...)`, tenant checks por `req.panelUser.localId`, soporte/admin, separación entre acciones públicas y de panel y el borde demo/live en frontend;
- `B5a` no cubre `RLS`, policies, privilegio real del `service_role`, exposición de datos en lookups públicos ni blast radius sobre tablas;
- la base backend de `B5a` es más consistente que el gating del frontend: auth y tenant enforcement reales existen en la mayoría de los flujos sensibles del corte;
- no se observó un bypass confirmado ni bloqueantes confirmados de go-live dentro de `B5a`;
- `B5a` parece razonablemente cerrable por bloques si se mantiene la separación clara con `B5b`.

## 13. Backlog mínimo posterior

- decidir y documentar si `activity`, `calendar`, `GET /locals/:id/reservations` y `PATCH /panel/reservations/:id` deben ser `owner+staff` explícitos o si `panelAuth` + tenant scope alcanza;
- unificar el gating del panel en una barrera más consistente que el bootstrap cliente disperso;
- limpiar o aislar helpers públicos/legacy sin consumidor activo para que la superficie cliente no sugiera flows ya deprecated o protegidos;
- mantener explícito que demo runtime no es auth real: sirve para UI/demo, no para saltar enforcement backend;
- si se quiere endurecer `B5a`, el siguiente paso no es una auditoría nueva sino una remediación acotada sobre role split, shell gating y borde demo/runtime.

## 14. Relación con otros documentos / siguientes pasos

- `docs/production/B3_DEMO_MODE_RUNTIME_AND_RISK_ACCEPTANCE.md`: fija el riesgo aceptado del demo; este documento lo consume y no lo reabre;
- `docs/production/B6_MINIMUM_OBSERVABILITY_AND_INCIDENT_OPERATION.md`: usa la distinción live/demo para operación; este documento aporta el mapa de enforcement que la sostiene;
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`: debe resumir el estado actual de `B5a` y referenciar este discovery;
- `docs/production/GO_LIVE_REMEDIATION_PLAN.md`: puede usar este documento como evidencia del estado actual de `B5a`;
- `B5b` sigue pendiente como bloque distinto y no debe confundirse con este discovery.

