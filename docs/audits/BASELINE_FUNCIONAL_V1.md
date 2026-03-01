# TAIRET — Baseline funcional (v1)

## 0. Propósito

Este documento describe el **estado funcional actual** del MVP de Tairet usando como fuente primaria la evidencia confirmada en código.

Su objetivo es dejar claro, antes de cualquier implementación de hardening o refactor:

* qué existe hoy
* qué está confirmado en código
* qué requiere validación en runtime
* qué está conscientemente postergado
* qué deuda o riesgo está aceptado temporalmente

Este documento **no define fixes**, **no propone implementación** y **no reemplaza contratos congelados**.
Su función es describir el estado actual operativo con el menor nivel posible de ambigüedad.

---

## 1. Regla de fuente de verdad

El orden de verdad operativa para este baseline es:

1. **Código**
2. **Runtime**, solo si el código no alcanza
3. **Input humano**, solo para:

   * negocio
   * riesgo aceptado
   * comportamiento esperado

No se usa documentación vieja como fuente primaria.

Todo lo que no pueda confirmarse en código debe quedar marcado como:

* **Requiere validación**

---

## 2. Alcance de este baseline v1

Este baseline cubre únicamente lo que ya quedó confirmado o identificado durante la fase ASK actual sobre:

* B2C
* panel B2B
* API
* SQL/RLS
* observabilidad mínima
* inconsistencias visibles ya detectadas

No intenta cubrir todavía el detalle completo de todos los contratos internos del sistema.

---

## 3. Baseline confirmado en código

### 3.1 API pública / órdenes

Se confirma en código que existe un flujo público de consulta de órdenes por email:

* existe `GET /public/orders?email=...`
* el parámetro `email` tiene validación básica con `z.string().email()`
* el endpoint devuelve al menos `checkin_token`

Además, se confirma que ese flujo está consumido por el frontend B2C.

**Evidencia confirmada en código**

* `functions/api/src/routes/public.ts:163`
* `functions/api/src/routes/public.ts:284`
* `functions/api/src/routes/public.ts:289`
* `functions/api/src/routes/public.ts:296`
* `apps/web-b2c/src/lib/orders.ts:20`
* `apps/web-b2c/src/lib/orders.ts:22`

---

### 3.2 B2C — Mis Entradas

Se confirma en código que la pantalla `MisEntradas`:

* depende del flujo público de órdenes por email
* renderiza QR
* muestra/copia `checkin_token`

Esto implica que, en el estado actual, el flujo B2C de recuperación de entradas no está aislado de ese token a nivel de UI.

**Evidencia confirmada en código**

* `apps/web-b2c/src/pages/MisEntradas.tsx:227`
* `apps/web-b2c/src/pages/MisEntradas.tsx:253`
* `apps/web-b2c/src/pages/MisEntradas.tsx:258`

---

### 3.3 B2C — Popup de mapa

Se confirma en código que el popup del mapa construye HTML mediante `setHTML(...)` con contenido interpolado.

Esto describe el comportamiento actual del componente, sin concluir todavía explotabilidad real.

**Evidencia confirmada en código**

* `apps/web-b2c/src/components/shared/MapSection.tsx:343`
* `apps/web-b2c/src/components/shared/MapSection.tsx:389`
* `apps/web-b2c/src/components/shared/MapSection.tsx:395`

---

### 3.4 Panel B2B — Reservas

Se confirma en código que la vista de reservas del panel:

* carga datos
* luego realiza filtrado local en cliente con `reservations.filter(...)`

También se confirma en backend que existe al menos una ruta de reservas con `.limit(20)`.

Esto deja establecido que el comportamiento actual de reservas no está completamente resuelto server-side.

**Evidencia confirmada en código**

* `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:89`
* `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:165`
* `functions/api/src/routes/reservations.ts:161`
* `functions/api/src/routes/reservations.ts:185`

---

### 3.5 Panel B2B — Auth

Se confirma en código que el panel usa autenticación basada en:

* `Authorization: Bearer` desde cliente
* validación backend a través de `supabase.auth.getUser()` en `panelAuth`

Esto congela el baseline actual del flujo de autenticación panel/API.

**Evidencia confirmada en código**

* `apps/web-next/lib/api.ts:22`
* `apps/web-next/lib/api.ts:39`
* `functions/api/src/middlewares/panelAuth.ts:63`
* `functions/api/src/middlewares/panelAuth.ts:86`

---

### 3.6 Panel B2B — Logout

Se confirma en código que el logout observado en el panel:

* limpia cookie
* redirige a login

No se observa en ese punto un `supabase.auth.signOut()` explícito.

Esto describe el estado actual del código, sin afirmar todavía si el logout es suficiente o insuficiente en runtime.

**Evidencia confirmada en código**

* `apps/web-next/components/panel/SidebarUserInfo.tsx:13`
* `apps/web-next/components/panel/SidebarUserInfo.tsx:15`

---

### 3.7 Panel B2B — Ruta `/panel/metrics`

Se confirma en código que la ruta `/panel/metrics` renderiza componentes de lineup (`LineupBarView/LineupClubView`), lo que constituye una inconsistencia semántica visible del estado actual.

**Evidencia confirmada en código**

* `apps/web-next/app/panel/(authenticated)/metrics/page.tsx:4`
* `apps/web-next/app/panel/(authenticated)/metrics/page.tsx:11`

---

### 3.8 API — Concentración estructural en `panel.ts`

Se confirma en código que `functions/api/src/routes/panel.ts` concentra múltiples dominios operativos, incluyendo al menos:

* perfil
* gallery
* reservations
* check-in
* orders
* exports
* catalog
* calendar

También se confirma que el archivo llega a 2729 líneas.

Esto describe una deuda estructural actual del backend panel.

**Evidencia confirmada en código**

* `functions/api/src/routes/panel.ts:422`
* `functions/api/src/routes/panel.ts:840`
* `functions/api/src/routes/panel.ts:1060`
* `functions/api/src/routes/panel.ts:1764`
* `functions/api/src/routes/panel.ts:2004`
* `functions/api/src/routes/panel.ts:2728`
* `functions/api/src/routes/panel.ts` (última línea `2729`)

---

### 3.9 Observabilidad actual

Se confirma en código que:

* existe `requestId`
* el middleware de error todavía usa `console.error`
* Sentry panel sigue pendiente / sin inicialización real en el archivo observado

Esto define el baseline actual de observabilidad: existe una base mínima, pero no está consolidada.

**Evidencia confirmada en código**

* `functions/api/src/middlewares/requestId.ts:9`
* `functions/api/src/middlewares/requestId.ts:11`
* `functions/api/src/middlewares/error.ts:16`
* `functions/api/src/middlewares/error.ts:17`
* `apps/web-next/lib/sentry.ts:1`
* `apps/web-next/lib/sentry.ts:5`

---

### 3.10 SQL / RLS

Se confirma en código que existen políticas RLS permisivas con `USING (true)` y/o `WITH CHECK (true)`.

Esto no implica por sí solo una conclusión final de seguridad runtime, pero sí congela una deuda real presente en SQL.

**Evidencia confirmada en código**

* `infra/sql/rls.sql:21`
* `infra/sql/rls.sql:30`
* `infra/sql/rls.sql:35`
* `infra/sql/rls.sql:79`

---

## 4. Baseline que requiere validación en runtime

Los siguientes puntos **no deben asumirse** como confirmados solo por existir en código. Requieren validación en runtime:

### 4.1 Órdenes públicas / Mis Entradas

* que `/public/orders?email` responda correctamente con datos reales
* que `MisEntradas` funcione end-to-end con órdenes reales
* que el flujo visible de QR/token sea suficiente en operación real

**Estado:** Requiere validación

---

### 4.2 Reservas panel

* impacto real del `.limit(20)` sobre datos existentes
* si ya hay truncado visible en casos reales
* si la pantalla está consumiendo exactamente la ruta/contrato que se está auditando

**Estado:** Requiere validación

---

### 4.3 Logout panel

* si el comportamiento actual realmente invalida sesión de forma suficiente
* si el usuario puede volver atrás y seguir operando
* si hay persistencia de sesión residual

**Estado:** Requiere validación

---

### 4.4 Popup de mapa

* origen real de los datos interpolados
* si esos valores pueden ser controlados o editados por actores no confiables
* si el riesgo XSS es real/explotable en runtime o solo potencial

**Estado:** Requiere validación

---

### 4.5 Check-in / Export CSV

* contrato exacto
* comportamiento runtime
* paridad entre código observado y operación real

**Estado:** Requiere validación

---

### 4.6 Modelo real de acceso DB

* qué flujos dependen realmente de RLS
* qué flujos pasan por service role
* qué actores usan `anon` / `auth`
* qué tablas/operaciones quedarían afectadas por endurecimiento

**Estado:** Requiere validación

---

## 5. Qué funciona hoy con limitaciones

Con base en lo confirmado en código, hoy existen flujos operativos, pero con limitaciones técnicas ya detectadas:

### 5.1 Recuperación B2C de entradas

Existe y está conectada al endpoint público por email, pero con exposición actual de `checkin_token` en UI.

### 5.2 Reservas panel

Existe una vista funcional, pero con filtrado cliente y al menos una limitación backend detectada (`.limit(20)`).

### 5.3 Observabilidad

Existe `requestId`, pero el sistema todavía no tiene observabilidad consolidada:

* error middleware no unificado con logger
* Sentry panel pendiente

### 5.4 Backend panel

El panel está centralizado en un router/backend monolítico (`panel.ts`), lo que no impide operación inmediata, pero sí eleva el riesgo estructural de cambios.

---

## 6. Qué está conscientemente postergado

Según decisiones ya fijadas en esta fase documental:

### 6.1 Login B2C futuro

El login de usuarios B2C no forma parte del hardening inmediato y queda para una fase posterior.

### 6.2 Corrección de `/panel/metrics`

La inconsistencia de `/panel/metrics` existe, pero está tratada como P3 / no bloqueante.

### 6.3 Roadmap de fixes e implementación

Este baseline no define todavía la ejecución CODE.
Eso queda para etapas posteriores, una vez cerrada la capa documental v1.

---

## 7. Qué deuda/riesgo está aceptado temporalmente

### 7.1 Endpoint público de órdenes por email

Se mantiene temporalmente como decisión de negocio.

### 7.2 Dependencia actual de `MisEntradas` respecto de ese flujo

Se mantiene mientras no exista login B2C futuro.

### 7.3 Fix semántico de `/panel/metrics`

Se acepta como pendiente no crítico en esta etapa.

---

## 8. Qué no se toca en fases tempranas

Mientras no se cierre mejor la capa documental y de validación, no se deberían romper en fases tempranas:

* `GET /public/orders?email=...`
* consumo B2C de órdenes públicas
* visualización actual de `MisEntradas`
* auth panel basado en Bearer → `panelAuth`
* flujo visible de reservas panel
* popup visible del mapa
* check-in/export, hasta congelar mejor sus contratos

---

## 9. Qué queda fuera de este baseline v1

Queda fuera de este baseline, por no estar todavía suficientemente extraído desde código:

* payload mínimo exacto de `/public/orders?email`
* contrato exacto de check-in
* contrato exacto de export CSV
* payload exacto de reservas panel
* contratos de `BarProfile`, `ClubProfile` y `EventProfile`
* contratos exactos de errores por endpoint crítico
* estado SEO/HashRouter reconfirmado en esta capa documental v1

Todos esos puntos deben tratarse como:

* **Requiere validación**

---

## 10. Regla de uso de este documento

Este baseline debe usarse como referencia antes de:

* abrir un ASK específico
* redactar prompts CODE
* tocar flujos sensibles
* aprobar cambios de hardening o refactor

Cualquier expansión futura de este documento debe seguir esta regla:

* primero código
* runtime solo si el código no alcanza
* input humano solo para negocio / riesgo aceptado / comportamiento esperado
