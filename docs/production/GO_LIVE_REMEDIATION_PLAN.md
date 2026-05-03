# GO_LIVE_REMEDIATION_PLAN

## 1. Propósito del documento

Este documento convierte el readiness final de Tairet en un plan de remediación ejecutable para llegar a go-live.

No reabre el diagnóstico ni propone una auditoría nueva. Toma los bloqueantes, pendientes y validaciones de `docs/production/PRODUCTION_READINESS_AND_GO_LIVE_CHECKLIST.md` y los ordena en bloques de trabajo, dependencias, fases y criterios de cierre.

Regla aplicada:

- si el punto depende de entorno real, decisión de negocio, DSN, deploy, rollback, proveedor de pagos o policies desplegadas, queda como decisión o validación explícita;
- si un riesgo no se remedia antes del go-live, debe tener aceptación formal y owner;
- este documento no abre prompts CODE ni cambios de implementación.

## 2. Cómo usar este remediation plan

Usar este documento como tablero operativo previo a producción:

1. cerrar primero las decisiones de alcance y ownership;
2. cerrar topología, envs, deploy, rollback y migraciones;
3. aislar o apagar demo mode;
4. cerrar pagos, seguridad de aplicación y Supabase/datos;
5. cerrar observabilidad mínima;
6. ejecutar QA/smoke contra entorno real congelado;
7. pasar a go/no-go.

Estados usados:

| Estado | Significado |
| --- | --- |
| `Bloqueante` | impide go-live real si no se cierra o acepta formalmente |
| `Crítico no bloqueante` | puede convivir con go-live acotado si queda aceptado y agendado |
| `Post go-live` | no compromete la salida inicial si los gates previos están cerrados |
| `Requiere decisión` | necesita decisión de negocio/operación antes de ejecutar |
| `Requiere validación` | necesita entorno real, runtime o evidencia externa al repo |

Fuentes base consumidas:

- `docs/production/PRODUCTION_READINESS_AND_GO_LIVE_CHECKLIST.md`
- `docs/architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md`
- `docs/architecture/FUNCTIONAL_FLOWS_E2E.md`
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`
- `docs/operations/OBSERVABILITY_AND_ERROR_HANDLING.md`
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`
- `docs/audits/**`
- `docs/panel/**`
- `docs/RUNBOOK.md`
- `docs/production/B0_GO_LIVE_DECISIONS_AND_OWNERSHIP.md`

## 3. Resumen ejecutivo del plan

El objetivo operativo no es "mejorar todo", sino cerrar los gates mínimos que hoy impiden declarar producción real.

Secuencia recomendada:

| Orden | Bloque | Prioridad | Resultado esperado |
| --- | --- | --- | --- |
| 0 | `B0 — Decisiones de alcance y ownership` | `Bloqueante` | alcance, riesgos y owners definidos antes de ejecutar |
| 1 | `B1 — Topología productiva y envs` | `Bloqueante` | hosts y envs productivas validadas |
| 2 | `B2 — Deploy, rollback y migraciones` | `Bloqueante` | release operable y reversible |
| 3 | `B3 — Cleanup o aislamiento demo` | `Bloqueante` | demo apagado o aislado |
| 4 | `B4 — Pagos y callback` | `Bloqueante` si hay tickets pagos | alcance de pagos cerrado |
| 5 | `B5a — Seguridad de aplicación y control de acceso` | `Bloqueante` si no hay cierre/aceptación | auth, rutas sensibles y tenant checks validados |
| 6 | `B5b — Supabase, datos y políticas` | `Bloqueante` si no hay cierre/aceptación | riesgos de datos aceptados o mitigados |
| 7 | `B6 — Observabilidad mínima e incidentes` | `Bloqueante` si se exige soporte día 1 | incidente básico operable |
| 8 | `B7 — Validación funcional y smoke final` | `Bloqueante` | go/no-go con evidencia del entorno real |
| 9 | `B8 — Críticos no bloqueantes` | `Crítico no bloqueante` | backlog aceptado y priorizado |
| 10 | `B9 — Post go-live` | `Post go-live` | mejoras diferidas fuera del gate |

Veredicto heredado del readiness:

- Tairet no está listo para producción real plena.
- El plan apunta a convertir ese estado en go-live acotado y defendible.
- Si no se cierran `B0` a `B7`, incluyendo `B5a` y `B5b`, no corresponde declarar producción real.

## 4. Supuestos y decisiones pendientes

Estas decisiones deben cerrarse antes de ejecutar remediación técnica:

| Decisión | Opciones válidas | Impacto |
| --- | --- | --- |
| Alcance de pagos | `free_pass only` o proveedor de pagos real | define si `B4` es cierre documental/QA o implementación/validación bloqueante |
| Demo mode | apagar en producción o aislar en host/entorno demo | define cierre de `B3` |
| Validación de seguridad de aplicación | validar o aceptar auth, roles, tenant checks y rutas sensibles | define cierre de `B5a` |
| Aceptación de riesgos de datos | mitigar antes de go-live o aceptar formalmente | define alcance de `B5b` |
| Sentry productivo | usar con DSN validado o declarar fallback manual | define cierre de `B6` |
| Topología productiva | hosts reales de B2C, panel y API | desbloquea `B1`, `B2` y `B7` |
| Owner de release/incidentes | persona o rol responsable | desbloquea go/no-go y operación día 1 |

Supuestos iniciales del plan:

- `MisEntradas` sigue despublicada; si se reexpone, debe volver a validarse.
- La compra productiva confirmada desde repo es `free_pass`; pagos reales no están cerrados.
- El backend opera con `SUPABASE_SERVICE_ROLE`; hasta prueba contraria debe asumirse bypass de RLS por backend.
- Sentry/PostHog no deben declararse operativos sin validación de entorno.
- Demo mode es bloqueante si queda expuesto en producción real.

## 5. Bloqueantes de go-live

| Bloque | Por qué existe | Riesgo que mitiga | Depende de | Cerrado significa |
| --- | --- | --- | --- | --- |
| `B0 — Decisiones de alcance y ownership` | el readiness deja decisiones abiertas de alcance, pagos, demo, riesgos y operación | ejecución sin owner, aceptación implícita de riesgos o go-live con alcance ambiguo | input de negocio/operación | alcance, owners y riesgos aceptados quedan documentados |
| `B1 — Topología productiva y envs` | panel/API no tienen host productivo verificable desde repo y hay drift de envs | frontends apuntan a API incorrecta, CORS rompe producción o secrets/envs quedan mal cableados | `B0` | hosts y envs productivas validadas sin exponer valores |
| `B2 — Deploy, rollback y migraciones` | no hay CD/rollback/promotion/migraciones productivas documentadas | release no reversible o migración sin recuperación | `B0`, `B1` | procedimiento por superficie, rollback y estrategia SQL cerrados |
| `B3 — Cleanup o aislamiento demo` | `NEXT_PUBLIC_ENABLE_PANEL_DEMO` y `/panel/demo/*` existen | datos/fixtures demo visibles en operación real | `B0`, `B1` | demo apagado o aislado y flujo live validado con demo off |
| `B4 — Pagos y callback` | el repo no cierra proveedor de pagos más allá de `free_pass` | vender tickets pagos sin proveedor/callback validado | `B0`, `B1`, `B2` | alcance `free_pass only` aceptado o pagos reales validados |
| `B5a — Seguridad de aplicación y control de acceso` | las rutas críticas dependen de auth, roles, tenant checks y separación público/panel | acceso indebido al panel, settings/soporte/accesos o endpoints sensibles | `B0`, `B1` | `panelAuth`, `requireRole(...)`, tenant checks y rutas sensibles validadas o aceptadas con owner |
| `B5b — Supabase, datos y políticas` | hay service role, RLS parcial, lookup público, callback crítico y tablas de alto impacto | exposición o modificación indebida de datos críticos | `B0`, `B1`, `B4` | mitigación o aceptación formal de riesgos de datos con owner |
| `B6 — Observabilidad mínima e incidentes` | hay requestId/logs, pero no proceso productivo end-to-end | no poder diagnosticar incidentes día 1 | `B1`, `B2` | health, logs, requestId y ruta de incidente validados |
| `B7 — Validación funcional y smoke final` | el readiness depende de entorno real | declarar go-live sin evidencia runtime | `B1` a `B6` | smoke B2C/panel/API pasado y decisión go/no-go registrada |

## 6. Críticos no bloqueantes

Estos trabajos no deben mezclarse con los gates de salida si se acepta un go-live acotado, pero deben quedar agendados con owner.

| Bloque | Trabajo | Criterio para no bloquear go-live |
| --- | --- | --- |
| `B8.1` | hardening RLS ampliado fuera de tracking/promos/reviews | aceptación formal de riesgo `SUPABASE_SERVICE_ROLE` + plan posterior |
| `B8.2` | refactor residual de `panel.ts` | no tocar antes de go-live si puede desestabilizar reservas, orders, check-in o export |
| `B8.3` | B2C error tracking dedicado | fallback operativo aceptado por soporte |
| `B8.4` | PostHog/GA4 productivo | no declararlo requisito del primer release |
| `B8.5` | destino final de `MisEntradas` | mantener despublicado; si se reexpone, sale de backlog y vuelve a gate |
| `B8.6` | consistencia de `/panel/metrics` y vistas `lineup` | aceptar deuda semántica sin romper lectura operativa |
| `B8.7` | drift de `.env.example` y docs locales | deploy usa inventario real validado, aunque examples se corrijan luego |

## 7. Post go-live

Estos trabajos quedan fuera del gate inicial si `B0` a `B7` se cierran:

- dashboards avanzados de observabilidad;
- alertas por dominio más granulares;
- route-level `error.tsx` en panel;
- refactors de mantenibilidad no ligados a riesgos de go-live;
- adopción real de `packages/ui`;
- analítica enriquecida de producto;
- mejoras visuales del panel demo si queda como herramienta comercial aislada;
- documentación operativa por dominio: reservas, orders, check-in, promos y calendario.

## 8. Fases de ejecución recomendadas

| Fase | Bloques | Objetivo | No conviene empezar antes de | Gate de salida |
| --- | --- | --- | --- | --- |
| Fase 0 | `B0` | cerrar decisiones de alcance, owner y aceptación | ninguna | decisión escrita de alcance, pagos, demo, riesgos y owners |
| Fase 1 | `B1`, `B2` | cerrar entorno, deploy, rollback y migraciones | `B0` | host/envs/procedimiento/rollback validados |
| Fase 2 | `B3` | apagar o aislar demo | `B0`, `B1` | demo off o host demo separado, flujo live validado |
| Fase 3 | `B4`, `B5a`, `B5b` | cerrar pagos, seguridad de aplicación y Supabase/datos | `B0`, `B1`, `B2` | pagos definidos, controles de aplicación validados y riesgos de datos mitigados o aceptados |
| Fase 4 | `B6` | dejar soporte de incidente mínimo operable | `B1`, `B2` | health/logs/requestId/Sentry o fallback validados |
| Fase 5 | `B7` | ejecutar QA/smoke y decidir go/no-go | `B1` a `B6` | smoke pasado o release abortado |
| Fase 6 | `B8`, `B9` | ejecutar backlog crítico y mejoras | go-live acotado o pausa formal | backlog con owners y fechas |

## 9. Dependencias y gates entre bloques

- `B0` precede a todo porque define alcance, pagos, demo, owners y aceptación de riesgos.
- `B1` precede a validaciones reales porque sin hosts/envs no hay evidencia productiva confiable.
- `B2` debe cerrarse antes de tocar producción porque sin rollback o estrategia de migraciones no hay salida reversible.
- `B3` precede a go-live porque demo expuesto es bloqueante.
- `B4` depende de la decisión de pagos: `free_pass only` reduce el bloque a restricción de alcance y smoke; pagos reales lo convierten en validación/implementación bloqueante.
- `B5a` depende de `B0` y `B1`: valida seguridad de aplicación, `panelAuth`, `requireRole(...)`, tenant checks, separación público/panel y rutas sensibles; no cubre RLS ni blast radius Supabase.
- `B5b` depende de `B0`, `B1` y `B4`: valida o acepta riesgos de `SUPABASE_SERVICE_ROLE`, RLS, lookup público, `payment_events` y tablas críticas; no cubre auth/routing de aplicación.
- `B6` debe cerrarse antes de `B7` si se exige soporte real desde día 1.
- `B7` no debe ejecutarse como cierre final hasta que el entorno real esté congelado y `B5a`/`B5b` estén mitigados o aceptados.
- `B8` no debe adelantarse si puede desestabilizar flujos críticos antes del go-live.
- `B9` no debe bloquear salida inicial si los gates operativos están cerrados.

## 10. Criterio de cierre por bloque

| Bloque | Criterio de cierre verificable | Evidencia esperada |
| --- | --- | --- |
| `B0` | decisión escrita sobre alcance, pagos, demo, riesgos y owners | nota de decisión o actualización documental |
| `B1` | hosts reales y envs críticas validadas sin secretos expuestos | checklist de envs y prueba de conectividad por superficie |
| `B2` | procedimiento de deploy/rollback/migraciones ejecutable por un operador | runbook o sección operativa con pasos y criterio de abortar |
| `B3` | `NEXT_PUBLIC_ENABLE_PANEL_DEMO` apagado o demo aislada; `/panel/demo/*` no accesible en producción real | verificación del host productivo y flujo live con demo off |
| `B4` | `free_pass only` aceptado o pagos reales con callback/proveedor validado | decisión de alcance y smoke de orden/callback según corresponda |
| `B5a` | `panelAuth`, `requireRole(...)`, tenant checks, separación público/panel, settings/soporte/accesos y rutas sensibles validadas o aceptadas | discovery documentado en `docs/audits/B5A_APPLICATION_ACCESS_DISCOVERY.md` y smoke/auth por ruta crítica |
| `B5b` | riesgos de `SUPABASE_SERVICE_ROLE`, RLS, lookup público, `payment_events` y tablas críticas mitigados o aceptados | matriz corta de aceptación/mitigación de datos con owner |
| `B6` | `/health`, `x-request-id`, logs, Sentry o fallback e incidente mínimo validados | prueba de requestId/log y ruta soporte -> logs |
| `B7` | smoke B2C/panel/API pasado contra entorno real y go/no-go registrado | checklist de smoke firmado o release abortado |
| `B8` | backlog crítico no bloqueante priorizado con owner | tickets/docs con owner y prioridad |
| `B9` | backlog post go-live registrado sin bloquear release | backlog post-release separado del gate |

Checkpoint `B5a-1`:

- `B5a-1 Role Split Explicito` ya fue ejecutado sobre las rutas parciales identificadas por `docs/audits/B5A_APPLICATION_ACCESS_DISCOVERY.md`;
- el resultado fue agregar `requireRole(["owner","staff"])` en backend donde faltaba role split explicito, manteniendo intactos los tenant checks existentes;
- la validacion quedo cerrada con `pnpm -C functions/api typecheck` OK y verificaciones manuales cortas de runtime OK;
- este checkpoint no reabre el discovery de `B5a`, no cubre automaticamente `B5a-2` ni `B5a-3`, y no modifica el alcance de `B5b`.

Checkpoint `B5a-2`:

- `B5a-2 Shell Auth Gating` ya fue ejecutado sobre el shell autenticado del panel;
- el resultado fue centralizar el gate de acceso de `app/panel/(authenticated)`, usar estados uniformes de acceso y quitar la verificacion local dispersa del dashboard;
- la validacion quedo cerrada con `pnpm -C apps/web-next typecheck` OK y verificaciones manuales cortas de runtime OK;
- `B5a-3 Demo/Runtime Boundary` no se ejecuta en este corte por ahora: el demo vigente sigue cumpliendo su funcion comercial, no hay bypass backend confirmado y no se justifica ampliar la superficie de cambio;
- este checkpoint no reabre el discovery de `B5a` y no modifica el alcance de `B5b`.

Checkpoint `B5b`:

- el discovery de `B5b` ya fue ejecutado y documentado en `docs/audits/B5B_SUPABASE_DATA_ACCESS_DISCOVERY.md`;
- `B5b` no se considera cerrado completo: el riesgo residual sigue en blast radius backend con `SUPABASE_SERVICE_ROLE`, `/payments/callback` si pagos reales aplican, drift SQL/env y validacion runtime de Supabase;
- `B5b-0 Runtime Supabase Validation` ya fue ejecutado parcialmente contra Supabase real y produjo evidencia suficiente para repriorizar el roadmap;
- el orden actualizado de remediacion es: contencion focalizada de exposicion directa de datos; decision de blast radius de `SUPABASE_SERVICE_ROLE`; cleanup de drift SQL/env; `/payments/callback` si pagos reales aplican; hardening RLS remanente por slices;
- la contencion focalizada de exposicion directa de datos ya cubre `local_daily_ops`, `orders`, `locals`, `reservations`, `ticket_types`, `table_types`, `panel_users` y `payment_events`;
- la decision de blast radius de `SUPABASE_SERVICE_ROLE` queda documentada como aceptacion formal y temporal para `free_pass only`; Public DTO/selects hardening de `POST /orders` y `POST /reservations`, Panel mutation selects hardening y `GET /events/whatsapp_clicks/count` validation ya quedaron documentados y validados; los siguientes focos quedan en drift SQL/env y `/payments/callback` si pagos reales aplican;
- no se debe implementar todo `B5b` en una sola tanda: los endpoints publicos de lectura de ordenes ya quedaron contenidos con `410 Gone`, `/payments/callback` queda condicionado al alcance real de pagos del corte y el hardening RLS remanente queda posterior por slices;
- este checkpoint solo documenta evidencia runtime y repriorizacion; no implementa remediacion;
- la remediacion restante de `B5b` queda pendiente por bloques y no reabre el discovery de `B5a`.

Checkpoint `B5b-1 local_daily_ops`:

- `public.local_daily_ops` ya fue remediado como primer slice de contencion focalizada de exposicion directa de datos;
- el cambio aplicado en Supabase live quedo versionado en `infra/sql/migrations/019_harden_local_daily_ops_data_api.sql`;
- resultado: RLS on, policies abiertas previas eliminadas y grants de `anon` / `authenticated` removidos;
- validacion: post-checks runtime OK y QA live aprobado para perfiles publicos, orden `free_pass`, QR/email, reservas y calendario panel;
- este checkpoint cierra solo el slice `local_daily_ops`; `B5b` seguia abierto para `orders`, `locals`, `reservations`, `ticket_types`, `table_types`, blast radius de `SUPABASE_SERVICE_ROLE` y decisiones de aceptacion restantes.

Checkpoint `B5b-2 orders`:

- `public.orders` ya fue remediado como segundo slice de contencion focalizada de exposicion directa de datos;
- el cambio aplicado en Supabase live quedo versionado en `infra/sql/migrations/020_harden_orders_data_api.sql`;
- resultado: RLS sigue on, policies publicas abiertas previas eliminadas y grants de `anon` / `authenticated` removidos;
- validacion: post-checks runtime OK y QA live aprobado para orden `free_pass`, QR/email, `GET /public/orders?email=...`, `GET /orders/:id`, panel orders/search/summary, check-in, activity, metrics y calendario panel;
- los campos de ventana `intended_date`, `valid_from`, `valid_to` y `valid_window_key` siguen devolviendose correctamente;
- este checkpoint no toca endpoints publicos, backend, frontend ni `SUPABASE_SERVICE_ROLE`; cierra solo la exposicion directa de la tabla cruda `orders` por Data API;
- en ese momento, `locals`, `reservations` y endpoints publicos de ordenes seguian pendientes; checkpoints posteriores documentan sus cierres;
- `B5b` sigue abierto para `ticket_types`, `table_types`, blast radius de `SUPABASE_SERVICE_ROLE`, drift SQL/env y decisiones de aceptacion restantes.

Checkpoint `B5b-3 GET /orders/:id`:

- `GET /orders/:id` ya fue contenido como primer mini-slice de Public Orders Endpoint Containment;
- antes del cambio era publico, usaba `select("*")` sobre `public.orders` y podia exponer la fila completa de la orden;
- no se encontro consumidor activo real en repo; solo existia un helper legacy no importado en `apps/web-next/lib/orders.ts`;
- resultado: el endpoint responde `410 Gone` con `{ "error": "Order lookup by id is no longer available" }`;
- el handler ya no consulta Supabase y ya no usa `select("*")`;
- validacion: backend typecheck OK y QA live aprobado para `GET /orders/:id` -> `410 Gone`, `POST /orders` free pass, email/QR, `GET /public/orders?email=...`, panel orders/search/summary, check-in, activity, metrics y calendario;
- este checkpoint no toca `POST /orders`, `GET /public/orders?email=...`, panel routes, frontend, SQL, migraciones, RLS, grants ni policies;
- en ese momento, `GET /public/orders?email=...` quedaba pendiente como riesgo residual separado; el checkpoint `B5b-4` documenta su cierre posterior;
- en ese momento, `locals` y `reservations` seguian pendientes; checkpoints posteriores documentan sus cierres;
- `B5b` sigue abierto para `ticket_types`, `table_types`, blast radius de `SUPABASE_SERVICE_ROLE`, drift SQL/env, `/payments/callback` si aplica y decisiones de aceptacion restantes.

Checkpoint `B5b-4 GET /public/orders`:

- `GET /public/orders?email=...` ya fue contenido como segundo mini-slice de Public Orders Endpoint Containment;
- antes del cambio era publico, validaba email, consultaba `orders` por `customer_email_lower`, devolvia hasta 50 ordenes y exponia `checkin_token`;
- el unico consumidor visible era `MisEntradas`; esa pagina existe en codigo, pero no esta montada como ruta activa del B2C;
- decision de producto del corte: `Mis Entradas` no es feature activo y queda diferido para futuro con usuarios reales/auth por correo y contrasena;
- resultado: el endpoint responde `410 Gone` con `{ "error": "Public order lookup by email is no longer available" }`;
- el handler ya no valida email, no consulta Supabase, no busca por `customer_email_lower`, no devuelve historial y no expone `checkin_token`;
- validacion: backend typecheck OK y QA live aprobado para `GET /public/orders?email=...` -> `410 Gone`, `GET /orders/:id` -> `410 Gone`, `POST /orders` free pass, email/QR, panel orders/search/summary, check-in, activity, metrics y calendario;
- este checkpoint no toca `POST /orders`, `GET /orders/:id`, panel routes, check-in, activity, metrics, calendar, frontend, SQL, migraciones, RLS, grants ni policies;
- con esto, los endpoints publicos de lectura de ordenes quedan cerrados para este corte: `GET /orders/:id` -> `410 Gone` y `GET /public/orders?email=...` -> `410 Gone`;
- `POST /orders` sigue activo para `free_pass`;
- en ese momento, `locals` seguia pendiente; el checkpoint `B5b-5` documenta su cierre posterior;
- en ese momento, `reservations` seguia pendiente; el checkpoint `B5b-6` documenta su cierre posterior;
- `B5b` sigue abierto para `ticket_types`, `table_types`, blast radius de `SUPABASE_SERVICE_ROLE`, drift SQL/env, `/payments/callback` si aplica y decisiones de aceptacion restantes.

Checkpoint `B5b-5 locals`:

- `public.locals` ya fue remediado como siguiente slice de contencion focalizada de exposicion directa de datos;
- el cambio aplicado en Supabase live quedo versionado en `infra/sql/migrations/021_harden_locals_data_api.sql`;
- antes del cambio tenia RLS on, policy publica abierta `locals_select_public` y grants amplios para `anon` / `authenticated`;
- resultado: RLS sigue on, `locals_select_public` eliminada y grants de `anon` / `authenticated` removidos;
- post-checks confirmados: `rls_enabled=true`, `force_rls=false`, `pg_policies` sin filas para la tabla y grants `anon` / `authenticated` en 0 filas;
- validacion: QA live aprobado para `GET /public/locals`, `GET /public/locals/by-slug/dlirio`, `GET /public/locals/by-slug/dlirio/catalog`, home/listados/explorar, perfil publico con mapa/contacto/galeria/horarios/promociones, `POST /orders` free pass, `POST /reservations`, bootstrap panel, `/panel/local`, soporte y edicion de perfil/galeria;
- este checkpoint no toca endpoints publicos, backend, frontend ni `SUPABASE_SERVICE_ROLE`; cierra solo la exposicion directa de la tabla cruda `locals` por Data API;
- los endpoints publicos shapeados de `locals` siguen funcionando;
- en ese momento, `reservations` seguia pendiente; el checkpoint `B5b-6` documenta su cierre posterior;
- `B5b` sigue abierto para `ticket_types`, `table_types`, blast radius de `SUPABASE_SERVICE_ROLE`, drift SQL/env, `/payments/callback` si aplica y decisiones de aceptacion restantes.

Checkpoint `B5b-6 reservations`:

- `public.reservations` ya fue remediado como siguiente slice de contencion focalizada de exposicion directa de datos;
- el cambio aplicado en Supabase live quedo versionado en `infra/sql/migrations/022_harden_reservations_data_api.sql`;
- antes del cambio tenia RLS on, policies publicas abiertas `reservations_insert_public` / `reservations_select_by_local` y grants amplios para `anon` / `authenticated`;
- resultado: RLS sigue on, `reservations_insert_public` y `reservations_select_by_local` eliminadas, y grants de `anon` / `authenticated` removidos;
- post-checks confirmados: `relrowsecurity=true`, `relforcerowsecurity=false`, `pg_policies` sin filas para la tabla y grants `anon` / `authenticated` en 0 filas;
- validacion: QA live aprobado para `POST /reservations` B2C, email/notificacion de reserva, `PATCH /reservations/:id` publico en `410 Gone`, panel de reservas/listado del local, `GET /panel/reservations/search`, `PATCH /panel/reservations/:id`, calendario month/day, `GET /metrics/summary`, `GET /activity` y exports de reservas;
- este checkpoint no toca endpoints publicos, backend, frontend ni `SUPABASE_SERVICE_ROLE`; cierra solo la exposicion directa de la tabla cruda `reservations` por Data API;
- los endpoints publicos y panel siguen funcionando via backend/API;
- en ese momento, `ticket_types` y `table_types` seguian pendientes; el checkpoint `B5b-7` documenta su cierre posterior.

Checkpoint `B5b-7 ticket_types/table_types`:

- `public.ticket_types` y `public.table_types` ya fueron remediadas como slice de catalog Data API containment;
- el cambio aplicado en Supabase live quedo versionado en `infra/sql/migrations/023_harden_catalog_types_data_api.sql`;
- antes del cambio tenian RLS off, sin policies activas y grants amplios para `anon` / `authenticated`;
- resultado: RLS on en ambas tablas, sin policies nuevas y grants de `anon` / `authenticated` removidos;
- post-checks confirmados: `relrowsecurity=true`, `relforcerowsecurity=false`, `pg_policies` en 0 filas y grants `anon` / `authenticated` en 0 filas;
- conteos conservados: `ticket_types` total 4, active 3, inactive 1; `table_types` total 3, active 3, inactive 0;
- validacion: QA live aprobado para `GET /public/locals/by-slug/dlirio/catalog`, tickets, mesas, perfil publico de club, selector free pass, selector de mesas, `POST /orders` free pass con `ticket_type_id`, QR/email, WhatsApp tracking, panel catalogo tickets/mesas y metricas/lineup;
- este checkpoint no toca endpoints publicos, backend, frontend, otras tablas ni `SUPABASE_SERVICE_ROLE`; cierra solo la exposicion directa de las tablas crudas de catalogo por Data API;
- el catalogo publico y el panel catalogo siguen funcionando via backend/API shapeada;
- en ese momento, el cleanup final de grants en `panel_users` y `payment_events` seguia pendiente; el checkpoint `B5b-8` documenta su cierre posterior.

Checkpoint `B5b-8 panel_users/payment_events grants`:

- `public.panel_users` y `public.payment_events` ya fueron remediadas como mini-slice final de Data API grants cleanup;
- el cambio aplicado en Supabase live quedo versionado en `infra/sql/migrations/024_harden_panel_users_payment_events_grants.sql`;
- antes del cambio ambas tablas ya tenian RLS on, `force_rls=false` y `pg_policies` en 0 filas;
- el pendiente era grants directos amplios para `anon` / `authenticated`: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` y `TRIGGER`;
- resultado: grants de `anon` / `authenticated` removidos en ambas tablas, sin tocar RLS y sin crear policies nuevas;
- post-checks confirmados: RLS sigue on, `force_rls=false`, `pg_policies` sigue en 0 filas y grants `anon` / `authenticated` en 0 filas;
- este checkpoint no toca backend, frontend, endpoints, otras tablas, `SUPABASE_SERVICE_ROLE` ni `/payments/callback`;
- con esto, el mini-check global de Data API containment queda limpio para las tablas revisadas y High-Risk Data Exposure Containment queda cerrado para este corte;
- `B5b` sigue abierto para blast radius de `SUPABASE_SERVICE_ROLE`, drift SQL/env, `/payments/callback` si aplica y decisiones de aceptacion restantes.

Checkpoint `B5b-9 SUPABASE_SERVICE_ROLE blast radius`:

- el backend usa un cliente Supabase privilegiado con `SUPABASE_SERVICE_ROLE` y la validacion runtime confirmo `service_role.rolbypassrls=true`;
- High-Risk Data Exposure Containment ya quedo cerrado para este corte sobre las tablas revisadas: `local_daily_ops`, `orders`, `locals`, `reservations`, `ticket_types`, `table_types`, `panel_users` y `payment_events`;
- decision operativa: para `free_pass only`, se acepta formalmente mantener el cliente backend global con `SUPABASE_SERVICE_ROLE`;
- no se eliminara `SUPABASE_SERVICE_ROLE` en este corte; la frontera efectiva queda en backend/API shapeada;
- controles compensatorios: validacion de input, DTOs/payloads shapeados, `panelAuth`, `requireRole`, tenant checks y rate limits donde existen;
- esta aceptacion es temporal/operativa y no representa arquitectura final ni reduccion de privilegios;
- en ese momento quedaban como proximos sub-slices las mitigaciones pequenas de DTO/selects en `POST /orders`, `POST /reservations`, mutaciones panel con `select("*")` y `GET /events/whatsapp_clicks/count`; los checkpoints `B5b-10`, `B5b-11` y `B5b-12` documentan el cierre posterior de los DTO/selects publicos, de las mutaciones panel puntuales y de la validacion de tracking;
- `/payments/callback` queda como validacion separada si pagos reales entran en scope;
- refactors mayores diferidos: clientes privilegiados por dominio, roles/RPCs de menor privilegio y eliminacion del service role global;
- `B5b` no queda cerrado completo: siguen pendientes drift SQL/env y `/payments/callback` si aplica.

Checkpoint `B5b-10 Public DTO/selects hardening`:

- `POST /orders` y `POST /reservations` ya fueron remediados como sub-slice de reduccion de payload publico;
- `POST /orders` dejo de usar select amplio/fila completa y ahora devuelve solo `id`, `checkin_token`, `quantity`, `total_amount`, `currency`, `status`, `payment_method`, `created_at` e `intended_date`;
- `POST /orders` ya no devuelve PII ni campos internos: `customer_email`, `customer_name`, `customer_last_name`, `customer_phone`, `customer_document`, `transaction_id`, `used_at`, `items`, `updated_at`, `is_window_legacy`;
- `POST /reservations` dejo de usar select amplio/fila completa y ahora devuelve solo `id`, `status`, `date`, `guests` y `created_at`;
- `POST /reservations` ya no devuelve PII ni campos internos: `name`, `last_name`, `email`, `phone`, `notes`, `table_note`, `local_id`, `updated_at`;
- verificaciones registradas: `pnpm -C functions/api typecheck` OK, `pnpm -C apps/web-b2c typecheck` OK y `git diff --check` OK;
- QA live aprobado: `POST /orders` free pass, response minimo, modal de exito, QR/token, email con QR/token, compra con `ticket_type_id`, `intended_date`, `POST /reservations`, response minimo, toast/navegacion, email/notificacion, panel orders/search, check-in, panel reservas/confirmacion, activity, metrics y calendar month/day;
- este checkpoint no toca reglas de negocio, Data API containment, RLS, SQL, migraciones, panel, payments/callback, service role ni endpoints publicos de lectura de ordenes;
- `B5b` no queda cerrado completo: siguen pendientes drift SQL/env y `/payments/callback` si pagos reales aplican.

Checkpoint `B5b-11 Panel mutation selects hardening`:

- `PATCH /panel/reservations/:id` y `PATCH /panel/orders/:id/use` ya fueron remediados como sub-slice de reduccion de payloads/selects en mutaciones puntuales del panel;
- `PATCH /panel/reservations/:id` redujo fetch interno a `id`, `local_id`, `status`, `email`, `name`, `date` y `guests`, y redujo response/update DTO a `id`, `status`, `table_note` y `updated_at`;
- se conservaron tenant check, validacion de estado y datos internos necesarios para email de confirmacion/cancelacion;
- `PATCH /panel/orders/:id/use` redujo fetch interno a `id`, `local_id`, `status`, `used_at`, `valid_from`, `valid_to`, `is_window_legacy` y `created_at`, y redujo response/update DTO a `id`, `status` y `used_at`;
- se conservaron tenant check y validacion de ventana;
- `PATCH /panel/checkin/:token` no fue modificado; queda intacto como flujo operativo real del scanner;
- `apps/web-next/lib/reservations.ts` quedo alineado con `PanelReservationMutationResponse`; `Reservation` usado por listados no fue modificado;
- verificaciones registradas: `pnpm -C functions/api typecheck` OK y `pnpm -C apps/web-next typecheck` OK;
- QA live aprobado: confirmacion/cancelacion de reserva, edicion de `table_note`, nota visible en UI, listados/busqueda de reservas, emails, check-in QR/token, scanner, orders search/summary, activity, metrics y calendar month/day;
- `PATCH /panel/orders/:id/use` no se forzo por ID porque no hay consumidor activo claro y no conviene afectar datos reales innecesariamente;
- este checkpoint no toca reglas de negocio, Data API containment, RLS, SQL, migraciones, endpoints publicos, payments/callback ni service role;
- `B5b` no queda cerrado completo: siguen pendientes drift SQL/env y `/payments/callback` si pagos reales aplican.

Checkpoint `B5b-12 GET /events/whatsapp_clicks/count validation`:

- `GET /events/whatsapp_clicks/count` ya fue remediado como sub-slice de tracking validation;
- en `functions/api/src/routes/events.ts` se agrego `whatsappClickCountQuerySchema` con `localId: z.string().uuid()`;
- el handler ahora usa `safeParse(req.query)` y responde `400` cuando `localId` falta o no es UUID valido;
- para UUIDs validos se mantiene el contrato `{ local_id: localId, count: count ?? 0 }`;
- la consulta a Supabase no se ejecuta si `localId` es invalido;
- no se valido existencia del local y no se agrego query a `locals`, para evitar query adicional y cambio semantico;
- no se toco `POST /events/whatsapp_click`, metrics, activity, frontend, SQL, RLS, migraciones, payments/callback ni service role;
- verificaciones registradas: `pnpm -C functions/api typecheck` OK y `git diff --check` OK;
- QA live aprobado: UUID valido con clicks -> `200` y count `10`; UUID valido sin clicks -> `200` y count `0`; sin `localId` -> `400`; `localId=abc` -> `400`; `POST /events/whatsapp_click` -> OK; `GET /metrics/summary` -> OK; `GET /activity` -> OK;
- este checkpoint reduce ruido/queries invalidas en un endpoint publico que usa backend privilegiado, sin cambiar el contrato para UUIDs validos;
- `B5b` no queda cerrado completo: siguen pendientes drift SQL/env y `/payments/callback` si pagos reales aplican.

## 11. Riesgos y ambigüedades que requieren validación

### 11.1 Hallazgos de `docs/audits/**` usados para remediación

| Estado | Hallazgos |
| --- | --- |
| Vigentes | RA-01, RC-04, RC-07 a RC-13, PN-07/PN-08, F6/F7 pausadas, residuales F3 `RV-13` a `RV-16` y `PN-04` |
| Parcialmente mitigados | RC-05 por `requestId`, logger y wiring mínimo de Sentry; RC-06 por extracciones parciales de `panel.ts` |
| Requieren revalidación | Sentry real, RLS desplegado, pagos/callback, lookup público, auth por ruta y topología productiva |
| Snapshot histórico | `docs/audits/TAIRET_TECH_AUDIT_MVP.md`; usar como contexto, no como fuente operativa primaria |

### 11.2 Validaciones que no se cierran desde repo/docs

- host real de B2C, panel y API;
- mapping real de dominios y CORS;
- envs productivas reales, sin exponer secretos;
- estado desplegado de Supabase, schema, migraciones y RLS;
- semántica real de `SUPABASE_SERVICE_ROLE` frente a RLS en el entorno objetivo;
- alcance productivo de pagos;
- autenticidad y exposición final de `/payments/callback`;
- captura real de Sentry con DSN activo;
- plataforma real de logs y búsqueda por `requestId`;
- estado final de demo mode y rutas `/panel/demo/*`;
- QA manual contra entorno real;
- backup/restore, rollback y owner de incidente.

### 11.3 Drift ya conocido que no debe bloquear este plan

- `5173` vs `5174` debe resolverse dentro de `B1`, no abrir una auditoría aparte.
- `SUPABASE_SERVICE_ROLE_KEY` vs `SUPABASE_SERVICE_ROLE` debe resolverse dentro de `B1`.
- `MisEntradas` preservada pero despublicada debe mantenerse como condición de `B5a`/`B5b`.
- `/panel/metrics` reutilizando `lineup` queda como `B8`, no como bloqueante.
- Sentry TODO legacy queda como contexto; la validación real vive en `B6`.

## 12. Documentos vivos durante la remediación

Mantener estos documentos como fuentes vivas mientras se ejecuta el plan:

- `docs/production/GO_LIVE_REMEDIATION_PLAN.md`: tablero de ejecución de remediación;
- `docs/production/B0_GO_LIVE_DECISIONS_AND_OWNERSHIP.md`: decisiones, owners y criterios de cierre de `B0`;
- `docs/production/PRODUCTION_READINESS_AND_GO_LIVE_CHECKLIST.md`: gate de decisión y checklist final;
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`: envs, deploy, rollback y drift operativo;
- `docs/operations/OBSERVABILITY_AND_ERROR_HANDLING.md`: requestId, Sentry, logs, incidentes y gaps;
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`: riesgos, controles y hardening;
- `docs/architecture/FUNCTIONAL_FLOWS_E2E.md`: QA funcional B2C/B2B;
- `docs/audits/STATUS.md`: tablero canónico de auditoría;
- `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`: riesgos residuales y aceptados;
- `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md`: demo cleanup;
- `docs/RUNBOOK.md`: base de operación local, a actualizar si se formaliza operación productiva.
