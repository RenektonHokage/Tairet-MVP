# PRODUCTION_READINESS_AND_GO_LIVE_CHECKLIST

## 1. Propósito del documento

Este documento sintetiza el estado de production readiness de Tairet a partir del repo real, la documentación vigente y `docs/audits/**`.

Su objetivo es responder si Tairet está listo para una salida real a producción, qué bloquea el go-live, qué pendientes son críticos, qué puede quedar post go-live y qué debe validarse fuera del repo antes de exponer operación real.

Este documento no reemplaza los mapas de arquitectura, flujos, operación, observabilidad o seguridad. Los consume como fuente para una decisión ejecutiva y un checklist final.

## 2. Cómo leer este documento

Estados usados:

- `Confirmado`: hay evidencia directa en código o documentación vigente.
- `Parcial`: existe base funcional o técnica, pero con límites, dependencias de entorno, mocks, scopes acotados o cobertura incompleta.
- `Requiere validación`: el repo y los docs no alcanzan para cerrar el punto sin entorno real, QA manual, deploy o decisión de negocio.
- `Bloqueante`: impide un go-live productivo real salvo que se cierre antes o se acepte formalmente un alcance más restringido.

Criterio aplicado:

- Si una capacidad depende de hostnames, envs reales, DSN, policies desplegadas, proveedor de pagos, rollback o QA manual, no se marca como lista solo por existir código.
- Si un riesgo puede aceptarse para un go-live acotado, queda como `aceptación requerida`; no se degrada silenciosamente a listo.
- No se listan secretos ni valores reales de variables.

## 3. Veredicto ejecutivo de production readiness

**Veredicto: `No listo para producción real plena`.**

Tairet está funcionalmente avanzado y puede sostener demo o preproducción controlada, pero la evidencia actual no permite declarar un go-live productivo pleno.

Los motivos principales son:

- la topología productiva de panel y API no está cerrada desde el repo;
- no hay CD, deploy workflow, rollback general, promoción de entornos ni estrategia documentada de migraciones;
- la observabilidad productiva depende de entorno y DSN, y no está validada end-to-end;
- la integración de pagos productivos no está cerrada más allá de `free_pass`, callback e idempotencia visibles;
- la postura de datos/RLS sigue parcial fuera de slices endurecidas;
- `SUPABASE_SERVICE_ROLE` concentra blast radius del backend;
- el runtime demo del panel sigue presente y debe apagarse o aislarse antes de producción real;
- existen drifts de env/config que pueden romper operación o diagnóstico si no se corrigen o aceptan antes del despliegue.

Lectura operativa:

- `Listo`: no.
- `Listo con observaciones`: no para producción plena.
- `Apto para demo/preproducción controlada`: sí, si se mantiene alcance controlado y se explicitan los riesgos.
- `Go-live productivo acotado`: posible solo con checklist mínimo cerrado y aceptación formal de riesgos residuales.

**Evidencia principal**

- `docs/architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md`
- `docs/architecture/FUNCTIONAL_FLOWS_E2E.md`
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`
- `docs/operations/OBSERVABILITY_AND_ERROR_HANDLING.md`
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`
- `docs/audits/STATUS.md`
- `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`
- `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md`

## 4. Fuentes revisadas

### 4.1 Documentos base obligatorios

| Fuente | Uso en readiness |
| --- | --- |
| `docs/architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md` | mapa de capas, dependencias, rutas críticas y drift estructural |
| `docs/architecture/FUNCTIONAL_FLOWS_E2E.md` | estado de flujos B2C/B2B, `free_pass`, demo-only y rutas parciales |
| `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md` | entornos, env vars, CI/CD, dominios, rollback y operación |
| `docs/operations/OBSERVABILITY_AND_ERROR_HANDLING.md` | Sentry, PostHog, logs, `requestId`, gaps y puntos ciegos |
| `docs/security/SECURITY_AND_HARDENING_STATUS.md` | auth, RLS, blast radius, service role, hardening y riesgos |
| `docs/RUNBOOK.md` | arranque local, health check, bootstrap manual y troubleshooting |
| `docs/panel/**` | estado demo, cleanup, analytics, UX/performance y scope operativo del panel |

### 4.2 `docs/audits/**`

| Fuente | Estado para este documento | Lectura de readiness |
| --- | --- | --- |
| `docs/audits/STATUS.md` | vigente | tablero principal de F3/F4/F6/F7, bloqueantes, pausas y residuales |
| `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md` | vigente | fuente de riesgos aceptados, críticos, parciales y pendientes |
| `docs/audits/HARDENING_ROADMAP.md` | vigente | marco de hardening por fases y principio no-breaking |
| `docs/audits/CONTRATOS_CONGELADOS_V1.md` | vigente | contratos y dominios que no deben romperse en hardening |
| `docs/audits/MATRIZ_VALIDACION_PREVIA_V1.md` | parcialmente vigente | separa evidencia por código de validaciones runtime |
| `docs/audits/SMOKE_TESTS_V1.md` | parcialmente vigente | evidencia de smoke local, no reemplaza QA productivo |
| `docs/audits/BASELINE_FUNCIONAL_V1.md` | parcialmente vigente | baseline útil, pero superado en partes por docs posteriores |
| `docs/audits/TAIRET_TECH_AUDIT_MVP.md` | snapshot histórico | contexto inicial; no fuente operativa primaria |
| `docs/audits/AGENT.md` | guía de trabajo | criterio metodológico; no evidencia primaria del sistema |

Hallazgos de auditoría usados:

- Vigentes: RA-01, RC-04, RC-07 a RC-13, PN-07/PN-08, F6/F7 pausadas, residuales F3 `RV-13` a `RV-16` y `PN-04`.
- Parcialmente mitigados: RC-05 por `requestId`, logger y wiring mínimo de Sentry panel; RC-06 por extracciones parciales de `panel.ts`.
- Mitigados por código/docs posteriores: findings viejos sobre logout y parte del hallazgo histórico de error middleware/Sentry TODO.
- Requieren revalidación: captura real de Sentry, estado desplegado de RLS, autenticidad de pagos/callback, exposición real de lookup público, cobertura de auth por ruta y topología productiva.

## 5. Estado por capa

| Capa | Estado | Lectura de readiness |
| --- | --- | --- |
| Arquitectura/base del sistema | `Parcial` | capas B2C, panel, API y datos están documentadas; topología productiva final no está cerrada |
| Flujos funcionales B2C | `Parcial` | exploración y reservas existen; perfiles mezclan API + mocks y entradas de discoteca están acotadas a `free_pass` |
| Flujos funcionales B2B/panel | `Parcial` | panel operativo avanzado; demo mode, operación real y validaciones productivas siguen pendientes |
| Entornos/despliegue/operación | `Bloqueante` | no hay deploy automation, rollback general, promoción de entornos, migraciones productivas ni hosts de panel/API verificables |
| Seguridad/hardening | `Parcial` | auth panel y guardrails existen; RLS, service role, lookup público y pagos/callback requieren cierre o aceptación formal |
| Observabilidad/manejo de errores | `Parcial` / `Requiere validación` | backend tiene `requestId` y logs; Sentry/PostHog/captura productiva no están demostrados |
| Demo-only / cleanup pre-producción | `Bloqueante` si queda expuesto | el runtime demo debe apagarse, aislarse o declararse fuera de producción |

**Evidencia principal**

- `docs/architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md`
- `docs/architecture/FUNCTIONAL_FLOWS_E2E.md`
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`
- `docs/operations/OBSERVABILITY_AND_ERROR_HANDLING.md`
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`

## 6. Bloqueantes reales de salida a producción

1. **Topología productiva y envs críticas sin cierre verificable.**
   - Deben cerrarse dominios, hosts y variables por superficie: B2C, panel y API.
   - Variables críticas: `FRONTEND_ORIGIN`, `VITE_API_URL`, `NEXT_PUBLIC_API_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `VITE_MAPBOX_TOKEN`, `SENTRY_DSN` y `NEXT_PUBLIC_SENTRY_DSN` si Sentry se declara operativo.
   - Estado: `Bloqueante`.

2. **Release, deploy, rollback y migraciones no documentados como proceso productivo.**
   - CI existe, pero no hay CD, deploy workflow, promotion pipeline, rollback general ni estrategia de migraciones productivas visible.
   - Estado: `Bloqueante`.

3. **Demo mode del panel debe apagarse o aislarse.**
   - `NEXT_PUBLIC_ENABLE_PANEL_DEMO`, `/panel/demo/*`, runtime demo, datasets demo y overrides visuales no deben confundirse con operación real.
   - Estado: `Bloqueante` si quedan expuestos en producción.

4. **Pagos productivos no están cerrados.**
   - El repo permite afirmar `free_pass`, callback e idempotencia; no permite afirmar integración productiva completa de proveedor.
   - Si el go-live requiere tickets pagos, esto es `Bloqueante`.
   - Si el go-live se limita a `free_pass`, debe quedar como restricción explícita de alcance.

5. **Riesgos de seguridad/datos requieren cierre o aceptación formal.**
   - `SUPABASE_SERVICE_ROLE`, RLS parcial, `GET /public/orders?email=...`, `payment_events` y `/payments/callback` no deben quedar implícitamente aceptados.
   - Estado: `Bloqueante` si no hay mitigación o aceptación formal.

6. **Observabilidad mínima para incidentes no está cerrada.**
   - Hay `x-request-id`, logs JSON y wiring mínimo de Sentry panel, pero no hay evidencia de captura real, agregación, alertas o runbook de incidente end-to-end.
   - Estado: `Bloqueante` si producción requiere soporte real desde el día 1 sin proceso alternativo manual.

**Evidencia principal**

- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`
- `docs/operations/OBSERVABILITY_AND_ERROR_HANDLING.md`
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`
- `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md`
- `docs/audits/STATUS.md`
- `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`

## 7. Pendientes críticos no bloqueantes

Estos pendientes pueden no bloquear un go-live acotado si el alcance y el riesgo quedan aceptados explícitamente.

| Pendiente | Por qué importa | Condición para no bloquear |
| --- | --- | --- |
| Hardening RLS ampliado fuera de tracking/promos/reviews | las tablas críticas siguen sin cierre general verificable | aceptación formal del modelo backend con `SUPABASE_SERVICE_ROLE` y plan posterior |
| Refactor residual de `panel.ts` | concentra dominios sensibles como reservas, órdenes, check-in y export | mantener controles actuales y no abrir refactor estructural durante go-live |
| B2C error tracking dedicado | hoy no hay Sentry/PostHog/error boundary dedicado visible | soporte acepta diagnóstico por backend/logs y errores locales |
| PostHog/GA4 productivo | helper/envs visibles, uso real no confirmado | no tratar analytics SaaS como requisito de go-live |
| Cierre final de `MisEntradas` | base de código preservada y endpoint público residual | mantener despublicado; si se reexpone, pasa a `Requiere validación` fuerte |
| Consistencia semántica de métricas/lineup | `/panel/metrics` reutiliza vistas de `lineup` | aceptar deuda técnica sin romper lectura operativa |
| `.env.example` y docs operativas con drift | puede romper onboarding y despliegue manual | el equipo de deploy usa inventario real validado fuera del ejemplo |

## 8. Pendientes no críticos / post go-live

- dashboards más completos de observabilidad y negocio;
- alertas avanzadas por dominio;
- route-level `error.tsx` en panel;
- refactors de mantenibilidad no vinculados a gates de go-live;
- adopción real de `packages/ui` si se decide consolidar diseño;
- analítica de producto enriquecida con PostHog/GA4 u otra herramienta;
- mejoras visuales del panel demo si permanece solo como herramienta comercial aislada;
- documentación granular por dominio operativo: reservas, orders, check-in, promos y calendario.

## 9. Elementos demo-only / temporales a limpiar o aislar

| Elemento | Acción requerida antes de producción real | Estado |
| --- | --- | --- |
| `NEXT_PUBLIC_ENABLE_PANEL_DEMO` | apagar en producción o limitar a entorno demo separado | `Bloqueante` si queda activo sin aislamiento |
| `/panel/demo/bar`, `/panel/demo/discoteca`, `/panel/demo/off` | dejar inaccesibles en producción real o documentar host demo separado | `Bloqueante` si quedan expuestas |
| Runtime demo en `apps/web-next/lib/panel-demo/*` | confirmar que no mezcla datos live y demo | `Requiere validación` |
| Datasets demo locales | asegurar que no se renderizan fuera de demo mode | `Requiere validación` |
| Edición local en cliente para demo | mantener fuera de flujos live | `Requiere validación` |
| Overrides visuales de video | limpiar o aislar si afectan experiencia real | `Requiere validación` |
| Check-in y soporte/settings fuera del scope demo reutilizable | no tratarlos como módulos demo-ready si dependen de flujos reales | `Confirmado` |
| Mocks/fixtures B2C en perfiles | no son demo-only puros, pero sí deuda de readiness para datos productivos | `Parcial` |

**Evidencia principal**

- `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md`
- `docs/panel/PANEL_DEMO_VIDEO_SCOPE.md`
- `docs/panel/PANEL_DEMO_BLOQUE_3_ORDERS_DISCOTECA_CIERRE.md`
- `docs/architecture/FUNCTIONAL_FLOWS_E2E.md`

## 10. Checklist final de salida a producción

### 10.1 Entorno y configuración

- [ ] Confirmar host productivo del B2C y que `https://www.tairet.com.py` sirve el build esperado.
- [ ] Confirmar host productivo del panel.
- [ ] Confirmar host productivo de la API.
- [ ] Validar `FRONTEND_ORIGIN` contra los orígenes reales.
- [ ] Validar `VITE_API_URL` y `NEXT_PUBLIC_API_URL` contra la API productiva.
- [ ] Validar Supabase productivo: URL, anon key del panel y service role solo en backend.
- [ ] Validar `EMAIL_ENABLED`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS` y `B2C_BASE_URL` si se enviarán emails reales.
- [ ] Validar `VITE_MAPBOX_TOKEN` para mapas públicos.
- [ ] Resolver o documentar drift `5173` vs `5174`.
- [x] Drift `SUPABASE_SERVICE_ROLE_KEY` vs `SUPABASE_SERVICE_ROLE` resuelto en `functions/api/.env.example`; `SUPABASE_SERVICE_ROLE` queda como canonical del backend/API.

### 10.2 Seguridad y hardening

- [ ] Decidir si el go-live acepta el modelo backend con `SUPABASE_SERVICE_ROLE`.
- [ ] Validar estado desplegado de RLS, especialmente fuera de tracking/promos/reviews.
- [ ] Decidir y documentar tratamiento de `GET /public/orders?email=...`.
- [ ] Confirmar que `MisEntradas` sigue despublicada si no se validó su reintroducción.
- [ ] Validar autenticidad, exposición y semántica real de `/payments/callback`.
- [ ] Validar `panelAuth`, `requireRole(...)` y tenant checks en rutas críticas del panel.
- [ ] Confirmar que rate limit panel y trust proxy tienen configuración adecuada para el hosting real.
- [ ] Registrar aceptación formal de riesgos residuales si se decide salir sin cerrar todo RLS/lookup.

### 10.3 Observabilidad y errores

- [ ] Confirmar que `/health` responde en API productiva.
- [ ] Confirmar que `x-request-id` aparece en responses y logs.
- [ ] Confirmar dónde se consultan logs productivos.
- [ ] Validar captura real de Sentry panel con DSN activo si se va a usar Sentry.
- [ ] Definir fallback operativo si Sentry no estará activo en el primer go-live.
- [ ] Confirmar que soporte puede vincular usuario/incidente con requestId/log.
- [ ] Definir alertas o revisión manual para `/payments/callback`, `/panel/checkin`, `/panel/orders` y reservas.

### 10.4 Cleanup demo

- [ ] Apagar `NEXT_PUBLIC_ENABLE_PANEL_DEMO` en producción real.
- [ ] Confirmar que `/panel/demo/*` no está accesible desde el host productivo.
- [ ] Confirmar que datasets demo no se renderizan fuera del runtime demo.
- [ ] Confirmar que overrides visuales de video no afectan live.
- [ ] Confirmar que módulos demo-enabled conservan flujo live intacto con demo off.

### 10.5 Validación funcional B2C

- [ ] Validar exploración de bares y discotecas.
- [ ] Validar navegación a `#/bar/:barId` y `#/club/:clubId`.
- [ ] Validar perfil de bar con horarios, mapa, reseñas y CTA de reserva.
- [ ] Validar perfil de discoteca con catálogo, mesas por WhatsApp y selector de entradas.
- [ ] Validar reserva de bar end-to-end contra backend productivo.
- [ ] Validar orden `free_pass` si ese será el alcance productivo.
- [ ] Confirmar que `/evento/:eventId` no se presenta como venta transaccional activa.
- [ ] Confirmar que `MisEntradas` no queda expuesta si no se revalida.

### 10.6 Validación funcional B2B / panel

- [ ] Validar login con Supabase Auth y bootstrap de `/panel/me`.
- [ ] Validar dashboard por tipo de local.
- [ ] Validar `/panel/profile` con perfil, galería, horarios y catálogo según tipo.
- [ ] Validar promos en `/panel/marketing/promos`.
- [ ] Validar calendario y escritura sobre `local_daily_ops`.
- [ ] Validar reservas para bar en `/panel/reservations`.
- [ ] Validar orders para club en `/panel/orders`, incluyendo summary, búsqueda y export si aplica.
- [ ] Validar check-in para club en `/panel/checkin`.
- [ ] Validar `/panel/metrics` sabiendo que reutiliza vistas de `lineup`.
- [ ] Validar `/panel/settings` como soporte, status y accesos, no como settings genéricos.

### 10.7 Despliegue, rollback y migraciones

- [ ] Definir responsable de release.
- [ ] Definir paso exacto de deploy por superficie.
- [ ] Definir rollback por superficie.
- [ ] Definir estrategia de migraciones SQL.
- [ ] Confirmar backup/restore o punto de recuperación antes de migrar.
- [ ] Confirmar criterio de abortar release.
- [ ] Registrar commit/tag/release candidata si aplica.

### 10.8 Smoke tests post-release

- [ ] API `/health`.
- [ ] Home pública B2C.
- [ ] Perfil de bar.
- [ ] Perfil de discoteca.
- [ ] Reserva de bar.
- [ ] Orden `free_pass` si forma parte del alcance.
- [ ] Login panel.
- [ ] Dashboard panel.
- [ ] Reservas panel para bar.
- [ ] Orders panel para club.
- [ ] Check-in panel para club.
- [ ] Support/status panel.
- [ ] Confirmación de logs/requestId.

## 11. Requiere validación antes de go-live

- hosting real de B2C, panel y API;
- mapping de dominios y CORS real;
- valores reales y vigencia de envs críticas, sin exponer secretos;
- estado desplegado de Supabase, schema, migrations y RLS;
- semántica real de `SUPABASE_SERVICE_ROLE` frente a RLS en el entorno objetivo;
- alcance productivo de pagos: `free_pass` only o proveedor real;
- autenticidad del callback de pagos y exposición final;
- captura real de Sentry con DSN activo;
- uso real de PostHog/GA4 si se declara analytics SaaS;
- plataforma de logs, retención, búsqueda por `requestId` y alertas mínimas;
- estado final de demo mode y rutas `/panel/demo/*`;
- QA manual de flujos B2C y panel contra entorno real;
- backup/restore y estrategia de migraciones;
- procedimiento de rollback y owner de incidente.

## 12. Drift o ambigüedades detectados

- `docs/audits/TAIRET_TECH_AUDIT_MVP.md` es snapshot histórico, no fuente operativa primaria.
- Hallazgos viejos sobre logout quedaron superados por código/docs posteriores.
- El error middleware y Sentry TODO histórico están parcialmente mitigados, pero Sentry productivo sigue en `Requiere validación`.
- `infra/sql/rls.sql` muestra policies permisivas mientras migraciones `016`, `017` y `018` endurecen slices concretas; el estado desplegado real no se puede cerrar desde repo.
- `functions/api/.env.example` ya usa `SUPABASE_SERVICE_ROLE`, alineado con el código documentado; `SUPABASE_SERVICE_ROLE_KEY` queda como nombre histórico/no canonical.
- B2C fija Vite en `5174`, pero RUNBOOK y defaults CORS todavía mencionan `5173`.
- `apps/web-next/.env.example` no cubre todas las envs usadas por runtime del panel.
- La raíz declara Node `>=20`, pero CI usa Node `22`.
- Links o referencias Vercel no equivalen a topología productiva completa.
- `MisEntradas` está preservada en código pero despublicada del router B2C actual.
- `/panel/metrics` funciona como analytics, pero reutiliza vistas de `marketing/lineup`.
- `/panel/settings` es soporte/status/accesos, no un módulo genérico de configuración.

## 13. Qué documentos deberían mantenerse vivos después de este

- `docs/production/PRODUCTION_READINESS_AND_GO_LIVE_CHECKLIST.md` como gate de decisión previo a salida.
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md` como mapa de envs, deploy y rollback.
- `docs/operations/OBSERVABILITY_AND_ERROR_HANDLING.md` como base para incidentes y señales.
- `docs/security/SECURITY_AND_HARDENING_STATUS.md` como estado de riesgos, controles y hardening.
- `docs/architecture/FUNCTIONAL_FLOWS_E2E.md` como base de QA funcional.
- `docs/audits/STATUS.md` y `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md` como tablero de auditoría y riesgos residuales.
- `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md` como referencia de demo cleanup mientras exista runtime demo.
- `docs/RUNBOOK.md`, pero requiere actualización si se formaliza operación productiva.
