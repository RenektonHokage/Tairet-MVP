# B2_DEPLOY_ROLLBACK_AND_MIGRATIONS

## 1. Propósito del documento

Este documento cierra documentalmente el bloque `B2 — Deploy, rollback y migraciones` del remediation plan de Tairet.

Su función es dejar un procedimiento operativo base para:

- preparar un release;
- desplegar por superficie;
- abortar una salida si falla el smoke mínimo;
- documentar qué rollback es razonable por tipo de cambio;
- tratar migraciones SQL y cambios de datos con una regla prudente.

Este documento no inventa CD, rollback nativo, promotion pipeline, backup/restore ni procedimientos de plataforma que no estén demostrados por el repo o por la documentación vigente.

## 2. Alcance de B2

Este bloque consume como decisiones de entrada del corte:

- alcance del go-live: `free_pass only`;
- B2C: host objetivo del corte `https://tairet.com.py`;
- panel: host temporal aceptado `https://tairet-mvp-web-next.vercel.app/`;
- API: host objetivo del corte `https://tairetapi-production.up.railway.app/`;
- demo aceptado por ruta no enlazada;
- owners de release e incidentes: `nosotros`;
- estrategia de observabilidad mínima: `/health`, `x-request-id`, logs backend y Sentry panel solo si se valida con DSN; si no, fallback manual + logs + `requestId`.

Fuentes base consumidas:

- `docs/production/GO_LIVE_REMEDIATION_PLAN.md`
- `docs/production/B0_GO_LIVE_DECISIONS_AND_OWNERSHIP.md`
- `docs/production/B1_PRODUCTION_TOPOLOGY_AND_ENVS.md`
- `docs/production/PRODUCTION_READINESS_AND_GO_LIVE_CHECKLIST.md`
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`
- `docs/operations/OBSERVABILITY_AND_ERROR_HANDLING.md`
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`
- `docs/audits/STATUS.md`
- `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`
- `docs/audits/MATRIZ_VALIDACION_PREVIA_V1.md`
- `docs/RUNBOOK.md`
- `.github/workflows/ci.yml`
- `apps/web-b2c/package.json`
- `apps/web-next/package.json`
- `functions/api/package.json`
- `infra/sql/README.md`
- `infra/sql/schema.sql`
- `infra/sql/rls.sql`
- `infra/sql/migrations/*.sql`

Postura operativa base de `B2`:

- el repo sí demuestra build reproducible y CI;
- el repo no demuestra deploy automático, rollback automatizado, promoción entre entornos ni backup/restore;
- por lo tanto, el release documentado en este bloque debe tratarse como procedimiento manual asistido por plataforma externa;
- todo lo que dependa de Vercel, Railway, Supabase o tooling externo no visible queda en `Requiere validación`.

## 3. Precondiciones para release

Antes de ejecutar un release de este corte deben cumplirse estas precondiciones:

- `B0` vigente y consistente con el corte actual;
- `B1` cerrado documentalmente y usado como inventario de hosts/envs críticas;
- alcance activo `free_pass only`;
- owners de release e incidentes asentados como `nosotros`;
- hosts objetivo del corte documentados para B2C, panel y API;
- decisión demo vigente documentada, sin reabrir `B3`;
- observabilidad mínima del corte definida: `/health`, `x-request-id`, logs y criterio Sentry/fallback;
- clasificación del release cerrada antes de tocar producción;
- si el release toca SQL no trivial, recovery point o backup/restore validados de antemano.

### 3.1 Tipos de release

| Tipo | Qué incluye | Qué no debe asumir | Impacto operativo |
| --- | --- | --- | --- |
| `Release sin SQL` | cambios en B2C, panel y/o API sin tocar `infra/sql/**` | no depende de schema o policies nuevas | permite rollback de código relativamente más simple, sujeto a plataforma |
| `Release con SQL aditiva` | migraciones idempotentes o aditivas; por ejemplo `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, constraints idempotentes | no debe asumirse compatible hacia atrás sin revisión previa | exige revisar compatibilidad código ↔ schema antes del deploy y antes de considerar rollback simple |
| `Release con SQL no trivial` | cambios de RLS, funciones SQL, reconciliación de drift, tablas críticas o cambios con blast radius alto | no debe venderse como release fácilmente reversible | exige recovery point / backup-restore validado y criterio explícito de abortar |

Regla de clasificación:

- todo release debe declararse en una sola categoría antes de ejecutarse;
- si hay duda entre `SQL aditiva` y `SQL no trivial`, se clasifica como `SQL no trivial`;
- la clasificación elegida condiciona rollback y smoke post-deploy.

## 4. Despliegue por superficie

### 4.1 B2C

| Punto | Lectura operativa |
| --- | --- |
| Origen del build visible | `apps/web-b2c/package.json` usa `vite build`; CI ejecuta `pnpm -r build` |
| Tipo de release compatible | normalmente `Release sin SQL` |
| Dependencias críticas | `VITE_API_URL`, `VITE_MAPBOX_TOKEN` si el mapa sigue activo |
| Qué significa “desplegado” | el host objetivo responde con el build esperado, carga home y consume la API correcta sin error visible de CORS |
| Confirmado por repo | build Vite reproducible; `preview` local existe; host objetivo documentado en `B1` |
| Requiere validación | plataforma real de publicación, paso exacto de deploy y rollback nativo del host |

### 4.2 Panel

| Punto | Lectura operativa |
| --- | --- |
| Origen del build visible | `apps/web-next/package.json` usa `next build` y `next start`; CI compila el panel |
| Tipo de release compatible | `Release sin SQL` o release dependiente de backend/API ya desplegada |
| Dependencias críticas | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ENABLE_PANEL_DEMO`, `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` si Sentry se declara operativo |
| Qué significa “desplegado” | `/panel/login` responde, el panel apunta a la API correcta y el flujo live no queda roto por la decisión demo del corte |
| Confirmado por repo | build/start estándar de Next; host temporal aceptado en `B1`; wiring de demo y Sentry visibles |
| Requiere validación | plataforma real de publicación, build realmente servido y capacidad nativa de rollback |

### 4.3 API

| Punto | Lectura operativa |
| --- | --- |
| Origen del build visible | `functions/api/package.json` usa `tsc`; runtime visible `node dist/index.js` |
| Tipo de release compatible | `Release sin SQL`, `Release con SQL aditiva` o `Release con SQL no trivial`, según el cambio |
| Dependencias críticas | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`, `FRONTEND_ORIGIN`, `PORT`, `NODE_ENV`, `TRUST_PROXY_HOPS`, `RATE_LIMIT_PANEL`, `EMAIL_ENABLED`, `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `B2C_BASE_URL` cuando aplique |
| Qué significa “desplegado” | `/health` responde `200`, la API expone el servicio esperado y permite consumo desde B2C/panel del corte |
| Confirmado por repo | Express + TypeScript compilable; `/health` existe; host objetivo documentado en `B1` |
| Requiere validación | paso real de publicación, rollback nativo, configuración efectiva de proxy/CORS/rate limit y servicio realmente servido en el host |

## 5. Rollback por superficie

### 5.1 Regla general

- el repo no muestra rollback automatizado ni promotion pipeline;
- por lo tanto, el rollback observable solo puede documentarse como vuelta manual al último build o commit conocido como bueno, usando la capacidad nativa de la plataforma si existe;
- cualquier afirmación más fuerte que esa queda en `Requiere validación`.

### 5.2 Rollback por tipo de release

| Tipo | Regla de rollback |
| --- | --- |
| `Release sin SQL` | rollback objetivo: volver al último build/commit bueno por superficie; depende de redeploy manual o capacidad nativa de la plataforma |
| `Release con SQL aditiva` | rollback de código no debe asumirse suficiente si la versión anterior no tolera el schema nuevo; revisar compatibilidad hacia atrás antes de tratarlo como rollback simple |
| `Release con SQL no trivial` | no vender rollback rápido ni automático; queda subordinado a recovery point externo, restauración manual o procedimiento específico de plataforma/DB |

Regla crítica:

- si el release incluye SQL no trivial y no existe evidencia de recovery point o backup/restore, no corresponde presentarlo como release reversible.

### 5.3 Rollback por superficie

#### B2C

- Si el problema es solo frontend y no hubo SQL, el rollback objetivo es volver al último build estático o commit bueno.
- Si la plataforma permite redeploy de un build previo, eso debe validarse fuera del repo.
- Si no existe esa capacidad confirmada, el rollback operativo se reduce a redeploy manual del commit anterior.

#### Panel

- Si el problema es solo frontend/panel y no hubo SQL, el rollback objetivo es volver al último build o commit bueno.
- Después del rollback debe verificarse `/panel/login` y una vista autenticada mínima.
- Si el release tocó wiring de demo, auth o Sentry, el rollback debe validar explícitamente que el flujo live vuelva a comportarse como antes.

#### API

- Si hubo solo cambio de código y no hubo SQL, el rollback objetivo es volver al último build o commit bueno.
- Si hubo cambio SQL, el rollback de código no debe asumirse suficiente.
- Si el release fue `SQL no trivial`, el rollback pasa a ser coordinado y dependiente de plataforma/DB.

### 5.4 Regla de abortar release

Se debe abortar release e iniciar rollback si falla cualquiera de estos puntos:

- `/health` no responde en API;
- la home B2C no carga o queda apuntando a una API incorrecta;
- `/panel/login` no responde o el panel no puede bootstrapear su consumo básico de API/auth;
- aparece error visible de CORS contra los origins del corte;
- falla una migración SQL o queda una tabla crítica en estado inconsistente;
- falla el smoke condicional obligatorio para backend o SQL.

## 6. Migraciones y cambios de datos

### 6.1 Qué evidencia existe hoy

La evidencia visible del repo muestra:

- `infra/sql/README.md` define un orden de bootstrap base: `schema.sql` → `rls.sql` → `seed.sql`;
- `schema.sql` no alcanza por sí solo como mapa fiel del runtime;
- el repo conserva migraciones incrementales en `infra/sql/migrations/*.sql`;
- existen migraciones de reconciliación y endurecimiento que no deben tratarse como cambios triviales;
- no hay evidencia visible de down migrations, backup/restore ni procedimiento productivo formal de apply.

### 6.2 Cómo decidir el tipo de release

| Tipo | Regla |
| --- | --- |
| `Release sin SQL` | no cambia `infra/sql/**` |
| `Release con SQL aditiva` | usa migraciones idempotentes y aditivas, sin drops, sin cambios destructivos y sin endurecimiento RLS transversal |
| `Release con SQL no trivial` | incluye reconciliación de drift, funciones SQL, policies RLS, blast radius sobre datos críticos o cualquier cambio cuya reversión no sea obvia |

### 6.3 Reglas operativas para SQL

- `schema.sql` + `rls.sql` + `seed.sql` sirven como bootstrap/base, no como procedimiento incremental seguro sobre una base existente.
- Para una base con datos, el release debe apoyarse en `infra/sql/migrations/*.sql`, no en reejecutar todo el baseline.
- El drift entre `schema.sql`, migraciones y runtime sigue vigente y condiciona el release.
- Las migraciones `016`, `017` y `018` pueden citarse como evidencia de slices RLS ya tratadas, pero no cierran el estado desplegado completo.
- No deben asumirse down migrations.
- Cualquier release con SQL no trivial exige recovery point validado antes de aplicar.

### 6.4 Tablas y cambios de mayor riesgo

Se deben tratar como `SQL no trivial` los cambios que toquen:

- `orders`;
- `reservations`;
- `payment_events`;
- `panel_users`;
- `locals`;
- `local_daily_ops`;
- `ticket_types`;
- `table_types`;
- cualquier policy RLS o helper SQL que cambie acceso efectivo a datos.

Lectura operativa:

- `015_reconcile_locals_schema.sql` ya se presenta como reconciliación prudente e idempotente, pero igual pertenece a una zona sensible de drift;
- `016_harden_tracking_rls_backend_only.sql`, `017_harden_promos_rls_backend_only.sql` y `018_harden_reviews_rls_backend_only.sql` son evidencia de endurecimiento por slices y deben tratarse como cambios SQL no triviales;
- el repo no permite afirmar cómo está desplegado exactamente ese estado en el entorno real.

## 7. Smoke mínimo post-deploy

### 7.1 Smoke base por superficie tocada

| Superficie tocada | Smoke mínimo |
| --- | --- |
| B2C | home pública + un perfil público |
| Panel | `/panel/login` + una vista autenticada mínima |
| API | `GET /health` |

### 7.2 Smoke condicional obligatorio si el release toca backend o SQL

Si el release toca backend, aunque no toque SQL, además del smoke base debe verificarse:

- `GET /health`;
- presencia de `x-request-id`;
- un consumo real desde B2C hacia la API;
- un consumo real desde panel hacia la API;
- `/panel/support/status` si la superficie panel depende del backend en ese release.

Si el release toca SQL, además de lo anterior debe verificarse:

- al menos un flujo de lectura o escritura alineado con las tablas afectadas;
- si las tablas afectadas son críticas, aplicar este mapeo mínimo:

| Tabla o área afectada | Smoke mínimo adicional |
| --- | --- |
| `orders` o `payment_events` | smoke de orden `free_pass` y verificación operativa del flujo panel relacionado |
| `reservations` | crear o consultar una reserva mínima |
| `locals` o `local_daily_ops` | lectura de perfil/local o calendario afectado |
| `ticket_types` o `table_types` | lectura panel/public donde aplique el catálogo |
| RLS / policies | validación mínima de que los flows actuales no se rompen y de que no se abrió acceso SQL directo no esperado |

Regla de abortar:

- si el release toca backend o SQL y falla cualquier smoke condicional obligatorio, se aborta release y se inicia rollback según el tipo de release.

## 8. Requiere validación

- paso exacto de deploy en la plataforma real de B2C, panel y API;
- capacidad nativa de rollback por plataforma;
- existencia real de preview/staging persistentes o promotion pipeline;
- commit, tag o artifact exacto que se usará como release candidate o rollback target;
- backup/restore o recovery point real de la base antes de migrar;
- estado real del schema y de las policies RLS desplegadas;
- compatibilidad efectiva entre rollback de código y estado SQL ya aplicado;
- validez runtime de los hosts del corte;
- cobertura real de Sentry/logs durante un release desplegado;
- criterio operativo real de apply para migraciones en Supabase o plataforma de datos usada.

## 9. Criterio de cierre de B2

`B2` puede considerarse cerrado documentalmente cuando este documento deja explícitos y verificables los siguientes puntos:

- precondiciones de release asentadas para el corte actual;
- todo release debe clasificarse en `sin SQL`, `SQL aditiva` o `SQL no trivial`;
- despliegue por superficie documentado con lo confirmado y lo que sigue en `Requiere validación`;
- rollback descrito por superficie y por tipo de release, sin prometer reversibilidad no demostrada;
- tratamiento de migraciones y drift SQL explicitado;
- smoke mínimo diferenciado entre frontend-only y releases que tocan backend o SQL;
- criterio de abortar release documentado.

Este cierre no implica que la plataforma real ya esté validada. Implica que el repo deja una base operativa suficientemente clara para ejecutar `B3`, `B6` y `B7` con menos ambigüedad.

## 10. Dependencias que destraba B2

- destraba `B3` al dejar claro cómo liberar, abortar o volver atrás si un cambio de panel/demo compromete el entorno del corte;
- destraba `B6` al fijar cuándo un release ya debe validar `/health`, `x-request-id`, logs y `/panel/support/status`;
- destraba `B7` al dejar explícito el piso mínimo de smoke, el criterio de abortar y la diferencia entre release frontend-only y release con backend/SQL.
