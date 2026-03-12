# PANEL ANALYTICS - CIERRE DE ETAPA

## Estado

La etapa de analytics del panel B2B queda cerrada a nivel de implementacion en el alcance aprobado.

Este documento deja asentado:

- que superficies quedaron alcanzadas;
- que cambios de datos/contrato quedaron incorporados;
- que cambios visuales/copy quedaron cerrados;
- y desde que checkpoint debe retomarse el trabajo luego, sin reabrir analytics desde cero.

Documentos relacionados:

- `docs/panel/PANEL_DEMO_DISCOVERY.md`
- `docs/panel/PANEL_DEMO_BLOQUE_1_CIERRE.md`
- `docs/panel/PANEL_DEMO_VIDEO_SCOPE.md`
- `docs/panel/PANEL_DEMO_UI_POLISH_RESERVAS_ORDERS_CIERRE.md`
- `docs/panel/PANEL_DEMO_BLOQUE_3_ORDERS_DISCOTECA_CIERRE.md`
- `docs/panel/PANEL_ANALYTICS_SOURCE_OF_TRUTH.md`

## Contexto breve

El objetivo de esta etapa fue cerrar la lectura analitica y operativa del panel dentro del scope de video grabado, sin reabrir decisiones funcionales ya cerradas.

El enfoque que queda consolidado es:

- Dashboard responde que esta pasando.
- Metricas responde por que esta pasando.
- Entradas queda como modulo operativo por fecha concreta.
- Visitas al perfil se mantiene como KPI + sparkline.
- Preventa vive en Entradas.

## Alcance cerrado de la etapa

### 1. Entradas / preventa por fecha (`/panel/orders`)

Quedo implementado:

- anclaje semantico del modulo a la fecha seleccionada;
- encabezado contextual por estado temporal:
  - futura
  - hoy
  - pasada
- limpieza de etiquetas redundantes de estado temporal;
- KPI de `Ingresos de entradas` integrado al summary;
- `Ultima compra` y `Ritmo reciente de venta` resueltos desde summary para fecha futura;
- grilla final de 4 KPIs en una sola linea, con composicion distinta segun:
  - futura
  - hoy
  - pasada

Decisiones semanticas que quedan cerradas:

- el modulo se lee como preventa / operacion / resultado segun la fecha elegida;
- no se trata como agregado abstracto;
- la fecha seleccionada es la referencia principal de toda la pantalla;
- `Ultima compra` y `Ritmo reciente` no salen del listado visible;
- la ventana de `Ritmo reciente de venta` queda fijada en `ultimas 24 h`.

KPIs por estado temporal que quedan definidos:

- Futura:
  - `Vendidas para esta fecha`
  - `Ingresos acumulados`
  - `Ritmo reciente de venta`
  - `Ultima compra`
- Hoy:
  - `Vendidas hoy`
  - `Usadas`
  - `Pendientes`
  - `Ingresos de hoy`
- Pasada:
  - `Vendidas ese dia`
  - `Usadas`
  - `No usadas`
  - `Ingresos de ese dia`

### 2. Metricas discoteca (`/panel/metrics`)

Quedo ajustado visualmente:

- mayor firmeza y legibilidad en la lectura de series;
- menor suavizado excesivo;
- mejor lectura de picos y caidas;
- correccion del hover/tooltip en `Entradas por tipo / Tendencia en el tiempo`;
- criterio visual consistente entre modo `Entradas` y modo `Ingresos`.

Quedo cerrado en tipos/colores/copy:

- tipos visibles:
  - `General`
  - `Free pass`
  - `Backstage`
- colores diferenciados por tipo sin colision visual;
- `VIP` queda reemplazado en copy visible por `Free pass`;
- `Free pass` queda con revenue cero en la capa demo;
- promo destacada de discoteca cerrada como `2x1 en Fernet`;
- copy visible ajustado:
  - `Compras`
  - `Vendidas`
  - `Entradas usadas`
  - `Suma de entradas vendidas en el periodo.`

Tambien quedo implementado:

- ampliacion de `Mesas con mas interes` de 4 a 6 items;
- cierre del revenue demo y de la relacion con volumentria vendida;
- coherencia entre Dashboard / Entradas / Metricas dentro del scope aprobado.

Se mantuvo igual a proposito:

- la estructura principal de la pantalla;
- el bloque `Entradas por tipo + tabla + tendencia + ingresos`;
- el enfoque funcional del modulo;
- el uso de `Visitas al perfil` solo como KPI + sparkline en dashboard.

### 3. Visitas al perfil

Rol final del bloque:

- KPI + sparkline de apoyo;
- no grafico protagonista;
- no superficie analitica principal por si sola.

Quedo mejorado:

- mayor legibilidad del sparkline;
- lectura mas clara de pico/caida;
- mejor consistencia con el resto de analytics del panel.

No se convirtio en:

- grafico principal del dashboard;
- visual protagonista de metricas;
- analisis separado de trafico.

### 4. Metricas bar (`/panel/metrics`)

Evolucion del bloque:

- primero se incorporo source of truth nueva para lecturas por dia/franja basada en `reservations.date`;
- luego se agrego source of truth final para lectura lineal por estado y horario promedio operativo;
- finalmente se resolvio el bloque analitico como una tarjeta unica con switch:
  - `Por dia`
  - `Por hora`

Shapes / series nuevas agregadas:

- `series.reservations_by_daypart`
- `series.reservation_daypart_meta`
- `series.reservations_status_hour_by_day`
- `series.reservation_status_hour_meta`

Resolucion final del switch:

- `Por dia`:
  - lectura por estados;
  - usa `reservations_by_status`;
  - mantiene una lectura temporal simple del periodo activo.
- `Por hora`:
  - lectura de trafico total de reservas;
  - usa `reservations_status_hour_by_day`;
  - deriva localmente una sola linea `Reservas totales`;
  - mantiene el mismo orden cronologico del periodo activo;
  - tooltip explicita hora promedio total + count.

Lectura final de cada modo:

- `Por dia` responde una lectura semanal simple por estado.
- `Por hora` responde comportamiento horario total a lo largo del mismo periodo.

## Cambios de datos / contrato que quedaron cerrados

Quedan cerrados los siguientes cambios de shape/contrato:

- Summary de `/panel/orders`:
  - `revenue_paid`
  - `latest_purchase_at`
  - `recent_sales_qty`
  - `recent_sales_window_label`
- Contrato de metricas para `bar`:
  - `reservations_by_daypart`
  - `reservation_daypart_meta`
  - `reservations_status_hour_by_day`
  - `reservation_status_hour_meta`
- Reglas cerradas para la source of truth horaria de `bar`:
  - basada en `reservations.date`
  - usa `reservations.status`
  - `en_revision` se absorbe como `pending`
  - ventana operativa `18:00-00:00`
  - `00:00` se representa como `24.0`
  - fuera de ventana se excluye
  - dias/estados sin datos devuelven `null + count 0`
- Capa demo alineada con live para:
  - orders summary extendido
  - metricas `bar`
  - metricas `discoteca`

## Cambios visuales / copy que quedaron cerrados

Quedan cerrados:

- relectura de `/panel/orders` como modulo por fecha concreta;
- encabezado contextual compacto por fecha;
- grilla fija de 4 KPIs por estado temporal;
- limpieza de labels redundantes en Entradas;
- copy visible de discoteca ajustado a lenguaje de panel;
- legibilidad mejorada de `Metricas discoteca`;
- sparkline de `Visitas al perfil` mas claro sin volverlo protagonista;
- `Metricas bar` resuelto con switch `Por dia / Por hora` dentro del mismo bloque analitico.

## Que quedo explicitamente fuera de alcance

Queda fuera de esta etapa:

- rediscutir el enfoque funcional ya cerrado;
- reabrir analytics como discovery amplio;
- tratar `marketing/lineup` como objetivo funcional;
- limpieza arquitectonica amplia de vistas compartidas;
- cambios en backend, DB, provider, runtime o layout fuera de las shapes minimas ya agregadas;
- nuevas features analiticas fuera de las superficies ya cerradas;
- rediseño general del panel.

## Pendientes menores no bloqueantes

Quedan solo pendientes menores de QA visual/manual:

- validacion visual final en browser de:
  - spacing y jerarquia de `/panel/orders`;
  - lectura final de `Metricas discoteca`;
  - lectura final del switch `Por dia / Por hora` en `Metricas bar`;
  - spacing final de `Mesas con mas interes` con 6 items;
  - comportamiento visual en desktop y mobile de las superficies ajustadas.

No quedan pendientes abiertos de arquitectura o contrato dentro del alcance de analytics de esta etapa.

## Checkpoint operativo

Checkpoint vigente:

- la etapa de analytics del panel queda cerrada a nivel de implementacion;
- `/panel/orders` queda resuelto como modulo operativo por fecha;
- `Metricas discoteca` queda cerrada en el alcance funcional y visual aprobado;
- `Visitas al perfil` queda estabilizado como KPI + sparkline;
- `Metricas bar` queda cerrada con doble lectura `Por dia / Por hora`;
- los contratos minimos necesarios ya quedaron incorporados.

Para retomar trabajo mas adelante:

- no hace falta reabrir analytics como discovery general;
- el punto de partida debe ser este cierre y `PANEL_ANALYTICS_SOURCE_OF_TRUTH.md`;
- cualquier siguiente etapa debe tratarse como un bloque nuevo y acotado, no como continuidad abierta de definiciones pendientes en analytics.
