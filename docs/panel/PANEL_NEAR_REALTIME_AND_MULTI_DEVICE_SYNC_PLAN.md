# Panel Near Realtime And Multi-Device Sync Plan

## 1. Proposito

Este documento define el plan tecnico para que el panel de Tairet se actualice sin refresh manual y soporte mejor operacion con multiples dispositivos.

El objetivo inicial no es realtime perfecto. El objetivo es lograr una experiencia operativa confiable, segura y de bajo riesgo para el corte `free_pass only`, empezando por Entradas y Reservas.

## 2. Alcance

Alcance inicial:

- Entradas;
- Reservas;
- sincronizacion razonable entre dispositivos;
- refetch automatico con pantalla activa;
- refetch inmediato despues de mutaciones criticas;
- indicador de frescura;
- boton manual `Actualizar` como fallback.

Este plan no es realtime global del panel. Activity, Metrics y Calendar son superficies cercanas, pero no son prioridad inicial.

## 3. Problema operativo que resuelve

Casos que debe mejorar:

- entra una nueva reserva y el panel debe mostrarla sin refresh manual;
- entra una nueva entrada/free pass y Entradas debe verla sin refresh manual;
- una entrada cambia de estado y otros dispositivos deben ver el cambio casi en vivo;
- una entrada validada por scanner o manualmente debe reflejarse en otros dispositivos;
- una reserva confirmada, cancelada o editada debe reflejarse en otra sesion;
- varios celulares o notebooks pueden estar operando a la vez;
- el operador necesita evitar decisiones sobre datos viejos.

Esto no reemplaza backend, internet ni panel/API funcionando. No es offline mode.

## 4. Estado actual del panel

Discovery confirmado:

- `@tanstack/react-query` esta instalado y existe `queryClient` en `apps/web-next/lib/api.ts`.
- No se observo uso activo de `useQuery`, `useMutation`, `invalidateQueries` ni provider de TanStack Query en las pantallas revisadas.
- La configuracion global de `queryClient` tiene `refetchOnWindowFocus: false`.
- Entradas y Reservas usan `fetch`/helpers manuales con `useEffect`, `useCallback` y estado local.
- No hay polling operativo general ni refetch por `visibilitychange`/focus en las pantallas revisadas.

Entradas:

- pantalla principal: `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx`;
- carga summary con `GET /panel/orders/summary`;
- carga listado/busqueda con `GET /panel/orders/search`;
- valida manualmente con `PATCH /panel/orders/:id/use`;
- scanner usa otra pantalla y endpoint: `PATCH /panel/checkin/:token`;
- ya hace refetch despues de validacion manual;
- preserva busqueda aplicada, fecha, estado y paginacion como estado local;
- no hay auto-refetch periodico.

Reservas:

- pantalla principal: `apps/web-next/app/panel/(authenticated)/reservations/page.tsx`;
- vista: `apps/web-next/components/panel/views/ReservationsView.tsx`;
- carga por fecha con `GET /locals/:id/reservations?date=YYYY-MM-DD`;
- muta con `PATCH /panel/reservations/:id`;
- confirma/cancela y luego hace refetch;
- actualiza `table_note` localmente despues de guardar;
- mantiene fecha, busqueda, filtro de estado y ordenamiento en estado local;
- no hay auto-refetch periodico.

Capa API reusable:

- `apiGetWithAuth`;
- `apiPatchWithAuth`;
- `getAuthHeaders`;
- `getApiBase`.

## 5. Estrategia recomendada

Recomendacion para el primer bloque: **polling/refetch inteligente**.

Motivos:

- no requiere SQL/RLS;
- no requiere exponer subscriptions directas a tablas;
- no reabre service role ni seguridad;
- aprovecha endpoints panel ya autenticados;
- permite rollback simple;
- es suficiente para operacion near realtime de puerta/reservas.

Comparacion:

| Estrategia | Uso recomendado | Riesgo | Decision |
| --- | --- | --- | --- |
| Polling/refetch inteligente | Primer bloque RT1/RT2 | Bajo si se controla frecuencia y visibilidad | Recomendado |
| Supabase Realtime | Futuro si polling no alcanza | Requiere revisar RLS, canales por tenant y exposicion de datos | No usar en RT1/RT2 |
| SSE | Futuro si se quiere canal backend controlado | Requiere infraestructura/API persistente y manejo de reconexion | Evaluar despues |
| WebSocket propio | Futuro avanzado | Mayor complejidad operativa | No recomendado como primer paso |

Politica tecnica inicial:

- polling solo si la pestana esta visible;
- refetch inmediato despues de mutaciones criticas;
- refetch al volver a `document.visibilityState === "visible"`;
- no resetear filtros, busqueda, fecha, estado ni paginacion;
- no interrumpir confirmaciones, modales ni ediciones;
- no usar subscriptions directas a tablas en el primer bloque;
- no cambiar contratos backend salvo necesidad real.

## 6. Roadmap por fases

### RT0 - Discovery/documentacion

Este documento.

Resultado esperado:

- estado actual inventariado;
- estrategia definida;
- pantallas y endpoints priorizados;
- riesgos y QA definidos.

### RT1 - Entradas near realtime

Objetivo:

- Entradas se actualiza sin refresh manual mientras el operador mantiene filtros activos.

Implementacion recomendada:

- refetch automatico de `GET /panel/orders/search` cada 3 a 5 segundos si la pestana esta visible;
- refetch automatico de `GET /panel/orders/summary` cada 3 a 5 segundos en clubs;
- refetch inmediato despues de `PATCH /panel/orders/:id/use`;
- refetch al volver la pestana visible;
- indicador `Actualizado hace Xs`;
- boton `Actualizar` como fallback manual;
- conservar `searchType`, input escrito, busqueda aplicada, `intendedDate`, `stateFilter`, `entriesOffset` y paginacion.

Reglas:

- no hacer polling si falta contexto o fecha requerida;
- no resetear input mientras el usuario escribe;
- no cerrar confirmacion de validacion manual;
- no disparar multiples requests simultaneos;
- errores de refetch deben mostrarse sin bloquear operacion previa.

### RT1-A - Entradas near realtime implementado

Estado: `Implementado y validado funcionalmente`.

Archivo implementado:

- `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx`.

Que se implemento:

- polling/refetch cada `5000ms`;
- polling solo cuando `document.visibilityState === "visible"`;
- pausa cuando la pestana esta oculta;
- refetch inmediato al volver a pestana visible;
- refetch de `GET /panel/orders/search`;
- refetch de `GET /panel/orders/summary` en locales tipo `club`;
- demo mode sin polling real;
- indicador de frescura:
  - `Actualizado recien`;
  - `Actualizado hace Xs`;
  - `Actualizado hace X min`;
  - `Actualizado: pendiente`;
- boton manual `Actualizar`;
- refresh manual respetando busqueda, filtros y fecha actuales;
- preservacion de `searchType`, input escrito, busqueda aplicada, `intendedDate`, `stateFilter`, `entriesOffset` y paginacion;
- guards anti-requests solapados:
  - `entriesInFlightRef`;
  - `summaryInFlightRef`;
  - `refreshInFlightRef`.

Validacion tecnica:

- `pnpm -C apps/web-next typecheck` -> `OK`;
- `git diff --check` -> `OK`.

QA runtime ejecutado:

- nueva entrada/free pass aparece en Entradas sin refresh manual -> `PASS`;
- scanner + Entradas sincronizan correctamente -> `PASS`;
- el input no se borra durante auto-refetch -> `PASS`;
- escritura parcial no aplicada como busqueda activa: no se detecto borrado de input -> `PASS`;
- filtros y fechas no se rompen durante auto-refetch -> `PASS`;
- boton `Actualizar` respeta busqueda/filtros/fecha actuales -> `PASS`;
- pestana oculta no actualiza agresivamente -> `PASS`;
- al volver a pestana visible, actualiza -> `PASS`;
- `GET /panel/checkins` sin regresion -> `PASS`;
- `/health` 200 -> `PASS`;
- `x-request-id` presente -> `PASS`;
- smoke corto general -> `PASS`.

N/A:

- error no bloqueante por refetch fallido -> `N/A`, no simulado en este QA;
- no bloquea el cierre de RT1-A.

Alcance cerrado:

- solo Entradas;
- no Reservas;
- no Activity/Metrics/Calendar;
- no realtime puro;
- no Supabase Realtime;
- no SSE;
- no WebSocket;
- no backend.

Lectura correcta:

- RT1-A queda cerrado como near realtime por polling/refetch inteligente en Entradas;
- no significa que todo el panel tenga realtime;
- no significa que multi-device sync este completamente resuelto en todo el producto;
- no reemplaza una arquitectura realtime futura si mas adelante se necesita.

Siguiente paso recomendado:

- RT2 Reservas near realtime usando el patron validado de RT1-A;
- antes de RT2, mantener el mismo criterio: polling visible-only, preservacion de filtros/fecha/busqueda y no pisar edicion de nota interna.

### RT2 - Reservas near realtime

Objetivo:

- Reservas nuevas y cambios de estado aparecen sin refresh manual.

Implementacion recomendada:

- refetch automatico de `GET /locals/:id/reservations?date=...` cada 10 a 15 segundos si la pestana esta visible;
- refetch inmediato despues de confirmar/cancelar;
- conservar fecha, busqueda, filtro de estado y ordenamiento;
- no pisar `table_note` mientras el usuario esta editando;
- indicador `Actualizado hace Xs`;
- boton `Actualizar` como fallback manual.

Reglas:

- pausar refetch destructivo si hay modal de nota abierto;
- si refetch ocurre durante edicion, no sobrescribir el draft;
- si hay error de red, mantener datos actuales y mostrar aviso leve.

### RT3 - Multi-device sync smoke

Objetivo:

- validar operacion real con dos sesiones/dispositivos.

Escenarios:

- A valida una entrada manualmente y B ve `Usada` sin refresh;
- A escanea QR y B ve cambio sin refresh;
- A intenta usar entrada ya usada y recibe error controlado;
- reserva creada desde B2C aparece en panel sin refresh;
- A confirma/cancela una reserva y B ve el cambio;
- owner y staff ven datos consistentes segun permisos.

### RT4 - Evaluacion realtime real

Solo evaluar si RT1/RT2 no alcanzan.

Opciones futuras:

- Supabase Realtime con canales por `local_id`;
- SSE desde API con auth panel;
- WebSocket propio si existe necesidad fuerte.

Cualquier opcion realtime real requiere revision explicita de seguridad, tenant isolation, RLS/exposicion, costos y operacion.

## 7. Pantallas y endpoints involucrados

| Pantalla | Endpoint / fuente | Dato | Frecuencia sugerida | Riesgo | Prioridad |
| --- | --- | --- | --- | --- | --- |
| Entradas | `GET /panel/orders/search` | listado/busqueda de entradas | 3-5s visible | requests excesivos, filtros activos | RT1 |
| Entradas | `GET /panel/orders/summary` | resumen de entradas | 3-5s visible | desalineacion con listado | RT1 |
| Entradas | `PATCH /panel/orders/:id/use` | validacion manual | refetch inmediato post-mutacion | doble validacion visual | RT1 |
| Scanner | `PATCH /panel/checkin/:token` | validacion QR | no cambiar; impacto via refetch de Entradas | no romper scanner | RT1 QA |
| Check-ins | `GET /panel/checkins` | ultimos check-ins | futuro/manual o 10-15s si se usa | endpoint sin consumidor activo fuerte | Bajo |
| Reservas | `GET /locals/:id/reservations?date=...` | reservas por fecha | 10-15s visible | pisar edicion/filtros | RT2 |
| Reservas | `PATCH /panel/reservations/:id` | estado/nota | refetch inmediato segun accion | pisar nota interna | RT2 |
| Activity | `GET /activity` | actividad operacional | 15-30s si aplica | ruido/costo | Futuro |
| Metrics | `GET /metrics/summary` | metricas y series | 15-30s o manual | queries pesadas | Futuro |
| Calendar | `GET /panel/calendar/month`, `GET /panel/calendar/day` | calendario operativo | manual o lento | ediciones concurrentes | Futuro |

## 8. Reglas UX para actualizacion automatica

- No resetear busqueda activa.
- No borrar input mientras el usuario escribe.
- No cambiar fecha seleccionada automaticamente.
- No cambiar filtro de estado automaticamente.
- No mover paginacion actual salvo decision explicita.
- No interrumpir confirmaciones de validacion.
- No cerrar modales de edicion.
- No sobrescribir drafts locales de nota interna.
- Mostrar `Actualizado hace Xs` cuando haya un fetch exitoso.
- Mostrar estado discreto si el refetch falla, manteniendo datos anteriores.
- Incluir boton `Actualizar` para fallback manual.
- Evitar spinners grandes en refetch de fondo; reservarlos para carga inicial.
- Pausar o reducir polling cuando `document.visibilityState !== "visible"`.
- Refetch inmediato cuando la pestana vuelve a visible.

## 9. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Exceso de requests | carga API/Railway/Supabase | intervalos acotados, solo pestana visible, abort/in-flight guard |
| Pisar filtros activos | mala UX operativa | preservar estado local y aplicar refetch sobre mismos parametros |
| Pisar edicion de nota | perdida de trabajo | pausar merge destructivo durante modal/draft |
| Race visual entre dispositivos | estado momentaneamente viejo | refetch post-mutacion y polling corto en Entradas |
| Error de red | operador queda inseguro | mantener datos previos y mostrar aviso no bloqueante |
| Validacion duplicada | confusion en puerta | backend ya bloquea `used_at`; UI debe reflejar `already used` |
| Polling en demo | datos inconsistentes o ruido | mantener demo con data local o no hacer polling real |
| Supabase Realtime directo | posible exposicion/RLS | no usar en RT1/RT2; evaluar seguridad aparte |
| Metrics pesadas | costo/latencia | usar intervalos lentos o manual refresh |

## 10. QA recomendado

RT1 Entradas:

- abrir dos sesiones/dispositivos;
- buscar por email;
- buscar por documento/cedula;
- A valida manualmente una entrada;
- B ve cambio a `Usada` sin refresh manual;
- scanner posterior sobre esa entrada responde como ya usada;
- scanner QR valido actualiza Entradas en otra sesion;
- filtros, fecha, estado y paginacion se mantienen;
- input escrito no se borra;
- pestana oculta pausa o reduce polling;
- volver a la pestana dispara refetch;
- error de refetch no rompe datos visibles.

RT2 Reservas:

- abrir dos sesiones/dispositivos;
- crear reserva desde B2C;
- panel la muestra sin refresh manual;
- A confirma reserva y B ve cambio;
- A cancela reserva y B ve cambio;
- editar nota interna sin que el refetch borre el draft;
- filtros, fecha, busqueda y ordenamiento se mantienen;
- errores de refetch son controlados.

Transversal:

- owner y staff;
- `/health` 200;
- `x-request-id` presente;
- Sentry captura errores si aparecen;
- sin cambios en paid flows;
- sin cambios en `/payments/callback`;
- sin cambios SQL/RLS;
- scanner sin regresion.

## 11. Fuera de alcance

Fuera del primer bloque:

- paid flows;
- `/payments/callback`;
- WebSocket propio;
- SSE;
- Supabase Realtime en produccion;
- cambios RLS;
- cambios SQL/migraciones;
- offline mode;
- cambios grandes de UI;
- B2C;
- demo mode;
- cambios de permisos;
- cambios de scanner;
- cambios de service role global.

## 12. Decisiones futuras

Evaluar despues de RT1/RT2:

- si polling cumple la experiencia operativa o se necesita realtime real;
- si conviene migrar pantallas criticas a TanStack Query;
- si Supabase Realtime puede usarse con canales por `local_id` sin reabrir riesgos;
- si SSE desde API da mejor control de auth/tenant que Supabase Realtime directo;
- si se necesita indicador de `otro dispositivo valido esta entrada`;
- si se requiere auditoria mas avanzada de eventos multi-device;
- si Activity/Metrics deben tener refresh automatico lento;
- si Calendar necesita sincronizacion para ediciones concurrentes.
