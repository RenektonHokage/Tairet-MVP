# FUNCTIONAL_FLOWS_E2E

## 1. Propósito del documento

Este documento describe los flujos funcionales end-to-end principales de Tairet a partir de código y documentación vigente del repo.

Su función es servir como base operativa para:

- QA funcional;
- hardening;
- readiness de producción;
- operación;
- futuros prompts técnicos.

Regla aplicada de fuente de verdad:

1. código del repo;
2. `docs/architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md`;
3. docs operativas vigentes del repo como soporte secundario;
4. cualquier punto no verificable queda marcado como `Requiere validación`.

## 2. Cómo leer este documento

Cada flujo se documenta con la misma plantilla:

- Nombre del flujo
- Actor
- Objetivo
- Superficies involucradas
- Backend / datos que intervienen
- Secuencia resumida
- Resultado esperado
- Dependencias / puntos sensibles
- Estado del flujo
- Evidencia principal

Leyenda de estado:

- `vigente`: la superficie está activa y el recorrido es verificable desde código con backend o capa de datos identificable.
- `parcial`: el flujo existe, pero tiene límites visibles, fallback a mocks, gating por tipo de local o cobertura incompleta.
- `requiere validación`: el repo no alcanza para cerrar el end-to-end real sin runtime.
- `demo-only`: soportado solo por runtime demo del panel.

## 3. Flujos B2C

### 3.1 Exploración y descubrimiento de locales

- Actor: usuario final B2C.
- Objetivo: descubrir bares y discotecas disponibles por zona, listado o búsqueda.
- Superficies involucradas: `#/explorar`, `#/bares`, `#/discotecas`, `#/zona/asuncion`, `#/zona/san-bernardino`, `#/zona/ciudad-del-este`, búsqueda del navbar.
- Backend / datos que intervienen: `getLocalsList("bar" | "club")` sobre `/public/locals`; selectors locales `selectBarVenues` y `selectClubVenues`; horarios presentados desde la data pública enriquecida.
- Secuencia resumida: las vistas cargan listados base desde selectors/fixtures, intentan enriquecer cards con datos públicos reales y exponen navegación hacia slugs de perfil.
- Resultado esperado: el usuario ve cards de locales, filtros básicos, horarios resumidos y CTA hacia perfiles.
- Dependencias / puntos sensibles: flujo híbrido API + fixtures; dependencia de slugs consistentes; cualquier drift entre fixtures y payload público impacta cards y navegación.
- Estado del flujo: `vigente`.
- Evidencia principal: `apps/web-b2c/src/App.tsx`, `apps/web-b2c/src/pages/Explorar.tsx`, `apps/web-b2c/src/pages/AllBars.tsx`, `apps/web-b2c/src/pages/AllClubs.tsx`, `apps/web-b2c/src/lib/navbarSearch.ts`.

### 3.2 Navegación hacia perfiles públicos

- Actor: usuario final B2C.
- Objetivo: pasar de listados, zonas o búsqueda al detalle público de un local.
- Superficies involucradas: cards y resultados de búsqueda en B2C; `#/bar/:barId`; `#/club/:clubId`.
- Backend / datos que intervienen: resolución posterior por slug con `/public/locals/by-slug/:slug`; composición de hrefs desde search y listados.
- Secuencia resumida: el usuario entra desde una card o un resultado de búsqueda, el router resuelve el slug y el perfil valida tipo y existencia antes de renderizar.
- Resultado esperado: el perfil abre si el slug es válido; si no, el flujo termina en not found.
- Dependencias / puntos sensibles: consistencia entre slugs, data pública y mocks; el destino puede fallar aunque la navegación de origen exista.
- Estado del flujo: `vigente`.
- Evidencia principal: `apps/web-b2c/src/App.tsx`, `apps/web-b2c/src/pages/Explorar.tsx`, `apps/web-b2c/src/pages/AllBars.tsx`, `apps/web-b2c/src/pages/AllClubs.tsx`, `apps/web-b2c/src/lib/navbarSearch.ts`, `apps/web-b2c/src/pages/BarProfile.tsx`, `apps/web-b2c/src/pages/ClubProfile.tsx`.

### 3.3 Ver perfil de bar

- Actor: usuario final B2C.
- Objetivo: inspeccionar el perfil público de un bar y decidir si avanzar a reserva.
- Superficies involucradas: `#/bar/:barId`.
- Backend / datos que intervienen: `/public/locals/by-slug/:slug`; tracking de visita vía `/events/profile_view`; reseñas vía `/reviews`; mapa en cliente.
- Secuencia resumida: el perfil resuelve el slug, exige que el local sea `bar`, mezcla data pública con `mockBarData`, renderiza promos, reseñas, horarios, galería y CTA de reserva.
- Resultado esperado: el usuario obtiene una vista pública utilizable del bar y puede avanzar a `#/reservar/:barId`.
- Dependencias / puntos sensibles: dependencia dual API + mock; si el local existe en backend pero no en mocks el flujo cae; promos hacen fallback si el backend no las devuelve; coords y horarios deben ser coherentes.
- Estado del flujo: `parcial`.
- Evidencia principal: `apps/web-b2c/src/pages/BarProfile.tsx`, `apps/web-b2c/src/components/shared/ReviewsSection.tsx`, `apps/web-b2c/src/hooks/useProfileViewOnce.ts`.

### 3.4 Ver perfil de discoteca

- Actor: usuario final B2C.
- Objetivo: inspeccionar el perfil público de una discoteca y acceder a catálogo, mesas o entradas.
- Superficies involucradas: `#/club/:clubId`.
- Backend / datos que intervienen: `/public/locals/by-slug/:slug`; `/public/locals/by-slug/:slug/catalog`; tracking de visita vía `/events/profile_view`; tracking de WhatsApp vía `/events/whatsapp_click`.
- Secuencia resumida: el perfil resuelve slug y tipo `club`, exige `mockClubData`, carga catálogo de tickets y mesas, luego expone selector de compra y CTA externos.
- Resultado esperado: el usuario puede ver el perfil, entender la oferta vigente y avanzar a free pass o a reserva de mesa por WhatsApp.
- Dependencias / puntos sensibles: dependencia dual API + mock; catálogo puede fallar y degradar el recorrido; el contacto del local condiciona el subflujo de mesas.
- Estado del flujo: `parcial`.
- Evidencia principal: `apps/web-b2c/src/pages/ClubProfile.tsx`, `apps/web-b2c/src/components/shared/PurchaseSelector.tsx`, `apps/web-b2c/src/hooks/useProfileViewOnce.ts`.

### 3.5 Reservas en bares

- Actor: usuario final B2C.
- Objetivo: solicitar una reserva en un bar para una fecha y hora válidas.
- Superficies involucradas: `#/bar/:barId`; `#/reservar/:barId`.
- Backend / datos que intervienen: `useLocalOpeningHoursBySlug`; creación vía `/reservations`.
- Secuencia resumida: desde el perfil el usuario abre el formulario, el frontend valida cantidad, fecha y hora contra horarios del local, envía la reserva y vuelve a la pantalla previa en caso de éxito.
- Resultado esperado: la reserva queda creada y el usuario recibe confirmación visual.
- Dependencias / puntos sensibles: integridad de `opening_hours`; acople entre slug del perfil y local real; la operación depende de reglas horarias correctas y de la disponibilidad del backend.
- Estado del flujo: `vigente`.
- Evidencia principal: `apps/web-b2c/src/App.tsx`, `apps/web-b2c/src/pages/ReservaForm.tsx`, `apps/web-b2c/src/hooks/useLocalOpeningHoursBySlug.ts`, `apps/web-b2c/src/lib/api.ts`.

### 3.6 Entradas de discoteca desde el perfil

- Actor: usuario final B2C.
- Objetivo: obtener una entrada válida desde la superficie actual de discoteca.
- Superficies involucradas: `#/club/:clubId`; modal `PurchaseSelector` + `CheckoutBase`; `#/confirmacion-compra` existe en router, pero el flujo principal visible hoy cierra dentro del checkout.
- Backend / datos que intervienen: catálogo del club; creación de orden vía `/orders`.
- Secuencia resumida: el usuario selecciona items del catálogo, el frontend bloquea tickets pagos, pasa solo items válidos al checkout, completa datos personales y genera la orden con `payment_method: "free_pass"` si el total es cero.
- Resultado esperado: se crea una orden con token/QR de check-in para el caso de `free_pass`.
- Dependencias / puntos sensibles: el flujo vigente está acotado a `free_pass`; depende de UUIDs válidos del catálogo, fecha objetivo, generación de token y envío/entrega posterior de comprobante.
- Estado del flujo: `parcial`.
- Evidencia principal: `apps/web-b2c/src/pages/ClubProfile.tsx`, `apps/web-b2c/src/components/shared/PurchaseSelector.tsx`, `apps/web-b2c/src/components/shared/CheckoutBase.tsx`, `apps/web-b2c/src/lib/orders.ts`.

### 3.7 Reserva de mesas en discoteca vía WhatsApp

- Actor: usuario final B2C.
- Objetivo: derivar la reserva de mesa a un canal operativo externo del local.
- Superficies involucradas: `#/club/:clubId`.
- Backend / datos que intervienen: tracking de clic vía `/events/whatsapp_click`; construcción de URL de WhatsApp en cliente.
- Secuencia resumida: el usuario elige una mesa, el frontend registra el clic cuando puede identificar el local y abre WhatsApp con un mensaje prearmado.
- Resultado esperado: el usuario sale de Tairet hacia la conversación con el local.
- Dependencias / puntos sensibles: disponibilidad y calidad del número de contacto; dependencia de un canal externo sin confirmación transaccional dentro de Tairet; tracking fire-and-forget.
- Estado del flujo: `vigente`.
- Evidencia principal: `apps/web-b2c/src/components/shared/PurchaseSelector.tsx`, `apps/web-b2c/src/lib/whatsapp.ts`, `apps/web-b2c/src/lib/api.ts`.

### 3.8 Reseñas visibles en superficie actual

- Actor: usuario final B2C.
- Objetivo: consultar señal social global o por local desde superficies públicas.
- Superficies involucradas: `#/reseñas`; bloques de reseñas dentro de perfiles.
- Backend / datos que intervienen: `/reviews` consumido por `useReviews`.
- Secuencia resumida: la vista global y las secciones de perfil cargan reseñas con alcance global o por venue y muestran promedio, total y entradas visibles.
- Resultado esperado: el usuario puede leer reseñas sin necesidad de otra autenticación.
- Dependencias / puntos sensibles: el repo confirma lectura, no escritura pública; cobertura real de paginación y moderación queda fuera de este documento.
- Estado del flujo: `vigente`.
- Evidencia principal: `apps/web-b2c/src/App.tsx`, `apps/web-b2c/src/pages/AllReviews.tsx`, `apps/web-b2c/src/components/shared/ReviewsSection.tsx`, `apps/web-b2c/src/hooks/useReviews.ts`.

## 4. Flujos B2B / Panel

### 4.1 Acceso y login al panel

- Actor: owner o staff del local.
- Objetivo: autenticarse y entrar al panel operativo correcto del tenant.
- Superficies involucradas: `/panel/login`; bootstrap posterior en `/panel`.
- Backend / datos que intervienen: Supabase Auth en frontend; `/panel/me`; middlewares `panelAuth` y `requireRole(...)`.
- Secuencia resumida: el usuario inicia sesión con email y password, obtiene sesión de Supabase, el panel rehidrata contexto con `Bearer` hacia la API y resuelve local, rol y modo de operación.
- Resultado esperado: acceso al panel autenticado según rol.
- Dependencias / puntos sensibles: sesión de Supabase; tabla `panel_users`; tenencia correcta del local; el panel depende de auth frontend y auth backend en cascada.
- Estado del flujo: `vigente`.
- Evidencia principal: `apps/web-next/app/panel/login/page.tsx`, `apps/web-next/lib/api.ts`, `apps/web-next/lib/panel.ts`, `apps/web-next/lib/panelContext.tsx`, `functions/api/src/middlewares/panelAuth.ts`.

### 4.2 Dashboard operativo principal

- Actor: owner o staff del local.
- Objetivo: leer el estado operativo principal del local al entrar al panel.
- Superficies involucradas: `/panel`.
- Backend / datos que intervienen: `/metrics/summary`; contexto de panel para resolver `local.type`.
- Secuencia resumida: la portada del panel carga contexto, pide resumen con series y monta `DashboardBarView` o `DashboardClubView` según tipo de local.
- Resultado esperado: KPIs y tendencia principal del día o rango actual.
- Dependencias / puntos sensibles: calidad del contrato de métricas; branch correcto por tipo de local; consistencia entre resumen y actividad operativa real.
- Estado del flujo: `vigente`.
- Evidencia principal: `apps/web-next/app/panel/(authenticated)/page.tsx`, `apps/web-next/lib/metrics.ts`, `docs/panel/PANEL_ANALYTICS_SOURCE_OF_TRUTH.md`.

### 4.3 Gestión de perfil del local

- Actor: owner o staff del local.
- Objetivo: editar datos públicos, galería, horarios y catálogo operativo del local.
- Superficies involucradas: `/panel/profile`.
- Backend / datos que intervienen: `/panel/local`; `/panel/local/gallery/signed-upload`; `/panel/catalog/tickets`; `/panel/catalog/tables`; lectura de promos del local.
- Secuencia resumida: el panel carga el perfil actual, permite editar contenido principal, horarios y activos visuales, y expone edición de tickets o mesas según el tipo de local.
- Resultado esperado: perfil y catálogo del local actualizados desde una sola superficie de edición.
- Dependencias / puntos sensibles: storage firmado; validación de `opening_hours`; fuerte acople entre perfil, galería y catálogo; diferencias por tipo de local.
- Estado del flujo: `vigente`.
- Evidencia principal: `apps/web-next/app/panel/(authenticated)/profile/page.tsx`, `apps/web-next/lib/panel.ts`, `apps/web-next/lib/promos.ts`.

### 4.4 Gestión de promociones

- Actor: owner o staff del local.
- Objetivo: crear, editar, ordenar y eliminar promociones visibles en superficie pública.
- Superficies involucradas: `/panel/marketing/promos`.
- Backend / datos que intervienen: `/locals/:id/promos`; `/locals/:id/promos/:promoId`; `/locals/:id/promos/reorder`.
- Secuencia resumida: la pantalla carga promos del local, permite cambios de contenido y orden, y sincroniza esas modificaciones contra la API.
- Resultado esperado: promos actualizadas para el local actual y potencialmente consumibles por B2C.
- Dependencias / puntos sensibles: `localId` del contexto; manejo de imágenes; acople con la forma en que B2C consume `local.promotions`.
- Estado del flujo: `vigente`.
- Evidencia principal: `apps/web-next/app/panel/(authenticated)/marketing/promos/page.tsx`, `apps/web-next/lib/promos.ts`, `functions/api/src/routes/promos.ts`, `apps/web-b2c/src/pages/BarProfile.tsx`, `apps/web-b2c/src/pages/ClubProfile.tsx`.

### 4.5 Calendario operativo

- Actor: owner o staff del local.
- Objetivo: administrar el estado operativo diario del local.
- Superficies involucradas: `/panel/calendar`.
- Backend / datos que intervienen: `/panel/calendar/month`; `/panel/calendar/day`.
- Secuencia resumida: el operador navega el mes, inspecciona el detalle del día y persiste cambios operativos sobre la fecha seleccionada.
- Resultado esperado: la operación diaria queda registrada y disponible para otras superficies.
- Dependencias / puntos sensibles: `local_daily_ops` es transversal y afecta disponibilidad, horarios visibles, reservas, órdenes y métricas.
- Estado del flujo: `vigente`.
- Evidencia principal: `apps/web-next/app/panel/(authenticated)/calendar/page.tsx`, `apps/web-next/lib/calendar.ts`, `functions/api/src/routes/calendar.ts`.

### 4.6 Reservas de bar en panel

- Actor: owner o staff de un bar.
- Objetivo: revisar y operar reservas por fecha.
- Superficies involucradas: `/panel/reservations`.
- Backend / datos que intervienen: `/panel/reservations/search`; `/panel/reservations/:id`; export de clientes; base pública de reservas originadas en B2C.
- Secuencia resumida: el operador elige fecha, carga reservas del local, filtra o busca resultados, actualiza estados y notas, y puede exportar clientes.
- Resultado esperado: la operación diaria de reservas queda gestionada desde el panel.
- Dependencias / puntos sensibles: flujo bloqueado para clubs; hay sensibilidad conocida por filtros cliente y límites en backend; export y estado comparten el mismo dominio de reservas.
- Estado del flujo: `vigente`.
- Evidencia principal: `apps/web-next/app/panel/(authenticated)/reservations/page.tsx`, `apps/web-next/lib/reservations.ts`, `functions/api/src/routes/panel.ts`, `functions/api/src/routes/reservations.ts`, `docs/audits/BASELINE_FUNCIONAL_V1.md`.

### 4.7 Orders y entradas de discoteca en panel

- Actor: owner o staff de una discoteca.
- Objetivo: leer resumen, buscar entradas y exportar datos operativos por fecha.
- Superficies involucradas: `/panel/orders`.
- Backend / datos que intervienen: `/panel/orders/summary`; `/panel/orders/search`; export de clientes.
- Secuencia resumida: el operador fija `intended_date`, carga resumen y entradas, busca por email o documento, revisa estado de cada token y puede exportar el padrón del rango.
- Resultado esperado: operación de entradas centralizada por fecha para el local actual.
- Dependencias / puntos sensibles: flujo orientado a clubs; alto acople con `orders`, `check-in`, estados temporales y export; el repo no cierra pagos productivos más allá de `free_pass`.
- Estado del flujo: `vigente`.
- Evidencia principal: `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx`, `functions/api/src/routes/panel.ts`, `docs/panel/PANEL_ANALYTICS_SOURCE_OF_TRUTH.md`.

### 4.8 Check-in de entradas

- Actor: owner o staff de una discoteca en puerta.
- Objetivo: validar tokens y marcar entradas usadas en tiempo real.
- Superficies involucradas: `/panel/checkin`.
- Backend / datos que intervienen: `PATCH /panel/checkin/:token`.
- Secuencia resumida: el operador escanea o pega un token, el backend valida ventana temporal y estado previo, luego responde éxito, ya usado, token inválido o fuera de ventana.
- Resultado esperado: entrada aceptada o rechazada con feedback explícito para operación de puerta.
- Dependencias / puntos sensibles: flujo bloqueado para bares; depende de cámara/permisos del navegador, ventana válida de check-in y consistencia del dominio `orders`.
- Estado del flujo: `vigente`.
- Evidencia principal: `apps/web-next/app/panel/(authenticated)/checkin/page.tsx`, `functions/api/src/routes/panel.ts`, `docs/audits/SMOKE_TESTS_V1.md`.

### 4.9 Métricas y analítica

- Actor: owner o staff del local.
- Objetivo: leer métricas explicativas y actividad reciente del local.
- Superficies involucradas: `/panel/metrics`.
- Backend / datos que intervienen: `/metrics/summary`; `/activity`.
- Secuencia resumida: la ruta resuelve `local.type`, monta `LineupBarView` o `LineupClubView` y consume resumen con series y actividad reciente.
- Resultado esperado: lectura analítica del desempeño por tipo de local.
- Dependencias / puntos sensibles: la ruta de métricas reutiliza vistas de `lineup`; existe acoplamiento técnico entre analytics y marketing/lineup.
- Estado del flujo: `vigente`.
- Evidencia principal: `apps/web-next/app/panel/(authenticated)/metrics/page.tsx`, `apps/web-next/lib/metrics.ts`, `apps/web-next/lib/activity.ts`, `docs/panel/PANEL_ANALYTICS_SOURCE_OF_TRUTH.md`.

### 4.10 Settings, soporte y accesos

- Actor: owner o staff del local.
- Objetivo: consultar estado de soporte, diagnóstico mínimo y accesos del panel.
- Superficies involucradas: `/panel/settings`.
- Backend / datos que intervienen: `/panel/support/status`; `/panel/support/access`.
- Secuencia resumida: la pantalla carga estado general del tenant, muestra canales de soporte y, si el rol es `owner`, lista usuarios habilitados del panel para ese local.
- Resultado esperado: visibilidad sobre soporte operativo y accesos del panel.
- Dependencias / puntos sensibles: la superficie funciona como soporte/diagnóstico más que como settings genéricos; depende de `panel_users`, rol actual y env vars de contacto.
- Estado del flujo: `vigente`.
- Evidencia principal: `apps/web-next/app/panel/(authenticated)/settings/page.tsx`, `apps/web-next/lib/support.ts`, `functions/api/src/routes/support.ts`.

### 4.11 Runtime demo del panel

- Actor: operador interno o demo user.
- Objetivo: forzar un escenario demo de `bar`, `discoteca` u `off`.
- Superficies involucradas: `/panel/demo/[scenario]`.
- Backend / datos que intervienen: runtime local del panel; fuentes demo del panel cuando el modo está habilitado.
- Secuencia resumida: la ruta valida si demo está habilitado, persiste o limpia el escenario y redirige a login o panel según corresponda.
- Resultado esperado: activar o desactivar una sesión demo sin mezclarla con la operación live.
- Dependencias / puntos sensibles: no es flujo productivo; depende de flags/runtime demo y de fuentes demo paralelas.
- Estado del flujo: `demo-only`.
- Evidencia principal: `apps/web-next/app/panel/demo/[scenario]/page.tsx`, `apps/web-next/lib/panel-demo/runtime.ts`, `docs/panel/PANEL_ANALYTICS_SOURCE_OF_TRUTH.md`.

## 5. Dependencias transversales y puntos sensibles

- Supabase es la dependencia transversal principal: Auth en panel, datos y storage en backend, con `SUPABASE_SERVICE_ROLE` en la API.
- `panelAuth` y `requireRole(...)` son el cierre principal del panel; cualquier drift entre sesión frontend, bearer y `panel_users` rompe varios flujos a la vez.
- `local_daily_ops` es una pieza transversal: calendario, listados, reservas, órdenes y métricas dependen de su coherencia.
- Los perfiles B2C de bar y discoteca siguen acoplados a mocks además de la API pública; eso vuelve frágiles los slugs y el render público.
- `orders` concentra blast radius alto: checkout B2C, summary/search en panel, check-in, export y lookup público preservado nacen del mismo dominio.
- El subflujo de mesas discoteca depende de WhatsApp como canal externo; Tairet solo registra el clic y delega la conversión fuera del sistema.
- `/panel/metrics` reutiliza vistas de `marketing/lineup`; el cambio semántico de analytics todavía no elimina ese acople técnico.
- Soporte, accesos y observabilidad siguen parciales: hay request IDs, rutas de soporte y wiring visible, pero la cobertura efectiva depende de entorno y runtime.

## 6. Flujos parciales, demo-only o que requieren validación

- `#/evento/:eventId`: la ruta existe y el perfil de evento renderiza información pública, pero el propio código deshabilita la venta y aclara que no hay catálogo transaccional activo. Estado recomendado: `parcial`.
- `MisEntradas`: la base de código y el contrato público de lookup por email siguen presentes, pero la ruta no está montada en el B2C actual. Estado recomendado: no tratarlo como flujo vigente; si se reexpone, queda `Requiere validación`.
- Historial o perfil de usuario B2C: no hay una superficie pública actual verificable que lo sostenga como flujo vigente. Estado recomendado: `Requiere validación`.
- Compra con pagos productivos: el checkout visible confirma `free_pass`; el proveedor de pago real no está cerrado end-to-end en el repo. Estado recomendado: `Requiere validación`.
- Runtime demo del panel: existe y está soportado en código, pero no debe confundirse con una superficie operativa productiva. Estado recomendado: `demo-only`.

## 7. Drift o ambigüedades detectados

- `SYSTEM_ARCHITECTURE_OVERVIEW.md` ya marcaba al B2C como híbrido; este documento confirma que el drift no es teórico: los perfiles públicos siguen dependiendo tanto de API como de mocks.
- `docs/audits/SMOKE_TESTS_V1.md` y `docs/audits/BASELINE_FUNCIONAL_V1.md` conservan evidencia útil sobre `MisEntradas`, lookup público y check-in, pero la superficie pública actual ya no expone `MisEntradas`.
- `/panel/metrics` se presenta como analytics, pero técnicamente reutiliza vistas de `lineup`; no es contradicción, sí un acople semántico relevante.
- `/panel/settings` no es un módulo de configuración general; en el estado actual funciona como pantalla de soporte, estado y accesos.
- El flujo de compra en discoteca debe leerse como `free_pass` operativo, no como pagos productivos cerrados.

## 8. Qué documentos deberían escribirse después de este

- Matriz de QA funcional por flujo y por estado esperado.
- Documento de readiness de producción por dependencia crítica.
- Documento de hardening por superficie: B2C pública, panel autenticado, callbacks y storage.
- Documento operativo por dominio: reservas, órdenes/check-in, promos, calendario y soporte.
