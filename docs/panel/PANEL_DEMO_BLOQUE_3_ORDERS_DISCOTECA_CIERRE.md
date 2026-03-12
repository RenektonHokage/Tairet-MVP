# PANEL DEMO - CIERRE BLOQUE 3 ORDERS DISCOTECA

## Estado

Bloque 3 del panel demo cerrado y validado.

Este documento registra el cierre del bloque que demo-enableo `Entradas` para `discoteca` en:

- `/panel/orders`

Su funcion es dejar asentado:

- que se implemento;
- que se valido;
- que limites mantuvo el bloque;
- y desde que checkpoint debe retomarse el trabajo despues.

Documentos relacionados:

- `docs/panel/PANEL_DEMO_DISCOVERY.md`
- `docs/panel/PANEL_DEMO_BLOQUE_1_CIERRE.md`
- `docs/panel/PANEL_DEMO_VIDEO_SCOPE.md`
- `docs/panel/PANEL_DEMO_UI_POLISH_RESERVAS_ORDERS_CIERRE.md`

## Contexto breve

Luego del re-scope del panel demo a video grabado, `Entradas` paso a ser una de las pantallas objetivo pendientes para el escenario `discoteca`.

Bloque 1 ya habia dejado resuelto:

- runtime demo persistido;
- identidad sintetica;
- shell del panel;
- dashboard demo-aware.

Ademas, `Entradas` ya habia recibido el polish visual necesario para video.

Este Bloque 3 completo la parte funcional demo de esa pantalla, sin tocar backend, API, DB, provider, runtime ni layout.

## Objetivo del bloque

Demo-enablear `/panel/orders` solo para `discoteca`, con el menor alcance posible y manteniendo intacto el flujo live fuera del branch demo.

Objetivos concretos del bloque:

- resolver summary demo desde fixtures;
- resolver fecha default demo desde `current_window`;
- resolver listado, filtro y busqueda sobre fixtures demo;
- preservar la UI ya existente de la pantalla;
- mantener `copy token`;
- evitar export real en demo y mostrar un mensaje controlado.

## Pantalla afectada

- `Entradas`
- ruta: `/panel/orders`
- escenario demo: `discoteca`

Queda asentado que este bloque se activo solo bajo el branch:

- `isDemo && demoScenario === "discoteca" && context?.local.type === "club"`

## Archivos tocados

- `apps/web-next/lib/panel-demo/orders.ts`
- `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx`

## Que se implemento

### 1. Helper demo nuevo para orders

Se creo:

- `apps/web-next/lib/panel-demo/orders.ts`

Ese archivo concentra fixtures y helpers tipados para `discoteca`.

Incluye al menos:

- `getPanelDemoDiscotecaOrdersDefaultDate()`
- `getPanelDemoDiscotecaOrdersSummary()`
- `searchPanelDemoDiscotecaOrders()`

Los fixtures cubren multiples fechas/evento y mezclan estados:

- `used`
- `pending`
- `unused`

## 2. Demo-enable local en OrdersPageClient

`OrdersPageClient.tsx` quedo demo-enabled solo para `discoteca`.

La pantalla sigue usando su UI actual, pero en el branch demo reemplaza exclusivamente:

- `summary`
- `listado / busqueda`
- `export CSV`

No se movio la UI fuera del archivo ni se abrio un refactor amplio del modulo.

### 3. Summary demo desde fixtures

En demo `discoteca`, las summary cards pasan a resolverse desde fixtures demo.

Se mantuvo coherencia con el comportamiento live:

- las cards siguen mostrando `quantity`;
- no se cambio la semantica visual del modulo;
- `current_window` sigue existiendo en demo para sostener la logica actual.

### 4. Fecha default demo desde current_window

La fecha por defecto de la pantalla en demo se sigue resolviendo a traves de `current_window`.

Eso permitio conservar el comportamiento actual de la page sin agregar otra capa de estado o navegacion.

### 5. Listado, filtro y busqueda demo

En demo `discoteca`, el listado usa fixtures demo filtrados por:

- fecha;
- estado;
- busqueda por `email` o `document`.

Tambien se preservo:

- `count`;
- `limit: 20`;
- la estructura visual del listado ya existente.

### 6. Copy token preservado

La accion `Copiar` para token se mantuvo sin cambios de flujo.

No requirio backend adicional y sigue funcionando como interaccion de navegador.

### 7. Export demo sin backend

En demo `discoteca`, `Exportar CSV` no pega al backend.

En su lugar, la pantalla muestra el mensaje controlado:

- `La exportacion CSV no esta disponible en modo demo.`

## Validacion realizada

Validacion tecnica ejecutada:

- `pnpm -C apps/web-next typecheck` OK

Validacion manual:

- QA visual/manual OK en `/panel/orders`

Tambien queda asentado que:

- no se ejecuto `build`
- no se tocaron modulos fuera del scope aprobado

## Resultado del bloque

Resultado del cierre:

- bloque implementado;
- bloque validado;
- bloque cerrado.

Hechos que quedan asentados como comprobados:

- `/panel/orders` quedo demo-enabled solo para `discoteca`;
- se creo `apps/web-next/lib/panel-demo/orders.ts`;
- `summary`, fecha default, filtro, busqueda y listado usan fixtures demo dentro del branch demo;
- `copy token` se preservo;
- `Exportar CSV` en demo no pega al backend y muestra un mensaje controlado;
- el flujo live quedo intacto fuera del branch demo;
- no hubo expansion de alcance fuera de este modulo.

## Que quedo fuera del alcance

Este bloque no cubrio:

- `metrics`;
- `calendar`;
- `promos`;
- `support`;
- `checkin`;
- `profile`;
- `marketing/lineup`;
- export real;
- `PATCH /panel/orders/:id/use`;
- cambios en backend, API, DB o auth real;
- cambios en provider, runtime o layout;
- refactor amplio de `OrdersPageClient.tsx`;
- optimizacion general del panel.

## Checkpoint operativo

Checkpoint vigente despues de este bloque:

- Bloque 1 sigue cerrado y validado;
- `Reservas` para `bar` ya estaba demo-enabled;
- `Entradas` para `discoteca` queda ahora demo-enabled funcionalmente;
- el objetivo activo sigue siendo exclusivamente video grabado;
- el flujo live continua intacto fuera de los branches demo;
- el siguiente trabajo no debe reinterpretar este documento como plan del proximo modulo.

Este documento debe leerse como cierre de Bloque 3 ya completado, no como roadmap detallado de lo que sigue.
