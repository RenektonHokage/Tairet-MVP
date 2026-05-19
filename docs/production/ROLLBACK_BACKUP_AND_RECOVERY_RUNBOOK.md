# ROLLBACK_BACKUP_AND_RECOVERY_RUNBOOK

## 1. Proposito

Este runbook define como responder ante fallas del release candidate `free_pass only` de Tairet.

Su objetivo es documentar, con evidencia real ya validada en dashboards externos, que rollback, redeploy, logs, backups y recovery existen hoy para este corte, que gaps quedan aceptados y cuando corresponde hacer rollback, pausar operacion o escalar.

Este documento no aprueba paid flows, no habilita pagos reales y no aprueba `/payments/callback` productivo.

Reglas de lectura:

- no inventar capacidades no verificadas;
- no copiar secretos, valores reales de env vars ni connection strings;
- no subir backups al repo;
- distinguir `PASS operativo para free_pass only` de recovery enterprise;
- cualquier paid flow o cambio de `/payments/callback` requiere gate futuro separado.

## 2. Estado ejecutivo

Veredicto:

`Rollback / Backup / Recovery Readiness: PASS operativo para free_pass only`

Clasificacion por superficie:

| Superficie | Estado | Lectura operativa |
| --- | --- | --- |
| Vercel B2C | `PASS` | Proyecto, branch productiva, dominio, envs criticas y redeploy disponibles. |
| Vercel Panel | `PASS` | Proyecto, host real, ultimo deploy bueno, envs criticas, Sentry y redeploy disponibles. |
| Railway API | `PASS con gap menor documentado` | Servicio, production env, health, logs, redeploy y restart disponibles; rollback explicito a deployment anterior no confirmado. |
| Supabase | `PASS operativo con gaps de plan Free` | Proyecto activo y backup manual CLI validado; backups automaticos, PITR y restore point no disponibles en Free plan. |

Lectura correcta:

- el corte sigue siendo `free_pass only`;
- este runbook no equivale a recovery enterprise;
- Supabase Free tiene gaps aceptados para este corte acotado;
- `SUPABASE_SERVICE_ROLE` sigue existiendo y su riesgo sigue aceptado solo para `free_pass only`;
- paid flows siguen fuera del corte;
- `/payments/callback` sigue como gate futuro obligatorio;
- antes de operacion comercial fuerte, pagos reales o datos criticos a escala se requiere mejorar el plan de backup/recovery.

## 3. Alcance del runbook

Este runbook cubre:

- B2C publico;
- panel live;
- API backend;
- Supabase DB/Auth/Storage;
- env vars criticas;
- logs y observabilidad minima;
- backups manuales;
- rollback, redeploy, restart y recovery operativo;
- criterios de rollback, pausa y escalamiento.

Queda fuera:

- cambios de codigo;
- cambios SQL/RLS/migraciones;
- cambios de env vars;
- paid flows;
- `/payments/callback` productivo;
- upgrades de plataforma;
- restore completo probado en entorno aislado;
- diseno de recovery enterprise.

## 4. Superficies y hosts

| Superficie | Host / recurso | Estado | Nota operativa |
| --- | --- | --- | --- |
| B2C | `https://tairet.com.py` | `PASS` | Dominio publico conectado a branch temporal productiva validada. |
| B2C redirect | `https://www.tairet.com.py` | `PASS` | Redirige a `https://tairet.com.py`. |
| Panel | `https://tairet-mvp-web-next.vercel.app` | `PASS` | Host real del panel en Vercel. |
| API | `https://tairetapi-production.up.railway.app` | `PASS` | API en Railway, `/health` validado. |
| Supabase | `Tairet-DB` | `PASS operativo con gaps` | Free plan; backup manual CLI validado, sin backups automaticos/PITR. |

## 5. Rollback/redeploy por superficie

### 5.1 Vercel B2C

Evidencia validada:

- proyecto: `tairet-mvp-web-b2c`;
- branch productiva real: `feat/public-landing-temp`;
- branch usada para landing page temporal que sirve el dominio publico;
- ultimo deploy bueno reportado: hace 2 meses al momento de la validacion manual;
- commit del ultimo deploy: `update landing messagin`;
- dominio: `https://tairet.com.py`;
- `https://www.tairet.com.py` redirige hacia `https://tairet.com.py`;
- `VITE_API_URL` presente;
- `VITE_MAPBOX_TOKEN` presente;
- opcion de redeploy disponible;
- preview vs production entendido: previews o deploys de `main` no prueban visualmente el B2C publico si el dominio real sigue conectado a `feat/public-landing-temp`.

Estrategia de rollback/recovery:

- si el B2C publico falla por deploy reciente, usar redeploy del ultimo deploy bueno o redeploy de la branch productiva validada;
- no usar `main` como evidencia visual del B2C publico mientras `tairet.com.py` siga conectado a `feat/public-landing-temp`;
- validar dominio apex y redirect `www` despues del redeploy;
- validar que el B2C consuma la API correcta y no tenga bloqueo CORS.

Validaciones post-rollback:

- abrir `https://tairet.com.py`;
- confirmar redirect desde `https://www.tairet.com.py`;
- abrir home/perfil publico basico;
- verificar llamada a API sin error CORS visible;
- validar flujo publico afectado por el incidente.

### 5.2 Vercel Panel

Evidencia validada:

- proyecto: `tairet-mvp-web-next`;
- host real: `https://tairet-mvp-web-next.vercel.app`;
- ultimo deploy bueno reportado: hace 1 hora al momento de la validacion manual;
- commit del ultimo deploy: `hardening v2 checkpoint`;
- opcion de redeploy disponible;
- variables criticas presentes:
  - `NEXT_PUBLIC_API_URL`;
  - `NEXT_PUBLIC_SUPABASE_URL`;
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
  - `SENTRY_DSN`;
  - `NEXT_PUBLIC_SENTRY_DSN`;
  - `NEXT_PUBLIC_ENABLE_SENTRY_TEST`;
  - `NEXT_PUBLIC_ENABLE_PANEL_DEMO`;
  - `NEXT_PUBLIC_SUPPORT_EMAIL`;
  - `NEXT_PUBLIC_SUPPORT_WHATSAPP`;
  - `NEXT_PUBLIC_POSTHOG_HOST`;
- `NEXT_PUBLIC_ENABLE_SENTRY_TEST=false`;
- el boton "Enviar prueba a Sentry" no aparece en runtime;
- smoke real de Sentry ya fue validado previamente;
- panel demo queda como estado momentaneo aceptado y no blocker dentro de este checklist.

Estrategia de rollback/recovery:

- si el panel falla por deploy reciente, usar redeploy del ultimo deploy bueno;
- si el problema es de env, corregir la env afectada sin copiar valores a documentos o chat y redeployar;
- si Sentry se degrada pero los flujos core siguen, operar con fallback manual mientras se corrige env/deploy;
- si auth o bootstrap del panel fallan, tratarlo como incidente critico y considerar rollback inmediato.

Validaciones post-rollback:

- abrir `/panel/login`;
- login owner;
- login staff si aplica;
- `GET /panel/me`;
- dashboard/shell;
- settings/support/status;
- verificar que el boton de smoke Sentry siga apagado;
- verificar que staff no vea exports sensibles.

### 5.3 Railway API

Evidencia validada:

- proyecto Railway: `sublime-charm`;
- environment: `production`;
- servicio: `@tairet/api`;
- dominio: `https://tairetapi-production.up.railway.app`;
- ultimo deployment bueno: activo, hace 9 horas aproximadamente al momento de la validacion manual;
- commit del deploy: `export quitamos algunos headers`;
- runtime: Node `20.20.2`, region US West, 1 replica;
- variables criticas presentes:
  - `SUPABASE_URL`;
  - `SUPABASE_SERVICE_ROLE`;
  - `FRONTEND_ORIGIN`;
  - `EMAIL_ENABLED`;
  - `RESEND_API_KEY`;
  - `EMAIL_FROM_ADDRESS`;
  - `RATE_LIMIT_PANEL`;
  - `TRUST_PROXY_HOPS`;
- variables adicionales presentes:
  - `POSTHOG_HOST`;
  - `POSTHOG_KEY`;
  - `RAILPACK_NODE_VERSION`;
- `GET /health` -> `200 OK`;
- body: `{ "ok": true }`;
- `x-request-id` presente;
- `x-railway-request-id` presente;
- Deploy Logs accesibles;
- HTTP Logs accesibles;
- HTTP Logs muestran `GET /health` -> `200`;
- Deploy Logs muestran logs de panel con `requestId`;
- busqueda por path/timestamp validada;
- busqueda por `requestId` especifico de `/health` no confirmada;
- redeploy disponible;
- restart disponible;
- rollback explicito a deployment anterior no confirmado desde UI visible.

Gap aceptado:

- rollback explicito no confirmado;
- mitigacion actual: revertir commit o volver a commit anterior desde GitHub y redeployar.

Estrategia de rollback/recovery:

- si el deploy API falla, usar redeploy/restart si aplica;
- si se confirma regresion de codigo, revertir commit o volver a commit anterior desde GitHub y redeployar;
- si el problema es env, restaurar env correcta en Railway sin documentar valores y reiniciar/redeployar;
- si el problema involucra SQL o datos, no asumir que rollback de codigo alcanza.

Validaciones post-rollback:

- `GET /health` -> `200`;
- `x-request-id` presente;
- revisar HTTP Logs por path/timestamp;
- revisar Deploy Logs si hubo redeploy;
- validar CORS desde B2C y panel;
- validar free pass, reservas y check-in si la API fue tocada.

### 5.4 Supabase

Evidencia validada:

- proyecto: `Tairet-DB`;
- organization: `RenektonHokage's Org`;
- branch/environment: `main / production`;
- region: `us-west-2`;
- estado: activo;
- plan actual: Free plan;
- SQL Editor accesible;
- modal Connect disponible;
- connection string ubicada desde Connect, sin copiarla al informe;
- Supabase CLI usable via `npx`;
- Docker Desktop validado;
- backup manual generado correctamente;
- archivos generados:
  - `roles.sql` - 297 bytes;
  - `schema.sql` - 43465 bytes;
  - `data.sql` - 615573 bytes;
- archivos movidos a `backups/`;
- `backups/` agregado a `.gitignore`;
- `backups/` no aparece como untracked;
- backups se mantienen fuera de Git;
- variable sensible `DB_URL` removida de la sesion PowerShell;
- password de base de datos reseteada correctamente;
- no se detectaron env vars runtime actuales tipo `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PASSWORD`, `SUPABASE_DB_URL` ni connection string directa PostgreSQL;
- no se requiere cambiar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE` por ese reset;
- Auth users visibles desde Authentication -> Users;
- Storage visible;
- bucket `local-gallery` existente;
- Table Editor accesible;
- Authentication Policies accesible;
- RLS/policies verificables desde dashboard;
- acceso owner/admin confirmado;
- 2FA/MFA activado;
- solo un owner/admin actual.

Gaps confirmados:

- backups automaticos no disponibles en Free plan;
- PITR es add-on de Pro Plan y no esta activo;
- restore point no disponible/no confirmado en Free plan;
- export manual dashboard no disponible desde Database -> Backups;
- backup de Storage no confirmado como parte de backups DB;
- recovery formal de Auth users queda pendiente;
- solo un owner/admin actual.

Estrategia de recovery:

- para este corte, el recovery minimo de DB se apoya en backup manual CLI validado;
- no tratar rollback SQL como simple ni automatico;
- antes de cualquier SQL no trivial, generar backup manual nuevo y validar acceso a recovery;
- si hay problema de datos, pausar superficie afectada antes de reintentar writes;
- no subir backups al repo;
- no copiar DB URLs, connection strings ni passwords a docs o chat;
- para Storage, documentar gap hasta tener backup/recovery especifico.

## 6. Backups y recovery Supabase

Estado actual:

| Capacidad | Estado | Evidencia / nota |
| --- | --- | --- |
| Backups automaticos | `No disponible` | Free plan no los ofrece en el estado validado. |
| PITR | `No activo` | Requiere Pro Plan/add-on. |
| Restore point dashboard | `No disponible/no confirmado` | No visible en plan Free. |
| Export manual dashboard | `No disponible` | No se vio `Download backup`, `Export` ni `Generate backup`. |
| Backup manual CLI | `PASS` | Generado end-to-end via CLI con Docker Desktop. |
| Backup DB fuera de Git | `PASS` | Archivos movidos a `backups/`, fuera de Git. |
| Auth users visibles | `PASS` | Usuarios visibles en dashboard. |
| Recovery formal de Auth users | `Pendiente` | Depende de estrategia futura de backup/restore. |
| Storage visible | `PASS` | Bucket `local-gallery` existente. |
| Backup Storage | `No confirmado` | Gap operativo aceptado para este corte. |
| RLS/policies verificables | `PASS` | Dashboard permite revisar policies. |
| Acceso emergencia | `Parcial` | Owner/admin con 2FA/MFA; falta segundo admin confiable. |

Tablas criticas para backups/recovery:

- `orders`;
- `reservations`;
- `locals`;
- `local_daily_ops`;
- `panel_users`;
- `ticket_types`;
- `table_types`;
- `payment_events`;
- `reviews`;
- `promos`.

Reglas operativas:

- no asumir restore automatico desde dashboard en plan Free;
- no asumir PITR;
- no asumir que backup DB cubre Storage;
- no asumir down migrations;
- `schema.sql`, `rls.sql` y `seed.sql` son baseline/bootstrap, no procedimiento incremental seguro sobre datos existentes;
- cualquier SQL no trivial requiere backup manual nuevo y criterio de pausa/rollback antes de aplicar;
- restaurar datos puede desincronizar app/schema si no se coordina con el commit desplegado.

## 7. Env vars criticas y manejo seguro

Reglas:

- documentar solo nombres y presencia, nunca valores;
- no copiar secretos al repo, docs, issues ni chat;
- no copiar connection strings;
- si una env critica cambia, ejecutar smoke minimo por superficie afectada;
- si se sospecha exposicion de una credencial, rotar en la plataforma correspondiente y revalidar.

B2C:

- `VITE_API_URL`;
- `VITE_MAPBOX_TOKEN`.

Panel:

- `NEXT_PUBLIC_API_URL`;
- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- `SENTRY_DSN`;
- `NEXT_PUBLIC_SENTRY_DSN`;
- `NEXT_PUBLIC_ENABLE_SENTRY_TEST`;
- `NEXT_PUBLIC_ENABLE_PANEL_DEMO`;
- `NEXT_PUBLIC_SUPPORT_EMAIL`;
- `NEXT_PUBLIC_SUPPORT_WHATSAPP`;
- `NEXT_PUBLIC_POSTHOG_HOST`.

API:

- `SUPABASE_URL`;
- `SUPABASE_SERVICE_ROLE`;
- `FRONTEND_ORIGIN`;
- `EMAIL_ENABLED`;
- `RESEND_API_KEY`;
- `EMAIL_FROM_ADDRESS`;
- `RATE_LIMIT_PANEL`;
- `TRUST_PROXY_HOPS`;
- `POSTHOG_HOST`;
- `POSTHOG_KEY`;
- `RAILPACK_NODE_VERSION`.

Nota sobre reset de password DB:

- el reset de password de base de datos fue validado sin impacto runtime detectado;
- no se detectaron connection strings PostgreSQL directas en Vercel/Railway/repo para el runtime actual;
- no se requirio cambiar las envs Supabase URL/anon/service role por ese reset.

## 8. Escenarios de incidente

| Escenario | Respuesta recomendada | Evidencia minima |
| --- | --- | --- |
| API `/health` falla | Revisar Railway logs/env/deploy; redeploy/restart; si es regresion de codigo, revert commit y redeploy. | Hora, path, status, `x-request-id` si existe, deploy activo. |
| Panel login/bootstrap falla | Revisar Vercel deploy/env, Supabase Auth y API; rollback/redeploy panel si coincide con deploy reciente. | Usuario/rol, ruta, hora, error visible. |
| B2C no consume API | Validar `VITE_API_URL`, `FRONTEND_ORIGIN`, CORS y API health; redeploy B2C/API segun causa. | Origin, error CORS, ruta API, hora. |
| Check-in falla en puerta | Pausar operacion de puerta si no hay alternativa segura; revisar token, ventana, API logs y panel; rollback API/panel si es regresion. | Token de prueba seguro, hora, local, operador, response. |
| Free pass no crea orden | Pausar CTA/operacion afectada; revisar `POST /orders`, DB/API logs y emails; rollback API/B2C si corresponde. | Request time, local/slug, response, requestId. |
| Reservas no se crean o no llegan al panel | Pausar intake si hay inconsistencia; revisar `reservations`, API, panel y emails. | Email de prueba no sensible, hora, response, tenant. |
| Exports fallan o staff accede | Si staff accede, rollback inmediato por incidente de seguridad; si solo falla export owner, corregir o rollback segun impacto. | Rol, endpoint, status, archivo generado o error. |
| Sentry deja de recibir eventos | No bloquear si flujos core pasan; usar fallback manual y revisar DSN/deploy. | Hora, panel route, fallback logs, estado del DSN. |
| Env var critica mal configurada | Restaurar env correcta en plataforma, redeploy/restart y smoke minimo. | Nombre de env, superficie, cambio realizado, smoke. |
| Migracion SQL rompe flujo | Pausar; no asumir rollback de codigo; evaluar backup manual/recovery y estado de datos. | Migracion, tabla, error, backup disponible. |
| Supabase datos/auth/storage falla | Pausar superficie afectada; revisar dashboard, Auth users, Storage y backup manual disponible. | Tabla/recurso, usuario afectado, hora, error. |
| Railway deploy malo | Redeploy/restart; si es codigo, revert commit y redeploy. | Deployment activo, commit, logs, health. |
| Vercel deploy malo | Redeploy previous/ultimo bueno si disponible; validar envs y host. | Project, deployment, commit, ruta fallida. |
| Necesidad de pausar operacion | Congelar cambios, capturar evidencia, avisar owner y decidir rollback/pausa/escalamiento. | Superficie, impacto, hora, responsable. |

## 9. Criterios de rollback, pausa y escalamiento

Rollback inmediato si:

- falla `/health`;
- falla auth/bootstrap del panel;
- falla check-in valido;
- falla `free_pass`;
- fallan reservas core;
- CORS bloquea B2C o panel;
- staff puede descargar export sensible;
- reaparecen endpoints o datos sensibles ya cerrados;
- un deploy nuevo rompe flujos validados.

Pausa operativa si:

- no hay rollback rapido;
- hay duda sobre consistencia de `orders` o `reservations`;
- falla DB/Supabase;
- check-in en puerta no puede operar con seguridad;
- hay riesgo de duplicar, perder o corromper datos operativos.

Escalar si:

- falta acceso a dashboard necesario;
- no hay logs suficientes;
- se necesita restore de datos;
- se toca paid flow, `payment_events` o `/payments/callback` por accidente;
- se necesita decision de negocio sobre operar manualmente.

## 10. Validaciones post-rollback

Smoke minimo despues de cualquier rollback/redeploy:

- `GET /health` -> `200`;
- `x-request-id` presente;
- B2C home publica;
- B2C perfil publico basico;
- panel `/panel/login`;
- login owner;
- login staff si aplica;
- `GET /panel/me`;
- `free_pass`;
- reserva;
- check-in valido o smoke equivalente disponible;
- orders search;
- exports owner-only;
- staff bloqueado en exports sensibles;
- support/status;
- Sentry panel o fallback manual;
- logs accesibles en Railway por path/timestamp.

Si el cambio toca SQL/datos:

- validar tabla afectada;
- validar flujo que escribe esa tabla;
- validar lectura panel/public relacionada;
- no declarar recovery completo si no se probo restore.

## 11. Gaps operativos aceptados

Gaps aceptados para `free_pass only`:

- Supabase Free sin backups automaticos;
- Supabase sin PITR activo;
- Supabase sin restore point dashboard operativo;
- Supabase sin export manual dashboard;
- backup de Storage no confirmado;
- recovery formal de Auth users pendiente;
- solo un admin/owner en Supabase;
- Railway rollback explicito a deployment anterior no confirmado desde UI visible;
- B2C productivo conectado a branch distinta de `main`;
- no asumir down migrations;
- recovery enterprise no esta completo.

Estos gaps no bloquean el release candidate `free_pass only` porque:

- B7 final smoke fue `PASS`;
- delta smoke final post-hardening fue `PASS`;
- backup manual Supabase via CLI fue validado end-to-end;
- Vercel y Railway tienen redeploy/recovery operativo suficiente para este corte;
- paid flows y `/payments/callback` siguen fuera del alcance.

## 12. Decisiones futuras antes de operacion comercial/pagos

Antes de operacion comercial fuerte, datos criticos a escala o paid flows:

- subir Supabase a un plan con backups automaticos y/o PITR;
- validar restore controlado en entorno seguro;
- definir backup/recovery de Storage, especialmente bucket `local-gallery`;
- definir recovery formal de Auth users;
- agregar segundo admin confiable con 2FA/MFA;
- validar si Railway ofrece rollback explicito a deployment anterior y documentarlo;
- definir snapshots/registro seguro de env vars criticas sin exponer valores;
- ejecutar paid-flow gate;
- ejecutar `/payments/callback` security gate;
- validar Bancard/Dinelco sandbox/production flow;
- mantener backups fuera de Git.

## 13. Owners y operacion minima

Owners:

- release: `nosotros`;
- incidentes: `nosotros`;
- decision de rollback/pausa/escalamiento: `nosotros`.

Operacion minima:

- `/health`;
- `x-request-id`;
- Railway HTTP Logs;
- Railway Deploy Logs;
- `/panel/support/status`;
- Sentry panel;
- fallback manual por timestamp/path/requestId cuando aplique;
- evidencia capturada sin secretos.

Manejo de backups:

- backups fuera de Git;
- no copiar DB URLs ni connection strings;
- no adjuntar archivos de backup en PRs/issues/docs;
- registrar solo nombre, fecha, ubicacion segura y responsable.

## 14. Relacion con documentos existentes

Este runbook complementa y consume:

- `docs/production/FREE_PASS_RELEASE_CANDIDATE.md`;
- `docs/production/B2_DEPLOY_ROLLBACK_AND_MIGRATIONS.md`;
- `docs/production/B6_MINIMUM_OBSERVABILITY_AND_INCIDENT_OPERATION.md`;
- `docs/production/B7_FINAL_SMOKE_AND_GO_NO_GO.md`;
- `docs/production/GO_LIVE_REMEDIATION_PLAN.md`;
- `docs/security/SERVICE_ROLE_MINIMIZATION_PLAN.md`;
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`;
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`;
- `docs/operations/OBSERVABILITY_AND_ERROR_HANDLING.md`;
- `docs/RUNBOOK.md`.

Lectura final:

- `FREE_PASS_RELEASE_CANDIDATE.md` define que esta aprobado para el corte;
- este runbook define como responder si algo falla;
- B2 sigue siendo la base prudente de release/rollback/migraciones;
- B6 sigue siendo la base de observabilidad minima e incidente;
- Service Role Minimization sigue cerrado solo como riesgo reducido y aceptado para `free_pass only`;
- paid flows y `/payments/callback` quedan fuera hasta gate futuro.
