# TAIRET — Contratos congelados (v1)

## 0. Propósito

Este documento congela únicamente los contratos y comportamientos **confirmados en código** durante la fase ASK actual.

### Regla de fuente de verdad

El orden de verdad operativa para este documento es:

1. **Código**
2. **Runtime**, solo si el código no alcanza
3. **Input humano**, solo para:

   * negocio
   * riesgo aceptado
   * comportamiento esperado

No se usa documentación vieja como fuente primaria.

---

## 1. Regla de no-breaking

Mientras este documento esté vigente:

* no se rompen rutas ni payloads confirmados en fases tempranas
* no se mezclan cambios estructurales con hardening sensible
* todo lo no confirmado queda marcado como **Requiere validación**
* cualquier cambio futuro debe contrastarse contra este documento antes de pasar a CODE

---

## 2. Alcance congelado en v1

En esta versión se congelan únicamente los contratos/comportamientos que ya están confirmados en código:

* `GET /public/orders?email=...`
* consumo B2C de órdenes públicas
* comportamiento actual de `MisEntradas`
* comportamiento visible actual del popup de mapa
* comportamiento actual de reservas panel
* auth panel actual
* logout panel observado en código
* inconsistencia actual de `/panel/metrics`

Los contratos completos de:

* check-in
* export CSV
* reservas panel (payload exacto)
* órdenes públicas (payload exacto completo)
* perfiles B2C
  quedan fuera de esta v1 y pasan a **Requiere validación**.

---

## 3. Contratos congelados

### CF-01 — `GET /public/orders?email=...`

**Estado:** Congelado v1
**Fuente primaria:** Código

| Campo                           | Valor congelado                                                                                                                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ruta confirmada                 | `GET /public/orders?email=...`                                                                                                                                                                                         |
| Validación confirmada           | `email` validado con `z.string().email()`                                                                                                                                                                              |
| Parseo / normalización          | `parse(req.query)` + `trim().toLowerCase()`                                                                                                                                                                            |
| Query confirmada                | `.eq("customer_email_lower", emailLower)`                                                                                                                                                                              |
| Orden / límite confirmados      | `.order("created_at", { ascending: false })` + `.limit(50)`                                                                                                                                                            |
| Respuesta success observable    | `res.status(200).json(data || [])`                                                                                                                                                                                     |
| Errores observables             | `400` con `{ error: error.flatten() }` si falla Zod; `500` con `{ error: "Failed to fetch orders" }` si falla Supabase                                                                                               |
| Autenticación observable        | En el archivo observado (`public.ts`), la ruta no muestra middleware de auth aplicado y se registra como flujo público dentro de ese router.                                                                          |
| Payload observable actual       | `id`, `local_id`, `checkin_token`, `quantity`, `total_amount`, `currency`, `status`, `payment_method`, `used_at`, `created_at`                                                                                      |
| Evidencia                       | `functions/api/src/routes/public.ts:163`, `functions/api/src/routes/public.ts:289`, `functions/api/src/routes/public.ts:291`, `functions/api/src/routes/public.ts:292`, `functions/api/src/routes/public.ts:296` |
| Evidencia adicional             | `functions/api/src/routes/public.ts:297`, `functions/api/src/routes/public.ts:298`, `functions/api/src/routes/public.ts:299`, `functions/api/src/routes/public.ts:303`, `functions/api/src/routes/public.ts:306` |
| Consumidor confirmado           | `apps/web-b2c/src/lib/orders.ts`                                                                                                                                                                                       |
| Evidencia consumidor            | `apps/web-b2c/src/lib/orders.ts:20`, `apps/web-b2c/src/lib/orders.ts:22`, `apps/web-b2c/src/lib/orders.ts:36`                                                                                                       |
| Qué no se puede romper          | ruta, query param `email`, validación backend visible, respuesta success como array y payload compatible con `MisEntradas`                                                                                            |
| Regresión mínima                | `getOrdersByEmail()` deja de resolver un array usable para `MisEntradas`                                                                                                                                               |

**Requiere validación**

* dominio runtime real de `status`
* nulabilidad real de `checkin_token`, `currency`, `total_amount`, `created_at` y `used_at`
* shape runtime exacta de los items devueltos fuera de las ramas observables en código
* comportamiento real con más de `50` órdenes por email
* consumidores adicionales relevantes del contrato fuera de `getOrdersByEmail()`

---

### CF-02 — B2C `MisEntradas`

**Estado:** Congelado parcial v1
**Fuente primaria:** Código

| Campo                              | Valor congelado                                                                                                                                                                                                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pantalla confirmada                | `apps/web-b2c/src/pages/MisEntradas.tsx`                                                                                                                                                                                                                                                        |
| Dependencia confirmada             | `MisEntradas` consume `getOrdersByEmail()` y recibe el JSON del backend sin adaptación intermedia                                                                                                                                                                                              |
| Evidencia de dependencia           | `apps/web-b2c/src/pages/MisEntradas.tsx:43`, `apps/web-b2c/src/lib/orders.ts:20`, `apps/web-b2c/src/lib/orders.ts:36`                                                                                                                                                                         |
| Comportamiento confirmado          | busca por email, lista órdenes, abre modal y renderiza QR / muestra / copia `checkin_token`                                                                                                                                                                                                    |
| Evidencia de comportamiento        | `apps/web-b2c/src/pages/MisEntradas.tsx:43`, `apps/web-b2c/src/pages/MisEntradas.tsx:156`, `apps/web-b2c/src/pages/MisEntradas.tsx:227`, `apps/web-b2c/src/pages/MisEntradas.tsx:253`, `apps/web-b2c/src/pages/MisEntradas.tsx:258`                                                      |
| Campos realmente usados            | `id`, `checkin_token`, `quantity`, `created_at`, `total_amount`, `currency`, `status`, `payment_method`, `used_at`                                                                                                                                                                            |
| Evidencia campos usados            | `apps/web-b2c/src/pages/MisEntradas.tsx:156`, `apps/web-b2c/src/pages/MisEntradas.tsx:165`, `apps/web-b2c/src/pages/MisEntradas.tsx:168`, `apps/web-b2c/src/pages/MisEntradas.tsx:174`, `apps/web-b2c/src/pages/MisEntradas.tsx:178`, `apps/web-b2c/src/pages/MisEntradas.tsx:183` |
| Evidencia campos usados (modal)    | `apps/web-b2c/src/pages/MisEntradas.tsx:227`, `apps/web-b2c/src/pages/MisEntradas.tsx:237`, `apps/web-b2c/src/pages/MisEntradas.tsx:241`, `apps/web-b2c/src/pages/MisEntradas.tsx:243`, `apps/web-b2c/src/pages/MisEntradas.tsx:253`, `apps/web-b2c/src/pages/MisEntradas.tsx:275` |
| Campo presente no observado en uso | `local_id` está tipado en `Order` y viene del backend, pero no se observó uso directo en `MisEntradas`                                                                                                                                                                                        |
| Evidencia `local_id`               | `apps/web-b2c/src/lib/orders.ts:6`, `functions/api/src/routes/public.ts:296`                                                                                                                                                                                                                   |
| Qué no se puede romper             | recuperación por email, respuesta como array y disponibilidad de los campos usados actualmente por `MisEntradas`                                                                                                                                                                               |
| Regresión mínima                   | el usuario deja de recuperar/ver su entrada, deja de ver QR/token o se rompe el render de lista/modal                                                                                                                                                                                          |

**Requiere validación**

* si `checkin_token` puede faltar o llegar vacío en datos reales
* dominio runtime exacto de `status` y shape real de valores mostrados por la pantalla
* comportamiento real con emails sin órdenes, errores backend y datasets extensos
* si el token debe seguir visible/copiable o solo existir internamente (definición de negocio)

---

### CF-03 — Reservas panel

**Estado:** Congelado parcial v1
**Fuente primaria:** Código

| Campo                                      | Valor congelado                                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vista observada                            | `apps/web-next/app/panel/(authenticated)/reservations/page.tsx`                                                                                                                                                                                                                                       |
| Ruta real de carga                         | `GET /locals/:id/reservations`                                                                                                                                                                                                                                                                        |
| Ruta real de update                        | `PATCH /panel/reservations/:id`                                                                                                                                                                                                                                                                       |
| Rutas relacionadas del bloque              | `GET /panel/exports/reservations-clients.csv?from=...&to=...` visible en la vista; `GET /panel/reservations/search?q=...` existe pero la vista actual no la usa; `PATCH /reservations/:id` devuelve `410 Deprecated` y no tiene consumidor observado en esta vista                              |
| Shape observable de carga                  | `id`, `local_id`, `name`, `last_name`, `email`, `phone`, `date`, `guests`, `status`, `notes`, `table_note`, `created_at`, `updated_at`                                                                                                                                                            |
| Campos usados por la vista actual         | `id`, `name`, `last_name`, `email`, `phone`, `date`, `guests`, `status`, `notes`, `table_note`                                                                                                                                                                                                       |
| Campos presentes no observados en esa vista | `local_id`, `created_at`, `updated_at`                                                                                                                                                                                                                                                                |
| Filtros / acciones visibles                | fecha por query param y estado local; filtro local por fecha, búsqueda y `status`; sort por hora o nombre; refresh manual; confirm/cancel; edición de `table_note`; export CSV visible; bloqueo para `club`; empty state si no hay fecha seleccionada                                            |
| Restricciones backend observables          | orden por `created_at desc`, `.limit(20)`, `401` sin `panelUser`, `400` sin `id`, `403` por tenant mismatch, `data || []` en success                                                                                                                                                               |
| Restricciones update observables           | schema con `status?: "confirmed" \| "cancelled"`, `table_note?: string \| null`, `cancel_reason?: string`; `404` si no existe; `403` si tenant no coincide; solo cambia `status` si la reserva está en `en_revision`; `400` si no hay cambios reales; devuelve registro actualizado y dispara email fire-and-forget |
| Consumidor confirmado adicional            | `getPanelReservationsByLocalId()` también se usa en `LineupCalendarView.tsx`                                                                                                                                                                                                                          |
| Evidencia principal                        | `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:93`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:165`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:220`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:266`             |
| Evidencia backend                          | `functions/api/src/routes/reservations.ts:161`, `functions/api/src/routes/reservations.ts:181`, `functions/api/src/routes/reservations.ts:184`, `functions/api/src/routes/reservations.ts:185`, `functions/api/src/routes/panel.ts:1107`, `functions/api/src/routes/panel.ts:1184`           |
| Evidencia rutas relacionadas               | `functions/api/src/routes/panel.ts:1063`, `functions/api/src/routes/panel.ts:1767`, `functions/api/src/routes/reservations.ts:151`, `apps/web-next/lib/reservations.ts:64`, `apps/web-next/lib/reservations.ts:77`, `apps/web-next/components/panel/views/lineup/LineupCalendarView.tsx:459` |
| Qué no se puede romper                     | para **la vista actual observada de reservas panel**, la carga autenticada, el render de campos usados, los filtros/acciones visibles y el bloqueo para `club`                                                                                                                                      |
| Regresión mínima                           | la vista actual deja de cargar, mostrar o operar reservas con el comportamiento visible hoy esperado                                                                                                                                                                                                  |

**Requiere validación**

* impacto real del `.limit(20)`
* suficiencia del filtro local por fecha sobre un subset backend
* si `LineupCalendarView` debe entrar en el mismo no-breaking contractual de este GET
* si la ausencia de `requireRole(...)` en load/update es intencional y suficiente
* integración o descarte contractual de la ruta `/panel/reservations/search`
* desalineación observable de `table_note` (contador `500`, `maxLength={2000}`, backend sin `max` observable)
* uso real o descarte definitivo del helper legacy `updateReservationStatus()`

---

### CF-04 — Popup de mapa B2C

**Estado:** Congelado parcial v1
**Fuente primaria:** Código

| Campo                     | Valor congelado                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comportamiento confirmado | popup usa `setHTML(...)` con contenido interpolado                                                                                                                        |
| Evidencia                 | `apps/web-b2c/src/components/shared/MapSection.tsx:343`, `apps/web-b2c/src/components/shared/MapSection.tsx:389`, `apps/web-b2c/src/components/shared/MapSection.tsx:395` |
| Qué no se puede romper    | render visual e información visible del popup                                                                                                                             |
| Regresión mínima          | popup deja de renderizar o pierde información útil                                                                                                                        |

**Requiere validación**

* origen real de `venue/address/location`
* si esos datos pueden venir de input editable
* si el riesgo XSS es explotable o solo potencial

---

### CF-05 — Auth panel

**Estado:** Congelado parcial v1
**Fuente primaria:** Código

| Campo                              | Valor congelado                                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mecanismo cliente confirmado       | frontend arma `Authorization: Bearer` desde `supabase.auth.getSession()`                                                                                                       |
| Verificación backend confirmada    | `panelAuth` exige Bearer, valida con `supabase.auth.getUser()` y resuelve `panel_users`                                                                                        |
| Cobertura auth observada en carga  | `GET /locals/:id/reservations` usa `panelAuth` + tenant check por `localId`; no muestra `requireRole(...)`                                                                    |
| Cobertura auth observada en update | `PATCH /panel/reservations/:id` usa `panelAuth` + tenant check por `reservation.local_id`; no muestra `requireRole(...)`                                                      |
| Cobertura auth observada adicional | `GET /panel/reservations/search` y `GET /panel/exports/reservations-clients.csv` usan `panelAuth + requireRole(["owner","staff"])`                                            |
| Evidencia cliente                  | `apps/web-next/lib/api.ts:22`, `apps/web-next/lib/api.ts:39`, `apps/web-next/lib/api.ts:120`, `apps/web-next/lib/api.ts:153`                                                 |
| Evidencia backend                  | `functions/api/src/middlewares/panelAuth.ts:63`, `functions/api/src/middlewares/panelAuth.ts:86`, `functions/api/src/middlewares/panelAuth.ts:101`, `functions/api/src/routes/reservations.ts:161`, `functions/api/src/routes/panel.ts:1107`, `functions/api/src/routes/panel.ts:1767` |
| Qué no se puede romper             | acceso autenticado actual del bloque de reservas, tenant checks observados y envío de Bearer desde frontend                                                                    |
| Regresión mínima                   | la vista de reservas o sus acciones visibles pierden acceso autenticado válido o dejan de respetar el tenant observado                                                         |

**Requiere validación**

* suficiencia/intencionalidad de la ausencia de `requireRole(...)` en load/update de reservas
* cobertura exacta de rutas protegidas fuera del bloque observado
* comportamiento real frente a expiración/reingreso

---

### CF-06 — Logout panel

**Estado:** Congelado observacional v1
**Fuente primaria:** Código + runtime local observado

| Campo                               | Valor congelado                                                                                                                                                                                                                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comportamiento confirmado por código | limpia cookie `panel_token` y redirige a `/panel/login`                                                                                                                                                                                                                                  |
| Wiring auth relacionado              | el frontend arma `Authorization: Bearer` desde `supabase.auth.getSession()`; `/panel` verifica sesión con `supabase.auth.getSession()` y `panelAuth` valida Bearer con `supabase.auth.getUser()` y luego `panel_users`                                                               |
| Hallazgo en runtime local observado  | el logout visible redirige a `/panel/login`, pero no invalida la sesión Auth observada: la key de Supabase sigue en storage, un refresh en `/panel` recupera acceso, una nueva navegación a `/panel` recupera acceso y una request autenticada posterior a `GET /panel/me` sigue respondiendo `200` |
| Alcance prudente                     | este hallazgo queda congelado solo para el runtime local observado; no debe universalizarse a otros despliegues o navegadores sin validación adicional                                                                                                                               |
| Evidencia de código                  | `apps/web-next/components/panel/SidebarUserInfo.tsx:13`, `apps/web-next/components/panel/SidebarUserInfo.tsx:15`, `apps/web-next/components/panel/SidebarUserInfo.tsx:16`, `apps/web-next/lib/api.ts:22`, `apps/web-next/app/panel/(authenticated)/page.tsx:307`, `functions/api/src/middlewares/panelAuth.ts:86` |
| Ausencia observada en código         | no se ve `supabase.auth.signOut()` explícito en ese punto                                                                                                                                                                                                                                |
| Qué no se puede romper               | redirect visible a `/panel/login` y comportamiento observable actual del logout mientras no se implemente un cierre efectivo de sesión                                                                                                                                                 |
| Regresión mínima                     | el logout deja de redirigir a `/panel/login` o cambia el comportamiento observable actual sin soporte documental/QA previo                                                                                                                                                              |

**Requiere validación**

* si el mismo comportamiento se reproduce en otros entornos, navegadores o configuraciones de despliegue
* si existe algún mecanismo adicional de invalidación no observado en este runtime local
* comportamiento tras expiración natural de token o reapertura completa del navegador

---

### CF-06A — Check-in panel

**Estado:** Congelado parcial v1
**Fuente primaria:** Código

| Campo                            | Valor congelado                                                                                                                                                                                                                                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ruta observable actual           | `PATCH /panel/checkin/:token`                                                                                                                                                                                                                                                                                    |
| Auth / rol observables           | `panelAuth + requireRole(["owner","staff"])`                                                                                                                                                                                                                                                                     |
| Request observable               | token en path; la llamada frontend observada no envía body                                                                                                                                                                                                                                                       |
| Ramas backend observables        | `400` si falta token; `404` si no encuentra orden; `403` si el token pertenece a otro local; `400` si la orden no está `paid`; `409` si ya fue usada con `usedAt`; `409` para ventana inválida en clubes con payload específico; `500` con `Failed to check in`                                           |
| Success observable               | actualiza `used_at` y responde `id`, `local_id`, `status`, `used_at`, `customer_name`, `customer_last_name`, `customer_document`                                                                                                                                                                               |
| Consumidor frontend confirmado   | `apps/web-next/app/panel/(authenticated)/checkin/page.tsx` es la única llamada directa confirmada al endpoint actual                                                                                                                                                                                            |
| Mapping frontend observable      | `200 -> success`; `409 + usedAt` o texto `already used` -> `already_used`; `409` restante -> `window_invalid`; `404 -> invalid_token`; `403 -> forbidden`; `5xx -> error (server)`; resto -> `error (unknown)`                                                                                                |
| Comportamientos visibles         | soporta modo manual y auto-scan sobre la misma función; timeout `5500ms`, `1` retry, base `450ms`; renderiza resultados visibles por rama; bloquea la feature para locales `bar`                                                                                                                               |
| Ruta relacionada                 | `GET /panel/checkins` existe y usa el mismo esquema de auth/rol, pero no quedó confirmado en esta extracción como parte del mismo contrato visible del bloque                                                                                                                                                   |
| Evidencia backend                | `functions/api/src/routes/panel.ts:1355`, `functions/api/src/routes/panel.ts:1363`, `functions/api/src/routes/panel.ts:1374`, `functions/api/src/routes/panel.ts:1390`, `functions/api/src/routes/panel.ts:1398`, `functions/api/src/routes/panel.ts:1424`, `functions/api/src/routes/panel.ts:1434` |
| Evidencia frontend               | `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:529`, `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:556`, `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:578`, `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:583`, `apps/web-next/app/panel/(authenticated)/checkin/page.tsx:874` |
| Qué no se puede romper           | ruta actual, protección por auth/rol, mapping frontend observable, bloqueo visible para `bar`, soporte manual/auto-scan y render visible de resultados                                                                                                                                                           |
| Regresión mínima                 | el check-in deja de clasificar y mostrar el resultado actual esperado o deja de usar la ruta protegida observada                                                                                                                                                                                                |

**Requiere validación**

* robustez runtime del scanner/cámara/torch/permisos
* el mapping frontend `404 -> invalid_token` no distingue entre las ramas `404` observables identificadas en backend
* robustez del mapping frontend actual para `409`
* suficiencia operativa de timeout/retry en contexto real de puerta
* si `GET /panel/checkins` entra o no en el mismo contrato visible del bloque

---

### CF-06B — Export CSV panel

**Estado:** Congelado parcial v1
**Fuente primaria:** Código

| Campo                                | Valor congelado                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ruta observable actual               | `GET /panel/exports/reservations-clients.csv?from=YYYY-MM-DD&to=YYYY-MM-DD`                                                                                                                                                                                                                                                                                         |
| Auth / rol observables               | `panelAuth + requireRole(["owner","staff"])`                                                                                                                                                                                                                                                                                                                          |
| Validación visible de rango          | `YYYY-MM-DD`, `from <= to`, máximo `366` días                                                                                                                                                                                                                                                                                                                         |
| Comportamiento backend observable    | `400` si el rango es inválido; `404` si el local autenticado no existe; para `bar` exporta desde `reservations`; para `club` exporta desde `orders` + `legacyOrders`; en `club` incluye `checkin_token` y `resolveOrderState(...)`                                                                                                                             |
| Respuesta observable                 | `Content-Type: text/csv; charset=utf-8`, `Content-Disposition`, `Cache-Control: no-store`                                                                                                                                                                                                                                                                            |
| Filename backend observable          | `tairet_reservas_clientes_bar_<local>_<from>_a_<to>.csv` o `tairet_reservas_clientes_club_<local>_<from>_a_<to>.csv`, con sanitización del nombre del local                                                                                                                                                                                                       |
| Formato CSV observable               | BOM UTF-8, `CRLF` y escape seguro para Excel                                                                                                                                                                                                                                                                                                                          |
| Fallback frontend de filename        | `tairet_reservas_clientes_<from>_a_<to>.csv`                                                                                                                                                                                                                                                                                                                          |
| Consumidores frontend confirmados    | `apps/web-next/app/panel/(authenticated)/reservations/page.tsx` y `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx`                                                                                                                                                                                                                            |
| Helper frontend confirmado           | `downloadPanelReservationsClientsCsv()` valida navegador, valida `from/to`, usa `getAuthHeaders()` + `credentials: "include"`, intenta filename desde `Content-Disposition` y descarga por `blob` + link temporal                                                                                                                                                 |
| Evidencia backend                    | `functions/api/src/routes/panel.ts:1767`, `functions/api/src/routes/panel.ts:1773`, `functions/api/src/routes/panel.ts:1859`, `functions/api/src/routes/panel.ts:1862`, `functions/api/src/routes/panel.ts:1991`, `functions/api/src/routes/panel.ts:1994`                                                                                                      |
| Evidencia frontend                   | `apps/web-next/lib/panelExport.ts:40`, `apps/web-next/lib/panelExport.ts:57`, `apps/web-next/lib/panelExport.ts:78`, `apps/web-next/lib/panelExport.ts:79`, `apps/web-next/app/panel/(authenticated)/reservations/page.tsx:151`, `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx:265`                                                |
| Qué no se puede romper               | para el **contrato visible actual de export y sus consumidores confirmados**, la ruta observada, validación visible de rango, headers/filename observables, fallback frontend y descarga vía helper                                                                                                                                                                |
| Regresión mínima                     | la exportación deja de descargar, deja de respetar el contrato visible actual o rompe alguno de los consumidores confirmados                                                                                                                                                                                                                                          |

**Requiere validación**

* cobertura real del export con datasets grandes, límites y zonas horarias
* si `GET /panel/checkins` entra o no en el mismo contrato visible del bloque F5B
* si el export debe tratarse como contrato compartido entre reservas y órdenes más allá de los consumidores ya confirmados

---

### CF-06C — Modelo observable de acceso a datos / RLS

**Estado:** Congelado parcial v1
**Fuente primaria:** Código + SQL observado del repo

| Campo                                               | Valor congelado                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Camino backend observable                           | la API usa un cliente Supabase creado con `SUPABASE_SERVICE_ROLE`                                                                                                                                                                                                                                                                                                                                                       |
| Camino panel observable                             | el panel crea cliente Supabase con `NEXT_PUBLIC_SUPABASE_ANON_KEY`, obtiene sesión con `supabase.auth.getSession()` y manda Bearer al backend                                                                                                                                                                                                                                                                          |
| Camino B2C observable                               | B2C observado usa API pública; en el scope revisado no quedó confirmado `.from(...)` de negocio en frontend                                                                                                                                                                                                                                                                                                            |
| Tablas base observadas en `schema.sql`              | `locals`, `promos`, `orders`, `payment_events`, `reservations`, `events_public`, `whatsapp_clicks`, `profile_views`, `panel_users`, `local_daily_ops`                                                                                                                                                                                                                                                                |
| Tablas/columnas runtime fuera del `schema.sql` base observado | `ticket_types`, `table_types`, `orders.items`, `orders.valid_from`, `orders.valid_to`, `orders.valid_window_key`, `orders.is_window_legacy`, `orders.intended_date`, `orders.customer_email_lower`                                                                                                                                                                                                                    |
| Cobertura RLS observable por tabla en el archivo revisado | `locals`, `promos`, `orders`, `reservations`, `events_public`, `whatsapp_clicks`, `profile_views`, `local_daily_ops`; con señales permisivas explícitas `USING (true)` / `WITH CHECK (true)` donde sí hay policy observable                                                                                                                                                                                          |
| Tablas críticas sin coverage RLS observable en el archivo revisado | `panel_users`, `payment_events`, `ticket_types`, `table_types`                                                                                                                                                                                                                                                                                                                                                          |
| Guardrails observables actuales                     | `panelAuth`, `requireRole(...)`, tenant checks por `local_id`, validaciones de input/path y rutas públicas mediadas por backend                                                                                                                                                                                                                                                                                        |
| Tabla transversal sensible                          | `locals` y `local_daily_ops` afectan listados públicos, validaciones de apertura, reservas, órdenes, export, métricas y panel                                                                                                                                                                                                                                                                                          |
| Nota de drift observable                            | existe gap entre `infra/sql/schema.sql`, migraciones observadas y tablas/columnas usadas por runtime                                                                                                                                                                                                                                                                                                                   |
| Evidencia SQL                                       | `infra/sql/schema.sql:9`, `infra/sql/schema.sql:53`, `infra/sql/schema.sql:129`, `infra/sql/rls.sql:5`, `infra/sql/rls.sql:19`, `infra/sql/migrations/006_create_catalog_tables.sql:7`, `infra/sql/migrations/011_add_orders_valid_window.sql:8`, `infra/sql/migrations/012_add_orders_intended_date_night_window.sql:9`                                                                                           |
| Evidencia runtime                                   | `functions/api/src/services/supabase.ts:4`, `functions/api/src/services/supabase.ts:12`, `functions/api/src/middlewares/panelAuth.ts:86`, `functions/api/src/middlewares/panelAuth.ts:101`, `functions/api/src/routes/public.ts:297`, `functions/api/src/routes/orders.ts:137`, `functions/api/src/routes/panel.ts:2059`                                                                                               |
| Qué no se puede romper                              | antes de F7, la matriz actor → tabla → operación demostrable por código, los guardrails backend observados y la reconciliación documental mínima entre `schema.sql`, migraciones y runtime                                                                                                                                                                                                                           |
| Regresión mínima                                    | diseñar o ejecutar F7 solo contra `schema.sql` + `rls.sql`, sin contemplar drift observable ni tablas críticas del runtime                                                                                                                                                                                                                                                                                             |

**Requiere validación**

* semántica efectiva de `SUPABASE_SERVICE_ROLE` frente a RLS en entorno real
* esquema efectivo real de producción frente al SQL observado del repo
* impacto operativo real por actor/tabla al endurecer policies
* intención y cobertura real de tablas sin coverage RLS observable en el archivo revisado
* existencia/uso real de `orders.customer_email_lower` en producción

---

### CF-07 — `/panel/metrics`

**Estado:** Inconsistencia conocida congelada
**Fuente primaria:** Código

| Campo                     | Valor congelado                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Inconsistencia confirmada | `/panel/metrics` renderiza `LineupBarView/LineupClubView`                                                                   |
| Evidencia                 | `apps/web-next/app/panel/(authenticated)/metrics/page.tsx:4`, `apps/web-next/app/panel/(authenticated)/metrics/page.tsx:11` |
| Clasificación             | P3 / no bloqueante                                                                                                          |
| Qué no se puede romper    | no mezclar este fix con fases críticas de hardening                                                                         |
| Regresión mínima          | navegación interna afectada por tocar esta ruta sin aislarla                                                                |

---

## 4. Contratos no congelados aún

Quedan fuera de esta versión y deben tratarse como **Requiere validación**:

* cobertura runtime exacta del scanner/cámara/torch/permisos del check-in
* suficiencia del mapping frontend actual de `404/409` en check-in frente a todas las ramas backend observables
* cobertura operativa exacta del export CSV con datasets grandes / límites / zonas horarias
* si `GET /panel/checkins` entra o no en el mismo contrato visible del bloque de check-in/export
* semántica efectiva de `SUPABASE_SERVICE_ROLE` frente a RLS en entorno real
* esquema efectivo real de producción frente al SQL observado del repo
* intención/cobertura real de tablas sin coverage RLS observable en el archivo revisado
* payload completo de `/public/orders?email`
* payload completo de reservas panel
* contratos de `BarProfile`, `ClubProfile` y `EventProfile`
* contratos exactos de error (`403/409/410/429`) por endpoint crítico

---

## 5. Reglas de uso de este documento

Este documento debe usarse como referencia obligatoria antes de:

* abrir un nuevo ASK específico
* redactar prompts CODE
* aprobar cambios en rutas/payloads
* tocar flujos sensibles en frontend, panel o API

Toda ampliación de este documento debe seguir el mismo criterio:

* primero código
* runtime solo si el código no alcanza
* input humano solo para negocio / riesgo aceptado / comportamiento esperado
