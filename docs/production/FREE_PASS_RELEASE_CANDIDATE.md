# FREE_PASS_RELEASE_CANDIDATE

## 1. Proposito

Este documento congela el estado aprobado del release candidate `free_pass only` de Tairet.

Sirve como referencia operativa antes de cualquier cambio futuro: que esta aprobado, que queda fuera del corte, que riesgos fueron aceptados y que condiciones reabren el gate.

No reemplaza los documentos largos de B0-B7, seguridad, observabilidad o deploy. Resume el checkpoint vigente despues de:

- B7 smoke final aprobado;
- delta smoke final post-hardening `PASS`;
- cierre de Service Role Minimization para `free_pass only`.

Este documento no aprueba paid flows, no elimina `SUPABASE_SERVICE_ROLE` y no aprueba `/payments/callback` productivo.

## 2. Estado ejecutivo

Veredicto:

`Release candidate free_pass only: APROBADO DOCUMENTALMENTE`

Lectura correcta:

- aprobado solo para el corte `free_pass only`;
- no equivale a produccion plena de pagos;
- no declara paid flows listos;
- no elimina `SUPABASE_SERVICE_ROLE`;
- no aprueba `/payments/callback`;
- no reabre B0, B1, B2, B3, B5a, B5b, B6 ni B7 para este corte.

Estado cerrado consumido:

- B0 decisiones y ownership cerrado;
- B1 topologia/envs cerrado documentalmente;
- B2 deploy/rollback/migraciones documentado;
- B3 demo en produccion por rutas no enlazadas aceptado;
- B5a/B5b cerrados para `free_pass only`;
- B6 observabilidad minima cerrado;
- B7 smoke final aprobado;
- Service Role Minimization cerrado para `free_pass only` como riesgo reducido y aceptado.

## 3. Alcance del release candidate

Capacidades aprobadas para este release candidate:

- B2C publico operativo actual;
- panel live owner/staff;
- `free_pass`;
- QR/check-in;
- reservas;
- catalogo tickets/mesas;
- promos;
- reviews sin `user_agent` publico;
- tracking/metricas minimas;
- exports owner-only;
- Sentry panel operativo;
- observabilidad minima con `/health`, `x-request-id`, logs Railway, `support/status` y Sentry panel.

Notas de alcance:

- el B2C validado es el build publico actualmente deployado en `https://tairet.com.py`;
- cambios visuales existentes solo en `main` no forman parte de este release candidate;
- `MisEntradas` y lookup publico de ordenes siguen fuera del corte.

## 4. Hosts y superficies

| Superficie | Host | Estado | Nota operativa |
| --- | --- | --- | --- |
| B2C | `https://tairet.com.py` | `Aprobado para este RC` | Build publico real deployado y validado para el corte. |
| B2C redirect | `https://www.tairet.com.py` | `Aprobado para este RC` | Redirige a `https://tairet.com.py`. |
| Panel live | `https://tairet-mvp-web-next.vercel.app` | `Aprobado para este RC` | Host temporal aceptado para owner/staff. |
| API | `https://tairetapi-production.up.railway.app` | `Aprobado para este RC` | `/health` y `x-request-id` validados. |
| Demo panel | mismo host panel, rutas `/panel/demo/*` | `Aceptado con riesgo` | Permitido solo por rutas no enlazadas conocidas. |

## 5. Evidencia de validacion

Fuentes resumidas:

- `docs/production/B0_GO_LIVE_DECISIONS_AND_OWNERSHIP.md`;
- `docs/production/B1_PRODUCTION_TOPOLOGY_AND_ENVS.md`;
- `docs/production/B2_DEPLOY_ROLLBACK_AND_MIGRATIONS.md`;
- `docs/production/B3_DEMO_MODE_RUNTIME_AND_RISK_ACCEPTANCE.md`;
- `docs/production/B6_MINIMUM_OBSERVABILITY_AND_INCIDENT_OPERATION.md`;
- `docs/production/B7_FINAL_SMOKE_AND_GO_NO_GO.md`;
- `docs/production/GO_LIVE_REMEDIATION_PLAN.md`;
- `docs/security/SERVICE_ROLE_MINIMIZATION_PLAN.md`;
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`;
- `docs/audits/B5B_SUPABASE_DATA_ACCESS_DISCOVERY.md`;
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`;
- `docs/operations/OBSERVABILITY_AND_ERROR_HANDLING.md`.

Validaciones que soportan este release candidate:

- B7 final smoke `PASS`;
- delta smoke final post-hardening `PASS`;
- API `/health` `200` y `x-request-id` presente;
- Sentry panel validado con evento real y boton de prueba apagado;
- catalogo/promos `PASS`;
- reviews `PASS` sin `user_agent` publico;
- orders search `PASS` sin `created_at`, `valid_from`, `valid_to`;
- `GET /panel/checkins` `PASS` sin `checkin_token` ni `customer_email`;
- `PATCH /panel/checkin/:token` `PASS` sin `local_id` en success payload;
- exports XLSX/CSV `PASS`, owner-only, sin `Local ID` ni `Token check-in`;
- staff bloqueado por backend/UI en exports;
- panel owner/staff, reservations, calendar, metrics, activity y `support/status` `PASS`.

Lectura de Service Role Minimization:

- el riesgo fue reducido por DTO/payload/export hardening;
- el riesgo residual fue aceptado para este corte;
- `SUPABASE_SERVICE_ROLE` sigue existiendo.

## 6. Riesgos aceptados

Riesgos aceptados solo para este corte:

- `SUPABASE_SERVICE_ROLE` sigue existiendo en backend/API;
- el riesgo de service role queda reducido y aceptado solo para `free_pass only`;
- demo en produccion por rutas no enlazadas;
- panel en Vercel;
- PII comercial en panel/export owner-only donde es operativamente necesaria;
- `checkin_token` sigue visible en `GET /panel/orders/search` porque la UI vigente lo muestra/copia;
- Sentry operativo para panel, pero no implica observabilidad enterprise completa.

Estos riesgos no deben interpretarse como arquitectura final ni como aprobacion para paid flows.

## 7. Fuera de alcance

Queda explicitamente fuera de este release candidate:

- paid flows;
- pagos reales;
- `/payments/callback` productivo;
- Bancard/Dinelco production flow;
- firma/autenticidad/idempotencia/replay de proveedor de pagos;
- `MisEntradas`;
- lookup publico de ordenes;
- migracion completa a JWT/RLS/RPC;
- eliminacion completa de `SUPABASE_SERVICE_ROLE`;
- export limitado para staff;
- demo hardening definitivo;
- cambios visuales B2C que existan solo en `main` pero no esten deployados en el B2C publico actual.

## 8. Criterios de no tocar / congelamiento

Para conservar este release candidate:

- no abrir mas hardening de service role salvo bug real o regresion demostrada;
- no tocar paid flows sin gate especifico;
- no tocar `/payments/callback` sin plan de seguridad, QA y rollback;
- no reabrir `MisEntradas` sin validacion de seguridad y producto;
- no mezclar nuevos features con este release candidate;
- no reactivar export staff sin decision formal;
- no cambiar hosts/API/env critica sin revalidar smoke minimo;
- no declarar pagos reales listos por inferencia desde este documento.

## 9. Rollback y operacion minima

Referencia operativa:

- release/rollback manual segun `docs/production/B2_DEPLOY_ROLLBACK_AND_MIGRATIONS.md`;
- incidente minimo segun `docs/production/B6_MINIMUM_OBSERVABILITY_AND_INCIDENT_OPERATION.md`;
- owner de release/incidentes: `nosotros`.

Senales minimas:

- `GET /health`;
- `x-request-id`;
- logs Railway;
- `support/status`;
- Sentry panel;
- evidencia de host/superficie afectada;
- hora aproximada y usuario/rol si aplica.

Regla de operacion:

- si falla una superficie core, no aplicar fixes en caliente sin criterio de rollback o abort;
- paid flows y `/payments/callback` no se usan como fallback ni como parte de este release.

## 10. Criterios de reapertura

Reabrir este release candidate si ocurre cualquiera de estos eventos:

- falla check-in;
- falla `free_pass`;
- falla panel auth;
- falla export owner-only;
- reaparece un campo removido en un DTO hardened;
- staff puede descargar export sensible;
- paid flow aparece activo;
- `/payments/callback` entra en scope;
- se cambia host, API base o env critica;
- se reabre `MisEntradas` o lookup publico de ordenes;
- se detecta regresion en Sentry panel o en observabilidad minima.

## 11. Proximos gates futuros

Gates futuros fuera de este release candidate:

- paid-flow gate;
- `/payments/callback` security gate;
- Bancard/Dinelco sandbox/production validation;
- arquitectura futura JWT/RLS/RPC;
- demo hardening futuro;
- export limitado staff si aparece necesidad formal;
- decision futura sobre PII comercial, notas, `Reserva ID`, `Orden ID` y `Creada` en exports owner-only.
