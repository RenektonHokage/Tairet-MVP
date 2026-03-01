Estado: histórico / snapshot de auditoría inicial

No usar como fuente operativa primaria

Fuente operativa actual:

docs/audits/CONTRATOS_CONGELADOS_V1.md

docs/audits/BASELINE_FUNCIONAL_V1.md

docs/audits/MATRIZ_VALIDACION_PREVIA_V1.md

docs/audits/SMOKE_TESTS_V1.md

docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md

docs/audits/HARDENING_ROADMAP.md


# TAIRET — Auditoría técnica MVP (Discovery + plan por fases)

Fecha: 2026-02-24  
Alcance revisado: `apps/web-b2c/**`, `apps/web-next/**`, `functions/api/**`, `infra/sql/**`, `docs/**`, `package.json`, `pnpm-workspace.yaml`  
Restricción aplicada: **sin implementación**, solo discovery y auditoría.

## 1. Resumen ejecutivo

El MVP está funcional en sus flujos núcleo (B2C, panel B2B, API y SQL), pero presenta riesgos técnicos concentrados en 4 áreas:  
1) seguridad y exposición de datos en endpoints públicos, 2) consistencia arquitectónica (archivos y módulos monolíticos), 3) observabilidad incompleta, y 4) escalabilidad/performance en consultas y filtrado.

Diagnóstico ejecutivo:
- **Estado general MVP:** operativo, pero con deuda técnica acumulada en frontend panel y router panel de API.
- **Riesgo alto inmediato:** exposición por lookup de órdenes públicas por email + token de check-in (requiere validación de riesgo de negocio).
- **Riesgo alto estructural:** políticas RLS SQL marcadas como TODO con `USING (true)` / `WITH CHECK (true)` (requiere validación de modelo final de acceso DB en producción).
- **Riesgo medio-alto crecimiento:** SEO interno limitado por `HashRouter` y sitemap mínimo.

---

## 2. Hallazgos con evidencia

### 2.1 Hallazgos principales (cross-stack)

| ID | Hallazgo | Impacto MVP | Evidencia |
|---|---|---|---|
| H-01 | B2C usa `HashRouter`; SEO por páginas internas queda limitado para indexación clásica. | Alto (adquisición/SEO) | `apps/web-b2c/src/App.tsx:6`, `apps/web-b2c/src/App.tsx:59`, `docs/seo/SEO_FASE3_RUNBOOK.md:29` |
| H-02 | Canonical y OG/Twitter definidos solo en home base; sitemap contiene solo raíz. | Medio-Alto (SEO técnico) | `apps/web-b2c/index.html:12`, `apps/web-b2c/index.html:23`, `apps/web-b2c/public/sitemap.xml:4`, `apps/web-b2c/public/robots.txt:16` |
| H-03 | `EventProfile` sigue en mock y venta de entradas deshabilitada. | Medio (cobertura funcional) | `apps/web-b2c/src/pages/EventProfile.tsx:16`, `apps/web-b2c/src/pages/EventProfile.tsx:229`, `apps/web-b2c/src/pages/EventProfile.tsx:236` |
| H-04 | `BarProfile`/`ClubProfile` dependen de mock existente para renderizar; sin mock, marcan not found aunque exista local en DB. | Alto (consistencia de catálogo) | `apps/web-b2c/src/pages/BarProfile.tsx:77`, `apps/web-b2c/src/pages/BarProfile.tsx:79`, `apps/web-b2c/src/pages/ClubProfile.tsx:80`, `apps/web-b2c/src/pages/ClubProfile.tsx:83` |
| H-05 | Endpoint público de órdenes por email devuelve `checkin_token` sin auth. | Alto (seguridad/datos, requiere validación) | `functions/api/src/routes/public.ts:284`, `functions/api/src/routes/public.ts:296`, `functions/api/src/routes/public.ts:299` |
| H-06 | B2C expone y permite copiar `checkin_token` en UI de Mis Entradas. | Medio-Alto (seguridad operativa) | `apps/web-b2c/src/pages/MisEntradas.tsx:227`, `apps/web-b2c/src/pages/MisEntradas.tsx:253`, `apps/web-b2c/src/pages/MisEntradas.tsx:258` |
| H-07 | Popup de mapa usa `setHTML(...)` con contenido interpolado. | Medio-Alto (XSS potencial, requiere validación de sanitización upstream) | `apps/web-b2c/src/components/shared/MapSection.tsx:343`, `apps/web-b2c/src/components/shared/MapSection.tsx:385`, `apps/web-b2c/src/components/shared/MapSection.tsx:389` |
| H-08 | SQL RLS habilitado pero políticas marcadas con `true` y TODOs de tenant/auth. | Alto (seguridad de datos) | `infra/sql/rls.sql:15`, `infra/sql/rls.sql:21`, `infra/sql/rls.sql:26`, `infra/sql/rls.sql:30`, `infra/sql/rls.sql:81` |

### 2.2 B2C

| ID | Hallazgo | Impacto MVP | Evidencia |
|---|---|---|---|
| B2C-01 | `LOCAL_ID` hardcodeado con TODO de parametrización. | Medio (configuración/errores de entorno) | `apps/web-b2c/src/constants.ts:5`, `apps/web-b2c/src/constants.ts:6` |
| B2C-02 | Tracking fire-and-forget con warnings en consola; dedupe de promo en `sessionStorage`. | Bajo-Medio (telemetría no garantizada) | `apps/web-b2c/src/lib/api.ts:29`, `apps/web-b2c/src/lib/api.ts:96`, `apps/web-b2c/src/lib/api.ts:132` |
| B2C-03 | AuthContext local/in-memory sin persistencia ni backend auth real. | Medio (consistencia de sesión) | `apps/web-b2c/src/context/AuthContext.tsx:21`, `apps/web-b2c/src/context/AuthContext.tsx:25`, `apps/web-b2c/src/context/AuthContext.tsx:30` |
| B2C-04 | Checkout bloquea pagos no free pass por diseño actual. | Medio (negocio/revenue) | `apps/web-b2c/src/components/shared/CheckoutBase.tsx:222`, `apps/web-b2c/src/components/shared/CheckoutBase.tsx:226`, `apps/web-b2c/src/components/shared/CheckoutBase.tsx:350` |
| B2C-05 | Fallback a mocks en catálogo ante errores de red. | Medio (consistencia funcional) | `apps/web-b2c/src/lib/locals.ts:730`, `apps/web-b2c/src/lib/locals.ts:732` |
| B2C-06 | Persistencia en `localStorage` de carrito/fingerprint. | Bajo-Medio (privacidad/dispositivo compartido) | `apps/web-b2c/src/context/CartContext.tsx:211`, `apps/web-b2c/src/context/CartContext.tsx:224`, `apps/web-b2c/src/lib/fingerprint.ts:13`, `apps/web-b2c/src/lib/fingerprint.ts:23` |

### 2.3 B2B panel (`web-next`)

| ID | Hallazgo | Impacto MVP | Evidencia |
|---|---|---|---|
| B2B-01 | Vista de reservas carga todo por local y filtra/ordena en cliente. | Alto (performance y costo de red) | `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:89`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:160`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:165` |
| B2B-02 | `getPanelReservations()` exportada pero siempre lanza error. | Medio (DX/mantenibilidad) | `apps/web-next/lib/reservations.ts:47`, `apps/web-next/lib/reservations.ts:51` |
| B2B-03 | Ruta `/panel/metrics` renderiza componentes de lineup (inconsistencia semántica). | Medio (arquitectura/navegación) | `apps/web-next/app/panel/(authenticated)/metrics/page.tsx:4`, `apps/web-next/app/panel/(authenticated)/metrics/page.tsx:11`, `apps/web-next/app/panel/(authenticated)/metrics/page.tsx:14` |
| B2B-04 | Logout limpia cookie y redirige; no se observa `supabase.auth.signOut()`. | Medio (sesión/seguridad, requiere validación) | `apps/web-next/components/panel/SidebarUserInfo.tsx:13`, `apps/web-next/components/panel/SidebarUserInfo.tsx:15`, `apps/web-next/components/panel/SidebarUserInfo.tsx:16` |
| B2B-05 | Sentry está en dependencias pero inicialización es TODO. | Medio-Alto (observabilidad) | `apps/web-next/package.json:14`, `apps/web-next/lib/sentry.ts:1`, `apps/web-next/lib/sentry.ts:5` |
| B2B-06 | En CI se usa cliente Supabase dummy si faltan env vars. | Medio (riesgo de falsos verdes, requiere validación) | `apps/web-next/lib/supabase.ts:6`, `apps/web-next/lib/supabase.ts:18`, `apps/web-next/lib/supabase.ts:22` |

### 2.4 API (`functions/api`)

| ID | Hallazgo | Impacto MVP | Evidencia |
|---|---|---|---|
| API-01 | `panel.ts` concentra muchas responsabilidades (perfil, gallery, reservas, check-in, órdenes, export CSV, catálogo, calendario). | Alto (mantenibilidad/pruebas) | `functions/api/src/routes/panel.ts:425`, `functions/api/src/routes/panel.ts:1107`, `functions/api/src/routes/panel.ts:1767`, `functions/api/src/routes/panel.ts:2729` |
| API-02 | Middleware de errores usa `console.error` y TODO de logger. | Medio (observabilidad inconsistente) | `functions/api/src/middlewares/error.ts:16`, `functions/api/src/middlewares/error.ts:17` |
| API-03 | Rate limit en memoria; recomendación explícita de migrar a Redis al escalar. | Medio-Alto (escalabilidad) | `functions/api/src/middlewares/rateLimit.ts:4`, `functions/api/src/middlewares/rateLimit.ts:6`, `functions/api/src/middlewares/rateLimit.ts:31` |
| API-04 | CORS depende de `FRONTEND_ORIGIN`; default localhost si env ausente. | Medio (riesgo operativo por configuración) | `functions/api/src/middlewares/cors.ts:4`, `functions/api/src/middlewares/cors.ts:9`, `functions/api/src/middlewares/cors.ts:39` |
| API-05 | Export CSV implementa mitigación de fórmula CSV injection y sanitiza nombre de archivo. | Positivo (seguridad defensiva) | `functions/api/src/routes/panel.ts:399`, `functions/api/src/routes/panel.ts:402`, `functions/api/src/routes/panel.ts:415`, `functions/api/src/routes/panel.ts:417` |
| API-06 | Endpoints públicos legacy sensibles fueron deprecados con `410` en favor de panel auth. | Positivo (seguridad) | `functions/api/src/routes/orders.ts:295`, `functions/api/src/routes/orders.ts:299`, `functions/api/src/routes/reservations.ts:148`, `functions/api/src/routes/reservations.ts:152` |

### 2.5 SQL + documentación

| ID | Hallazgo | Impacto MVP | Evidencia |
|---|---|---|---|
| SQL-01 | `schema.sql` contiene PII sensible en texto (`customer_document`, email, phone, IP, user_agent). | Alto (cumplimiento/datos) | `infra/sql/schema.sql:64`, `infra/sql/schema.sql:68`, `infra/sql/schema.sql:89`, `infra/sql/schema.sql:122` |
| DOC-01 | Documento de checklist menciona `PATCH /reservations/:id` como flujo panel, pero API pública lo marca deprecated. | Medio (drift de documentación) | `docs/docs/CHECKLIST_MVP_PANEL.md:30`, `functions/api/src/routes/reservations.ts:148`, `functions/api/src/routes/reservations.ts:153` |
| DOC-02 | SEO fase 3 reporta cierre técnico y deja pendiente OG visual + SEO por páginas. | Bajo-Medio (alineación roadmap) | `docs/seo/SEO_FASE3_RUNBOOK.md:1`, `docs/seo/SEO_FASE3_RUNBOOK.md:30`, `docs/seo/SEO_ROLLOUT_PLAN.md:155`, `docs/seo/SEO_ROLLOUT_PLAN.md:157` |

---

## 3. Riesgos (MVP)

### Riesgos altos

1. **Exposición por lookup de órdenes públicas por email** (requiere validación de política de negocio).  
   Evidencia: `functions/api/src/routes/public.ts:284`, `functions/api/src/routes/public.ts:296`, `apps/web-b2c/src/pages/MisEntradas.tsx:227`.

2. **Políticas RLS permisivas (`true`) con TODOs pendientes**.  
   Evidencia: `infra/sql/rls.sql:21`, `infra/sql/rls.sql:26`, `infra/sql/rls.sql:30`.

3. **Acoplamiento alto en router panel API** (riesgo de regresión al cambiar cualquier subflujo).  
   Evidencia: `functions/api/src/routes/panel.ts:1767`, `functions/api/src/routes/panel.ts:2079`, `functions/api/src/routes/panel.ts:2729`.

### Riesgos medios

1. **SEO interno limitado por hash routing** (descubrimiento orgánico restringido).  
   Evidencia: `apps/web-b2c/src/App.tsx:59`, `docs/seo/SEO_FASE3_RUNBOOK.md:29`.

2. **Filtrado local de reservas en panel** (escala mal ante crecimiento).  
   Evidencia: `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:89`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:165`.

3. **Observabilidad incompleta** (Sentry TODO + errores en consola).  
   Evidencia: `apps/web-next/lib/sentry.ts:1`, `functions/api/src/middlewares/error.ts:17`.

### Riesgos bajos

1. **Drift de documentación en algunos contratos operativos**.  
   Evidencia: `docs/docs/CHECKLIST_MVP_PANEL.md:30`, `functions/api/src/routes/reservations.ts:153`.

2. **Dependencia parcial de mocks en B2C** para fallback/representación.  
   Evidencia: `apps/web-b2c/src/pages/ClubProfile.tsx:80`, `apps/web-b2c/src/lib/locals.ts:730`.

---

## 4. Deuda técnica priorizada

### Alta

1. **Hardening de acceso a datos de órdenes públicas** (token/checkin/email).  
   Evidencia: `functions/api/src/routes/public.ts:296`, `apps/web-b2c/src/lib/orders.ts:22`.

2. **Cierre de políticas RLS y validación del modelo de seguridad DB real**.  
   Evidencia: `infra/sql/rls.sql:15`, `infra/sql/rls.sql:81`.

3. **Descomposición del router panel API** por bounded context (profile/checkin/export/catalog/calendar).  
   Evidencia: `functions/api/src/routes/panel.ts:425`, `functions/api/src/routes/panel.ts:2729`.

4. **Eliminar dependencia funcional de mocks en perfiles B2C**.  
   Evidencia: `apps/web-b2c/src/pages/BarProfile.tsx:77`, `apps/web-b2c/src/pages/ClubProfile.tsx:80`.

### Media

1. **Mover filtros de reservas al backend (query server-side)**.  
   Evidencia: `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:160`.

2. **Completar observabilidad end-to-end (Sentry + logger unificado)**.  
   Evidencia: `apps/web-next/lib/sentry.ts:1`, `functions/api/src/middlewares/error.ts:16`.

3. **Corregir inconsistencias de routing semántico (`/panel/metrics`)**.  
   Evidencia: `apps/web-next/app/panel/(authenticated)/metrics/page.tsx:11`.

4. **Revisar cierre de sesión panel con signout explícito** (requiere validación).  
   Evidencia: `apps/web-next/components/panel/SidebarUserInfo.tsx:15`.

### Baja

1. **Eliminar APIs/funciones “placeholder” que lanzan error**.  
   Evidencia: `apps/web-next/lib/reservations.ts:47`.

2. **Reducir ruido de `console.*` en runtime productivo**.  
   Evidencia: `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:295`, `apps/web-next/lib/posthog.ts:13`.

3. **Parametrizar constantes legacy hardcodeadas**.  
   Evidencia: `apps/web-b2c/src/constants.ts:6`.

---

## 5. Quick wins

Quick wins seleccionados por bajo costo / alto impacto:

1. **Unificar manejo de error backend con `logger` y `requestId`** en middleware global.  
   Evidencia base: `functions/api/src/middlewares/error.ts:16`, `functions/api/src/middlewares/requestId.ts:11`.

2. **Remover/exportar correctamente `getPanelReservations()`** para evitar trampas DX.  
   Evidencia: `apps/web-next/lib/reservations.ts:47`.

3. **Alinear `/panel/metrics` con vista de métricas real o renombrar ruta**.  
   Evidencia: `apps/web-next/app/panel/(authenticated)/metrics/page.tsx:7`, `apps/web-next/app/panel/(authenticated)/metrics/page.tsx:11`.

4. **Activar Sentry básico en panel** (ya existe dependencia).  
   Evidencia: `apps/web-next/package.json:14`, `apps/web-next/lib/sentry.ts:1`.

5. **Cerrar drift docs de reservas panel** (`PATCH /panel/reservations/:id`).  
   Evidencia: `docs/docs/CHECKLIST_MVP_PANEL.md:30`, `functions/api/src/routes/reservations.ts:153`.

6. **Checklist de seguridad para endpoint público de órdenes** (si se mantiene, endurecer controles).  
   Evidencia: `functions/api/src/routes/public.ts:284`.

---

## 6. Arquitectura / consistencia

### Concentración de responsabilidades

- Archivo panel API con alta concentración de dominios: `functions/api/src/routes/panel.ts:425`, `functions/api/src/routes/panel.ts:1767`, `functions/api/src/routes/panel.ts:2729`.
- Página de perfil panel de gran tamaño (llega a línea 2666): `apps/web-next/app/panel/(authenticated)/profile/page.tsx:2666`.
- Página check-in panel extensa (llega a línea 1174): `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:1174`.
- Librería B2C de locales extensa (llega a línea 738): `apps/web-b2c/src/lib/locals.ts:738`.

### Inconsistencias funcionales

- Métricas panel renderiza componentes de lineup: `apps/web-next/app/panel/(authenticated)/metrics/page.tsx:11`.
- B2C mezcla DB-first con fallback mock en perfiles: `apps/web-b2c/src/pages/BarProfile.tsx:153`, `apps/web-b2c/src/pages/ClubProfile.tsx:181`.

### Consistencias positivas

- API de panel aplica auth + rol en endpoints sensibles: `functions/api/src/routes/panel.ts:1767`, `functions/api/src/middlewares/panelAuth.ts:86`.
- Endpoints públicos legacy peligrosos se cerraron con `410`: `functions/api/src/routes/orders.ts:299`, `functions/api/src/routes/reservations.ts:152`.

---

## 7. Seguridad y datos

### Riesgos detectados

1. **Consulta pública de órdenes por email con token de check-in** (requiere validación de riesgo aceptado).  
   Evidencia: `functions/api/src/routes/public.ts:296`, `apps/web-b2c/src/lib/orders.ts:22`.

2. **RLS incompleto / permisivo en SQL** (si hay acceso directo con claves no-service).  
   Evidencia: `infra/sql/rls.sql:21`, `infra/sql/rls.sql:26`, `infra/sql/rls.sql:35`.

3. **Construcción HTML directa en popup de mapa** (vector XSS potencial si datos no confiables).  
   Evidencia: `apps/web-b2c/src/components/shared/MapSection.tsx:343`.

4. **Datos personales sensibles en esquema** (documento, email, teléfono, IP, user-agent).  
   Evidencia: `infra/sql/schema.sql:68`, `infra/sql/schema.sql:89`, `infra/sql/schema.sql:122`.

### Controles existentes

- `panelAuth` valida token y resuelve `panel_users` por `auth_user_id`: `functions/api/src/middlewares/panelAuth.ts:86`, `functions/api/src/middlewares/panelAuth.ts:102`.
- `requestId` en request/response: `functions/api/src/middlewares/requestId.ts:9`, `functions/api/src/middlewares/requestId.ts:11`.
- CSV export con hardening anti fórmula y saneo de filename: `functions/api/src/routes/panel.ts:402`, `functions/api/src/routes/panel.ts:417`.

---

## 8. Performance

1. **Reservas panel: fetch completo + filtros en cliente**.  
   Evidencia: `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:89`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:165`.

2. **Rate limit en memoria no distribuido para horizontal scaling**.  
   Evidencia: `functions/api/src/middlewares/rateLimit.ts:4`, `functions/api/src/middlewares/rateLimit.ts:31`.

3. **Export CSV hasta 10k filas por consulta** (correcto para MVP, revisar para escala).  
   Evidencia: `functions/api/src/routes/panel.ts:1808`, `functions/api/src/routes/panel.ts:1894`.

4. **Uso de caché local en geocoding/fingerprint** (mejora UX, pero evaluar expiración/consistencia).  
   Evidencia: `apps/web-b2c/src/lib/geocode.ts:31`, `apps/web-b2c/src/lib/geocode.ts:191`, `apps/web-b2c/src/lib/fingerprint.ts:13`.

---

## 9. Observabilidad / monitoreo

Estado actual:
- Logger backend estructurado básico JSON: `functions/api/src/utils/logger.ts:2`, `functions/api/src/utils/logger.ts:11`.
- `requestId` propagado en headers: `functions/api/src/middlewares/requestId.ts:11`.
- Sentry panel sin inicializar (TODO): `apps/web-next/lib/sentry.ts:1`, `apps/web-next/lib/sentry.ts:5`.
- Parte de errores y diagnósticos aún salen por `console.*`: `functions/api/src/middlewares/error.ts:17`, `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:660`.

Riesgo operativo:
- Dificultad de correlación rápida FE/BE en incidentes sin pipeline de error tracking consolidado.

---

## 10. DX / mantenibilidad

1. **Complejidad elevada por archivos extensos y multipropósito**.  
   Evidencia: `functions/api/src/routes/panel.ts:2729`, `apps/web-next/app/panel/(authenticated)/profile/page.tsx:2666`.

2. **Funciones duplicadas/variantes API con patrón repetido**.  
   Evidencia: `apps/web-next/lib/api.ts:66`, `apps/web-next/lib/api.ts:120`, `apps/web-next/lib/panel.ts:207`.

3. **Código placeholder/deuda explícita en TODOs**.  
   Evidencia: `apps/web-next/lib/sentry.ts:1`, `apps/web-b2c/src/constants.ts:5`.

4. **Drift puntual entre docs y runtime de endpoints**.  
   Evidencia: `docs/docs/CHECKLIST_MVP_PANEL.md:30`, `functions/api/src/routes/reservations.ts:153`.

---

## 11. Plan por fases recomendado

## F1 — Seguridad y exposición de datos (prioridad crítica)

Objetivo: reducir riesgo de abuso/filtración sin romper flujos MVP.

Bloques:
- Revisar contrato de `/public/orders?email=...` y endurecer controles.
- Cerrar modelo de seguridad DB (RLS + uso de claves por entorno).
- Revisar superficies de XSS en UI (popup HTML).

Entrega esperada:
- Matriz de decisiones de seguridad + backlog técnico aprobado.

## F2 — Escalabilidad operativa del panel/API

Objetivo: sostener crecimiento de uso real del panel.

Bloques:
- Migrar filtros de reservas al backend (query param server-side).
- Separar `panel.ts` por subrouters de dominio.
- Revisar límites/estrategia export CSV y rate-limit distribuido.

Entrega esperada:
- Diseño de módulos + plan incremental de migración sin breaking changes.

## F3 — Observabilidad y confiabilidad

Objetivo: detectar y depurar incidentes rápido.

Bloques:
- Unificar logs backend con `logger` + `requestId` en todos los errores.
- Activar error tracking en panel (Sentry) y eventos críticos de check-in.
- Definir alertas mínimas (5xx, auth failures, export errors, check-in failures).

Entrega esperada:
- Runbook de incidentes con señales mínimas y owners.

## F4 — SEO/consistencia producto y reducción de deuda UX

Objetivo: preparar crecimiento orgánico y coherencia de flujos.

Bloques:
- Definir estrategia SEO compatible con hash routing (o plan de migración).
- Eliminar dependencia funcional de mocks en perfiles.
- Alinear naming/rutas panel inconsistentes y deuda DX residual.

Entrega esperada:
- Roadmap de hardening producto + UX no bloqueante.

---

## 12. Checklist por fase

## F1 — Seguridad y datos

- [ ] Decidir si `/public/orders?email` sigue público o pasa a modelo protegido.
- [ ] Si se mantiene público: definir controles anti abuso (rate limit específico + fricción adicional) **(requiere validación de negocio)**.
- [ ] Definir política de exposición de `checkin_token` en payload/UI.
- [ ] Validar y cerrar políticas RLS por tenant/auth.
- [ ] Revisar y sanitizar render HTML en mapa.

## F2 — Escalabilidad API/panel

- [ ] Diseñar endpoint de reservas con filtros server-side (`date`, `status`, `q`).
- [ ] Reducir fetch full-list en panel de reservas.
- [ ] Particionar `panel.ts` en submódulos con pruebas por dominio.
- [ ] Definir estrategia de export CSV para volúmenes altos (sin romper MVP actual).
- [ ] Evaluar rate limiting distribuido para entornos multi-instancia.

## F3 — Observabilidad

- [ ] Reemplazar `console.error` del error middleware por logger estructurado.
- [ ] Inicializar Sentry panel con DSN/env.
- [ ] Agregar correlación `requestId` en logs clave de auth, export y check-in.
- [ ] Definir panel mínimo de salud (errores 5xx, latencia, ratio de fallos check-in).
- [ ] Actualizar runbook operativo con rutas de diagnóstico.

## F4 — SEO, consistencia y deuda UX

- [ ] Definir estrategia SEO para rutas internas (`HashRouter` vs alternativa).
- [ ] Extender sitemap/canonical según estrategia definida.
- [ ] Plan de retiro de fallback mock obligatorio en perfiles.
- [ ] Corregir incoherencia de `/panel/metrics`.
- [ ] Limpiar deuda DX de funciones placeholder y TODOs críticos.

---

## 13. Prompts sugeridos (ASK) para atacar cada bloque

### ASK-01 — Seguridad endpoint público de órdenes

```text
Auditoría de seguridad sin implementar: revisá `/public/orders?email` (API + B2C Mis Entradas), modelá vectores de abuso reales, proponé 3 alternativas de hardening por costo/impacto, y entregá plan de rollout sin breaking changes. Incluí evidencia por archivo/línea y marcá explícitamente lo que requiere validación de negocio.
```

### ASK-02 — Cierre de RLS / modelo de acceso DB

```text
Hacé discovery de `infra/sql/schema.sql`, `infra/sql/rls.sql` y uso de Supabase en API/web. Detectá brechas entre políticas RLS y modelo real de acceso. Entregá matriz de riesgos (alto/medio/bajo) y plan por fases para cerrar RLS sin downtime. No implementar.
```

### ASK-03 — Escalabilidad reservas panel

```text
Revisá flujo de reservas panel (`web-next` + API), detectá cuellos de botella en fetch/filtrado/ordenamiento, y proponé diseño de endpoint server-side con contrato de query params, paginación y compatibilidad backward. Solo discovery con evidencia.
```

### ASK-04 — Descomposición `panel.ts`

```text
Diseñá un refactor incremental de `functions/api/src/routes/panel.ts` hacia subrouters por dominio (profile, gallery, reservations, checkin, orders, exports, catalog, calendar), con estrategia de migración segura, riesgos y checkpoints de QA. Sin tocar código.
```

### ASK-05 — Observabilidad MVP

```text
Auditá observabilidad de panel+API (logger, requestId, Sentry, runbooks). Proponé baseline mínimo para producción (eventos críticos, alertas, correlación FE/BE), priorizado por impacto/costo y sin implementación.
```

### ASK-06 — SEO interno con hash routing

```text
Hacé discovery SEO técnico de B2C con HashRouter, canonical, robots/sitemap y docs SEO existentes. Entregá 2 estrategias viables para mejorar indexación interna (sin romper MVP), tradeoffs y plan por fases. No implementar.
```

### ASK-07 — Plan de retiro de mocks en perfiles B2C

```text
Auditá dependencia de mocks en `BarProfile`/`ClubProfile`/`EventProfile`, identificá qué bloquea pasar a DB-first puro y proponé roadmap por hitos (datos, contratos, UI fallbacks), con evidencia por archivo/línea. Solo discovery.
```

---

## 14. Pendientes no bloqueantes

Pendientes ya registrados (alineados con docs y contexto actual):

1. **OG image final visual 1200x630** (no bloqueante técnico).  
   Evidencia: `docs/seo/SEO_FASE3_RUNBOOK.md:30`, `docs/seo/SEO_ROLLOUT_PLAN.md:155`.

2. **SEO grande por páginas internas (limitación hash router)**.  
   Evidencia: `docs/seo/SEO_FASE3_RUNBOOK.md:29`, `apps/web-b2c/src/App.tsx:59`.

3. **Ajuste menor de naming en archivo export CSV** (mejora cosmética/no bloqueante).  
   Evidencia: `functions/api/src/routes/panel.ts:1859`, `functions/api/src/routes/panel.ts:1991`.

4. **Polish visual en módulos no críticos (horarios/check-in)**.  
   Evidencia: `docs/checkpoint/HORARIOS_ROLLOUT_CHECKPOINT_2026-02-21.md:41`, `docs/checkin/QR_CHECKIN_MEJORA_PLAN.md:199`.

---

## Nota de validación de alcance

Durante esta auditoría no se implementaron cambios funcionales en app/backend/infra.  
Este documento es discovery técnico con evidencia y plan de ejecución recomendado.
