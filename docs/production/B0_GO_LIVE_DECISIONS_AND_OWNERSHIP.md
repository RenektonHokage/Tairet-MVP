# B0_GO_LIVE_DECISIONS_AND_OWNERSHIP

## 1. Propósito

Este documento cierra documentalmente el bloque `B0 — Decisiones de alcance y ownership` del remediation plan de go-live.

No inventa decisiones de negocio, operación ni seguridad. Su función es separar:

- decisiones que sí quedan cerradas desde repo/docs;
- decisiones que siguen `Pendiente`;
- validaciones que requieren entorno real, owner humano o evidencia externa al repo.

Fuente principal:

- `docs/production/GO_LIVE_REMEDIATION_PLAN.md`

Fuentes de soporte:

- `docs/production/B1_PRODUCTION_TOPOLOGY_AND_ENVS.md`
- `docs/production/PRODUCTION_READINESS_AND_GO_LIVE_CHECKLIST.md`
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`
- `docs/operations/OBSERVABILITY_AND_ERROR_HANDLING.md`
- `docs/architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md`
- `docs/architecture/FUNCTIONAL_FLOWS_E2E.md`
- `docs/audits/**`
- `docs/panel/**`
- `docs/RUNBOOK.md`

## 2. Cómo usar este documento

Usar esta tabla antes de ejecutar `B1` a `B7`.

Reglas:

- una decisión `Pendiente` no debe asumirse como cerrada por el equipo técnico;
- una decisión `Requiere validación` necesita entorno real, DSN, host, deploy, policy desplegada o prueba operativa;
- cuando un riesgo no se mitiga antes del go-live, debe quedar aceptado con owner y alcance;
- no se deben copiar secretos ni valores reales de envs en este documento.

Estados usados:

| Estado | Significado |
| --- | --- |
| `Cerrada documentalmente` | el repo/docs sostienen el criterio, aunque pueda requerir ejecución posterior |
| `Pendiente` | falta decisión humana de negocio, operación o seguridad |
| `Requiere validación` | falta evidencia de entorno real o runtime |

## 3. Tabla de decisiones de B0

| Decisión | Estado | Evidencia principal | Impacto en el plan | Owner requerido | Bloque que destraba | Criterio de cierre |
| --- | --- | --- | --- | --- | --- | --- |
| Alcance actual del go-live: `free_pass only` | `Cerrada documentalmente` | `docs/production/B1_PRODUCTION_TOPOLOGY_AND_ENVS.md`, `FUNCTIONAL_FLOWS_E2E.md` y readiness usan `free_pass only` como alcance vigente del corte | reduce `B4` a restricción de alcance + smoke; evita asumir pagos reales | No aplica para este corte | `B4`, `B7` | `free_pass only` queda asentado como alcance actual; si se quieren pagos reales, se reabre `B4` |
| Pagos reales no forman parte del go-live actual | `Cerrada documentalmente` | readiness y flujos E2E tratan la compra productiva confirmada como `free_pass`; `payments/callback` sigue como superficie crítica separada | impide asumir venta de tickets pagos sin reapertura formal del alcance | No aplica para este corte | `B4` | mantener `free_pass only` como restricción activa de este corte |
| Estrategia demo del corte: demo aceptado por ruta no enlazada, con riesgo aceptado | `Cerrada documentalmente` | `docs/production/B1_PRODUCTION_TOPOLOGY_AND_ENVS.md`, `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md` y remediation plan documentan superficie demo vigente | evita reabrir en `B0` la decisión de apagar o aislar; mantiene el riesgo explícito | No aplica para este corte | `B3`, `B7` | demo documentado como aceptado por ruta no enlazada; si la estrategia cambia, se reabre `B3` |
| Rutas demo válidas del corte | `Cerrada documentalmente` | `docs/production/B1_PRODUCTION_TOPOLOGY_AND_ENVS.md`, `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md` | fija el alcance visible de la superficie demo aceptada | No aplica para este corte | `B3`, `B7` | las rutas aceptadas quedan limitadas a `/panel/demo/bar`, `/panel/demo/discoteca` y `/panel/demo/off` |
| Topología objetivo del corte para B2C, panel y API | `Cerrada documentalmente` | `docs/production/B1_PRODUCTION_TOPOLOGY_AND_ENVS.md` fija B2C `https://tairet.com.py`, panel `https://tairet-mvp-web-next.vercel.app/` y API `https://tairetapi-production.up.railway.app/` | destraba `B1`/`B2`/`B6`/`B7` con una topología objetivo explícita | No aplica para este corte | `B1`, `B2`, `B6`, `B7` | topología objetivo documentada para este corte; la validación runtime sigue abierta aparte |
| Validación runtime de hosts y superficies del corte | `Requiere validación` | `docs/production/B1_PRODUCTION_TOPOLOGY_AND_ENVS.md` deja explícita validación pendiente del apex B2C, panel y API | evita confundir topología objetivo con topología runtime ya comprobada | Nosotros | `B1`, `B2`, `B6`, `B7` | hosts reales comprobados en runtime contra el entorno objetivo, sin exponer secretos |
| Owner de release | `Cerrada documentalmente` | decisión explícita de este corte | cierra la responsabilidad operativa de deploy/go-no-go en `B0` | Nosotros | `B2`, `B7` | owner de release asentado como `nosotros` |
| Owner de incidentes día 1 | `Cerrada documentalmente` | decisión explícita de este corte + postura operativa de `requestId`/logs en docs de observabilidad | cierra la responsabilidad de triage/escalamiento en `B0` | Nosotros | `B6`, `B7` | owner de incidentes asentado como `nosotros` |
| Estrategia Sentry del corte | `Cerrada documentalmente` | `docs/production/B1_PRODUCTION_TOPOLOGY_AND_ENVS.md`, `docs/operations/OBSERVABILITY_AND_ERROR_HANDLING.md`, `docs/audits/STATUS.md`, `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md` (`RV-16`) | define que panel/frontend valida Sentry real si se declara operativo y que backend puede operar con fallback manual + logs + `requestId` | Nosotros | `B6` | estrategia escrita: validar captura real en panel si se declara operativa; backend usa fallback manual si no llega a validarse a tiempo |
| Validación runtime de Sentry panel con DSN activo | `Requiere validación` | `docs/audits/STATUS.md` y `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md` mantienen `RV-16` como dependencia de entorno | evita sobreactuar cobertura real de Sentry en panel | Nosotros | `B6`, `B7` | evidencia runtime de captura real con DSN activo en panel, si Sentry se declara operativo |
| Tratamiento del riesgo de datos en este corte | `Cerrada documentalmente` | `docs/production/GO_LIVE_REMEDIATION_PLAN.md`, `docs/security/SECURITY_AND_HARDENING_STATUS.md` y `docs/audits/**` separan `B5b` como bloque específico | deja explícito que el riesgo de datos no se considera mitigado automáticamente en `B0` | No aplica para este corte | `B5b`, `B7` | queda escrito que el cierre material del riesgo de datos pertenece a `B5b` |
| Cierre material de riesgos de datos en `B5b` | `Requiere validación` | seguridad/readiness y `docs/audits/**` mantienen riesgos sobre `SUPABASE_SERVICE_ROLE`, RLS parcial, lookup público y `payment_events` | evita presentar `B0` como cierre de hardening o datos | Seguridad/Datos + nosotros | `B5b`, `B7` | mitigación o aceptación formal cerrada en `B5b`, con owner y alcance explícitos |
| `SUPABASE_SERVICE_ROLE` debe asumirse como blast radius alto hasta prueba contraria | `Cerrada documentalmente` | `SECURITY_AND_HARDENING_STATUS.md`, `docs/audits/STATUS.md` y contratos congelados indican uso backend de service role y postura RLS parcial | evita declarar seguridad de datos cerrada por inferencia | Owner requerido: Seguridad/Datos | `B5b` | mantener supuesto hasta validar policies desplegadas y comportamiento real del backend |
| `MisEntradas` se trata como despublicada salvo revalidación | `Cerrada documentalmente` | readiness y smoke/audits tratan `MisEntradas` como preservada/despublicada; si se reexpone vuelve a gate | evita reabrir lookup público sin validación | Owner requerido: Producto/Seguridad | `B5a`, `B5b`, `B7` | mantener despublicada o revalidar ruta/flujo antes de exponerla |

## 4. Dependencias que destraba cada decisión

| Decisión B0 | Bloques afectados | Dependencia concreta |
| --- | --- | --- |
| Alcance actual del go-live | `B4`, `B7` | limita el smoke y la salida inicial a `free_pass only` |
| Estrategia demo del corte | `B3`, `B7` | mantiene la superficie demo por ruta no enlazada, con riesgo aceptado y alcance explícito |
| Topología objetivo del corte | `B1`, `B2`, `B6`, `B7` | fija hosts objetivo, relación entre superficies y base para CORS/envs |
| Validación runtime de hosts y superficies | `B1`, `B2`, `B6`, `B7` | confirma que la topología objetivo coincide con el entorno real |
| Owner de release | `B2`, `B7` | habilita deploy, rollback y go/no-go con responsable |
| Owner de incidentes | `B6`, `B7` | habilita operación día 1 y escalamiento |
| Estrategia Sentry del corte | `B6` | define validación real en panel y fallback manual en backend si no llega a validarse |
| Validación runtime de Sentry panel | `B6`, `B7` | confirma si Sentry panel puede declararse operativo de verdad |
| Tratamiento del riesgo de datos | `B5b`, `B7` | deja explícito que el cierre material pertenece a `B5b` |

## 5. Pendientes explícitos antes de ejecución técnica

- Validar en runtime que `https://tairet.com.py` sea efectivamente el host servido del B2C y resolver su relación efectiva con `https://www.tairet.com.py`.
- Validar en runtime que el panel y la API respondan en los hosts documentados para este corte.
- Validar Sentry real en panel/frontend si se lo va a declarar operativo; si no, sostener explícitamente el fallback manual + logs + `requestId` en backend.
- Cerrar en `B5b` la mitigación o aceptación formal de riesgos de datos sobre `SUPABASE_SERVICE_ROLE`, RLS parcial, lookup público, `payment_events` y tablas críticas.

## 6. Riesgos de ejecutar sin cerrar B0

- Ejecutar `B1`/`B2` sin validar runtime de hosts puede dejar envs o CORS alineados a una topología objetivo que todavía no fue comprobada.
- Ejecutar `B5b` sin cierre material de riesgos de datos puede tratar como resuelto un blast radius que en este corte sigue explícitamente abierto.
- Ejecutar `B6` declarando Sentry operativo sin validación real del panel puede sobreafirmar cobertura de incidente.
- Ejecutar `B7` sin estas validaciones pendientes convierte el smoke en una validación incompleta para go-live.
