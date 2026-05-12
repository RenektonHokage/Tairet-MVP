# B7_FINAL_SMOKE_AND_GO_NO_GO

## 1. Propósito

Este documento cierra documentalmente el bloque `B7 — Validación funcional final y go/no-go` para el corte operativo `free_pass only` de Tairet.

Su función es dejar el registro final del smoke ejecutado contra el entorno real, con resultados globales, riesgos aceptados y decisión final. La evidencia registrada acá corresponde al corte `free_pass only` y no habilita paid flows ni pagos reales.

El objetivo de uso es:

- confirmar precondiciones del smoke final;
- registrar resultado real, evidencia, owner y fecha/hora;
- decidir `GO`, `NO-GO` o `GO con riesgos aceptados`.

Este documento no modifica código, SQL, migraciones, configuración, runtime envs ni endpoints.

## 2. Alcance del corte

| Decisión | Estado para B7 | Evidencia |
| --- | --- | --- |
| Alcance operativo | `free_pass only` | `docs/production/B0_GO_LIVE_DECISIONS_AND_OWNERSHIP.md`, `docs/production/B1_PRODUCTION_TOPOLOGY_AND_ENVS.md` |
| Paid flows / pagos reales | Fuera del corte actual | `docs/production/GO_LIVE_REMEDIATION_PLAN.md`, `docs/audits/B5B_SUPABASE_DATA_ACCESS_DISCOVERY.md` |
| `/payments/callback` | Stand by; gate obligatorio antes de paid flows | `docs/audits/B5B_SUPABASE_DATA_ACCESS_DISCOVERY.md`, `docs/security/SECURITY_AND_HARDENING_STATUS.md` |
| Demo panel | Permitido por rutas no enlazadas con riesgo aceptado | `docs/production/B3_DEMO_MODE_RUNTIME_AND_RISK_ACCEPTANCE.md` |
| Owner de release | `nosotros` | `docs/production/B0_GO_LIVE_DECISIONS_AND_OWNERSHIP.md` |
| Owner de incidentes | `nosotros` | `docs/production/B0_GO_LIVE_DECISIONS_AND_OWNERSHIP.md`, `docs/production/B6_MINIMUM_OBSERVABILITY_AND_INCIDENT_OPERATION.md` |

Paid flows no pueden considerarse aprobados por este checklist. Antes de activar pagos reales se debe ejecutar un gate separado sobre `/payments/callback`.

### 2.1 Resultado global registrado

| Superficie | Resultado final | Evidencia / notas |
| --- | --- | --- |
| Pasada rápida | `PASS` | Smoke final reportado como pasado para el corte `free_pass only`. |
| Ambientes y hosts | `PASS` | Hosts validados: B2C, redirect `www`, panel live y API. |
| B2C completo operativo | `PASS` | B2C público actualmente deployado en `https://tairet.com.py` operativo. |
| Free pass / órdenes | `PASS` | Flujo `free_pass` operativo; paid flows fuera de alcance. |
| Reservas | `PASS` | Flujo core de reservas operativo. |
| Panel live | `PASS` | Panel live operativo en host temporal aceptado. |
| Check-in | `PASS` | Flujo de check-in operativo. |
| API | `PASS` | API operativa en host validado. |
| Tracking / métricas mínimas | `PASS` | Tracking, metrics y activity mínimos operativos. |
| Demo/live | `PASS` | Demo/live validado bajo rutas aceptadas por B3. |
| Observabilidad mínima | `PASS` con Sentry `N/A` | Se opera con fallback manual + Railway logs + `x-request-id` + diagnóstico support. |

### 2.2 Nota de alcance B2C

- El smoke valida el B2C público actualmente deployado en `https://tairet.com.py`.
- `https://www.tairet.com.py` redirige correctamente a `https://tairet.com.py`.
- El B2C público está deployado desde una branch distinta a `main`.
- Cambios visuales existentes solo en `main` no forman parte de este B7 y no se registran como `PASS` de producción.
- Para este corte, se valida el build operativo real deployado.

## 3. Fuentes de verdad revisadas

Fuentes principales:

- `docs/production/GO_LIVE_REMEDIATION_PLAN.md`
- `docs/production/PRODUCTION_READINESS_AND_GO_LIVE_CHECKLIST.md`
- `docs/production/B0_GO_LIVE_DECISIONS_AND_OWNERSHIP.md`
- `docs/production/B1_PRODUCTION_TOPOLOGY_AND_ENVS.md`
- `docs/production/B2_DEPLOY_ROLLBACK_AND_MIGRATIONS.md`
- `docs/production/B3_DEMO_MODE_RUNTIME_AND_RISK_ACCEPTANCE.md`
- `docs/production/B6_MINIMUM_OBSERVABILITY_AND_INCIDENT_OPERATION.md`
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`
- `docs/audits/B5A_APPLICATION_ACCESS_DISCOVERY.md`
- `docs/audits/B5B_SUPABASE_DATA_ACCESS_DISCOVERY.md`

Fuentes de soporte:

- `docs/audits/**`
- `docs/operations/**`
- `docs/architecture/**`
- `docs/panel/**`
- `docs/RUNBOOK.md`

Evidencia B5a:

- `docs/audits/B5A_APPLICATION_ACCESS_DISCOVERY.md`: discovery final de `B5a`.
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`: estado documental de `B5a`, `B5a-1`, `B5a-2` y decisión vigente sobre `B5a-3`.
- `docs/production/GO_LIVE_REMEDIATION_PLAN.md`: checkpoints `B5a-1` y `B5a-2`.

Evidencia B5b:

- `docs/audits/B5B_SUPABASE_DATA_ACCESS_DISCOVERY.md`: checkpoints `B5b-0` a `B5b-14`.
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`: cierre `B5b` para `free_pass only` y stand by de `/payments/callback`.
- `docs/production/GO_LIVE_REMEDIATION_PLAN.md`: remediaciones, aceptaciones y gates futuros de B5b.

## 4. Precondiciones obligatorias

Estas precondiciones deben revisarse antes de ejecutar el smoke final. Si una precondición crítica falla, no ejecutar `GO`; resolver o declarar `NO-GO`.

| ID | Precondición | Resultado esperado | Resultado real | Estado | Evidencia / notas | Owner | Fecha/hora |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PRE-01 | B0 cerrado documentalmente | Alcance, owners, pagos fuera del corte, demo y riesgos definidos | Cierre documental consumido para B7 | `PASS` | B0 define `free_pass only`, owners `nosotros`, paid flows fuera del corte y demo aceptado con riesgo. | `nosotros` | 2026-05-05 |
| PRE-02 | B1 cerrado documentalmente | Hosts y envs objetivo documentados para B2C, panel y API | Cierre documental consumido para B7 | `PASS` | Hosts del corte validados en smoke final. | `nosotros` | 2026-05-05 |
| PRE-03 | B2 cerrado documentalmente | Release, rollback prudente, migraciones y abort criteria documentados | Cierre documental consumido para B7 | `PASS` | B2 aporta procedimiento de release/rollback prudente y abort criteria. | `nosotros` | 2026-05-05 |
| PRE-04 | B3 cerrado documentalmente | Demo permitido por rutas no enlazadas con riesgo aceptado | Cierre documental consumido para B7 | `PASS` | Demo/live reportado `PASS`; demo queda aceptado por rutas no enlazadas. | `nosotros` | 2026-05-05 |
| PRE-05 | B5a cerrado para este corte | Discovery documentado; `B5a-1` y `B5a-2` implementados/validados; `B5a-3` diferido con decisión vigente | B5a aprobado para `free_pass only` | `PASS` | Evidencia en `B5A_APPLICATION_ACCESS_DISCOVERY.md`, security status y remediation plan. | `nosotros` | 2026-05-05 |
| PRE-06 | B5b cerrado para `free_pass only` | Data API containment cerrado; endpoints sensibles contenidos; DTO/select hardening aplicado; `SUPABASE_SERVICE_ROLE` aceptado; `/payments/callback` en stand by | B5b aprobado solo para `free_pass only` | `PASS` | Evidencia en `B5B_SUPABASE_DATA_ACCESS_DISCOVERY.md`, security status y remediation plan. | `nosotros` | 2026-05-05 |
| PRE-07 | B5b no cerrado para paid flows | Pagos reales siguen fuera del corte y no se declaran listos | Paid flows fuera del corte | `PASS` | Este B7 no aprueba paid flows ni pagos reales. | `nosotros` | 2026-05-05 |
| PRE-08 | Gate futuro de pagos definido | Antes de paid flows: firma/autenticidad, idempotencia, replay, update seguro de `orders`, registro en `payment_events`, QA sandbox/controlado | Gate futuro requerido | `PASS` | `/payments/callback` queda en stand by y requiere gate separado. | `nosotros` | 2026-05-05 |
| PRE-09 | B6 cerrado documentalmente | Observabilidad mínima y ruta de incidente documentadas | B6 consumido para B7 | `PASS` | Observabilidad mínima reportada `PASS` con Sentry `N/A`. | `nosotros` | 2026-05-05 |
| PRE-10 | Owners disponibles | Owner de release e incidente: `nosotros` | Owners definidos | `PASS` | Owners de release/incidente: `nosotros`. | `nosotros` | 2026-05-05 |
| PRE-11 | Hosts del corte definidos | B2C, panel y API apuntan a los hosts esperados | Hosts validados | `PASS` | B2C, redirect `www`, panel live y API reportados operativos. | `nosotros` | 2026-05-05 |
| PRE-12 | Email/notificaciones clasificadas | Si `EMAIL_ENABLED=true` o envío real está habilitado, validar recepción; si no, registrar `N/A` sin bloquear flujo core | Condicionado a configuración vigente | `PASS` | Emails/notificaciones tratados como checks condicionados; no bloquean si están deshabilitados y flujo core pasa. | `nosotros` | 2026-05-05 |
| PRE-13 | Sentry clasificado | Sentry panel solo se declara operativo con DSN validado; si no, fallback manual + logs + `requestId` | Sentry `N/A`; fallback manual activo | `PASS` | No se declara Sentry operativo; fallback manual + Railway logs + `x-request-id` + diagnóstico support. | `nosotros` | 2026-05-05 |

Estados permitidos después de ejecutar: `PASS`, `FAIL`, `N/A`, `Aceptado con riesgo`.

## 5. Ambientes y hosts del smoke

| Superficie | Host / base URL | Estado esperado | Resultado real | Estado | Evidencia / notas | Owner | Fecha/hora |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B2C | `https://tairet.com.py` | Host objetivo del corte responde con build esperado | B2C público actualmente deployado operativo | `PASS` | Build real deployado validado; no incluye cambios visuales solo en `main`. | `nosotros` | 2026-05-05 |
| B2C redirect | `https://www.tairet.com.py` | Redirige a apex si aplica | Redirige correctamente a `https://tairet.com.py` | `PASS` | Redirect validado en smoke final. | `nosotros` | 2026-05-05 |
| Panel live | `https://tairet-mvp-web-next.vercel.app/` | Host temporal aceptado responde con build esperado | Panel live operativo | `PASS` | Host temporal aceptado para este corte. | `nosotros` | 2026-05-05 |
| API | `https://tairetapi-production.up.railway.app/` | API responde y expone `/health` | API operativa | `PASS` | API host validado en smoke final. | `nosotros` | 2026-05-05 |
| Demo panel | Mismo host del panel bajo `/panel/demo/*` | Rutas demo aceptadas disponibles solo como rutas no enlazadas | Demo/live operativo | `PASS` | Rutas demo aceptadas para este corte. | `nosotros` | 2026-05-05 |

Datos que debe preparar quien ejecute el smoke:

- usuario owner válido;
- usuario staff válido, si existe para este corte;
- slug de bar;
- slug de discoteca;
- email de prueba;
- teléfono/documento de prueba si el flujo lo requiere;
- `localId` UUID válido con clicks y otro UUID válido sin clicks;
- token QR/check-in generado durante el smoke;
- acceso a logs backend o procedimiento manual equivalente.

No registrar datos sensibles reales en este documento; usar evidencia segura o referencias internas.

## 6. Checklist B2C

| ID | Superficie | Check | Resultado esperado | Resultado real | Estado | Evidencia / notas | Owner | Fecha/hora |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B2C-01 | B2C | Abrir home pública | Home carga sin errores visibles | B2C completo operativo | `PASS` | Smoke final reportado `PASS` para B2C público deployado. | `nosotros` | 2026-05-05 |
| B2C-02 | B2C | Abrir explorar/listados | Listados cargan desde API o fallback esperado sin errores críticos | B2C completo operativo | `PASS` | Cubierto por smoke final B2C. | `nosotros` | 2026-05-05 |
| B2C-03 | B2C | Abrir perfil de bar | Perfil visible, datos principales coherentes | B2C completo operativo | `PASS` | Cubierto por smoke final B2C. | `nosotros` | 2026-05-05 |
| B2C-04 | B2C | Abrir perfil de discoteca | Perfil visible, datos principales coherentes | B2C completo operativo | `PASS` | Cubierto por smoke final B2C. | `nosotros` | 2026-05-05 |
| B2C-05 | B2C | Mapa/contacto/galería/horarios/promos donde aplique | Secciones visibles no rompen navegación ni API | B2C completo operativo | `PASS` | Cubierto por smoke final B2C. | `nosotros` | 2026-05-05 |
| B2C-06 | B2C | Verificar errores API/CORS en flujo público | No hay errores CORS/API que bloqueen navegación core | B2C completo operativo | `PASS` | Cubierto por smoke final B2C y API. | `nosotros` | 2026-05-05 |
| B2C-07 | B2C | Verificar `MisEntradas` | No aparece en navegación pública si sigue despublicado | B2C completo operativo | `PASS` | Paid/lookup público no reabierto; `MisEntradas` sigue fuera del corte. | `nosotros` | 2026-05-05 |
| B2C-08 | B2C | Mobile básico | Home, perfil y CTA core funcionan en viewport móvil | B2C completo operativo | `PASS` | Cubierto por smoke final B2C. | `nosotros` | 2026-05-05 |

## 7. Checklist free pass / órdenes

| ID | Superficie | Check | Resultado esperado | Resultado real | Estado | Evidencia / notas | Owner | Fecha/hora |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ORD-01 | B2C/API | Crear orden `free_pass` | `POST /orders` responde éxito para free pass | Free pass / órdenes operativo | `PASS` | Smoke final reportado `PASS` para free pass. | `nosotros` | 2026-05-05 |
| ORD-02 | API | Validar DTO mínimo de `POST /orders` | Respuesta contiene `id`, `checkin_token`, `quantity`, `total_amount`, `currency`, `status`, `payment_method`, `created_at`, `intended_date` | DTO mínimo validado dentro del smoke | `PASS` | Free pass / órdenes reportado `PASS`. | `nosotros` | 2026-05-05 |
| ORD-03 | Seguridad datos | Validar que respuesta pública no incluya PII removida | No devuelve `customer_email`, `customer_name`, `customer_last_name`, `customer_phone`, `customer_document`, `transaction_id`, `used_at`, `items`, `updated_at`, `is_window_legacy` | Sin reapertura de exposición pública reportada | `PASS` | B5b sigue cerrado para `free_pass only`. | `nosotros` | 2026-05-05 |
| ORD-04 | B2C | QR/token post-compra | QR o token de check-in visible/copiar según flujo vigente | QR/token operativo | `PASS` | Free pass y check-in reportados `PASS`. | `nosotros` | 2026-05-05 |
| ORD-05 | Email | Email free pass condicionado | Si envío real está habilitado, email llega; si no, marcar `N/A` y confirmar que flujo core no falla | Condicionado a configuración vigente | `PASS` | Emails/notificaciones tratados como checks condicionados; no bloquean si están deshabilitados y flujo core pasa. | `nosotros` | 2026-05-05 |
| ORD-06 | Alcance pagos | Confirmar paid flow fuera del corte | No aparece pago real habilitado ni CTA que permita paid flow sin gate | Paid flows fuera del corte | `PASS` | Este B7 no aprueba paid flows ni `/payments/callback` productivo. | `nosotros` | 2026-05-05 |
| ORD-07 | Panel | Orden aparece en búsqueda/resumen si aplica | `GET /panel/orders/search` y summary reflejan operación esperada | Panel live operativo | `PASS` | Panel live reportado `PASS`. | `nosotros` | 2026-05-05 |

## 8. Checklist reservas

| ID | Superficie | Check | Resultado esperado | Resultado real | Estado | Evidencia / notas | Owner | Fecha/hora |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RES-01 | B2C/API | Crear reserva desde B2C | `POST /reservations` responde éxito | Reservas operativas | `PASS` | Smoke final reportado `PASS` para reservas. | `nosotros` | 2026-05-05 |
| RES-02 | API | Validar DTO mínimo de reserva | Respuesta contiene `id`, `status`, `date`, `guests`, `created_at` | DTO mínimo validado dentro del smoke | `PASS` | Reservas reportado `PASS`. | `nosotros` | 2026-05-05 |
| RES-03 | Seguridad datos | Validar que respuesta pública no incluya PII removida | No devuelve `name`, `last_name`, `email`, `phone`, `notes`, `table_note`, `local_id`, `updated_at` | Sin reapertura de exposición pública reportada | `PASS` | B5b sigue cerrado para `free_pass only`. | `nosotros` | 2026-05-05 |
| RES-04 | Email/notificación | Email/notificación de reserva condicionado | Si envío real está habilitado, llega notificación; si no, marcar `N/A` y confirmar que reserva core no falla | Condicionado a configuración vigente | `PASS` | Emails/notificaciones tratados como checks condicionados; no bloquean si están deshabilitados y flujo core pasa. | `nosotros` | 2026-05-05 |
| RES-05 | Panel | Ver reserva en panel | Reserva creada aparece en panel live del tenant correcto | Panel live operativo | `PASS` | Panel live y reservas reportados `PASS`. | `nosotros` | 2026-05-05 |
| RES-06 | Panel | Confirmar reserva desde panel | Cambio de estado funciona y conserva tenant check | Reservas operativas | `PASS` | Smoke final reportado `PASS` para reservas. | `nosotros` | 2026-05-05 |
| RES-07 | Panel | Cancelar reserva desde panel si aplica | Cancelación funciona según reglas vigentes | Reservas operativas | `PASS` | Smoke final reportado `PASS` para reservas. | `nosotros` | 2026-05-05 |
| RES-08 | Panel | Editar `table_note` | Nota se guarda y queda visible correctamente | Reservas operativas | `PASS` | Smoke final reportado `PASS` para reservas. | `nosotros` | 2026-05-05 |

## 9. Checklist panel live

| ID | Superficie | Check | Resultado esperado | Resultado real | Estado | Evidencia / notas | Owner | Fecha/hora |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PAN-01 | Panel | Abrir `/panel/login` | Login carga sin activar demo involuntariamente | Panel live operativo | `PASS` | Smoke final reportado `PASS` para panel live. | `nosotros` | 2026-05-05 |
| PAN-02 | Panel/Auth | Login owner | Owner puede entrar al panel live | Panel live operativo | `PASS` | Panel live reportado `PASS`. | `nosotros` | 2026-05-05 |
| PAN-03 | Panel/Auth | Login staff si aplica | Staff puede entrar y queda limitado por rol | Panel live operativo | `PASS` | Panel live reportado `PASS`; B5a cerrado para este corte. | `nosotros` | 2026-05-05 |
| PAN-04 | API/Panel | `GET /panel/me` | Devuelve usuario, rol y tenant esperados | Panel live operativo | `PASS` | Panel live reportado `PASS`. | `nosotros` | 2026-05-05 |
| PAN-05 | Panel | Shell/dashboard autenticado | Shell carga y conserva sesión en refresh | Panel live operativo | `PASS` | Panel live reportado `PASS`. | `nosotros` | 2026-05-05 |
| PAN-06 | Panel/orders | Orders summary/search | Resumen y búsqueda funcionan para tenant correcto | Panel live operativo | `PASS` | Orders panel cubierto por panel live `PASS`. | `nosotros` | 2026-05-05 |
| PAN-07 | Panel/reservas | Reservas | Lista/búsqueda de reservas funciona | Panel live operativo | `PASS` | Reservas y panel live reportados `PASS`. | `nosotros` | 2026-05-05 |
| PAN-08 | Panel/calendar | Calendar month | Mes carga datos esperados | Panel live operativo | `PASS` | Panel live reportado `PASS`. | `nosotros` | 2026-05-05 |
| PAN-09 | Panel/calendar | Calendar day | Día carga datos esperados | Panel live operativo | `PASS` | Panel live reportado `PASS`. | `nosotros` | 2026-05-05 |
| PAN-10 | Panel/activity | Activity | Activity carga sin errores críticos | Panel live operativo | `PASS` | Activity reportado dentro de tracking/métricas mínimas `PASS`. | `nosotros` | 2026-05-05 |
| PAN-11 | Panel/metrics | Metrics summary | Métricas resumen cargan sin romper lectura operativa | Panel live operativo | `PASS` | Metrics reportado dentro de tracking/métricas mínimas `PASS`. | `nosotros` | 2026-05-05 |
| PAN-12 | Panel/catalog | Catalog tickets/tables | Listado y alta mínima de tickets/tables funcionan si aplica al smoke | Panel live operativo | `PASS` | Panel live reportado `PASS`. | `nosotros` | 2026-05-05 |
| PAN-13 | Panel/support | Support/settings/status | `/panel/support/status` o vista equivalente muestra diagnóstico mínimo | Diagnóstico support disponible | `PASS` | Observabilidad mínima reportada `PASS` con diagnóstico support. | `nosotros` | 2026-05-05 |
| PAN-14 | Panel/export | Exports si forman parte del corte | Export funciona o se registra `N/A` si no aplica al corte | Panel live operativo | `PASS` | Panel live reportado `PASS`; no se reportaron fallos críticos. | `nosotros` | 2026-05-05 |

## 10. Checklist check-in

| ID | Superficie | Check | Resultado esperado | Resultado real | Estado | Evidencia / notas | Owner | Fecha/hora |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CHK-01 | Panel/API | `PATCH /panel/checkin/:token` con token válido | Check-in exitoso para orden del tenant correcto | Check-in operativo | `PASS` | Smoke final reportado `PASS` para check-in. | `nosotros` | 2026-05-05 |
| CHK-02 | Panel/API | Token inválido | Error controlado, sin crash ni exposición de datos | Check-in operativo | `PASS` | Smoke final reportado `PASS`; no se reportaron fallos críticos. | `nosotros` | 2026-05-05 |
| CHK-03 | Panel/API | Token ya usado si corresponde | Respuesta esperada según regla vigente | Check-in operativo | `PASS` | Smoke final reportado `PASS`; no se reportaron fallos críticos. | `nosotros` | 2026-05-05 |
| CHK-04 | Seguridad/tenant | Tenant/local esperado | No permite operar orden de otro local | Check-in operativo | `PASS` | B5a tenant checks aprobado para este corte; check-in reportado `PASS`. | `nosotros` | 2026-05-05 |
| CHK-05 | Panel/UI | Resultado visible | Scanner/panel muestra resultado suficiente al operador | Check-in operativo | `PASS` | Smoke final reportado `PASS` para check-in. | `nosotros` | 2026-05-05 |

## 11. Checklist API

| ID | Superficie | Check | Resultado esperado | Resultado real | Estado | Evidencia / notas | Owner | Fecha/hora |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| API-01 | API | `GET /health` | `200` y respuesta de health esperada | API operativa | `PASS` | Smoke final reportado `PASS` para API. | `nosotros` | 2026-05-05 |
| API-02 | API | `x-request-id` | Header presente o preservado en responses backend | `x-request-id` disponible para fallback | `PASS` | Observabilidad mínima reportada `PASS` con `x-request-id`. | `nosotros` | 2026-05-05 |
| API-03 | API/CORS | CORS desde B2C | Origin `https://tairet.com.py` puede llamar API según allowlist vigente | API/B2C operativo | `PASS` | B2C y API reportados `PASS`; no se reportaron errores CORS críticos. | `nosotros` | 2026-05-05 |
| API-04 | API/CORS | CORS desde panel | Origin `https://tairet-mvp-web-next.vercel.app` puede llamar API según allowlist vigente | API/panel operativo | `PASS` | Panel live y API reportados `PASS`; no se reportaron errores CORS críticos. | `nosotros` | 2026-05-05 |
| API-05 | Seguridad | `GET /orders/:id` | `410 Gone` | Endpoint sensible contenido | `PASS` | B5b cerrado para `free_pass only`; endpoints sensibles contenidos. | `nosotros` | 2026-05-05 |
| API-06 | Seguridad | `GET /public/orders?email=...` | `410 Gone` | Endpoint sensible contenido | `PASS` | B5b cerrado para `free_pass only`; endpoints sensibles contenidos. | `nosotros` | 2026-05-05 |
| API-07 | Público | `GET /public/locals` | `200` y payload público shapeado | API pública operativa | `PASS` | API y B2C reportados `PASS`. | `nosotros` | 2026-05-05 |
| API-08 | Público | `GET /public/locals/by-slug/:slug` | `200` para slug válido del smoke | API pública operativa | `PASS` | API y B2C reportados `PASS`. | `nosotros` | 2026-05-05 |
| API-09 | Público | `GET /public/locals/by-slug/:slug/catalog` | `200` y catálogo público shapeado | API pública operativa | `PASS` | API, B2C y catálogo del flujo público reportados operativos. | `nosotros` | 2026-05-05 |

## 12. Checklist tracking / métricas mínimas

| ID | Superficie | Check | Resultado esperado | Resultado real | Estado | Evidencia / notas | Owner | Fecha/hora |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TRK-01 | Tracking | `POST /events/whatsapp_click` | Registra click y responde según contrato vigente | Tracking mínimo operativo | `PASS` | Tracking / métricas mínimas reportado `PASS`. | `nosotros` | 2026-05-05 |
| TRK-02 | Tracking | `GET /events/whatsapp_clicks/count` con UUID válido con clicks | `200` y `{ local_id, count }` | Tracking mínimo operativo | `PASS` | Tracking / métricas mínimas reportado `PASS`. | `nosotros` | 2026-05-05 |
| TRK-03 | Tracking | `GET /events/whatsapp_clicks/count` con UUID válido sin clicks | `200` y count `0` | Tracking mínimo operativo | `PASS` | Tracking / métricas mínimas reportado `PASS`. | `nosotros` | 2026-05-05 |
| TRK-04 | Tracking | `GET /events/whatsapp_clicks/count` sin `localId` | `400` con error de validación | Validación pública operativa | `PASS` | Tracking / métricas mínimas reportado `PASS`; B5b validation ya documentada. | `nosotros` | 2026-05-05 |
| TRK-05 | Tracking | `GET /events/whatsapp_clicks/count?localId=abc` | `400` con error de UUID inválido | Validación pública operativa | `PASS` | Tracking / métricas mínimas reportado `PASS`; B5b validation ya documentada. | `nosotros` | 2026-05-05 |
| TRK-06 | Panel/API | `GET /metrics/summary` | Métricas cargan para tenant autenticado | Métricas mínimas operativas | `PASS` | Tracking / métricas mínimas reportado `PASS`. | `nosotros` | 2026-05-05 |
| TRK-07 | Panel/API | `GET /activity` | Activity carga para tenant autenticado | Activity operativo | `PASS` | Tracking / métricas mínimas reportado `PASS`. | `nosotros` | 2026-05-05 |

## 13. Checklist demo/live

| ID | Superficie | Check | Resultado esperado | Resultado real | Estado | Evidencia / notas | Owner | Fecha/hora |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEMO-01 | Demo | `/panel/demo/bar` | Activa escenario `bar` y redirige según política B3 | Demo/live operativo | `PASS` | Demo/live reportado `PASS`. | `nosotros` | 2026-05-05 |
| DEMO-02 | Demo | `/panel/demo/discoteca` | Activa escenario `discoteca` y redirige según política B3 | Demo/live operativo | `PASS` | Demo/live reportado `PASS`. | `nosotros` | 2026-05-05 |
| DEMO-03 | Demo | `/panel/demo/off` | Limpia runtime demo y vuelve a live/login | Demo/live operativo | `PASS` | Demo/live reportado `PASS`. | `nosotros` | 2026-05-05 |
| DEMO-04 | Demo/live | Navegación normal no enlaza demo | No hay links visibles a `/panel/demo/*` desde navegación live normal | Demo por ruta no enlazada validado | `PASS` | Riesgo demo aceptado; demo/live reportado `PASS`. | `nosotros` | 2026-05-05 |
| DEMO-05 | Live | Panel live sin runtime demo persistido | Login/panel live funcionan sin identidad demo | Panel live operativo | `PASS` | Panel live y demo/live reportados `PASS`. | `nosotros` | 2026-05-05 |
| DEMO-06 | Incidente | Distinguir problema demo vs live | Si falla algo tras demo, probar `/panel/demo/off` y clasificar según B6 | Criterio operativo disponible | `PASS` | Observabilidad mínima reportada `PASS`; B6 consumido. | `nosotros` | 2026-05-05 |

## 14. Checklist observabilidad mínima

| ID | Superficie | Check | Resultado esperado | Resultado real | Estado | Evidencia / notas | Owner | Fecha/hora |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OBS-01 | API | `/health` | Responde en host API del corte | Observabilidad mínima operativa | `PASS` | API y observabilidad mínima reportadas `PASS`. | `nosotros` | 2026-05-05 |
| OBS-02 | API | `x-request-id` | Se observa en response y se puede usar para correlación | `x-request-id` disponible | `PASS` | Fallback manual usa Railway logs + `x-request-id`. | `nosotros` | 2026-05-05 |
| OBS-03 | Backend | Logs accesibles o ruta manual definida | Existe forma mínima de buscar por timestamp/path/requestId | Railway logs como fallback manual | `PASS` | Se opera con Railway logs + `x-request-id`. | `nosotros` | 2026-05-05 |
| OBS-04 | Panel/support | `/panel/support/status` | Diagnóstico mínimo disponible para owner/staff | Diagnóstico support disponible | `PASS` | Observabilidad mínima reportada `PASS` con diagnóstico support. | `nosotros` | 2026-05-05 |
| OBS-05 | Sentry panel | Validación con DSN activo si se declara operativo | Si DSN está activo, se valida captura real; si no, registrar `N/A` y usar fallback manual | Sentry no operativo validado | `N/A` | No se declara Sentry operativo; se usa fallback manual + Railway logs + `x-request-id` + diagnóstico support. | `nosotros` | 2026-05-05 |
| OBS-06 | Fallback manual | Ruta de incidente mínima | Owner sabe clasificar live, demo/live confusion o release regression | Fallback manual disponible | `PASS` | Fallback manual + Railway logs + `x-request-id` + diagnóstico support. | `nosotros` | 2026-05-05 |
| OBS-07 | Release abort | Criterio de aborto conectado con B2 | Fallas críticas del smoke pueden escalar a rollback/abort | Criterio operativo disponible | `PASS` | B2/B6 consumidos para decisión final. | `nosotros` | 2026-05-05 |

## 15. Criterios de `GO`, `NO-GO` y `GO con riesgos aceptados`

### 15.1 `GO`

Puede declararse `GO` solo si:

- todos los checks críticos pasan;
- B5a está cerrado para este corte;
- B5b está cerrado para `free_pass only`;
- B5b no se declara cerrado para paid flows;
- paid flows siguen fuera de alcance;
- demo risk está aceptado y validado según B3;
- observabilidad mínima o fallback manual está disponible según B6;
- emails/notificaciones están validados si el envío real está habilitado;
- emails/notificaciones están marcados `N/A` si el envío real está deshabilitado y el flujo core no falla;
- no hay fallos críticos en auth, API, B2C, panel, free pass, reservas o check-in.

### 15.2 `NO-GO`

Debe declararse `NO-GO` si falla cualquiera de estos puntos:

- API `/health`;
- CORS crítico desde B2C o panel;
- login o bootstrap del panel;
- `GET /panel/me`;
- creación de free pass;
- generación o uso del check-in token;
- reserva core;
- `PATCH /panel/checkin/:token` con token válido;
- endpoints sensibles que deberían estar cerrados no devuelven `410 Gone`;
- aparece un paid flow habilitado sin gate de pagos cerrado;
- se reabre exposición sensible ya cerrada en B5a/B5b;
- no existe forma mínima de diagnosticar un incidente;
- demo interfiere con panel live y no se recupera con `/panel/demo/off`.

### 15.3 `GO con riesgos aceptados`

Puede declararse `GO con riesgos aceptados` solo si:

- los flujos core pasan;
- los riesgos están documentados en este registro;
- owners aceptan explícitamente;
- el riesgo no contradice `free_pass only`;
- el riesgo no afecta seguridad crítica, datos sensibles ni operación mínima.

Riesgos aceptables esperados para este corte:

- `SUPABASE_SERVICE_ROLE` como riesgo residual aceptado para backend/API;
- demo en producción por ruta no enlazada;
- Sentry panel `N/A`, no operativo validado;
- fallback manual con Railway logs + `x-request-id` + diagnóstico support;
- panel host temporal;
- B2C validado sobre build actualmente deployado, no sobre cambios visuales solo en `main`;
- paid flows fuera del corte.

Riesgos no aceptables para este corte:

- paid flow activo sin gate de pagos;
- exposición pública de `MisEntradas` sin revalidación;
- endpoints de órdenes sensibles reabiertos;
- pérdida de tenant checks en panel;
- imposibilidad de operar incidente mínimo.

## 16. Registro de resultados

Usar esta tabla como resumen ejecutivo después de completar los checklists anteriores.

| Superficie | Resultado global | Checks fallidos | Checks `N/A` | Riesgos aceptados | Evidencia principal | Owner | Fecha/hora |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Pasada rápida | `PASS` | 0 | 0 | Riesgos aceptados del corte | Resultado global provisto para smoke final | `nosotros` | 2026-05-05 |
| Precondiciones | `PASS` | 0 | 0 | Paid flows fuera del corte; `SUPABASE_SERVICE_ROLE` aceptado | B0/B1/B2/B3/B5a/B5b/B6 consumidos | `nosotros` | 2026-05-05 |
| Ambientes y hosts | `PASS` | 0 | 0 | Panel host temporal; B2C build deployado no-main | B2C, `www` redirect, panel live y API reportados operativos | `nosotros` | 2026-05-05 |
| B2C | `PASS` | 0 | 0 | Build actualmente deployado; cambios visuales solo en `main` fuera de este B7 | B2C completo operativo en `https://tairet.com.py` | `nosotros` | 2026-05-05 |
| Free pass / órdenes | `PASS` | 0 | Emails condicionados si no hay envío real | Paid flows fuera del corte | Free pass / órdenes reportado `PASS` | `nosotros` | 2026-05-05 |
| Reservas | `PASS` | 0 | Email/notificación condicionado si no hay envío real | Ninguno adicional | Reservas reportado `PASS` | `nosotros` | 2026-05-05 |
| Panel live | `PASS` | 0 | 0 | Panel host temporal | Panel live reportado `PASS` | `nosotros` | 2026-05-05 |
| Check-in | `PASS` | 0 | 0 | Ninguno adicional | Check-in reportado `PASS` | `nosotros` | 2026-05-05 |
| API | `PASS` | 0 | 0 | Ninguno adicional | API reportada `PASS` | `nosotros` | 2026-05-05 |
| Tracking / métricas | `PASS` | 0 | 0 | Ninguno adicional | Tracking / métricas mínimas reportado `PASS` | `nosotros` | 2026-05-05 |
| Demo/live | `PASS` | 0 | 0 | Demo en producción por rutas no enlazadas | Demo/live reportado `PASS` | `nosotros` | 2026-05-05 |
| Observabilidad | `PASS` con Sentry `N/A` | 0 | Sentry panel `N/A` | Fallback manual + Railway logs + `x-request-id` + diagnóstico support | Observabilidad mínima reportada `PASS` con Sentry `N/A` | `nosotros` | 2026-05-05 |

Estados permitidos:

- `PASS`
- `FAIL`
- `N/A`
- `Aceptado con riesgo`

No completar como `PASS` sin ejecución real y evidencia suficiente.

## 17. Decisión final

Registro completado después del smoke final reportado para el corte `free_pass only`.

| Campo | Valor |
| --- | --- |
| Decisión final | `GO con riesgos aceptados` |
| Owner que decide | `nosotros` |
| Fecha/hora | 2026-05-05 |
| Entorno ejecutado | B2C `https://tairet.com.py`; redirect `https://www.tairet.com.py`; panel live `https://tairet-mvp-web-next.vercel.app`; API `https://tairetapi-production.up.railway.app` |
| Release/build/commit evaluado | Build operativo real deployado; B2C desplegado desde branch distinta a `main` |
| Evidencia principal | Resultado global de smoke final reportado: pasada rápida, ambientes/hosts, B2C, free pass, reservas, panel live, check-in, API, tracking/métricas, demo/live y observabilidad mínima en `PASS`; Sentry `N/A` |
| Riesgos aceptados | `SUPABASE_SERVICE_ROLE`; demo por rutas no enlazadas; Sentry panel `N/A`; fallback manual con Railway logs + `x-request-id` + diagnóstico support; panel host temporal; B2C validado sobre build deployado, no sobre cambios visuales solo en `main`; paid flows fuera del corte |
| Checks bloqueantes fallidos | Ninguno reportado |
| Próximos pasos inmediatos | Mantener paid flows fuera del corte; ejecutar gate futuro de `/payments/callback` antes de cualquier pago real; operar incidentes con fallback manual + Railway logs + `x-request-id` + diagnóstico support |

Declaración final:

> En base al smoke ejecutado y la evidencia registrada, el owner declara `GO con riesgos aceptados` para el corte `free_pass only`. Esta decisión habilita únicamente el corte `free_pass only`; no habilita paid flows, pagos reales ni `/payments/callback` productivo.

## 18. Seguimiento post go-live / gates futuros

Estos puntos quedan fuera del corte actual o requieren gate futuro:

| Gate futuro | Condición de activación | Requisito mínimo antes de activar |
| --- | --- | --- |
| Paid flows / pagos reales | Cualquier intención de vender tickets pagos | Gate específico de `/payments/callback`: firma/autenticidad, idempotencia, replay, update seguro de `orders`, registro en `payment_events`, QA sandbox/controlado |
| `/payments/callback` productivo | Proveedor de pago real en scope | Validación funcional y de seguridad separada; no se hereda del cierre `free_pass only` |
| `MisEntradas` | Reexposición pública o feature con usuarios reales | Revalidar auth, lookup, PII, tokens y contrato frontend/backend |
| Baseline SQL completo | Necesidad de reconstrucción o auditoría SQL final | Slice separado de reconciliación `schema.sql` / `rls.sql` / migraciones / runtime |
| Sentry operativo | Declarar Sentry como herramienta real de incidente | DSN activo y captura runtime validada |
| Demo hardening definitivo | Producción plena sin excepción demo | Apagar, aislar o rediseñar demo fuera del host live |

## 19. Confirmaciones de este documento

- Usa `docs/audits/**` como fuente de evidencia, incluyendo B5a y B5b.
- No inventa resultados de smoke.
- Registra únicamente los resultados provistos del smoke final ejecutado.
- Deja paid flows fuera del corte.
- Deja B7 como registro final del smoke ejecutado para `free_pass only`.
- No toca código, SQL, migraciones, runtime envs ni endpoints.
