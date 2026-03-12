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

Si hace falta ASK adicional dentro de `F3`, debería limitarse a una validación puntual con DSN Sentry activo, solo si ese entorno realmente existe.

Bloques abiertos actuales:

1. alcance exacto por flujo real e implicancias de rollout de la semántica backend con `SUPABASE_SERVICE_ROLE` / RLS (**fuera de `F3`; residual de `F7` / validación estructural**)
2. captura real de Sentry panel con DSN activo y cobertura runtime efectiva del wiring remanente en `apps/web-next` (**dependencia de entorno de `F3`**)

### Próximo CODE permitido

**Ninguno por ahora dentro de `F3`**

`F3` sigue abierta, pero el ASK mini vigente concluyó que **no corresponde abrir `F3 CODE 05` en este momento**. Los residuales actuales del bloque quedan clasificados como:

* **validación posterior**: `RV-13`, `RV-14`, `RV-15`
* **dependencia de entorno**: `RV-16`
* **residual no bloqueante**: `PN-04`

El siguiente CODE de `F3` solo debería reabrirse si aparece un bug activo confirmado de observabilidad o si un entorno con DSN activo demuestra un gap técnico concreto que justifique otro slice pequeño y aditivo.

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
* **F2 — ASK / validación runtime mínima**

  * logout, reservas `.limit(20)` + filtro local, export, check-in manual + scanner y mapa/popup ya quedaron cubiertos al nivel necesario para el cierre operativo del bloque
  * los residuales abiertos de ese frente quedaron reclasificados como validación posterior, dependencia de entorno de `F3` o validación estructural de `F7`
* **F5A — CODE de reservas + auth/logout**

  * `F5A-1 CODE 01` validado para reservas date-scoped sin romper modo legacy ni tocar lineup
  * `F5A-2 CODE 01` validado para logout/auth panel con invalidación efectiva de sesión en el runtime manual observado
* **F5B — CODE de check-in + export CSV**

  * cobertura principal de check-in validada por runtime local observado (manual + scanner)
  * export CSV validado en runtime local observado para sus consumidores confirmados
  * residuales del bloque reclasificados como posteriores / no bloqueantes
* **F4 — CODE de hardening aditivo del flujo público B2C**

  * `F4 CODE 01` despublicó temporalmente `MisEntradas` del B2C de pre-relanzamiento sin borrar la base de código
  * `F4 CODE 01A` validó el ajuste visual complementario de navegación (`Publicá tu local` en desktop y bottom navbar mobile equilibrada)
  * el residual `/public/orders?email` + `checkin_token` pasa a ola posterior, ligado a futura reintroducción con login/cuenta o futura reexposición real del bloque

---

## 7) Fases pendientes

* **F3 — CODE de observabilidad y guardrails (en curso)**
* **F6 — CODE de refactor estructural `panel.ts` (abierta pero pausada; `CODE 01` y `CODE 02` validados)**
* **F7 — CODE de hardening SQL / RLS (abierta pero pausada; reconciliación SQL parcialmente cerrada; semántica operativa observable del backend con `SUPABASE_SERVICE_ROLE` y alcance por flujo real parcialmente confirmados; `F7 CODE 01` validado sobre tracking público (`events_public`, `whatsapp_clicks`, `profile_views`); `F7 CODE 02` validado únicamente para `promos`; `F7 CODE 03` validado únicamente para `reviews`; `F7 CODE 04` no corresponde por ahora; cualquier otra tabla o flow queda fuera de scope del tercer rollout; siguiente paso: esperar nueva evidencia o replanteo de rollout antes de volver a evaluar el remanente)**
* **F8 — CODE de pendientes no bloqueantes y cierre documental (primer bloque consolidado: cierre documental + backlog no bloqueante; `/panel/metrics` diferido/no activo; no habilita CODE ni reabre `F3`, `F6` o `F7`; no existe un segundo bloque útil por ahora)**

---

## 8) Bloqueantes actuales

### Bloqueantes runtime / de validación mínima

* captura real de Sentry panel con DSN activo; el wiring remanente ya no rompe el panel, pero su efectividad real sigue en validación y depende del entorno

### Bloqueante operativo de habilitación

* `F3` ya fue habilitada e iniciada con slices seguros y aditivos; el bloqueo operativo ya no es “abrir o no abrir CODE”, sino **no abrir `CODE 05` sin un gap técnico nuevo y acotado**
* El siguiente paso correcto es **validación puntual con DSN activo si ese entorno existe**, o pausa de `F3` sin nuevo CODE hasta contar con ese entorno o con un bug activo confirmado del bloque

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
* `F2` queda cerrada formalmente: el runtime mínimo de logout, reservas, export, check-in y mapa/popup ya quedó cubierto al nivel requerido, y los residuales abiertos pasan a validación posterior, dependencia de entorno de `F3` o validación estructural de `F7`
* F5 se dividió en:

  * **F5A — reservas + auth/logout**
  * **F5B — check-in + export CSV**
* F7 quedó reforzada documentalmente: no debe diseñarse solo contra `schema.sql` + `rls.sql`, y requiere reconciliar `schema.sql`, migraciones y runtime antes de cualquier CODE del bloque
* El ASK de reconciliación operativa de superficie SQL para `F7` queda **parcialmente cerrado**: el drift principal entre `schema.sql`, migraciones y runtime ya quedó identificado documentalmente; `customer_email_lower` y la correspondencia final con el esquema desplegado siguen en `Requiere validación`
* La semántica operativa observable del backend para `F7` queda mejor asentada documentalmente: el cliente global usa `SUPABASE_SERVICE_ROLE` y, con la evidencia real disponible, cualquier diseño del bloque debe asumir bypass de RLS en backend hasta que se demuestre lo contrario por flujo real
* El ASK de alcance por flujo real de `SUPABASE_SERVICE_ROLE` para `F7` queda **parcialmente confirmado**: el backend observable opera con un cliente global y el bloque debe asumir bypass de RLS hasta prueba contraria por flujo real; los flows con `orders`, `reservations`, `panel_users`, `payments/callback`, `check-in`, `orders/search`, `orders/summary` y `export` quedan documentados como de alta o muy alta criticidad para rollout
* El primer bloque prudente de rollout de `F7` queda congelado en tracking público: `events_public`, `whatsapp_clicks` y `profile_views`
* **F7 CODE 01 queda validado únicamente para `events_public`, `whatsapp_clicks` y `profile_views`. Cualquier otra tabla o flow queda fuera de scope del primer rollout.**
* `orders`, `reservations`, `panel_users`, `payment_events`, `locals`, `local_daily_ops`, `ticket_types`, `table_types` y los flows derivados de alta criticidad (`payments/callback`, `check-in`, `orders/search`, `orders/summary`, `export`, bootstrap auth panel) quedan explícitamente fuera del primer rollout de `F7`
* La validación de `F7 CODE 01` ya no depende solo de lectura de código: incluye verificación real post-apply en Supabase, con `rls_enabled = true` preservado para `events_public`, `whatsapp_clicks` y `profile_views`, desaparición de las policies permisivas previas del bloque y presencia de las seis policies `*_backend_only` restrictivas para `anon` y `authenticated`
* El segundo bloque prudente de rollout de `F7` queda congelado en `promos`
* **F7 CODE 02 queda validado únicamente para `promos`. Cualquier otra tabla o flow queda fuera de scope del segundo rollout.**
* `orders`, `reservations`, `panel_users`, `payment_events`, `locals`, `local_daily_ops`, `ticket_types`, `table_types` y los flows derivados de alta criticidad (`payments/callback`, `check-in`, `orders/search`, `orders/summary`, `export`, bootstrap auth panel) quedan explícitamente fuera del segundo rollout de `F7`
* La validación de `F7 CODE 02` ya no depende solo de lectura de código: incluye verificación real post-apply en Supabase (`promos` con `rls_enabled = true`, desaparición de `promos_select_by_local`, presencia de `promos_select_backend_only` restrictiva para `anon` y `authenticated`) y validación funcional mínima de los flows actuales (`GET /public/locals/by-slug/mckharthys-bar` con `promotions` y `GET /locals/:id/promos` con auth en panel)
* El tercer bloque prudente de rollout de `F7` queda congelado en `reviews`
* **F7 CODE 03 queda validado únicamente para `reviews`. Cualquier otra tabla o flow queda fuera de scope del tercer rollout.**
* `orders`, `reservations`, `panel_users`, `payment_events`, `locals`, `local_daily_ops`, `ticket_types`, `table_types` y los flows derivados de alta criticidad (`payments/callback`, `check-in`, `orders/search`, `orders/summary`, `export`, bootstrap auth panel) quedan explícitamente fuera del tercer rollout de `F7`
* La validación de `F7 CODE 03` ya no depende solo de lectura de código: incluye evidencia del repo/SQL (`013_create_reviews.sql`, `018_harden_reviews_rls_backend_only.sql`, `rls.sql`), evidencia real post-apply en Supabase (`reviews_select_public` ya no existe, `reviews_select_backend_only` existe para `anon` y `authenticated` con `qual = false`) y smoke funcional mínimo real (`GET /reviews` y `POST /reviews` siguen funcionando)
* El hecho de que `reviews` siga fuera de `schema.sql` queda como **deuda documental separada** dentro del drift SQL del repo; no reabre `F7 CODE 03` ni debe volver a reclasificar este slice como validado parcial
* **Después de `F7 CODE 01–03`, no queda actualmente un cuarto bloque con blast radius lo bastante bajo para justificar `F7 CODE 04`; el remanente queda pausado hasta nueva evidencia o replanteo de rollout.**
* `ticket_types + table_types` queda como candidato relativo menos malo del remanente, pero todavía no cumple el umbral de prudencia por cruce entre catálogo público, panel, compra y coverage/documentación SQL insuficiente
* El siguiente paso correcto de `F7` ya no es abrir `F7 CODE 04`, sino esperar nueva evidencia o replanteo de rollout antes de volver a evaluar un cuarto bloque; ya no corresponde revalidar ni reabrir `F7 CODE 03`
* **El primer bloque de `F8` queda limitado a cierre documental, backlog no bloqueante y clasificación de `/panel/metrics` como diferido/no activo. No habilita CODE ni reabre `F3`, `F6` o `F7`.**
* El primer bloque de `F8` ya queda **consolidado / cumplido** como docs-only del ciclo actual: cerró backlog no bloqueante, sincronización documental y clasificación operativa de `/panel/metrics` como pendiente P3 diferido / no activo
* **Después del primer bloque de `F8`, no existe actualmente un segundo bloque útil de cierre documental / backlog no bloqueante; `F8` queda sin más trabajo inmediato hasta nueva evidencia o nueva prioridad.**
* Lo restante queda separado entre backlog no bloqueante ya clasificado, frentes pausados (`F3`, `F6`, `F7`) y trabajo técnico no habilitado; no corresponde convertir ese remanente en un segundo bloque activo de `F8`
* El gate hacia `F3` quedó satisfecho y la fase ya fue abierta con un primer slice seguro y aditivo
* `F3 CODE 01` ya quedó implementado y validado en backend con:

  * logger estructurado en `error middleware`
  * correlación por `requestId`
  * preservación de contratos visibles chequeados del API
* La validación post-CODE de `F3 CODE 01` confirmó en runtime local observado:

  * preservación de `x-request-id` en responses verificadas
  * preservación del shape visible de errores chequeados (`400`, `404`)
  * correlación útil entre response y log para errores que pasan por `errorHandler`
* `F3 CODE 01` dejó el baseline mínimo de observabilidad backend validado; la cobertura residual del slice quedó reclasificada como validación posterior y ya no justifica por sí sola otro CODE inmediato
* `F3 CODE 02` ya quedó implementado y validado en backend con:

  * observabilidad estructurada en `panelAuth`
  * reutilización de `getRequestId(req)` para correlación consistente
  * preservación de respuestas visibles de `401` chequeadas en auth panel
* La validación post-CODE de `F3 CODE 02` confirmó en runtime local observado:

  * preservación de `x-request-id` en rechazos de `panelAuth`
  * preservación del shape visible de `401` sin `Authorization` y con `Bearer bad-token`
  * correlación útil entre response y log con `authStage` y `rejectionReason`
* `F3 CODE 02` dejó `panelAuth` instrumentado y validado; su cobertura residual queda como validación posterior, no como disparador automático de otro CODE inmediato
* `F3 CODE 03` ya quedó implementado y validado en backend con:

  * observabilidad estructurada en `requireRole(...)`
  * reutilización de `getRequestId(req)` para correlación consistente
  * preservación de respuestas visibles chequeadas para `401 Unauthorized` y `403` por rol insuficiente
* La validación post-CODE de `F3 CODE 03` confirmó en runtime local observado:

  * preservación de `x-request-id` en la validación aislada del middleware
  * preservación del shape visible de `401` por falta de `req.panelUser` y `403` por rol insuficiente
  * correlación útil entre response y log con `authorizationStage`, `requiredRoles`, `actualRole` y `rejectionReason`
* `F3 CODE 03` dejó `requireRole(...)` instrumentado y validado; la validación adicional pendiente sobre una ruta real del producto queda como residual posterior
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
* `F3 CODE 04A` corrigió la regresión visible del panel; lo que sigue abierto en ese frente es la captura real con DSN activo, que hoy depende del entorno y no justifica por sí sola abrir `CODE 05`
* Tras consolidar `CODE 01`, `CODE 02`, `CODE 03` y `CODE 04A`, `F3` sigue abierta pero **no necesita CODE por ahora**
* Los residuales actuales de `F3` quedan clasificados como:

  * `RV-13`, `RV-14`, `RV-15` → **validación posterior**
  * `RV-16` → **dependencia de entorno**
  * `PN-04` → **residual no bloqueante**
* El siguiente paso correcto para `F3` es una validación puntual con DSN activo si el entorno existe, o pausa del bloque sin nuevo CODE hasta contar con ese entorno o con un bug activo confirmado
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
* `F5A-2 CODE 01` ya quedó implementado y validado para logout/auth panel con:

  * uso de `supabase.auth.signOut({ scope: "local" })` como mecanismo real de logout
  * limpieza de `panel_token` solo como compatibilidad residual
  * redirección visible preservada a `/panel/login`
* La validación manual real de `F5A-2 CODE 01` confirmó en el runtime observado:

  * redirect correcto tras logout
  * `back` sin recuperación de acceso efectivo
  * refresh en `/panel` sin recuperación de acceso
  * refresh en `/panel/reservations` sin recuperación de acceso
* En el runtime manual observado, el estado visual del logout y el acceso efectivo del panel quedaron alineados; navegación directa a `/panel`, request autenticada posterior y alcance fuera de ese entorno siguen en validación adicional
* `F5A` queda cerrada documentalmente: `F5A-1 CODE 01` y `F5A-2 CODE 01` quedaron validados y el residual del contrato legacy sin `date` pasa a ola posterior / no bloqueante
* El siguiente paso correcto después del cierre de `F5A` sigue siendo otro slice pequeño y aditivo de `F3`; el residual posterior de reservas legacy no autoriza por sí solo abrir un CODE nuevo de `F5A`
* En el runtime local observado, el export CSV panel ya quedó validado como funcional en reservas y orders, con headers de red observables y filename final descargado vía fallback frontend; `500`, datasets grandes y otros entornos siguen en validación
* En el runtime local observado, la Fase A del check-in quedó cerrada por cobertura combinada manual + scanner: manual confirmó `invalid_token`, `already_used`, `forbidden` y `window_invalid/expired`; scanner confirmó `success`, `not_yet_valid`, `already_used` y `otro local`
* El residual menor no bloqueante del check-in tras esa cobertura combinada es que `scanner + expired` no fue observado directamente en esta corrida
* `F5B` queda cerrada documentalmente: check-in y export ya tienen validación runtime local suficiente en sus flujos principales y los residuales abiertos del bloque pasan a ola posterior / no bloqueante
* No corresponde abrir CODE nuevo en `F5B` mientras no aparezca un bug activo confirmado del bloque; el siguiente paso correcto tras su cierre sigue siendo otro slice pequeño y aditivo de `F3`
* `F4` no debe tratarse como hardening de superficie pública B2C confirmada; el bloque se cerró como pre-relanzamiento / superficie potencialmente reexponible, mientras el estado de dominio/deploy final sigue en `Requiere validación`
* `F4 CODE 01` ya dejó `MisEntradas` fuera del routing público actual del B2C, quitó sus accesos visibles en navegación desktop/mobile y retiró el CTA post-compra que apuntaba a `/mis-entradas`, preservando `apps/web-b2c/src/pages/MisEntradas.tsx` para futura reintroducción
* `F4 CODE 01A` ya quedó validado manualmente como ajuste visual complementario del pre-relanzamiento:

  * reintrodujo `Publicá tu local` en la navbar desktop usando la ruta canónica ya existente
  * dejó la bottom navbar mobile equilibrada para `4` ítems reales
  * mantuvo `MisEntradas` despublicada sin reintroducir `/mis-entradas`
* `F4` queda cerrada documentalmente: tras `F4 CODE 01` y `F4 CODE 01A`, `MisEntradas` ya no forma parte de la superficie pública del B2C de pre-relanzamiento; la funcionalidad queda preservada en código para una futura reintroducción ligada a login/cuenta de usuario
* El residual `/public/orders?email` + `checkin_token` no desaparece: pasa a ola posterior y deja de tratarse como bloqueo activo del pre-relanzamiento mientras `MisEntradas` siga despublicada del B2C actual
* En el runtime local observado, la Fase B del bloque mapa/popup quedó cerrada como validación runtime: `dlirio` mostró mapa/ubicación operativos sin anomalías visibles y `mckharthys-bar` cayó a `Ubicación no disponible` cuando faltó ubicación cargada
* El residual del bloque mapa/popup pasa a plano técnico/documental: `setHTML(...)` sigue existiendo como superficie por código, pero no demostró comportamiento riesgoso observable en esta corrida
* `F6 CODE 01` ya quedó implementado y validado como slice estructural/no-breaking sobre `functions/api/src/routes/panel.ts`:

  * extrajo solo el dominio **club catalog** a `functions/api/src/routes/panelCatalog.ts`
  * preservó el mount visible bajo `/panel/catalog`
  * movió exactamente las rutas CRUD de `tickets` y `tables`, sin tocar contratos visibles ni middlewares del bloque
* La validación de `F6 CODE 01` confirmó por código + runtime manual observado:

  * `typecheck` OK en `functions/api`
  * borde no autenticado intacto (`GET /panel/catalog/tickets` y `GET /panel/catalog/tables` → `401`)
  * carga manual observada de `tickets` y `tables`
  * creación manual observada de ticket OK y uso posterior sin error visible
* `F6 CODE 01` no tocó rutas sensibles fuera del dominio catálogo:

  * `GET /panel/me`, `GET/PATCH /panel/local`, gallery upload/delete
  * reservas, check-in, `orders/search`, `orders/summary`, export CSV, `calendar`
  * `panelAuth` y `requireRole(...)`
* La duplicación temporal de `verifyClubOnly` entre `panel.ts` y `panelCatalog.ts` queda aceptada como residual estructural menor del slice; no bloquea la consolidación de `F6 CODE 01`, pero `F6` sigue abierta para futuros refactors del archivo monolítico
* `F6 CODE 02` ya quedó implementado y validado como slice estructural/no-breaking sobre `functions/api/src/routes/panel.ts`:

  * extrajo solo el dominio **local profile + gallery** a `functions/api/src/routes/panelLocal.ts`
  * preservó el mount visible bajo `/panel/local`
  * movió exactamente `GET /panel/local`, `PATCH /panel/local`, `POST /panel/local/gallery/signed-upload` y `DELETE /panel/local/gallery/:id`, sin tocar contratos visibles ni middlewares del bloque
* La validación de `F6 CODE 02` confirmó por código + runtime manual observado:

  * `typecheck` OK en `functions/api`
  * borde no autenticado intacto (`GET /panel/local` y `POST /panel/local/gallery/signed-upload` → `401`)
  * carga manual observada de profile OK
  * guardado manual observado de profile OK
  * upload manual observado de gallery OK
  * delete manual observado de gallery OK
  * sin errores visibles en el flujo manual observado
* `F6 CODE 02` no tocó rutas sensibles fuera del dominio local profile + gallery:

  * `GET /panel/me`
  * reservas, check-in, `orders/:id/use`, `orders/search`, `orders/summary`, export CSV
  * `catalog`, `calendar`, `panelAuth` y `requireRole(...)`
* `GET /panel/me` queda fuera de `F6 CODE 02` como residual estructural aceptable para mantener el slice chico; no bloquea la consolidación documental del slice
* Tras reevaluar el remanente de `panel.ts`, `F6` queda **abierta pero pausada**: no corresponde abrir `F6 CODE 03` ahora porque el remanente ya está concentrado en dominios sensibles (`GET /panel/me`, reservas, órdenes, check-in y export) y no aparece otro slice pequeño, coherente y no-breaking comparable a `CODE 01` o `CODE 02`
* El siguiente paso correcto dentro de `F6` no es un CODE inmediato, sino una **reevaluación posterior del remanente de `panel.ts`** cuando cambie el mapa de riesgo o aparezca un dominio claramente aislable

---

## 10) Próxima actualización esperada

Actualizar este documento cuando ocurra al menos una de estas situaciones:

* cambie el próximo ASK activo
* cambie el próximo CODE permitido o la pausa actual de `F6`
* se destrabe o aparezca un bloqueante importante
* cambie una decisión documental/operativa relevante

---

## 11) Fecha de última actualización

**2026-03-02**

---

## 12) Regla de uso del documento

* Este documento es un tablero operativo corto.
* No reemplaza los demás docs base.
* No debe usarse para introducir verdad nueva sin evidencia.
* Si hay contradicción entre este documento y los docs base, prevalecen los docs base.
* Antes de abrir un ASK o CODE nuevo, revisar este documento junto con `HARDENING_ROADMAP.md`.



Nota importante: El backend observable usa hoy un cliente global SUPABASE_SERVICE_ROLE; cualquier diseño de F7 debe asumir bypass de RLS en backend hasta que se demuestre lo contrario por flujo real.




