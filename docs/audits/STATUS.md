# TAIRET — STATUS

## 1) Título

**TAIRET — STATUS**

## 2) Ruta canónica

`docs/audits/STATUS.md`

## 3) Propósito

Mantener un tablero operativo corto y canónico del estado actual del hardening/auditoría documental de Tairet.

Este documento no reemplaza los docs base.
Su función es responder rápidamente:

* dónde estamos
* qué ya quedó cerrado
* qué sigue
* qué bloquea el siguiente paso
* qué ASK/CODE está permitido abrir

---

## 4) Regla de fuente de verdad

La prioridad operativa sigue siendo:

1. **Código del repo**
2. **Runtime/entorno**, solo cuando el código no alcanza
3. **Input humano**, solo para:

   * riesgo aceptado
   * comportamiento esperado
   * prioridad operativa

Este documento no debe contradecir:

* `docs/audits/CONTRATOS_CONGELADOS_V1.md`
* `docs/audits/BASELINE_FUNCIONAL_V1.md`
* `docs/audits/MATRIZ_VALIDACION_PREVIA_V1.md`
* `docs/audits/SMOKE_TESTS_V1.md`
* `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`
* `docs/audits/HARDENING_ROADMAP.md`

---

## 5) Estado actual

### Fase actual

**F3 — CODE de observabilidad y guardrails**
Estado: **activa** con **CODE 01, CODE 02, CODE 03 y CODE 04A implementados y validados**.

### Próximo ASK activo

**Ninguno bloqueante inmediato.**

Si hace falta ASK adicional, debería limitarse a definir el siguiente slice pequeño y aditivo dentro de `F3`.

Bloques abiertos actuales:

1. semántica efectiva de `SUPABASE_SERVICE_ROLE` / RLS en entorno
2. comportamiento del export fuera del runtime local observado (`500`, datasets grandes, otros navegadores/entornos)
3. captura real de Sentry panel con DSN activo y cobertura runtime efectiva del wiring remanente en `apps/web-next`

### Próximo CODE permitido

**F3 — siguiente slice pequeño y aditivo de observabilidad y guardrails**

El gate documental y de validación mínima ya alcanzó para abrir `F3`, pero **CODE 01, CODE 02, CODE 03 y CODE 04A no cierran toda la fase** y el siguiente slice debe seguir sin mezclar reservas, check-in, export, logout, frontend ni SQL/RLS.

---

## 6) Fases cerradas

* **F0 — Cierre documental v1**

  * `CONTRATOS_CONGELADOS_V1.md`
  * `BASELINE_FUNCIONAL_V1.md`
  * `MATRIZ_VALIDACION_PREVIA_V1.md`
  * `SMOKE_TESTS_V1.md`
  * `RIESGOS_ACEPTADOS_Y_PENDIENTES.md`
  * `HARDENING_ROADMAP.md`
* **F1 — ASK de extracción contractual adicional**

  * `/public/orders?email` + `MisEntradas`
  * reservas panel + auth/logout
  * check-in + export CSV
  * matriz actor → tabla → operación para RLS

---

## 7) Fases pendientes

* **F2 — ASK / validación runtime mínima residual**
* **F3 — CODE de observabilidad y guardrails (en curso)**
* **F4 — CODE de hardening aditivo del flujo público B2C**
* **F5A — CODE de reservas + auth/logout (slice `F5A-1 CODE 01` validado; fase no cerrada)**
* **F5B — CODE de check-in + export CSV**
* **F6 — CODE de refactor estructural `panel.ts`**
* **F7 — CODE de hardening SQL / RLS**
* **F8 — CODE de pendientes no bloqueantes y cierre documental**

---

## 8) Bloqueantes actuales

### Bloqueantes runtime / de validación mínima

* semántica efectiva de `SUPABASE_SERVICE_ROLE` / RLS en entorno
* comportamiento del export fuera del runtime local observado (`500`, datasets grandes, otros navegadores/entornos)
* captura real de Sentry panel con DSN activo; el wiring remanente ya no rompe el panel, pero su efectividad real sigue en validación

### Bloqueante operativo de habilitación

* `F3` ya fue habilitada e iniciada con slices seguros y aditivos; el bloqueo operativo ya no es “abrir o no abrir CODE”, sino **no mezclar el siguiente slice con superficies sensibles**
* El siguiente paso debe seguir siendo un bloque pequeño y aditivo de `F3`, sin arrastrar reservas, check-in, export, logout, frontend, `panel.ts` estructural ni SQL/RLS

---

## 9) Últimas decisiones importantes

* La ruta documental canónica es `docs/audits/`
* `TAIRET_TECH_AUDIT_MVP.md` se conserva como documento histórico / snapshot, no como fuente operativa primaria
* El hardening roadmap se rehízo apoyado en los docs v1, no en el roadmap viejo del chat
* F0 quedó cerrada como capa documental base v1
* F1 quedó cerrada documentalmente para:

  * `/public/orders?email` + `MisEntradas`
  * reservas panel + auth/logout
  * check-in + export CSV
  * matriz actor → tabla → operación para RLS
* F5 se dividió en:

  * **F5A — reservas + auth/logout**
  * **F5B — check-in + export CSV**
* F7 quedó reforzada documentalmente: no debe diseñarse solo contra `schema.sql` + `rls.sql`, y requiere reconciliar `schema.sql`, migraciones y runtime antes de cualquier CODE del bloque
* El gate hacia `F3` quedó satisfecho y la fase ya fue abierta con un primer slice seguro y aditivo
* `F3 CODE 01` ya quedó implementado y validado en backend con:

  * logger estructurado en `error middleware`
  * correlación por `requestId`
  * preservación de contratos visibles chequeados del API
* La validación post-CODE de `F3 CODE 01` confirmó en runtime local observado:

  * preservación de `x-request-id` en responses verificadas
  * preservación del shape visible de errores chequeados (`400`, `404`)
  * correlación útil entre response y log para errores que pasan por `errorHandler`
* `F3` sigue activa: `CODE 01` no cierra toda la fase y el siguiente paso natural es otro slice pequeño y aditivo dentro del mismo bloque
* `F3 CODE 02` ya quedó implementado y validado en backend con:

  * observabilidad estructurada en `panelAuth`
  * reutilización de `getRequestId(req)` para correlación consistente
  * preservación de respuestas visibles de `401` chequeadas en auth panel
* La validación post-CODE de `F3 CODE 02` confirmó en runtime local observado:

  * preservación de `x-request-id` en rechazos de `panelAuth`
  * preservación del shape visible de `401` sin `Authorization` y con `Bearer bad-token`
  * correlación útil entre response y log con `authStage` y `rejectionReason`
* `F3` sigue activa: `CODE 02` tampoco cierra toda la fase y el siguiente paso natural sigue siendo otro slice pequeño y aditivo dentro del mismo bloque, sin mezclar superficies sensibles
* `F3 CODE 03` ya quedó implementado y validado en backend con:

  * observabilidad estructurada en `requireRole(...)`
  * reutilización de `getRequestId(req)` para correlación consistente
  * preservación de respuestas visibles chequeadas para `401 Unauthorized` y `403` por rol insuficiente
* La validación post-CODE de `F3 CODE 03` confirmó en runtime local observado:

  * preservación de `x-request-id` en la validación aislada del middleware
  * preservación del shape visible de `401` por falta de `req.panelUser` y `403` por rol insuficiente
  * correlación útil entre response y log con `authorizationStage`, `requiredRoles`, `actualRole` y `rejectionReason`
* `F3` sigue activa: `CODE 03` tampoco cierra toda la fase y el siguiente paso natural sigue siendo otro slice pequeño y aditivo dentro del mismo bloque, sin mezclar superficies sensibles
* `F3 CODE 04` original no quedó validado: el wiring mínimo inicial de Sentry en `apps/web-next` introdujo regresión visible en runtime local del panel
* `F3 CODE 04A` ya quedó implementado y validado en `apps/web-next` con:

  * retiro de `withSentryConfig(...)` de `next.config.mjs`
  * preservación del wiring remanente mínimo en `instrumentation.ts`, `sentry.client.config.ts` y `app/global-error.tsx`
  * eliminación de la regresión visible de arranque del panel
* La validación post-CODE de `F3 CODE 04A` confirmó en runtime local observado:

  * `typecheck` OK en `apps/web-next`
  * `/panel/login` y `/panel` volvieron a responder `200`
  * no reapareció el error previo de módulo/config
  * el entorno local observado sigue sin DSN Sentry activo, por lo que la captura real permanece abierta
* En el runtime local observado persiste un warning de `require-in-the-middle` / OpenTelemetry / `@sentry/nextjs` al compilar `instrumentation`, pero quedó clasificado como residual no bloqueante mientras no rompa arranque ni rutas del panel
* `F3` sigue activa: `CODE 04A` corrige el slice anterior, pero tampoco cierra toda la fase y el siguiente paso natural sigue siendo otro slice pequeño y aditivo dentro del mismo bloque, sin mezclar superficies sensibles
* En el runtime local observado, el logout panel ya quedó validado como logout visible/UI sin invalidación efectiva de la sesión Auth; este hallazgo no debe universalizarse automáticamente a otros entornos
* `F5A-1 CODE 01` ya quedó implementado y validado para reservas panel con:

  * `date` opcional en `GET /locals/:id/reservations`
  * preservación intacta del modo legacy sin `date`
  * helper nuevo date-scoped solo para la página de reservas
  * `getPanelReservationsByLocalId()` intacto y lineup sin cambios
* La validación manual real de `F5A-1 CODE 01` confirmó en `date=2026-01-28`:

  * aparición de las `2` reservas reales del día
  * una reserva `confirmed` y otra `en_revision` / pendiente
  * `refresh` conservando la fecha seleccionada
  * `cancel` conservando el contexto del día
  * guardado de `table_note` conservando el contexto del día
* En el runtime manual observado, el bug original de ocultamiento en reservas quedó mitigado para la página date-scoped; la severidad residual del contrato legacy sin `date` y de otros locales/datasets sigue en validación
* En el runtime local observado, el export CSV panel ya quedó validado como funcional en reservas y orders, con headers de red observables y filename final descargado vía fallback frontend; `500`, datasets grandes y otros entornos siguen en validación
* En el runtime local observado, la Fase A del check-in quedó cerrada por cobertura combinada manual + scanner: manual confirmó `invalid_token`, `already_used`, `forbidden` y `window_invalid/expired`; scanner confirmó `success`, `not_yet_valid`, `already_used` y `otro local`
* El residual menor no bloqueante del check-in tras esa cobertura combinada es que `scanner + expired` no fue observado directamente en esta corrida
* En el runtime local observado, la Fase B del bloque mapa/popup quedó cerrada como validación runtime: `dlirio` mostró mapa/ubicación operativos sin anomalías visibles y `mckharthys-bar` cayó a `Ubicación no disponible` cuando faltó ubicación cargada
* El residual del bloque mapa/popup pasa a plano técnico/documental: `setHTML(...)` sigue existiendo como superficie por código, pero no demostró comportamiento riesgoso observable en esta corrida

---

## 10) Próxima actualización esperada

Actualizar este documento cuando ocurra al menos una de estas situaciones:

* se cierre F2
* cambie el próximo ASK activo
* cambie el próximo CODE permitido
* se destrabe o aparezca un bloqueante importante
* cambie una decisión documental/operativa relevante

---

## 11) Fecha de última actualización

**2026-03-01**

---

## 12) Regla de uso del documento

* Este documento es un tablero operativo corto.
* No reemplaza los demás docs base.
* No debe usarse para introducir verdad nueva sin evidencia.
* Si hay contradicción entre este documento y los docs base, prevalecen los docs base.
* Antes de abrir un ASK o CODE nuevo, revisar este documento junto con `HARDENING_ROADMAP.md`.
