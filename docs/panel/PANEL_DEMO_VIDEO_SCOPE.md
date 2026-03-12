# PANEL DEMO — VIDEO SCOPE

## Estado

A partir de este punto, el objetivo activo del panel demo queda recortado exclusivamente a completar las pantallas necesarias para un video grabado.

Este documento deja asentado el re-scope operativo de la iniciativa y pasa a ser la referencia principal para los proximos prompts relacionados con el panel demo.

Documentos relacionados:

- `docs/panel/PANEL_DEMO_DISCOVERY.md`
- `docs/panel/PANEL_DEMO_BLOQUE_1_CIERRE.md`

## Contexto

La iniciativa de panel demo nacio con una ambicion mas amplia: reutilizar el panel B2B real con runtime demo front-only para escenarios comerciales de `bar` y `discoteca`, preservando el flujo live y evitando tocar backend, API, DB o tenants reales.

Ese marco general sigue siendo valido como criterio tecnico.

Sin embargo, a nivel de producto y prioridad operativa, el objetivo activo ya no es una demo navegable amplia para vivo, sino un recorte mucho mas concreto: dejar listas solo las pantallas que van a aparecer en un video grabado.

## Motivo del re-scope

Este re-scope se hace para:

- reducir alcance;
- concentrar el esfuerzo en una salida concreta y verificable;
- evitar abrir modulos no necesarios para el entregable inmediato;
- mantener la iniciativa en bloques chicos, revisables y de menor riesgo.

La prioridad ya no es cubrir una experiencia demo extensa del panel, sino asegurar un set chico de pantallas con calidad suficiente para grabacion.

## Objetivo activo actual

El objetivo activo del panel demo es exclusivamente:

- completar las pantallas necesarias para el video grabado;
- reutilizando el panel real;
- sobre runtime demo front-only;
- sin reabrir la ambicion de demo en vivo amplia en esta etapa.

Este objetivo reemplaza cualquier priorizacion anterior que asumiera una expansion inmediata hacia una demo comercial mas completa en vivo.

## Pantallas objetivo del video

### Bares

- Dashboard
- Reservas
- Metricas

### Boliches

- Dashboard
- Entradas
- Metricas

Estas son, por ahora, las unicas pantallas funcionales objetivo del panel demo.

## Estado actual de avance

Estado confirmado al momento de este re-scope:

- Bloque 1 quedo implementado, validado y cerrado.
- Existe runtime demo persistido.
- Existe identidad sintetica demo.
- Existe ruta `/panel/demo/[scenario]`.
- `PanelProvider` quedo demo-aware.
- El dashboard `/panel` quedo demo-enabled.
- Dashboard ya esta resuelto para ambos escenarios:
  - bar
  - boliche / discoteca

Por lo tanto, las pantallas pendientes para el video quedan reducidas a:

### Pendientes en bar

- Reservas
- Metricas

### Pendientes en boliche

- Entradas
- Metricas

## Que queda fuera de alcance por ahora

Queda fuera del objetivo activo actual:

- una demo en vivo amplia del panel;
- ampliar cobertura a modulos no necesarios para el video;
- calendar;
- promos;
- support;
- checkin;
- profile;
- cualquier flujo pesado no imprescindible para grabacion;
- cualquier expansion de alcance que no responda directamente a las pantallas del video.

## Exclusiones aclaradas

### Exclusion funcional explicita

`/panel/marketing/lineup` no debe considerarse modulo funcional objetivo del panel demo.

Queda asentado como:

- vista temporal usada para disenos;
- fuera del roadmap funcional demo;
- candidata a remocion futura;
- no referencia valida para priorizar trabajo futuro del panel demo.

### Exclusion de objetivo

La demo en vivo amplia no es el objetivo actual.

Si en el futuro vuelve a abrirse esa linea, debera tratarse como una nueva decision de alcance y documentarse por separado.

## Relacion con los documentos previos

### Sobre `PANEL_DEMO_DISCOVERY.md`

Ese documento sigue siendo valido como base de arquitectura, restricciones y principios tecnicos generales:

- un solo panel real;
- runtime demo controlado;
- fixtures por dominio;
- preservacion del flujo live;
- cambios chicos y verificables.

Sin embargo, cualquier backlog o priorizacion ahi planteado debe leerse ahora bajo este nuevo recorte de objetivo.

### Sobre `PANEL_DEMO_BLOQUE_1_CIERRE.md`

Ese documento sigue siendo la fuente de verdad del cierre tecnico y de QA del Bloque 1.

No se redefine ni se reemplaza.

Este nuevo documento solo cambia el objetivo activo hacia adelante.

## Criterio para los siguientes bloques

A partir de este checkpoint, los proximos bloques del panel demo deben evaluarse solo contra este criterio:

- si la pantalla entra en el video, puede entrar al roadmap inmediato;
- si la pantalla no entra en el video, queda fuera por ahora;
- si existen varias opciones viables, priorizar la de menor riesgo y menor superficie de cambio;
- preservar siempre el flujo live cuando el demo mode esta apagado;
- no reabrir alcance hacia demo en vivo amplia sin un nuevo re-scope documentado.

## Checkpoint operativo

Checkpoint vigente desde este documento:

- Bloque 1 cerrado y validado;
- dashboard listo para bar y boliche;
- objetivo activo recortado a video grabado;
- roadmap funcional inmediato limitado a:
  - bar: reservas, metricas;
  - boliche: entradas, metricas;
- demo en vivo amplia deferida;
- `marketing/lineup` fuera del roadmap funcional demo.

Este documento debe tomarse como referencia operativa principal para los siguientes prompts del panel demo hasta nuevo aviso.
