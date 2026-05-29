# Eventos puntuales en Tairet: producto, arquitectura y roadmap

## 1. Propósito

Este documento define el plan de producto y arquitectura para incorporar **Eventos puntuales** como una nueva vertical de Tairet.

El objetivo es soportar fiestas universitarias, eventos anuales, eventos de marcas, lanzamientos, activaciones, conciertos y eventos temporales con venta/emisión de entradas, QR, validación en puerta, historial operativo, métricas simples, export y un panel reducido propio.

Este documento es solo de discovery y planificación. No implementa código, SQL, migraciones, endpoints, frontend, pagos ni cambios en `/payments/callback`.

## 2. Decisión de producto inicial

Eventos debe tratarse como una tercera vertical de Tairet, separada de bares y discotecas.

Decisiones iniciales:

- Un evento no debe modelarse como bar.
- Un evento no debe modelarse como discoteca.
- Un evento no debe modelarse como local falso.
- Un evento no debe ser solamente una promo de un local.
- Un evento puede asociarse opcionalmente a un local existente.
- La recomendación principal es un modelo híbrido: `events` como entidad propia con `local_id` opcional.
- No se recomienda extender `locals.type` con `event` como estrategia principal.

Ejemplos asociados a local:

- Halloween Night en Koala Jack.
- After universitario dentro de una discoteca.
- Lanzamiento de marca dentro de un bar.

Ejemplos independientes:

- Fiesta Universidad X en un salón.
- Evento de marca en una ubicación temporal.
- Concierto o activación sin local permanente de Tairet.

## 3. Qué es un evento en Tairet

Un evento en Tairet es una operación puntual o temporal con identidad comercial propia, fecha/hora definida, organizador, ubicación, entradas y validación de acceso.

Un evento puede:

- existir sin local;
- estar asociado a un local existente;
- tener varios tipos de entrada;
- vender o emitir entradas;
- generar QR de acceso;
- validar entradas por scanner o manualmente;
- tener historial operativo;
- tener métricas simples;
- exportar compradores/check-ins bajo permisos owner-only.

El concepto de **organizador** es de negocio y no debe confundirse necesariamente con los usuarios operativos del panel. Para el MVP, los permisos pueden empezar con roles `owner` y `staff`, pero `organizer` debe quedar modelado como concepto comercial del evento.

## 4. Casos de uso

Casos principales:

- Fiesta de Halloween que ocurre una vez al año.
- Fiesta universitaria o after universitario.
- Evento de una marca.
- Fiesta privada grande.
- Lanzamiento de producto.
- Concierto o evento temporal.
- Activación en una ubicación puntual.
- Evento dentro de una discoteca, bar o salón.

La necesidad común es operar una fecha o ventana temporal concreta, no administrar un local permanente.

## 5. Estado actual detectado en repo

### Docs revisados

Se revisaron estos documentos obligatorios:

- `docs/panel/RUNTIME_DEMO_COMMERCIAL_PLAN.md`
- `docs/panel/OPERATIONAL_ACTIVITY_LOG_PLAN.md`
- `docs/panel/ACTIVITY_ACTOR_LABEL_PLAN.md`
- `docs/panel/MANUAL_ENTRY_VALIDATION_FALLBACK.md`
- `docs/panel/PANEL_NEAR_REALTIME_AND_MULTI_DEVICE_SYNC_PLAN.md`
- `docs/production/FREE_PASS_RELEASE_CANDIDATE.md`
- `docs/production/B7_FINAL_SMOKE_AND_GO_NO_GO.md`
- `docs/security/SERVICE_ROLE_MINIMIZATION_PLAN.md`
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`

También se revisaron áreas de backend, DB, panel `web-next` y B2C `web-b2c`, incluyendo rutas, middlewares, servicios, schema/RLS/migrations y componentes relacionados con orders, reservations, check-in, activity, exports y UI de eventos.

### Hallazgos principales

- Existe `events_public`, pero no representa eventos comerciales puntuales. Es una tabla de tracking público usada para eventos como `promo_open`, ligada opcionalmente a `local_id`.
- `locals.type` está limitado a `bar | club`. No existe tipo `event`.
- No hay tabla transaccional de eventos puntuales como `events`.
- No hay modelo de permisos por evento.
- No hay `event_ticket_types`, `event_orders` ni `event_panel_users`.
- El B2C tiene UI/mock de eventos, incluyendo `/eventos`, `EventProfile`, `EventCard` y datos estáticos, pero no hay backend real de eventos.
- La UI/mock existente de Eventos en B2C puede servir como referencia visual, pero no debe tratarse como implementación backend cerrada.
- `orders` está diseñado alrededor de `local_id`, `ticket_types` y check-in de discoteca.
- `ticket_types` y `table_types` están ligados a `local_id`.
- El flujo actual de compra está enfocado en `free_pass`; los pagos siguen fuera de alcance operativo aprobado.
- El QR actual se valida contra `orders.checkin_token`.
- La validación manual desde Entradas usa `PATCH /panel/orders/:id/use`.
- El activity log operativo usa `operational_activity_events` con `entity_type = order | reservation`.
- Actor label se resuelve de forma segura en lectura, usando rol/display_name sin exponer email, IDs internos ni tokens.
- Export actual es owner-only y está acotado a locales.
- Near realtime actual usa polling/refetch visible-only, no Supabase Realtime.
- Panel auth actual depende de `panel_users.local_id`; no sirve tal cual para un tenant de evento independiente.

### Qué significa hoy `events_public`

`events_public` hoy significa tracking de actividad pública, no evento comercial.

En el estado actual:

- registra actividad pública como apertura de promociones;
- puede tener `local_id`;
- tiene `type`, `metadata` y `created_at`;
- aparece en timelines/actividad;
- no contiene fecha de evento, organizer, tickets, stock, órdenes ni panel de evento.

Por lo tanto, no debe reutilizarse como tabla principal de eventos puntuales.

## 6. Opciones de arquitectura

### Opción A - Eventos como extensión de locals

Consiste en crear un local tipo `event` o usar `locals` como contenedor de eventos.

Ventajas:

- Reutiliza panel, auth, métricas y rutas existentes.
- Menor trabajo inicial aparente.

Riesgos:

- Convierte eventos en locales falsos.
- Contamina `locals`, métricas, calendario y perfil.
- Fuerza `local_id` donde conceptualmente puede no existir.
- Confunde owner/staff de local con owner/staff de evento.
- Requiere extender `locals.type`, hoy limitado a `bar | club`.

Conclusión: no recomendada como estrategia principal. Solo podría considerarse como workaround temporal descartable, no como modelo de producto.

### Opción B - Eventos independientes con tablas propias

Consiste en crear entidades completamente separadas:

- `events`
- `event_ticket_types`
- `event_orders`
- `event_panel_users`
- `event_activity_events` o equivalente

Ventajas:

- Separación conceptual limpia.
- Permisos claros por `event_id`.
- Evita contaminar locales.

Riesgos:

- Mayor esfuerzo inicial.
- Puede duplicar lógica de QR, check-in, export, historial y panel.
- Requiere diseñar contratos nuevos antes de reutilizar componentes existentes.

Conclusión: técnicamente limpia, pero puede ser más grande que lo necesario para un MVP comercial.

### Opción C - Eventos híbridos

Consiste en crear `events` como entidad propia, con `local_id` opcional para eventos asociados a un local, y reutilizar piezas existentes donde el acoplamiento a `local_id` no rompa el modelo.

Ventajas:

- Soporta eventos independientes y eventos dentro de locales.
- Evita locales falsos.
- Permite reutilizar patrones existentes: QR, check-in, historial, actor label, export y polling.
- Mantiene una frontera clara para permisos y tenant model por evento.

Riesgos:

- Requiere diseñar cuidadosamente endpoints, permisos y activity log.
- Hay que evitar mezclar `local_id` y `event_id` en filtros de seguridad.
- La decisión `event_orders` vs reutilizar `orders` debe resolverse en un slice técnico separado.

Conclusión: es la opción más prudente para Tairet.

## 7. Recomendación

Recomendar Opción C: Eventos híbridos.

Decisiones recomendadas:

- Crear `events` como entidad propia.
- Permitir `events.local_id` nullable.
- No extender `locals.type` con `event` como camino principal.
- No usar `events_public` como tabla de eventos.
- No tratar eventos como promos.
- Mantener un panel reducido por evento.
- Reutilizar patrones existentes solo cuando no comprometan tenant/security.
- Resolver `event_orders` vs reutilizar `orders` en un slice separado, con foco en seguridad, reporting y check-in.

La decisión prudente es separar el concepto de evento desde el inicio y reutilizar componentes por contrato, no por acoplamiento accidental a locales.

## 8. Modelo conceptual propuesto

### `events`

Entidad principal del evento.

Campos conceptuales:

- `id`
- `title`
- `slug`
- `description`
- `cover_image_url`
- `gallery`
- `starts_at`
- `ends_at`
- `location_name`
- `address`
- `lat`
- `lng`
- `organizer_name`
- `local_id` nullable
- `status`: `draft | published | paused | finished`
- `created_at`
- `updated_at`

Notas:

- `local_id` solo indica asociación opcional con un local existente.
- El evento debe poder existir sin `local_id`.
- `organizer_name` representa el concepto comercial visible.

### `event_ticket_types`

Tipos de entradas del evento.

Campos conceptuales:

- `id`
- `event_id`
- `name`
- `description`
- `price`
- `stock`
- `active`
- `sales_start`
- `sales_end`
- `created_at`
- `updated_at`

Notas:

- `sold_count` puede ser calculado o persistido solo si se mantiene transaccionalmente.
- El control de stock debe evitar sobreventa en backend/DB, no depender del frontend.

### `event_orders` vs reutilizar `orders`

Esta queda como decisión técnica futura y debe resolverse en un slice separado.

Alternativa `event_orders`:

- Más separación conceptual.
- Tenant checks por `event_id`.
- Menos riesgo de romper rutas de locales.
- Requiere duplicar/adaptar export, metrics, check-in y activity.

Alternativa `orders` extendido:

- Reutiliza más infraestructura.
- Puede simplificar QR/check-in si se generaliza bien.
- Riesgo alto por acoplamientos actuales a `local_id`, club windows, panel routes y exports.

Recomendación preliminar: para MVP, preferir tabla/event-flow propio o una extensión muy explícita con `event_id`, validada en slice separado.

### Unidad validable

La unidad validable debe definirse temprano.

Opciones:

- `event_orders` con `quantity = 1` y un QR por orden.
- `event_order_entries` o equivalente, con un QR por entrada/persona.
- Orden grupal con un solo QR que valida toda la cantidad.

Recomendación:

- Preferir un QR por entrada/persona si el objetivo es mejor control de puerta.
- Evaluar `event_order_entries` o equivalente antes de implementar compra/check-in.
- Evitar lanzar con `quantity > 1` si no está definido si la validación será parcial, total o por persona.

### `event_panel_users`

Membresía operativa del panel de evento.

Campos conceptuales:

- `id`
- `event_id`
- `auth_user_id`
- `role`: `owner | staff`
- `display_name`
- `created_at`
- `updated_at`

Notas:

- `owner` y `staff` son roles operativos.
- `organizer` es concepto de negocio y no necesariamente usuario del panel.
- Un mismo usuario podría tener acceso a locales y eventos.

## 9. Panel reducido de eventos

El panel de evento debe ser más chico que el panel de local.

Secciones MVP:

- Inicio/resumen: ventas/emisiones, check-ins, pendientes, estado del evento.
- Entradas: listado, búsqueda, filtros simples, estado usada/no usada.
- Check-in: scanner QR y fallback manual.
- Historial: actividad por entrada/orden.
- Export: compradores, check-ins y pendientes/no usados, owner-only.
- Perfil del evento: título, portada, galería, fecha, ubicación, organizer, estado.

No conviene reutilizar directamente:

- perfil completo de local;
- horarios recurrentes de local;
- calendario operativo de bar/discoteca;
- promos avanzadas;
- métricas de local sin adaptación;
- navegación actual basada en `local.type`;
- tenant checks basados solo en `local_id`.

## 10. B2C de eventos

El B2C de eventos debe cubrir:

- listado o sección de eventos;
- detalle de evento;
- portada/galería;
- fecha y horario;
- ubicación;
- organizador;
- descripción;
- tipos de entradas;
- compra o registro;
- QR de acceso.

Estado actual:

- Existen piezas visuales/mock de eventos.
- `/eventos` y `EventProfile` no deben asumirse como contrato backend final.
- La UI/mock puede usarse como referencia de diseño y navegación.

El contrato B2C real debe esperar a que se defina el modelo de eventos, tickets, stock y unidad validable.

## 11. Permisos y tenant model

El tenant de evento debe validarse por `event_id`, no por `local_id`.

Principios:

- Un evento puede no tener local.
- Un evento puede tener `local_id` opcional.
- Owner/staff del local no son automáticamente owner/staff del evento salvo regla explícita futura.
- Owner/staff del evento deben resolverse por membresía de evento.
- Un usuario puede ser owner/staff de local y también owner/staff de evento.

El modelo actual `panel_users` está atado a `local_id` y a un `auth_user_id` único. Por eso, reutilizarlo directamente limita casos donde una persona opere más de un tenant o combine local + evento.

Opciones:

- Crear `event_panel_users` para MVP.
- Generalizar membresías a futuro con una tabla tenant-aware.

Recomendación MVP:

- Usar `event_panel_users` o equivalente separado.
- Mantener roles simples `owner | staff`.
- Tratar emails tipo `owner.<event_handle>@tairet.com.py` o `staff.<event_handle>@tairet.com.py` como convención operativa/demo, no como fuente real de autorización.

## 12. Reutilización de piezas existentes

Piezas reutilizables como patrones:

- Generación y lectura de QR.
- Scanner/check-in.
- Validación manual desde listado de entradas.
- Búsqueda manual por email/documento.
- Historial operativo por entidad.
- Actor label seguro.
- Sanitización de metadata.
- Export owner-only.
- Polling/refetch visible-only.
- Componentes visuales de panel, con adaptación.

Piezas a separar o adaptar:

- `panelAuth`, porque hoy devuelve `localId`.
- `requireRole`, si los roles pasan a depender de tenant evento.
- `orders`, porque hoy dependen de `local_id`.
- `ticket_types`, porque hoy son por local y sin stock de evento.
- `operational_activity_events`, porque hoy exige `local_id` y `entity_type = order | reservation`.
- Exports, porque hoy están atados a local type.
- Metrics/calendar, porque hoy agregan por local.

## 13. Activity log para eventos

El activity log de eventos debe mantener las políticas actuales:

- No guardar PII innecesaria en metadata.
- No guardar `checkin_token`.
- No exponer QR/token.
- No persistir actor label textual si puede resolverse de forma segura.
- No distinguir QR/manual en metadata salvo decisión futura explícita.

Opciones:

- Extender `operational_activity_events` para soportar `event_id` nullable y `entity_type = event_order` o equivalente.
- Crear `event_activity_events` para aislar el MVP.
- Reutilizar `order` como `entity_type` solo si se decide extender `orders` de forma segura.

Recomendación preliminar:

- Si se elige `event_orders`, usar `entity_type = event_order` o una tabla de activity propia.
- Reutilizar la lógica de sanitización y actor label, no asumir que la tabla actual sirve sin cambios.

## 14. Export para eventos

El export de evento debe ser owner-only.

Exports MVP:

- compradores/registrados;
- check-ins;
- pendientes/no usados;
- evento completo;
- eventualmente rango por fecha si un evento se vuelve multi-día.

No exportar:

- `checkin_token`;
- QR raw;
- IDs internos innecesarios;
- PII no requerida;
- `local_id`/`event_id` si no agrega valor operativo;
- metadata interna.

Campos candidatos:

- nombre;
- apellido;
- email;
- teléfono;
- documento si aplica;
- tipo de entrada;
- estado de pago/emisión;
- estado de check-in;
- fecha de compra/emisión;
- fecha de validación.

## 15. Near realtime para eventos

Para MVP, reutilizar el patrón actual de polling/refetch inteligente.

Principios:

- Polling visible-only.
- Refetch luego de check-in o validación manual.
- Counters livianos.
- Evitar Supabase Realtime al inicio.
- No refrescar si el tab no está visible.
- Preservar estados de UI durante operaciones manuales.

Aplicaciones:

- Entradas de evento.
- Check-in.
- Contadores de resumen.
- Historial por entrada.

## 16. Roadmap por slices

### Slice 0 - Documento/discovery

Crear este documento y dejar explícitas las decisiones, hallazgos, riesgos y no-goals.

### Slice 1 - Decisión de modelo y contrato de producto

Definir contrato de `events`, roles, organizer, lifecycle, estados, `local_id` opcional y unidad validable.

### Slice 2 - Modelo DB mínimo o adaptación controlada

Definir si se crean `event_orders`/`event_order_entries` o se extiende `orders`. Este slice debe resolver la decisión técnica futura de órdenes.

### Slice 3 - B2C listado/detalle de eventos

Conectar listado y detalle a una fuente real de eventos publicados. Reutilizar la UI/mock existente solo como referencia visual.

### Slice 4 - Tickets, stock y órdenes de evento

Implementar tipos de entrada, stock, ventana de venta, emisión/compra y protección contra sobreventa.

### Slice 5 - Panel reducido de evento

Crear navegación y vistas mínimas: inicio, entradas, check-in, historial, export y perfil.

### Slice 6 - Check-in/validación de evento

Implementar QR por unidad validable, scanner, validación manual y búsqueda por email/documento.

### Slice 7 - Activity log y actor label para evento

Registrar eventos operativos de entrada/orden, con actor label seguro y metadata sanitizada.

### Slice 8 - Export owner-only

Agregar export de compradores, check-ins y pendientes/no usados, sin tokens ni IDs internos innecesarios.

### Slice 9 - Near realtime

Agregar polling/refetch visible-only para entradas, check-in, counters e historial.

### Slice 10 - Demo comercial de eventos

Diseñar demo futura de evento puntual, por ejemplo Halloween Koala Jack o Fiesta Universidad X, sin mezclarla con la runtime demo actual de bar/discoteca hasta tener plan dedicado.

## 17. Riesgos y mitigaciones

### Mezclar `local_id` con `event_id`

Riesgo: fugas de datos o permisos incorrectos.

Mitigación: tenant checks separados y tests de owner/staff por evento.

### Convertir eventos en locales falsos

Riesgo: modelo difícil de mantener y confuso para producto.

Mitigación: `events` como entidad propia y `local_id` solo opcional.

### Sobreventa

Riesgo: vender más entradas que stock.

Mitigación: control atómico en backend/DB y QA concurrente.

### Unidad validable indefinida

Riesgo: check-in ambiguo con órdenes grupales.

Mitigación: definir temprano `event_order_entries` o regla de un QR por persona.

### Permisos cruzados

Riesgo: owner de local accede a evento sin permiso explícito.

Mitigación: membresía por evento.

### Pagos fuera de gate

Riesgo: tocar `/payments/callback` o paid flows antes de seguridad aprobada.

Mitigación: mantener pagos fuera del MVP hasta slice/gate separado.

### Activity/export con PII o tokens

Riesgo: exposición de datos sensibles.

Mitigación: reutilizar reglas de sanitización y exclusión de tokens.

### Demo contaminada

Riesgo: mezclar demo de eventos con runtime demo actual.

Mitigación: plan de demo de eventos separado.

## 18. QA recomendado

QA B2C:

- Listado de eventos publicados.
- Detalle de evento publicado.
- Evento sin local.
- Evento asociado a local.
- Tipos de entrada visibles.
- Estados `draft`, `published`, `paused`, `finished`.

QA compra/emisión:

- Compra/registro exitoso.
- Stock decrementa correctamente.
- Sin sobreventa con solicitudes concurrentes.
- Ventana de venta activa/inactiva.
- QR generado para la unidad validable.

QA check-in:

- Scanner valida QR válido.
- QR ya usado devuelve estado duplicado.
- QR inválido no filtra información sensible.
- Validación manual desde Entradas.
- Búsqueda por email/documento.
- Refetch de contadores luego de validar.

QA permisos:

- Owner de evento puede exportar.
- Staff de evento no puede exportar si se mantiene owner-only.
- Usuario de otro evento no puede ver entradas.
- Owner de local no accede al evento salvo membresía explícita.

QA activity/export:

- Historial muestra actor label seguro.
- Metadata no incluye PII sensible ni token.
- Export no incluye `checkin_token`.
- Export no incluye IDs internos innecesarios.

QA near realtime:

- Polling solo con tab visible.
- Refetch manual funciona.
- No rompe interacción durante búsqueda/validación.

## 19. Fuera de alcance MVP

Fuera del MVP:

- Marketplace avanzado de eventos.
- Organizadores múltiples complejos.
- Comisiones variables avanzadas.
- Cupones.
- Seating map.
- Mesas complejas salvo decisión explícita.
- Promociones avanzadas.
- CRM.
- Reportes por staff.
- Payouts/liquidaciones.
- Contratos.
- Multi-sede complejo.
- Permisos granulares avanzados.
- Cambios de pago complejos.
- Rediseño completo del panel.
- Reemplazar el panel de bares/discotecas.
- Tocar `/payments/callback`.
- Tocar paid flows sin gate específico.

## 20. Decisiones futuras

Decisiones pendientes:

- Resolver `event_orders` vs reutilizar `orders`.
- Resolver si habrá `event_order_entries` o equivalente.
- Definir si MVP permite quantity mayor a 1.
- Definir si habrá un QR por persona o QR grupal.
- Definir si mesas entran en MVP o quedan fuera.
- Definir estrategia de pagos cuando paid flows estén habilitados.
- Definir reportes por staff.
- Definir liquidaciones/payouts.
- Definir organizadores múltiples.
- Definir demo comercial de eventos.
- Definir si activity será tabla propia o extensión de la actual.
- Definir si el panel de evento vive bajo ruta separada o dentro del panel actual con tenant selector.

