# TAIRET — SMOKE_TESTS_V1

## 1) Ruta canónica

`docs/audits/SMOKE_TESTS_V1.md`

---

## 2) Propósito

Definir smoke tests mínimos para proteger los flujos críticos del MVP antes de cualquier fase CODE, separando explícitamente:

* lo que puede sostenerse desde código como baseline
* lo que requiere ejecución runtime para validarse realmente

Este documento no autoriza implementación.
Su función es definir la validación mínima previa para detectar regresiones visibles en flujos críticos.

---

## 3) Regla de fuente de verdad

1. **Código** (primario)
2. **Runtime** (solo cuando el código no alcanza)
3. **Input humano** (solo negocio, riesgo aceptado o comportamiento esperado)

Si un resultado no puede confirmarse solo desde código, su estado debe quedar como:

* **Requiere validación**

---

## 4) Alcance

Este documento cubre smoke tests mínimos para los siguientes flujos críticos:

1. Lookup público de órdenes por email
2. B2C `MisEntradas`
3. Popup de mapa
4. Login panel
5. Logout panel
6. Reservas panel
7. Check-in panel
8. Export CSV
9. Auth panel / acceso a rutas protegidas
10. Perfiles críticos B2C

Quedan fuera de alcance:

* roadmap de fixes
* cambios de arquitectura
* implementación
* decisiones de negocio nuevas
* redefinición de contratos no congelados aún

---

## 5) Smoke tests mínimos por flujo crítico

## ST-01 — Lookup público de órdenes por email

* **ID:** ST-01
* **Flujo:** API pública `/public/orders?email=...`
* **Tipo:** Mixto (Código + Runtime)
* **Precondiciones:**

  * API accesible
  * un email con órdenes para prueba
  * un email válido sin órdenes, si existe caso disponible
  * un email inválido para prueba de validación
* **Pasos:**

  1. Verificar en código que existe `GET /public/orders`, que valida `email` con Zod y que normaliza `trim().toLowerCase()`.
  2. Verificar en código que el backend selecciona `id`, `local_id`, `checkin_token`, `quantity`, `total_amount`, `currency`, `status`, `payment_method`, `used_at`, `created_at`.
  3. Verificar en código que el endpoint ordena por `created_at desc`, limita a `50` y responde `data || []` en success.
  4. Ejecutar request con email válido que tenga datos.
  5. Ejecutar request con email válido sin datos.
  6. Ejecutar request con email inválido.
  7. Si el entorno permite observar fallo backend, validar la rama `500` sin forzar cambios de código.
* **Resultado esperado:**

  * En success, la respuesta observable es un **array**.
  * Para email válido con datos, cada item mantiene el shape observable actual que hoy consume B2C.
  * Para email válido sin órdenes, la respuesta observable sigue siendo `[]`.
  * Para email inválido, la rama observable actual es `400` con `{ error: error.flatten() }`.
  * Para fallo backend, la rama observable actual es `500` con `{ error: "Failed to fetch orders" }`.
* **Regresión observable:**

  * cambio de ruta o del query param `email`
  * la respuesta success deja de ser array
  * desaparición de cualquiera de los campos hoy usados por `MisEntradas`
  * shape incompatible con `getOrdersByEmail()` / `MisEntradas`
* **Evidencia base de código:**

  * `functions/api/src/routes/public.ts:163`
  * `functions/api/src/routes/public.ts:289`
  * `functions/api/src/routes/public.ts:291`
  * `functions/api/src/routes/public.ts:292`
  * `functions/api/src/routes/public.ts:296`
  * `functions/api/src/routes/public.ts:298`
  * `functions/api/src/routes/public.ts:299`
  * `functions/api/src/routes/public.ts:303`
  * `functions/api/src/routes/public.ts:306`
* **Estado:** Requiere validación

---

## ST-02 — B2C `MisEntradas`

* **ID:** ST-02
* **Flujo:** recuperación de entradas por email en frontend B2C
* **Tipo:** Mixto (Código + Runtime)
* **Precondiciones:**

  * B2C accesible
  * API pública accesible
  * un email válido con órdenes para prueba
* **Pasos:**

  1. Verificar en código que `getOrdersByEmail()` consume `/public/orders?email` y devuelve `response.json()` directo cuando `response.ok`.
  2. Verificar en código que `MisEntradas` usa `id`, `checkin_token`, `quantity`, `created_at`, `total_amount`, `currency`, `status`, `payment_method` y `used_at`.
  3. En UI `MisEntradas`, buscar con email válido con órdenes.
  4. Verificar que la lista renderiza sin romperse y que cada item mantiene el comportamiento observable actual.
  5. Abrir modal o vista de entrada y validar QR, token visible y copy.
  6. Probar email válido sin órdenes para verificar estado vacío sin romper contrato observable.
* **Resultado esperado:**

  * La búsqueda dispara el consumo del endpoint público sin transformación intermedia del payload.
  * La lista mantiene el comportamiento observable actual usando los campos hoy leídos por `MisEntradas`.
  * El modal mantiene QR, token visible y acción de copia.
  * La respuesta vacía sigue resolviendo estado vacío sin romper la pantalla.
  * `local_id` puede seguir presente en el payload, pero no es requisito observable directo de esta pantalla.
* **Regresión observable:**

  * la búsqueda deja de poblar `orders` con un array usable
  * se rompe el render por ausencia/cambio de alguno de los campos usados por la pantalla
  * no aparece QR o no aparece token donde hoy el flujo lo expone
  * se rompe la vista vacía para emails sin órdenes
* **Evidencia base de código:**

  * `apps/web-b2c/src/lib/orders.ts:20`
  * `apps/web-b2c/src/lib/orders.ts:22`
  * `apps/web-b2c/src/lib/orders.ts:36`
  * `apps/web-b2c/src/pages/MisEntradas.tsx:43`
  * `apps/web-b2c/src/pages/MisEntradas.tsx:156`
  * `apps/web-b2c/src/pages/MisEntradas.tsx:165`
  * `apps/web-b2c/src/pages/MisEntradas.tsx:168`
  * `apps/web-b2c/src/pages/MisEntradas.tsx:174`
  * `apps/web-b2c/src/pages/MisEntradas.tsx:178`
  * `apps/web-b2c/src/pages/MisEntradas.tsx:183`
  * `apps/web-b2c/src/pages/MisEntradas.tsx:227`
  * `apps/web-b2c/src/pages/MisEntradas.tsx:241`
  * `apps/web-b2c/src/pages/MisEntradas.tsx:253`
  * `apps/web-b2c/src/pages/MisEntradas.tsx:258`
  * `apps/web-b2c/src/pages/MisEntradas.tsx:275`
* **Estado:** Requiere validación

---

## ST-03 — Popup de mapa

* **ID:** ST-03
* **Flujo:** render del popup en `MapSection`
* **Tipo:** Mixto (Código + Runtime)
* **Precondiciones:**

  * un perfil B2C con ubicación cargada
  * un perfil B2C sin ubicación cargada o sin mapa operativo
  * configuración del mapa operativa en el entorno de prueba cuando exista ubicación
* **Pasos:**

  1. Verificar en código el uso de `setHTML(...)`.
  2. Abrir un club con ubicación cargada y verificar que el bloque de ubicación renderiza mapa, marcador y controles básicos operativos.
  3. Verificar visualmente que la ubicación se ve correctamente y que no hay HTML roto, texto mal renderizado ni comportamiento anómalo visible.
  4. Abrir un bar sin ubicación cargada y verificar fallback `Ubicación no disponible`.
  5. Dejar explícito el residual técnico/documental: `setHTML(...)` sigue existiendo, pero en esta corrida no demostró comportamiento riesgoso observable.
* **Resultado esperado:**

  * Con ubicación cargada, el bloque de mapa/ubicación funciona de forma visible y consistente.
  * Sin ubicación cargada, el bloque cae a `Ubicación no disponible`.
  * En el runtime local observado no se detectan anomalías visibles del popup/bloque de ubicación.
* **Regresión observable:**

  * el mapa no renderiza cuando hay ubicación cargada
  * el bloque no cae a `Ubicación no disponible` cuando falta ubicación
  * contenido roto, texto mal renderizado o comportamiento visual anómalo
  * errores visibles al arrastrar o hacer zoom en el mapa observado
* **Evidencia base de código:**

  * `apps/web-b2c/src/components/shared/MapSection.tsx:343`
  * `apps/web-b2c/src/components/shared/MapSection.tsx:385`
  * `apps/web-b2c/src/components/shared/MapSection.tsx:389`
  * `apps/web-b2c/src/pages/BarProfile.tsx:331`
  * `apps/web-b2c/src/pages/BarProfile.tsx:333`
  * `apps/web-b2c/src/pages/ClubProfile.tsx:423`
  * `apps/web-b2c/src/pages/ClubProfile.tsx:425`
 * **Estado:** Confirmado por runtime local observado; residual técnico/documental no bloqueante

---

## ST-04 — Login panel

* **ID:** ST-04
* **Flujo:** sesión panel para acceder a rutas protegidas
* **Tipo:** Mixto (Código + Runtime)
* **Precondiciones:**

  * usuario panel válido
  * credenciales/sesión válidas según el flujo actual
* **Pasos:**

  1. Verificar en código que frontend arma `Authorization` desde sesión.
  2. Verificar en código que backend exige Bearer, valida usuario panel y protege las rutas del bloque de reservas.
  3. Probar login real y acceso a pantalla autenticada del panel.
* **Resultado esperado:**

  * Con sesión válida, las rutas protegidas del panel responden según el comportamiento actual esperado.
  * Sin sesión/token válido, el acceso debe ser rechazado de forma consistente.
* **Regresión observable:**

  * login aparentemente exitoso pero rutas protegidas fallan sistemáticamente
  * acceso a panel sin autenticación válida
* **Evidencia base de código:**

  * `apps/web-next/lib/api.ts:22`
  * `apps/web-next/lib/api.ts:39`
  * `functions/api/src/routes/reservations.ts:161`
  * `functions/api/src/routes/panel.ts:1107`
  * `functions/api/src/middlewares/panelAuth.ts:65`
  * `functions/api/src/middlewares/panelAuth.ts:86`
  * `functions/api/src/middlewares/panelAuth.ts:101`
* **Estado:** Requiere validación

---

## ST-05 — Logout panel

* **ID:** ST-05
* **Flujo:** cierre de sesión en panel
* **Tipo:** Mixto (Código + Runtime)
* **Precondiciones:**

  * sesión panel activa
* **Pasos:**

  1. Verificar en código que el logout limpia `panel_token` y redirige a `/panel/login`.
  2. Ejecutar logout desde UI.
  3. Verificar que la app redirige a `/panel/login`.
  4. Ejecutar `back` y observar si reaparece contenido protegido o no.
  5. Hacer refresh en una ruta protegida previamente abierta.
  6. Navegar de nuevo a `/panel`.
  7. Confirmar si una request autenticada posterior sigue funcionando o no.
  8. Separar el resultado entre logout visible y invalidación efectiva de sesión.
* **Resultado esperado:**

  * Desde código, el comportamiento visible confirmado es limpieza de cookie + redirección a `/panel/login`.
  * En el runtime local observado, el logout visible redirige a login pero no invalida la sesión Auth: `back` no restaura de inmediato el dashboard visible, pero refresh en `/panel`, nueva navegación a `/panel` y una request autenticada posterior siguen recuperando acceso.
  * Fuera de ese runtime local observado, la reproducción del hallazgo sigue sujeta a validación adicional.
* **Regresión observable:**

  * deja de limpiarse la cookie observada
  * deja de existir la redirección visible a `/panel/login`
  * cambia el comportamiento observable actual entre login visible y sesión todavía utilizable sin soporte documental/QA previo
* **Evidencia base de código:**

  * `apps/web-next/components/panel/SidebarUserInfo.tsx:13`
  * `apps/web-next/components/panel/SidebarUserInfo.tsx:15`
  * `apps/web-next/components/panel/SidebarUserInfo.tsx:16`
  * `apps/web-next/lib/api.ts:22`
  * `apps/web-next/app/panel/(authenticated)/page.tsx:307`
  * `functions/api/src/middlewares/panelAuth.ts:86`
* **Estado:** Confirmado por runtime local observado

---

## ST-06 — Reservas panel

* **ID:** ST-06
* **Flujo:** carga date-scoped, filtros remanentes en cliente y comportamiento visible de la vista de reservas
* **Tipo:** Mixto (Código + Runtime)
* **Precondiciones:**

  * usuario panel autenticado
  * datos de reservas existentes
* **Pasos:**

  1. Verificar en código que la página de reservas usa `getPanelReservationsByLocalIdAndDate(localId, date)` y que el backend acepta `date=YYYY-MM-DD` opcional en `GET /locals/:id/reservations`.
  2. Verificar en código que, cuando `date` no viene, el endpoint conserva el contrato legacy con `order("created_at", { ascending: false })` y `.limit(20)`.
  3. Verificar en código que `getPanelReservationsByLocalId()` sigue intacto y que lineup continúa consumiendo el helper legacy.
  4. En runtime manual observado, abrir la página con `date=2026-01-28` y confirmar que aparecen las `2` reservas reales del día.
  5. Confirmar en runtime manual observado que el caso visible del día incluye una reserva `confirmed` y otra `en_revision` / pendiente.
  6. Ejecutar `refresh` y confirmar que la fecha seleccionada se preserva y el dataset recarga en modo date-scoped.
  7. Ejecutar `cancel` sobre una reserva del día y confirmar que la recarga preserva el contexto del mismo día seleccionado.
  8. Guardar `table_note` y confirmar que el contexto del día seleccionado se preserva.
  9. Verificar en código que búsqueda y status siguen siendo filtros locales sobre el dataset date-scoped ya cargado.
  10. Verificar en código que export sigue visible y que la feature se mantiene bloqueada para `club`.
* **Resultado esperado:**

  * La página de reservas observada usa carga date-scoped y deja de depender del subset legacy de `20` para el día seleccionado.
  * En el runtime manual observado para `date=2026-01-28`, aparecen las `2` reservas reales del día que antes quedaban ocultas.
  * `refresh`, `cancel` y guardado de `table_note` preservan el contexto del día seleccionado en el caso manual observado.
  * Búsqueda y status siguen operando localmente sobre el dataset date-scoped ya cargado.
  * El modo legacy sin `date` permanece intacto para otros consumidores.
  * Lineup sigue usando el helper legacy sin cambios.
  * Export permanece visible y `club` sigue bloqueado.
* **Regresión observable:**

  * la página de reservas vuelve a depender del subset legacy de `20` para el día seleccionado
  * el modo legacy sin `date` cambia de comportamiento para otros consumidores
  * lineup deja de usar el helper legacy o cambia sin transición controlada
  * el caso manual observado de `date=2026-01-28` vuelve a ocultar reservas reales del día
  * `refresh`, `cancel` o `table_note` pierden el contexto del día seleccionado
  * se rompe el bloqueo para `club` o desaparece el export visible
* **Evidencia base de código:**

  * `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:8`
  * `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:84`
  * `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:92`
  * `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:161`
  * `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:166`
  * `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:212`
  * `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:222`
  * `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:247`
  * `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:301`
  * `apps/web-next/lib/reservations.ts:54`
  * `apps/web-next/lib/reservations.ts:60`
  * `functions/api/src/routes/reservations.ts:250`
  * `functions/api/src/routes/reservations.ts:259`
  * `functions/api/src/routes/reservations.ts:282`
  * `functions/api/src/routes/reservations.ts:289`
  * `functions/api/src/routes/reservations.ts:296`
  * `apps/web-next/components/panel/views/lineup/LineupCalendarView.tsx:459`
* **Estado:** Confirmado por código + runtime manual observado

---

## ST-07 — Check-in panel

* **ID:** ST-07
* **Flujo:** check-in por token en panel
* **Tipo:** Mixto (Código + Runtime)
* **Precondiciones:**

  * usuario panel autenticado con rol permitido según flujo actual
  * local `club` en el que la feature no quede bloqueada
  * casos/tokens representativos para cobertura manual y scanner
* **Pasos:**

  1. Verificar en código que la ruta observable actual es `PATCH /panel/checkin/:token`.
  2. Verificar en código que el request actual envía el token en el path, sin body observable.
  3. Verificar en código el mapping frontend actual de ramas `success`, `already_used`, `window_invalid`, `invalid_token`, `forbidden`, `error`.
  4. Verificar en código que la feature queda bloqueada para locales `bar`.
  5. Confirmar cobertura manual ya observada para `invalid_token`, `already_used`, `forbidden` y `window_invalid/expired`.
  6. Confirmar cobertura scanner ya observada para `success`, `not_yet_valid`, `already_used` y `otro local`.
  7. Verificar que la combinación manual + scanner cubre el wiring principal del bloque en el runtime local observado.
  8. Dejar explícito el residual menor: `scanner + expired` no observado directamente en esta corrida.
* **Resultado esperado:**

  * La cobertura manual confirma `invalid_token`, `already_used`, `forbidden` y `window_invalid/expired`.
  * La cobertura scanner confirma `success`, `not_yet_valid`, `already_used` y `otro local`.
  * En el runtime local observado, la cobertura combinada manual + scanner permite dar Fase A por cerrada.
  * El residual menor no bloqueante queda limitado a `scanner + expired` no observado directamente en esta corrida.
  * Para locales `bar`, la feature permanece bloqueada.
* **Regresión observable:**

  * request distinto a `PATCH /panel/checkin/:token` en manual o scanner
  * clasificación inconsistente de `404`, `403` o `409`
  * pérdida del mapping visible actual para `Check-in Exitoso`, `QR inválido`, `Ya Usado`, `Token de Otro Local` o `Fuera de ventana`
  * pérdida de coherencia entre cobertura manual y scanner
  * se rompe el bloqueo visible para `bar`
* **Evidencia base de código:**

  * `functions/api/src/routes/panel.ts:1355`
  * `functions/api/src/routes/panel.ts:1374`
  * `functions/api/src/routes/panel.ts:1398`
  * `functions/api/src/routes/panel.ts:1421`
  * `functions/api/src/routes/panel.ts:1424`
  * `functions/api/src/routes/panel.ts:1434`
  * `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:529`
  * `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:554`
  * `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:556`
  * `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:566`
  * `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:578`
  * `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:583`
  * `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:585`
  * `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:874`
 * **Estado:** Confirmado por runtime local observado con cobertura combinada; residual menor pendiente

---

## ST-08 — Export CSV

* **ID:** ST-08
* **Flujo:** descarga CSV en panel
* **Tipo:** Mixto (Código + Runtime)
* **Precondiciones:**

  * usuario panel autenticado con permisos del flujo actual
  * rango de fechas válido para prueba
* **Pasos:**

  1. Verificar en código que la ruta observable actual es `GET /panel/exports/reservations-clients.csv?from=YYYY-MM-DD&to=YYYY-MM-DD`.
  2. Verificar en código la validación visible de rango (`YYYY-MM-DD`, `from <= to`, máximo `366` días).
  3. Verificar en código headers/filename backend y fallback frontend del nombre de archivo.
  4. Verificar en código los dos consumidores confirmados del helper de export.
  5. Ejecutar export runtime válido desde el consumidor de reservas y registrar request, status, headers de red y filename final descargado.
  6. Ejecutar export runtime válido desde el consumidor de orders y registrar request, status, headers de red y filename final descargado.
  7. Comparar el filename backend enviado por `Content-Disposition` con el filename final usado por la descarga.
  8. Ejecutar export runtime con rango inválido y documentar status, `Content-Type` y error visible en UI.
  9. Si el entorno lo permite, observar el comportamiento visible ante `500`; si no es reproducible, dejarlo explícitamente pendiente.
* **Resultado esperado:**

  * En el runtime local observado, el export funciona desde reservas y desde orders.
  * En ambos casos, la response de red incluye `Content-Type: text/csv; charset=utf-8`, `Content-Disposition` y `Cache-Control: no-store`.
  * En el runtime local observado, el filename final descargado usa el fallback frontend `tairet_reservas_clientes_<from>_a_<to>.csv`, aunque backend envíe un filename más específico por `Content-Disposition`.
  * En el runtime local observado, el rango inválido devuelve `400` JSON y el frontend muestra error visible.
  * La validación de `500`, datasets grandes y otros entornos/navegadores sigue pendiente.
* **Regresión observable:**

  * no descarga
  * descarga rota o inconsistente entre reservas y orders
  * desaparecen los headers hoy observables en red sin soporte documental previo
  * cambia sin control la relación entre filename backend enviado y filename final descargado
  * respuesta sin manejo visible de error cuando corresponde
  * se rompe alguno de los consumidores confirmados del helper
* **Evidencia base de código:**

  * `functions/api/src/routes/panel.ts:1767`
  * `functions/api/src/routes/panel.ts:1773`
  * `functions/api/src/routes/panel.ts:1859`
  * `functions/api/src/routes/panel.ts:1862`
  * `functions/api/src/routes/panel.ts:1991`
  * `functions/api/src/routes/panel.ts:1994`
  * `apps/web-next/lib/panelExport.ts:58`
  * `apps/web-next/lib/panelExport.ts:61`
  * `apps/web-next/lib/panelExport.ts:78`
  * `apps/web-next/lib/panelExport.ts:79`
  * `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:151`
  * `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx:265`
* **Estado:** Confirmado por runtime local observado

---

## ST-09 — Auth panel / acceso a rutas protegidas

* **ID:** ST-09
* **Flujo:** enforcement de autenticación/autorización en rutas panel críticas
* **Tipo:** Mixto (Código + Runtime)
* **Precondiciones:**

  * casos de prueba con token válido, inválido y ausencia de token
* **Pasos:**

  1. Verificar en código que `GET /locals/:id/reservations` y `PATCH /panel/reservations/:id` usan `panelAuth` y tenant checks.
  2. Verificar en código que `PATCH /panel/checkin/:token` y `GET /panel/exports/reservations-clients.csv` usan `panelAuth + requireRole(["owner","staff"])`.
  3. Tomar `GET /panel/checkins` como ruta relacionada observada, sin asumir todavía que entra en el mismo no-breaking del bloque.
  4. Probar runtime sin token.
  5. Probar runtime con token inválido.
  6. Probar runtime con token válido y rol permitido.
* **Resultado esperado:**

  * Las rutas protegidas no quedan públicas.
  * El acceso responde de forma consistente con el mecanismo auth/tenant/rol actualmente observado.
* **Regresión observable:**

  * acceso sin auth en rutas panel críticas
  * acceso denegado incorrectamente en casos válidos
  * cambios no controlados entre rutas con y sin `requireRole(...)`
* **Evidencia base de código:**

  * `functions/api/src/routes/reservations.ts:161`
  * `functions/api/src/routes/reservations.ts:174`
  * `functions/api/src/routes/panel.ts:1063`
  * `functions/api/src/routes/panel.ts:1107`
  * `functions/api/src/routes/panel.ts:1137`
  * `functions/api/src/routes/panel.ts:1355`
  * `functions/api/src/routes/panel.ts:1460`
  * `functions/api/src/routes/panel.ts:1767`
  * `functions/api/src/middlewares/panelAuth.ts:65`
  * `functions/api/src/middlewares/panelAuth.ts:114`
* **Estado:** Requiere validación

---

## ST-10 — Perfiles críticos B2C

* **ID:** ST-10
* **Flujo:** rutas y comportamiento observable de perfiles bar/club/evento
* **Tipo:** Mixto (Código + Runtime)
* **Precondiciones:**

  * B2C accesible
  * slugs/eventos de prueba disponibles
* **Pasos:**

  1. Verificar en código las rutas críticas del flujo.
  2. Verificar en código la dependencia o fallback actual en perfiles bar/club.
  3. Verificar en código el comportamiento observable actual de `EventProfile`.
  4. Ejecutar navegación runtime sobre bar, club y evento.
* **Resultado esperado:**

  * Los perfiles cargan según el baseline actual.
  * `EventProfile` conserva el comportamiento actualmente observado en código, sin asumir más de lo que ya esté congelado.
* **Regresión observable:**

  * rutas de perfil rotas
  * ausencia de contenido visible por cambios no controlados
  * comportamiento distinto del baseline actual sin transición explícita
* **Evidencia base de código:**

  * `apps/web-b2c/src/App.tsx:68`
  * `apps/web-b2c/src/App.tsx:69`
  * `apps/web-b2c/src/pages/BarProfile.tsx:77`
  * `apps/web-b2c/src/pages/ClubProfile.tsx:80`
  * `apps/web-b2c/src/pages/EventProfile.tsx:229`
  * `apps/web-b2c/src/pages/EventProfile.tsx:236`
* **Estado:** Requiere validación

---

## 6) Criterio de salida del documento

## Etapa ST-0 — Definición documental (ASK)

* [ ] Los 10 smoke tests están definidos con ID, precondiciones, pasos y regresión observable.
* [ ] Cada smoke incluye evidencia por archivo/línea.
* [ ] No hay afirmaciones runtime marcadas como confirmadas sin ejecución.
* [ ] El documento se mantiene alineado con:

  * `docs/audits/CONTRATOS_CONGELADOS_V1.md`
  * `docs/audits/BASELINE_FUNCIONAL_V1.md`
  * `docs/audits/MATRIZ_VALIDACION_PREVIA_V1.md`

## Etapa ST-1 — Ejecución runtime mínima (pre-CODE)

* [ ] Se ejecutan los smoke tests aplicables en entorno de prueba.
* [ ] Cada smoke registra resultado: `PASS`, `FAIL` o `BLOQUEADO`.
* [ ] Todo `FAIL` deja documentada una regresión observable concreta.
* [ ] Todo `BLOQUEADO` deja documentada la causa.

## Etapa ST-2 — Gate de entrada a CODE

* [ ] Ningún flujo crítico queda sin smoke ejecutado o sin justificación explícita.
* [ ] Los flujos críticos sensibles no presentan regresión bloqueante sin triage previo.
* [ ] Los pendientes no bloqueantes siguen marcados como `Requiere validación` o quedan registrados fuera de este documento según corresponda.

---

## 7) Casos que requieren validación runtime

Por definición de este documento, todos los smoke tests con comportamiento observable en entorno real requieren validación runtime.

Especialmente sensibles:

* **ST-05** — efectividad real del logout
* **ST-06** — severidad residual del modo legacy sin `date` y cobertura fuera del caso manual observado
* **ST-07** — residual menor del check-in (`scanner + expired` no observado directamente en esta corrida)
* **ST-08** — descarga CSV real, filename efectivo y manejo de errores residuales
* **ST-09** — enforcement real de autenticación/autorización

Contexto base útil para el triage posterior:

* `functions/api/src/middlewares/requestId.ts:9`
* `functions/api/src/middlewares/requestId.ts:11`
* `functions/api/src/middlewares/error.ts:17`
* `apps/web-next/lib/sentry.ts:1`
* `apps/web-next/app/panel/(authenticated)/metrics/page.tsx:11`

---

## 8) Regla de uso del documento

1. Este documento no autoriza implementación; solo define validación mínima previa.
2. Un smoke sostenido por código no implica que funcione en runtime.
3. No marcar `PASS` sin evidencia de ejecución.
4. Si un smoke falla, debe quedar explícito si bloquea o no el CODE del flujo afectado.
5. Este documento debe mantenerse alineado con:

   * `docs/audits/CONTRATOS_CONGELADOS_V1.md`
   * `docs/audits/BASELINE_FUNCIONAL_V1.md`
   * `docs/audits/MATRIZ_VALIDACION_PREVIA_V1.md`
