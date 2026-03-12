# PANEL DEMO DISCOVERY

## Contexto

Se necesita una demo navegable del panel B2B de Tairet para ventas, reusable tanto en video como en vivo, sin tocar backend, API, DB ni tenants reales.

El objetivo de esta iniciativa no es crear un panel paralelo, sino reutilizar el panel real con una capa de datos demo front-only que permita mostrar dos escenarios comerciales:

- `bar`
- `discoteca`

## Objetivo

Definir e implementar por etapas la forma mas simple, rapida y de menor riesgo de correr el panel real con data demo coherente, preservando completamente el flujo live cuando el demo mode esta apagado.

## Hallazgos del repo

### Estructura del panel

- El panel B2B vive en `apps/web-next`.
- El layout autenticado reutiliza el mismo shell para todos los modulos: `app/panel/(authenticated)/layout.tsx`.
- El sidebar ya cambia segun `data.local.type`, por lo que el branching principal entre bar y discoteca ya existe y no requiere paneles duplicados.
- La navegacion principal observada:
  - Bar: dashboard, reservas, calendario, promociones, lineup, metricas, perfil, soporte.
  - Discoteca: dashboard, check-in, entradas, calendario, promociones, lineup, metricas, perfil, soporte.

### Data flow actual

- `PanelProvider` resuelve identidad basica del panel via `GET /panel/me`.
- No existe una query layer consolidada en uso; predomina `useEffect + state + helpers lib/*`.
- Existen algunos outliers con `fetch` directo, especialmente en `orders` y `checkin`.
- Varias vistas visibles ya son prop-driven, lo que favorece alimentar UI real con fixtures tipados.

### Patrones reutilizables

- Existen `sandbox views` en panel:
  - `components/panel/views/DashboardSandboxView.tsx`
  - `components/panel/views/ReservationsSandboxView.tsx`
- En B2C ya existe una convencion `lib/mocks` y fallback DB-first con mocks, lo que da un precedente util para organizar fixtures demo.

### Riesgos observados

- `PanelProvider` solo cubre identidad; no centraliza toda la data del panel.
- El dashboard hace un chequeo de sesion por separado, por lo que un provider-only switch no alcanza.
- `metrics` y `marketing/lineup` hoy comparten la misma vista, lo que confirma deuda semantica existente pero no bloquea la estrategia demo.
- La documentacion vigente del panel esta parcialmente desalineada con el data layer real.

## Veredicto arquitectonico

La direccion correcta, respaldada por la estructura real del repo, es:

- un solo panel real;
- un demo mode global front-only;
- dos escenarios demo: `bar` y `discoteca`;
- fixtures y adapters por dominio;
- sin clonar paginas ni paneles;
- sin tocar backend, API, DB, seeds, migraciones ni tenants reales.

## Alternativas descartadas

### Clonar paneles o pantallas

Descartado. Duplicaria layout, sidebar, branching por tipo de local y mantenimiento futuro sin que el repo ofrezca una ventaja concreta para hacerlo.

### Cuenta demo apoyada en backend

Descartado para esta fase. El backend del panel esta acoplado a `panel_users.local_id` y a `panelAuth`, lo que choca con la restriccion de no tocar backend/DB y aumenta el riesgo innecesariamente.

### Interceptar `window.fetch` globalmente

Descartado como primera opcion. Reduciria cambios puntuales hoy, pero seria una capa opaca y fragil para evolucionar.

## Alcance comercial recomendado

### Modulos de mayor valor demo

- dashboard
- reservations para bar
- orders para discoteca
- calendar
- metrics / lineup
- profile preview

### Modulos a simplificar o diferir

- promos como read-only o semi-simulado
- check-in sin scanner real en una etapa posterior
- profile full edit, uploads, catalog CRUD y flujos destructivos fuera del primer corte

## Bloque 1 minimo aprobado

El primer slice CODE queda recortado a:

- ruta de entrada demo `/panel/demo/:scenario`;
- runtime demo persistido en front;
- `PanelProvider` demo-aware para identidad sintetica;
- render correcto del panel shell/sidebar segun `bar` o `discoteca`;
- dashboard como unica vista demo-enabled del Bloque 1.

### Fuera de scope de Bloque 1

- `metrics`
- `lineup`
- `reservations`
- `orders`
- `calendar`
- `promos`
- `support`
- `checkin`
- `profile`
- cualquier refactor de outliers grandes

## Activacion y desactivacion del demo runtime

### Flag de entorno

- `NEXT_PUBLIC_ENABLE_PANEL_DEMO=true` habilita la ruta demo y la lectura del runtime persistido.
- si la flag esta apagada, el flujo live se mantiene intacto y el runtime demo almacenado no se usa.

### Rutas

- `/panel/demo/bar`
  - persiste runtime demo con escenario `bar`
  - redirige a `/panel`
- `/panel/demo/discoteca`
  - persiste runtime demo con escenario `discoteca`
  - redirige a `/panel`
- `/panel/demo/off`
  - limpia el runtime demo
  - redirige a `/panel/login`

## Garantia de no regresion live

El flujo live debe seguir intacto porque:

- el provider solo usa demo runtime si la flag publica esta encendida y el runtime valido existe;
- si no hay runtime demo valido, el panel conserva su comportamiento actual;
- el Bloque 1 no toca backend ni contratos de API;
- el dashboard es el unico modulo que cambia de origen de datos bajo demo mode.

## Riesgos e incertidumbres

- Otros modulos del panel todavia no son demo-aware en este bloque; por eso la garantia funcional del Bloque 1 se limita al shell/sidebar y al dashboard.
- El boton actual de logout no sera la via de apagado del demo runtime en este corte; la salida limpia del modo demo queda documentada via `/panel/demo/off`.
- Antes de ampliar alcance conviene validar comercialmente si el siguiente paso debe ser analytics read-only o un primer modulo operativo.

## Backlog recomendado

### Bloque 2

- extender demo runtime a `/panel/metrics` y `/panel/marketing/lineup`
- agregar fixtures por dominio para `metrics`, `activity` y `metricsBreakdown`
- mantener todo read-only

### Bloque 3

- sumar `reservations` para bar y `orders` para discoteca
- resolver lectura, filtros y semisimulacion minima de acciones locales
- seguir sin tocar `checkin`, uploads, export real y CRUD pesados
