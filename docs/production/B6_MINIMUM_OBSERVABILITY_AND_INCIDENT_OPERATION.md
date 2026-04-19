# B6_MINIMUM_OBSERVABILITY_AND_INCIDENT_OPERATION

## 1. Propósito del documento

Este documento cierra documentalmente el bloque `B6 — Observabilidad mínima e incidente operativo` del remediation plan de Tairet.

Su función es dejar un procedimiento operativo mínimo, honesto y ejecutable para este corte sobre:

- observabilidad mínima exigida;
- señales operativas realmente visibles hoy;
- ruta mínima de incidente;
- criterio para distinguir live real, demo/runtime demo y regresión de release;
- criterio de cierre verificable para destrabar `B7`.

Este documento no diseña observabilidad enterprise, no inventa dashboards, alertas ni agregación centralizada, y no afirma cobertura real de Sentry o PostHog si el repo solo muestra wiring o documentación parcial.

## 2. Alcance de B6

Este bloque consume como decisiones de entrada del corte:

- alcance del go-live: `free_pass only`;
- topología objetivo del corte documentada en `B1`;
- release manual, rollback prudente y abort criteria documentados en `B2`;
- demo del panel permitido en producción por ruta no enlazada con riesgo aceptado, documentado en `B3`;
- owners de release e incidentes: `nosotros`.

Fuentes base consumidas:

- `docs/production/GO_LIVE_REMEDIATION_PLAN.md`
- `docs/production/B0_GO_LIVE_DECISIONS_AND_OWNERSHIP.md`
- `docs/production/B1_PRODUCTION_TOPOLOGY_AND_ENVS.md`
- `docs/production/B2_DEPLOY_ROLLBACK_AND_MIGRATIONS.md`
- `docs/production/B3_DEMO_MODE_RUNTIME_AND_RISK_ACCEPTANCE.md`
- `docs/production/PRODUCTION_READINESS_AND_GO_LIVE_CHECKLIST.md`
- `docs/operations/OBSERVABILITY_AND_ERROR_HANDLING.md`
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`
- `docs/audits/STATUS.md`
- `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`
- `docs/audits/MATRIZ_VALIDACION_PREVIA_V1.md`
- `docs/RUNBOOK.md`
- `apps/web-next/instrumentation.ts`
- `apps/web-next/sentry.client.config.ts`
- `apps/web-next/app/global-error.tsx`
- `apps/web-next/lib/api.ts`
- `apps/web-next/lib/support.ts`
- `functions/api/src/middlewares/error.ts`
- `functions/api/src/middlewares/requestId.ts`
- `functions/api/src/server.ts`
- `functions/api/src/index.ts`
- `functions/api/src/routes/support.ts`

Lectura operativa base de `B6`:

- el mínimo defendible del corte está apoyado en señales del backend, no en herramientas SaaS externas;
- `Sentry` panel entra solo como herramienta adicional si existe validación runtime con DSN activo;
- `PostHog` o cualquier analytics SaaS quedan fuera del mínimo exigido;
- todo lo no demostrado en código/docs o no validado en runtime queda en `Requiere validación`.

## 3. Observabilidad mínima exigida para este corte

La observabilidad mínima exigida para este corte es la siguiente.

### 3.1 API

- `GET /health` como disponibilidad mínima;
- `x-request-id` en request/response como correlación principal;
- logs JSON por stdout como base de troubleshooting;
- `errorHandler`, `panelAuth` y `requireRole(...)` como fuentes principales de correlación backend;
- `/panel/support/status` como diagnóstico mínimo autenticado para panel, no como sustituto de monitoreo.

### 3.2 Panel

- estados locales de error/loading en flujos reales;
- `app/global-error.tsx` con `Sentry.captureException(error)` como wiring mínimo visible;
- `instrumentation.ts` y `sentry.client.config.ts` como wiring mínimo de Sentry solo si `SENTRY_DSN` o `NEXT_PUBLIC_SENTRY_DSN` están activos y validados;
- si Sentry no está validado, el fallback operativo mínimo es:
  - soporte/status;
  - diagnóstico copiable de `/panel/settings`;
  - logs backend;
  - contexto de release reciente.

### 3.3 B2C

- errores visibles por `toast`, estados locales, `console.error` y `console.warn`;
- fallbacks locales o degradación visible del flujo como señal operativa mínima;
- señales fire-and-forget a backend (`profile_view`, `whatsapp_click`, `promo_open`) solo como telemetría parcial, no como base principal de incidente.

### 3.4 Exclusiones explícitas del mínimo exigido

- `PostHog` y `GA4` no forman parte del mínimo exigido para este corte;
- no asumir `Sentry` backend operativo;
- no asumir que B2C o panel exponen `x-request-id` al operador;
- no asumir dashboards, alertas, retención ni agregación centralizada de logs.

## 4. Señales operativas por superficie

### 4.1 B2C

| Señal | Qué aporta hoy | Límite operativo |
| --- | --- | --- |
| `toast` y mensajes locales | error visible al usuario final | no dan correlación backend por sí solos |
| `console.error` / `console.warn` | diagnóstico técnico local/dev | no son canal operativo para producción |
| fallback a mocks o datos estáticos en zonas puntuales | evita caída completa en algunos flujos | puede esconder degradación sin dar trazabilidad fuerte |
| tracking fire-and-forget a `/events/*` | telemetría parcial de producto | no reemplaza error tracking ni respuesta a incidente |

Lectura operativa:

- la señal mínima real del B2C es el comportamiento visible del flujo;
- la correlación disponible hoy es host, ruta, hora, local/slug y error visible;
- no hay evidencia de `requestId` expuesto en UI ni de Sentry B2C activo.

### 4.2 Panel

| Señal | Qué aporta hoy | Límite operativo |
| --- | --- | --- |
| errores visibles por pantalla | degradación o fallo de fetch/flujo | cobertura desigual según módulo |
| `global-error.tsx` | captura global de error si Sentry está activo | sin DSN validado no prueba captura real |
| `/panel/settings` | pantalla operativa con diagnóstico y soporte | depende de login/auth y del backend |
| `support/status` | `ok`, tenant, email, rate limit, trust proxy, `api_base_url` | no equivale a monitoreo continuo |
| contactos de soporte por env | canal de escalamiento manual | no diagnostican por sí mismos |

Lectura operativa:

- la señal mínima del panel es error visible + diagnóstico de `/panel/settings`;
- el soporte operativo más útil del panel hoy es el diagnóstico copiable que consume `/panel/support/status`;
- si Sentry no está validado, el panel debe operar con fallback manual explícito.

### 4.3 API

| Señal | Qué aporta hoy | Límite operativo |
| --- | --- | --- |
| `GET /health` | disponibilidad mínima de servicio | no cubre negocio ni flows reales |
| `x-request-id` | correlación entre response y logs | no está expuesto de forma visible al operador desde UI |
| logs JSON por stdout | base de troubleshooting | sin evidencia de agregación o búsqueda central |
| `errorHandler` | correlación estructurada de errores no manejados | no cubre todas las ramas locales de cada ruta |
| `panelAuth` / `requireRole(...)` | trazabilidad auth/authz con stages y razones | sigue habiendo validación runtime pendiente en ramas menos cubiertas |
| `support/status` / `support/access` | diagnóstico autenticado para owner/staff | no son monitoreo público ni health global |

Lectura operativa:

- la API es la superficie con mejor señal mínima real para este corte;
- `/health`, `x-request-id` y logs backend son el núcleo operativo de `B6`;
- `support/status` complementa diagnóstico de panel, pero no reemplaza logs ni health check.

## 5. Ruta mínima de incidente

### 5.1 Detección

Un incidente mínimo de este corte puede detectarse por cualquiera de estas vías:

- problema reportado por usuario u operador;
- fallo de smoke o de release reciente;
- `/health` caído o degradado;
- error visible en panel o B2C;
- inconsistencia visible desde `/panel/settings` o `/panel/support/status`.

### 5.2 Contexto mínimo a capturar

Antes de diagnosticar, capturar como mínimo:

- superficie afectada: `B2C`, `panel live`, `panel demo` o `API`;
- host y ruta exacta;
- hora aproximada;
- local/slug y rol si aplica;
- si hubo release reciente;
- si hubo paso por `/panel/demo/bar`, `/panel/demo/discoteca` o `/panel/demo/off`;
- error visible;
- `x-request-id` si se logró observar desde la respuesta o desde tooling técnico.

### 5.3 Correlación inicial

La secuencia mínima de correlación para este corte es:

1. si la API parece involucrada, revisar `x-request-id`;
2. si UI no muestra `requestId`, usar hora + ruta + local/slug + host + `api_base_url`;
3. revisar `GET /health`;
4. en panel autenticado, revisar `/panel/support/status` o la vista de soporte en `/panel/settings`;
5. revisar logs backend por `requestId` o por timestamp/path.

### 5.4 Clasificación operativa

El incidente debe clasificarse rápidamente en una de estas categorías:

- `incidente live`
  - afecta rutas normales live;
  - no depende de activar demo;
  - persiste sin usar `/panel/demo/*`.
- `problema demo/live`
  - aparece solo tras activar demo;
  - desaparece con `/panel/demo/off`;
  - o afecta convivencia demo/live en el mismo host/origin.
- `problema de release recién hecho`
  - empieza inmediatamente después de release;
  - coincide con superficies tocadas;
  - o cae dentro de abort criteria ya documentados en `B2`.

### 5.5 Decisión operativa

La decisión mínima debe ser una de estas:

- `seguir`
  - si el problema no afecta live;
  - o si la herramienta no validada era opcional y el fallback manual cubre el corte.
- `escalar`
  - si afecta auth, reservas, orders, check-in, soporte o un flujo live que no se puede aislar rápido;
  - o si no se distingue con claridad entre live, demo y release.
- `abortar`
  - si el incidente coincide con criterios de `B2` para abortar release:
    - `/health`;
    - auth/bootstrap;
    - CORS;
    - smoke backend/SQL;
    - otras señales críticas del runbook de `B2`.

Owner operativo de esta ruta:

- release e incidente siguen bajo `nosotros` para este corte.

## 6. Demo vs live: cómo interpretar señales en este corte

Este bloque consume lo ya definido en `B3` y no lo reabre.

Reglas mínimas de interpretación:

- si el problema aparece solo después de `/panel/demo/bar` o `/panel/demo/discoteca`, tratarlo primero como problema demo/runtime demo;
- si desaparece con `/panel/demo/off`, no debe clasificarse automáticamente como incidente live;
- si ocurre en `/panel/login`, `/panel`, `/panel/settings` o `/panel/support/status` sin activar demo, tratarlo primero como incidente live;
- como demo y live comparten host/origin, el host por sí solo no distingue el tipo de incidente;
- la distinción mínima debe apoyarse en:
  - ruta visitada;
  - si hubo activación demo;
  - identidad/contexto demo;
  - comportamiento al apagar demo con `/panel/demo/off`.

Lectura operativa prudente:

- un problema demo no debe venderse automáticamente como incidente live;
- tampoco debe descartarse si rompe shell, auth o API compartida;
- un problema de `NEXT_PUBLIC_API_URL`, CORS o API compartida puede impactar tanto live como demo porque no existe origin separado.

## 7. Validaciones mínimas para cerrar B6

Para considerar `B6` cerrado documentalmente en el entorno objetivo, deben validarse como mínimo estos puntos:

- `/health` responde en la API del corte;
- `x-request-id` existe en responses backend donde corresponde;
- los logs backend son al menos legibles y útiles para correlación operativa;
- `/panel/support/status` existe como diagnóstico mínimo para owner/staff;
- queda explícito si el panel opera con Sentry validado o con fallback manual;
- B2C, panel y API tienen señales mínimas documentadas sin sobreactuar cobertura;
- existe criterio mínimo para distinguir live, demo/live confusion y release regression;
- existe una ruta mínima de incidente conectada con los criterios de abortar de `B2`.

## 8. Requiere validación

- `RV-13`: cobertura runtime más amplia de `errorHandler` y observación de un `500` natural;
- `RV-14`: cobertura runtime más amplia de `panelAuth`;
- `RV-15`: validación runtime sobre una ruta real protegida por `panelAuth + requireRole(...)`;
- `RV-16`: captura real de Sentry panel con DSN activo;
- `PN-04`: warning residual de `require-in-the-middle` / OpenTelemetry / `@sentry/nextjs` mientras no rompa runtime;
- acceso real a logs del entorno desplegado y posibilidad efectiva de buscar por `requestId`;
- cualquier Sentry backend;
- uso real de PostHog/GA4;
- exposición efectiva de `requestId` al operador desde UI;
- disponibilidad real de `/panel/support/status` en el host desplegado;
- cobertura runtime real de panel, B2C y API en los hosts del corte;
- dashboards, alertas, retención o agregación centralizada de logs.

## 9. Criterio de cierre de B6

`B6` puede considerarse cerrado documentalmente cuando este documento deja explícitos y verificables los siguientes puntos:

- fija una observabilidad mínima defendible para este corte;
- documenta qué señales existen hoy y cómo se usan;
- separa lo confirmado de lo que requiere validación runtime;
- deja una ruta mínima de incidente utilizable y conectada con `B2` y `B3`;
- no promete monitoreo, alerting ni captura real no demostrados.

Este cierre no implica que la observabilidad esté completa. Implica que existe un mínimo operativo razonable para diagnosticar el corte actual sin inventar tooling inexistente.

## 10. Dependencias que destraba B6

- destraba `B7` porque deja el piso operativo para smoke y decisión de abortar/escalar;
- refuerza `B2` porque conecta release/rollback con señales mínimas de diagnóstico;
- consume `B3` para que demo/live no se mezcle en operación;
- reduce ambigüedad operacional para el corte actual sin convertir `B6` en un rediseño de monitoreo.
