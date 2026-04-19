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
