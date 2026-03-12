# PANEL DEMO — CIERRE BLOQUE 1

## Estado

Bloque 1 del panel demo cerrado y validado.

Este documento registra el cierre real del primer slice implementado para panel demo, dejando asentado:

- que se implemento;
- que se valido;
- que limites siguen vigentes;
- y desde que punto debe retomarse el trabajo despues.

Documento relacionado:

- `docs/panel/PANEL_DEMO_DISCOVERY.md`

## Contexto breve

La iniciativa de panel demo se definio para reutilizar el panel B2B real con un runtime demo front-only, sin clonar paneles ni tocar backend, API, DB o tenants reales.

El Bloque 1 fue deliberadamente recortado al seam mas chico y seguro:

- ruta de entrada demo;
- runtime demo persistido;
- identidad sintetica en provider;
- shell/sidebar segun escenario;
- dashboard como unica vista demo-enabled.

## Objetivo del Bloque 1

Dejar una base funcional y verificable para demo mode sin abrir alcance hacia modulos operativos ni refactors mayores.

El objetivo especifico del bloque fue probar que el panel puede:

- entrar a modo demo desde una ruta controlada;
- persistir ese runtime en front;
- renderizar identidad y navegacion coherentes para `bar` y `discoteca`;
- preservar el flujo live cuando el demo mode esta apagado;
- y mostrar una primera vista real del panel usando data demo tipada.

## Que se implemento

### 1. Ruta de entrada demo

Se implemento la ruta:

- `/panel/demo/[scenario]`

Comportamientos implementados:

- `/panel/demo/bar`
  - persiste runtime demo para escenario `bar`
  - redirige a `/panel`
- `/panel/demo/discoteca`
  - persiste runtime demo para escenario `discoteca`
  - redirige a `/panel`
- `/panel/demo/off`
  - limpia el runtime demo
  - redirige a `/panel/login`

### 2. Runtime demo persistido

Se implemento un runtime demo persistido en front, controlado por flag publica:

- `NEXT_PUBLIC_ENABLE_PANEL_DEMO`

El runtime guarda el escenario demo activo y solo se utiliza si:

- la flag esta encendida;
- y existe un runtime demo valido persistido.

Si la flag esta apagada, el flujo live sigue su camino actual y el runtime demo almacenado no se usa.

### 3. Provider demo-aware

`PanelProvider` quedo demo-aware.

Comportamiento implementado:

- si hay runtime demo valido, devuelve `PanelUserInfo` sintetico;
- si no hay runtime demo valido, conserva el fetch live actual de `/panel/me`;
- expone ademas `isDemo` y `demoScenario` para el consumo del panel.

### 4. Identidad sintetica

Se agrego identidad sintetica para ambos escenarios:

- `bar`
- `discoteca`

Esa identidad sintetica es la que alimenta:

- header del panel;
- shell;
- sidebar;
- gating existente por `local.type`.

### 5. Dashboard demo-aware

El dashboard de `/panel` quedo como unica vista demo-enabled del Bloque 1.

Comportamiento implementado:

- si hay runtime demo activo, el dashboard usa fixtures demo tipados;
- si no hay runtime demo activo, conserva el consumo live existente;
- el chequeo de sesion live sigue vigente cuando no hay runtime demo.

## Archivos tocados en Bloque 1

- `docs/panel/PANEL_DEMO_DISCOVERY.md`
- `apps/web-next/lib/panelContext.tsx`
- `apps/web-next/lib/panel-demo/runtime.ts`
- `apps/web-next/lib/panel-demo/identity.ts`
- `apps/web-next/lib/panel-demo/dashboard.ts`
- `apps/web-next/app/panel/demo/[scenario]/page.tsx`
- `apps/web-next/app/panel/(authenticated)/page.tsx`

## Pruebas manuales realizadas

Pruebas manuales ejecutadas y reportadas OK para el cierre del bloque:

- `/panel/demo/bar` OK
- `/panel/demo/discoteca` OK
- `/panel/demo/off` OK
- flujo live preservado OK
- runtime persistido OK

Adicionalmente, el bloque quedo validado tecnicamente con:

- `pnpm -C apps/web-next typecheck`

## Resultado de validacion

Resultado del cierre:

- Bloque 1 implementado;
- Bloque 1 validado;
- Bloque 1 cerrado.

Hechos que quedan asentados como comprobados:

- el panel entra a demo mode desde una ruta controlada;
- el runtime demo persiste en front;
- el shell y el sidebar reaccionan al escenario correcto;
- el dashboard renderiza con data demo;
- el flujo live no quedo roto por este bloque.

## Hallazgos y decisiones importantes

- Se confirmo que `dashboard` era la vista inicial de menor riesgo para validar demo runtime.
- Se mantuvo el alcance estrictamente en el seam minimo: ruta demo, runtime, provider, identidad y dashboard.
- No se tocaron modulos operativos fuera de scope.
- No se introdujeron dependencias nuevas.
- No se reabrio la arquitectura definida en discovery.

## Limites actuales del demo

En este checkpoint, el demo del panel cubre funcionalmente solo:

- shell del panel;
- sidebar segun escenario;
- identidad sintetica;
- dashboard demo-aware.

No quedan demo-enabled en este bloque:

- metrics
- reservations
- orders
- calendar
- promos
- support
- checkin
- profile

## Exclusiones aclaradas

### Exclusion funcional explicita

`/panel/marketing/lineup` no debe considerarse modulo funcional objetivo del panel demo.

Queda asentado como:

- vista temporal usada para disenos;
- fuera del roadmap funcional demo;
- candidata a remocion futura;
- no base para ampliar alcance del panel demo.

### Exclusion de alcance

Este documento no define ni detalla el Bloque 2.

Su funcion es:

- cerrar Bloque 1;
- registrar validacion;
- y dejar un checkpoint claro para retomar el proceso despues.

## Estado actual / checkpoint

Estado operativo actual:

- discovery documentado;
- Bloque 1 implementado;
- Bloque 1 validado;
- Bloque 1 cerrado;
- panel demo listo para retomarse desde un siguiente bloque separado.

Punto exacto de reanudacion:

- partir de este checkpoint;
- conservar el principio de menor alcance;
- abrir el siguiente bloque solo con nuevo recorte documental previo si hace falta.

## Siguiente paso recomendado a nivel proceso

Antes de volver a CODE:

- definir el siguiente slice funcional mas chico;
- documentar ese recorte en `docs/panel/`;
- mantener el mismo criterio de no invadir modulos fuera de scope;
- y seguir tratando el panel demo por bloques cortos, verificables y reversibles.

No corresponde usar este documento para:

- ampliar alcance;
- reabrir decisiones cerradas del Bloque 1;
- ni convertirlo en un plan detallado del siguiente bloque.
