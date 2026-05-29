# Runtime Demo Comercial Plan

## 1. Proposito

Este documento define el plan para convertir el runtime demo del panel de Tairet en parte de una demo comercial oficial para reuniones.

El objetivo es tener un journey comercial solido, coherente y controlado: primero se muestra la experiencia B2C del local demo y despues se muestra el B2B/panel demo del mismo local. Este documento no implementa cambios de codigo, fixtures, assets, backend, SQL ni configuracion. Es una guia de discovery y roadmap para los siguientes slices.

## 2. Decision de producto

La decision de producto es que la demo comercial sea un journey coordinado:

`B2C demo visual -> B2B runtime demo`.

La demo no debe convertir D'Lirio ni McKarthy's en demo comercial operativa.

Separacion vigente:

- panel operativo / seed actual:
  - D'Lirio, McKarthy's y otros locales de prueba o QA siguen siendo datos operativos/seed;
  - no deben inflarse metricas ni cambiarse identidad de esos locales para vender;
  - cualquier override temporal sobre esos slugs debe tratarse como deuda demo/video, no como estrategia final.
- runtime demo comercial:
  - debe usar datos demo propios;
  - debe mantenerse front-only y separado de datos operativos;
  - debe tener dos variantes comerciales: demo discoteca y demo bar.
- demo journey B2C+B2B:
  - B2C y B2B deben compartir identidad visual;
  - B2C y B2B deben compartir narrativa comercial;
  - promociones, perfil, imagenes, metricas e historial deben sentirse conectados;
  - B2C muestra la experiencia del cliente;
  - B2B muestra como el local gestiona esa presencia, entradas/reservas, promociones, perfil, metricas e historial.
- assets demo:
  - las imagenes actuales usadas por D'Lirio y McKarthy's pueden servir como base visual porque no pertenecen a marcas externas;
  - para mantener separacion clara, deben copiarse o abstraerse como assets demo;
  - no deben consumirse como datos operativos vivos del seed.

## 3. Problema actual

El runtime demo ya existe y sirve para mostrar el panel, pero todavia no esta pulido como demo comercial oficial.

Problemas detectados:

- la identidad base del runtime demo ya fue alineada a `Koala Jack` y `Tairet Bar`, pero el journey B2C+B2B todavia no esta coordinado completo;
- Promociones demo tiene contenido funcional, pero todavia debe conectarse con assets y narrativa comercial por variante;
- Perfil del Local demo usa nombres, direccion y telefonos claramente ficticios;
- hay superficies graficas con textos como `Superficie demo para Perfil del Local`;
- el historial operativo por registro ya quedo integrado al runtime demo en Slice 5;
- las mejoras visibles del panel operativo deben revisarse contra la politica de paridad demo para evitar que la demo vuelva a quedar atrasada;
- existen overrides temporales sobre `dlirio` y `mckharthys-bar` que pueden confundirse con estrategia demo si no se documentan;
- el alias B2C `D'Lirio -> Koala Jack` es parcial y puede mezclar nombres dentro de la misma pantalla;
- el B2C de bar todavia no esta coordinado con `Tairet Bar`;
- si B2C y B2B cuentan historias distintas, el panel demo pierde fuerza comercial aunque este pulido.

## 4. Estado actual detectado

Activacion del runtime demo:

- `NEXT_PUBLIC_ENABLE_PANEL_DEMO=true` habilita el modo demo;
- `GET /panel/demo/bar` activa el escenario `bar` desde el navegador;
- `GET /panel/demo/discoteca` activa el escenario `discoteca` desde el navegador;
- `GET /panel/demo/off` limpia el runtime demo y vuelve al flujo live/login;
- el estado se guarda en `localStorage` con key `tairet.panel.demo`;
- los escenarios validos actuales son `bar` y `discoteca`.

Fuente tecnica actual:

- runtime: `apps/web-next/lib/panel-demo/runtime.ts`;
- identidad: `apps/web-next/lib/panel-demo/identity.ts`;
- dashboard/metricas: `apps/web-next/lib/panel-demo/dashboard.ts`;
- activity global demo: `apps/web-next/lib/panel-demo/activity.ts`;
- ordenes demo discoteca: `apps/web-next/lib/panel-demo/orders.ts`;
- reservas demo bar: `apps/web-next/lib/panel-demo/reservations.ts`;
- promociones demo: `apps/web-next/lib/panel-demo/promos.ts`;
- perfil demo: `apps/web-next/lib/panel-demo/profile.ts`;
- calendario demo: `apps/web-next/lib/panel-demo/calendar.ts`;
- breakdown de metricas demo: `apps/web-next/lib/panel-demo/metricsBreakdown.ts`;
- tiempo/rangos demo: `apps/web-next/lib/panel-demo/time.ts`.

Modulo demo-ready documentado:

- Dashboard / Inicio para `bar` y `discoteca`;
- Reservas para `bar`;
- Entradas para `discoteca`;
- Metricas para `bar` y `discoteca`;
- Promociones para `bar` y `discoteca`;
- Perfil del Local para `bar` y `discoteca`;
- Calendario para `bar` y `discoteca`.

Fuera de demo-ready actual:

- Check-in/scanner real;
- Soporte/Settings;
- paid flows.

Brechas puntuales:

- `apps/web-next/lib/panel-demo/variants.ts` ya centraliza `demoClub` y `demoBar`;
- `apps/web-next/lib/panel-demo/identity.ts` y `apps/web-next/lib/panel-demo/profile.ts` ya consumen la identidad base `Koala Jack` / `Tairet Bar`;
- `apps/web-next/lib/panel-demo/profile.ts` todavia usa `Av. Demo 1234` y superficies demo;
- `apps/web-next/lib/panel-demo/promos.ts` tiene fixtures demo, pero falta conectarlos con assets comerciales coordinados B2C+B2B;
- Slice 5 corrigio la paridad visible de Entradas/Reservas demo:
  - Entradas demo discoteca muestra `Validar` demo-only e `Historial`;
  - Reservas demo bar muestra `Historial`;
  - ambos historiales usan datos locales/mock y no endpoints.
- `apps/web-next/lib/panel-demo/activity.ts` alimenta actividad global de metricas/lineup, no historial por registro;
- `apps/web-next/lib/panelContext.tsx` tiene overrides visuales temporales para `dlirio` y `mckharthys-bar`;
- `apps/web-next/app/panel/(authenticated)/marketing/promos/page.tsx` tiene overrides temporales de vistas para `dlirio` y `mckharthys-bar`.

B2C detectado:

- `apps/web-b2c/src/pages/ClubProfile.tsx` usa `heroDisplayName = clubId === "dlirio" ? "Koala Jack" : clubData.name`;
- ese alias se aplica al hero de `dlirio`;
- otras superficies siguen usando `clubData.name`, por ejemplo galeria, compra/reserva y mapa;
- `apps/web-b2c/src/lib/mocks/clubs.ts` mantiene `dlirio` con `name: "DLirio"` y assets `dlirio-gallery-*`;
- `apps/web-b2c/src/pages/BarProfile.tsx` usa `barData.name` de forma amplia;
- `apps/web-b2c/src/lib/mocks/bars.ts` mantiene `mckharthys-bar` con `name: "Mckharthys Bar"` y copy asociado a McKarthy's;
- no existe todavia un B2C visual coordinado para `Tairet Bar`.

## 5. Arquitectura demo recomendada

Mantener tres planos separados:

1. Datos operativos / seed:
   - D'Lirio, McKarthy's y otros locales siguen para QA, smoke o uso operativo;
   - no se renombran para demo comercial;
   - no se inflan metricas operativas para venta.
2. Runtime demo comercial:
   - sigue siendo front-only;
   - usa fixtures propios;
   - no llama endpoints sensibles para simular la reunion;
   - mantiene escenarios `bar` y `discoteca`;
   - centraliza identidad, metricas, promociones, perfil, activity, ordenes y reservas demo.
3. B2C demo visual coordinado:
   - forma parte del journey comercial;
   - debe sentirse como el mismo local que luego se administra en el panel demo;
   - debe usar identidad, narrativa y assets demo coherentes;
   - no debe renombrar datos operativos ni consumir seed vivo como fuente comercial.

La demo comercial debe reutilizar componentes reales del panel y del B2C cuando sea posible, pero alimentar esas superficies con una fuente de verdad demo consistente y no con datos operativos alterados.

Flujo recomendado para reuniones:

1. Abrir B2C del local demo para mostrar la experiencia del cliente.
2. Pasar al B2B/runtime demo para mostrar como el local gestiona esa misma presencia.
3. Mantener nombre, imagenes, promociones y narrativa conectados en ambos lados.

## 6. Variantes demo

### Demo discoteca

Nombre recomendado: `Koala Jack`.

Uso en el journey:

- B2C: perfil publico visualmente presentado como `Koala Jack`;
- B2B: `/panel/demo/discoteca` presentado como `Koala Jack`;
- base visual: assets actuales usados por D'Lirio, copiados o abstraidos como assets demo separados.

Debe mostrar:

- dashboard con metricas de discoteca;
- Entradas/free pass;
- estados de validacion/check-in representados en ordenes demo;
- historial operativo por entrada;
- actores visibles como `Owner Martin` o `Staff Martin`;
- promociones de discoteca sin placeholders;
- Perfil del Local coherente con Koala Jack;
- actividad global creible;
- imagenes, textos, catalogo y horarios consistentes.

### Demo bar

Nombre recomendado: `Tairet Bar`.

Uso en el journey:

- B2C: perfil publico visualmente presentado como `Tairet Bar`;
- B2B: `/panel/demo/bar` presentado como `Tairet Bar`;
- base visual: assets actuales usados por McKarthy's, copiados o abstraidos como assets demo separados.

Nota de naming:

- si se decide mostrar solo `Tairet` en alguna superficie, documentarlo como `displayName` comercial;
- el nombre recomendado para evitar confusion con la plataforma es `Tairet Bar`.

Debe mostrar:

- dashboard con metricas de bar;
- Reservas;
- historial operativo por reserva;
- actores visibles como `Owner Martin` o `Staff Martin`;
- promociones de bar sin placeholders;
- Perfil del Local coherente con Tairet Bar;
- actividad global creible;
- imagenes, textos, horarios y zonas consistentes.

## 7. Fuente de verdad demo

La fuente de verdad demo recomendada debe centralizarse conceptualmente alrededor de dos objetos o modulos equivalentes:

- `demoClub`;
- `demoBar`.

Cada variante deberia agrupar o referenciar:

- identidad: nombre, slug, tipo, email visible demo;
- profile: descripcion, zona, direccion, horarios, atributos, imagenes, telefono demo;
- metrics: KPIs, series, breakdown y rangos;
- promos: titulos, descripciones, imagenes, estado, vistas;
- activity: ultimas acciones globales;
- orders: entradas/free pass, estados y fechas;
- reservations: reservas, estados, fechas y notas internas demo no sensibles;
- operationalActivity: historial por registro para ordenes/reservas demo;
- calendar: eventos/reservas por fecha.

Reglas:

- no hacer backfill ni lectura desde seed operativo;
- no usar `dlirio` ni `mckharthys-bar` como fuente comercial;
- no consumir imagenes de D'Lirio/McKarthy's como datos operativos vivos;
- copiar o abstraer assets usados como demo hacia una ruta demo separada;
- no renderizar placeholders visibles;
- no mostrar PII real;
- no mostrar tokens reales;
- no distinguir QR/manual en el historial demo;
- no conectar demo a paid flows.

Estructura conceptual para assets demo:

```text
apps/web-next/public/demo/koala-jack/
  cover
  gallery
  promos
  profile

apps/web-next/public/demo/tairet-bar/
  cover
  gallery
  promos
  profile
```

Si B2C necesita servir los mismos assets desde su propia app, el slice de assets debe definir una ruta equivalente en `apps/web-b2c` o una estrategia compartida segura. La regla importante es que los assets demo queden separados del seed operativo.

## 8. Politica de assets demo

Decision vigente:

- no se usara el panel operativo para subir imagenes del runtime demo comercial en este bloque;
- el panel operativo no sera usado como CMS de la demo;
- las imagenes comerciales de la demo se manejaran como assets versionados en el repo;
- el runtime demo consumira esas rutas por mapping central;
- los reemplazos de imagenes deben mantener nombres/rutas estables para evitar cambios de codigo.

Motivos:

- subir desde el panel puede modificar datos operativos/seed;
- puede mezclar demo con live/QA;
- requiere storage, persistencia y permisos si se quiere hacer correctamente;
- agrega scope innecesario para una demo comercial;
- puede hacer que la demo dependa de datos externos o estado mutable;
- dificulta reproducir la demo en deploys y reuniones.

Estructura recomendada:

```text
apps/web-next/public/demo/koala-jack/
  cover.jpg
  gallery-01.jpg
  gallery-02.jpg
  gallery-03.jpg
  promo-01.jpg
  promo-02.jpg
  promo-03.jpg
  promo-04.jpg

apps/web-next/public/demo/tairet-bar/
  cover.jpg
  gallery-01.jpg
  gallery-02.jpg
  gallery-03.jpg
  promo-01.jpg
  promo-02.jpg
  promo-03.jpg
  promo-04.jpg
```

Notas:

- los nombres pueden ajustarse si el mapping real usa otra convencion;
- lo importante es mantener rutas estables;
- si se reemplaza una imagen, mantener el nombre cuando sea posible;
- si hace falta agregar una nueva ruta, actualizar primero el mapping central;
- no usar D'Lirio ni McKarthy's como fuente viva de imagenes demo;
- no usar Supabase Storage ni uploads del panel para esta demo comercial.

## 9. Politica de paridad demo

Cada nuevo feature visible del panel debe clasificarse al cierre:

1. Demo-required:
   - debe aparecer en la demo comercial;
   - requiere fixture/demo adapter;
   - requiere QA en `/panel/demo/bar` y/o `/panel/demo/discoteca`.
2. Demo-optional:
   - puede quedar fuera hasta que sea util comercialmente;
   - se documenta como pendiente.
3. Demo-excluded:
   - no corresponde a la demo comercial;
   - ejemplos: paid flows, `/payments/callback`, configuraciones sensibles, operaciones backend internas.

Reglas:

- si un feature visible se vende o se muestra en reuniones, debe tener soporte demo;
- si no se actualiza el runtime demo, este documento debe registrar el gap;
- no asumir que los features live se reflejan automaticamente en demo;
- aunque el runtime demo reutilice componentes reales, puede necesitar fixtures nuevos;
- paid flows y `/payments/callback` quedan excluidos salvo decision futura explicita.

## 10. Pantallas a pulir

B2C visual:

- alinear hero, galeria, informacion, ubicacion, tickets/mesas o reservas;
- evitar que una misma pantalla mezcle `Koala Jack` con `DLirio`;
- evitar que una misma pantalla mezcle `Tairet Bar` con `Mckharthys Bar`;
- usar assets demo separados cuando se copien imagenes existentes;
- mantenerlo como demo visual coordinado, no como renombre operativo.

Promociones:

- mantener copy comercial por variante;
- eliminar cualquier copy generico o interno de demo si vuelve a aparecer;
- usar promociones coherentes por variante;
- evitar metricas infladas sobre slugs operativos.

Perfil del Local:

- mantener `Tairet Bar` y `Koala Jack` como identidad visible demo;
- eliminar `Av. Demo` y telefonos obviamente ficticios;
- revisar galeria, portada, descripcion, categorias, horarios y preview;
- asegurar que las imagenes parezcan parte del mismo local.

Historial operativo:

- agregar historial mock/local por registro en runtime demo;
- mostrar eventos de entrada en demo discoteca;
- mostrar eventos de reserva en demo bar;
- usar `Owner Martin` / `Staff Martin` cuando corresponda;
- no mostrar metadata cruda, PII, tokens, `table_note`, `notes` ni metodo QR/manual.

Metricas y actividad:

- mantener coherencia entre dashboard, metricas, activity global, ordenes y reservas;
- evitar numeros que parezcan inflados sin criterio;
- evitar referencias a locales operativos.

Entradas y Reservas:

- conservar filtros y vistas existentes;
- representar estados utiles para reunion;
- evitar acciones reales en demo;
- no reactivar scanner/check-in real en este bloque.

## 11. B2C y alias visual Koala Jack

Estado detectado:

- `apps/web-b2c/src/pages/ClubProfile.tsx` define `heroDisplayName = clubId === "dlirio" ? "Koala Jack" : clubData.name`;
- el alias se usa en el hero;
- otras zonas siguen usando `clubData.name`, por ejemplo galeria, compra/reserva y mapa;
- los assets y datos base siguen saliendo de mocks/data asociados a `dlirio`;
- `apps/web-b2c/src/pages/BarProfile.tsx` todavia usa `barData.name` de `mckharthys-bar`;
- no hay alias equivalente y coordinado para `Tairet Bar`.

Lectura recomendada:

- el alias actual de Koala Jack es un override visual parcial;
- no cambia la identidad operativa de D'Lirio;
- debe evolucionar hacia un B2C demo visual coordinado con el B2B demo;
- tiene riesgo de inconsistencia visible porque una misma pantalla puede mezclar `Koala Jack` con `DLirio`;
- el bar necesita una definicion equivalente para `Tairet Bar`;
- no debe resolverse ampliando overrides sueltos sin fuente demo clara.

Objetivo para el journey:

- B2C Koala Jack debe sentirse como el mismo local que `/panel/demo/discoteca`;
- B2C Tairet Bar debe sentirse como el mismo local que `/panel/demo/bar`;
- B2C muestra la experiencia del cliente;
- B2B muestra la operacion de ese mismo local demo.

## 12. Roadmap por slices

### Slice 0 - Discovery/documentacion

- Crear este documento.
- Registrar estado actual del runtime demo.
- Confirmar separacion entre seed operativo, runtime demo y alias B2C.
- No tocar codigo, fixtures, SQL, backend ni endpoints.

### Slice 1 - Fuente de verdad demo

Estado: `Implementado y validado`.

Que se creo:

- `apps/web-next/lib/panel-demo/variants.ts` como fuente central de variantes demo;
- `demoClub`;
- `demoBar`;
- `PANEL_DEMO_VARIANTS`;
- `getPanelDemoVariant(...)`.

Que se actualizo:

- `apps/web-next/lib/panel-demo/identity.ts` consume la fuente central para identidad demo;
- `apps/web-next/lib/panel-demo/profile.ts` consume la fuente central para identidad base de perfil;
- se mantiene compatibilidad con los escenarios actuales:
  - `/panel/demo/discoteca`;
  - `/panel/demo/bar`;
  - `/panel/demo/off`.

Identidad final:

- demo discoteca:
  - `name`: `Koala Jack`;
  - `scenario`: `discoteca`;
  - `type`: `club`;
  - `local id`: `demo-discoteca`.
- demo bar:
  - `name`: `Tairet Bar`;
  - `scenario`: `bar`;
  - `type`: `bar`;
  - `local id`: `demo-bar`.

Validaciones:

- `pnpm -C apps/web-next typecheck` -> `OK`;
- `git diff --check` -> `OK`;
- busqueda de `Demo Bar Tairet` / `Demo Discoteca Tairet` en `apps/web-next/lib/panel-demo` -> sin resultados;
- QA runtime de `/panel/demo/discoteca` -> `PASS`;
- QA runtime de `/panel/demo/bar` -> `PASS`;
- QA runtime de `/panel/demo/off` -> `PASS`.

Alcance protegido:

- no se toco B2C;
- no se toco backend;
- no se tocaron SQL/RLS/migraciones;
- no se tocaron endpoints;
- no se tocaron paid flows ni `/payments/callback`;
- no se modificaron datos operativos/seed;
- no se modificaron D'Lirio ni McKarthy's como datos operativos;
- no se amplio la estrategia de overrides sobre `dlirio` / `mckharthys-bar`.

Proximo paso:

- Slice 1B - Demo journey B2C+B2B coordinado;
- objetivo: ajustar este plan para que B2C y B2B cuenten la misma historia comercial.

### Slice 1B - Demo journey B2C+B2B coordinado

Estado: `Planificado en este documento`.

- Reencuadrar la demo comercial como journey `B2C demo visual -> B2B runtime demo`.
- Definir `Koala Jack` y `Tairet Bar` como demo brands coordinadas.
- Documentar que D'Lirio y McKarthy's no cambian como datos operativos.
- Documentar que sus assets pueden ser base visual solo si se copian o abstraen como assets demo.
- No tocar codigo, assets, fixtures, backend, SQL ni endpoints en este slice documental.

### Slice 2 - Assets demo comerciales

Estado: `Implementado y validado`.

Discovery realizado:

- D'Lirio usa assets locales en `apps/web-b2c/src/assets`:
  - `dlirio-gallery-1.jpg`;
  - `dlirio-gallery-2.jpg`;
  - `dlirio-gallery-3.jpg`;
  - `dlirio-gallery-4.jpg`;
  - `bailongo-promo.jpg`;
  - `tragos-fresh-promo.jpg`;
  - `formula-promo.jpg`.
- McKarthy's usa principalmente `/images/bar.jpg`, ubicado en `apps/web-b2c/public/images/bar.jpg`.

Que se creo:

- carpeta demo para `Koala Jack`: `apps/web-next/public/demo/koala-jack/`;
- carpeta demo para `Tairet Bar`: `apps/web-next/public/demo/tairet-bar/`;
- mapping central en `apps/web-next/lib/panel-demo/assets.ts`.

Assets disponibles para `Koala Jack`:

- `/demo/koala-jack/cover.jpg`;
- `/demo/koala-jack/gallery-01.jpg`;
- `/demo/koala-jack/gallery-02.jpg`;
- `/demo/koala-jack/gallery-03.jpg`;
- `/demo/koala-jack/promo-01.jpg`;
- `/demo/koala-jack/promo-02.jpg`;
- `/demo/koala-jack/promo-03.jpg`.

Assets disponibles para `Tairet Bar`:

- `/demo/tairet-bar/cover.jpg`;
- `/demo/tairet-bar/gallery-01.jpg`;
- `/demo/tairet-bar/gallery-02.jpg`;
- `/demo/tairet-bar/gallery-03.jpg`;
- `/demo/tairet-bar/promo-01.jpg`;
- `/demo/tairet-bar/promo-02.jpg`.

Mapping creado:

- `demoClubAssets`;
- `demoBarAssets`;
- `PANEL_DEMO_ASSETS`;
- `getPanelDemoAssets(...)`.

El mapping cubre:

- `cover`;
- `gallery`;
- `promos`;
- `profile.cover`;
- `profile.gallery`.

Confirmaciones:

- los assets son copias demo separadas;
- los assets se manejan como archivos versionados en el repo;
- el panel operativo no se usa para subir ni mantener imagenes del runtime demo;
- el runtime demo debe consumirlos por `apps/web-next/lib/panel-demo/assets.ts`;
- no se leen como seed operativo vivo;
- no se modificaron D'Lirio ni McKarthy's;
- no se toco B2C;
- no se conectaron todavia estos assets a Promociones, Perfil ni B2C;
- no se tocaron backend, SQL/RLS/migraciones, endpoints, paid flows ni `/payments/callback`.

Validaciones:

- `pnpm -C apps/web-next typecheck` -> `OK`;
- `git diff --check` -> `OK`;
- QA runtime de `/panel/demo/discoteca` -> `PASS`;
- QA runtime de `/panel/demo/bar` -> `PASS`;
- QA runtime de `/panel/demo/off` -> `PASS`.

Proximo paso:

- Slice 3 - B2C demo visual coordinado;
- objetivo: alinear el B2C de `Koala Jack` y `Tairet Bar`/`Tairet` con el journey comercial `B2C -> B2B`, evitando mezcla de nombres visibles.

### Slice 3 - B2C demo visual coordinado

Estado: `Implementado y validado`.

Que se creo:

- `apps/web-b2c/src/lib/demoBrands.ts` como capa centralizada de display demo en B2C;
- `getDemoBrand(...)`;
- `getDemoBrandDisplayName(...)`.

Que se alineo:

- `dlirio` resuelve visualmente como `Koala Jack`;
- `mckharthys-bar` resuelve visualmente como `Tairet Bar`;
- no se mutan datos base;
- no se modifica identidad operativa de D'Lirio ni McKarthy's;
- la resolucion ocurre en render/display.

Superficies cubiertas:

- hero/titulo visible;
- alt text de galeria;
- titulos de dialogos de galeria;
- compra/mesas;
- reservas;
- mapa/ubicacion.

Validaciones:

- `pnpm -C apps/web-b2c typecheck` -> `OK`;
- `git diff --check` -> `OK`;
- QA runtime B2C `dlirio` / `Koala Jack` -> `PASS`;
- QA runtime B2C `mckharthys-bar` / `Tairet Bar` -> `PASS`;
- cards/listados de locales no se tocaron -> `PASS`;
- otros perfiles no cambiaron -> `PASS`;
- imagenes siguen cargando -> `PASS`;
- navegacion B2C sin regresiones visibles -> `PASS`.

Alcance protegido:

- no se toco backend;
- no se tocaron SQL/RLS/migraciones;
- no se tocaron endpoints;
- no se tocaron paid flows ni `/payments/callback`;
- no se toco panel B2B;
- no se modificaron datos operativos/seed;
- no se cambio identidad interna de D'Lirio ni McKarthy's.

Proximo paso:

- Slice 4 - Promociones demo B2B con assets;
- objetivo: conectar los assets demo ya preparados en `/demo/koala-jack` y `/demo/tairet-bar` al runtime demo de Promociones.

### Slice 4 - Promociones demo B2B con assets

- Pulir promociones para `demoClub` y `demoBar`.
- Reemplazar placeholders y copy interno.
- Alinear preview, estados y metricas demo.
- Consumir assets demo desde `apps/web-next/lib/panel-demo/assets.ts`.
- Reemplazar SVGs/preview genericos por assets demo versionados.
- No usar overrides sobre `dlirio` o `mckharthys-bar` como estrategia nueva.

### Slice 5 - Parity UI Entradas/Reservas demo con Validar + Historial

Estado: `Implementado y validado`.

Que se implemento:

- Entradas demo discoteca puede simular `Validar`;
- la simulacion de `Validar` no llama backend;
- la simulacion actualiza estado local de la card;
- la simulacion actualiza resumen usado/pendiente cuando corresponde;
- Entradas demo muestra `Historial` por registro;
- Reservas demo bar muestra `Historial` por registro;
- `OperationalActivityHistory` acepta `demoItems`;
- si `demoItems` viene, `OperationalActivityHistory` no llama `GET /panel/activity/entity`;
- en live/operativo, el historial sigue usando el endpoint actual;
- en live/operativo, `Validar` mantiene su `PATCH` existente.

Discovery que cerro el slice:

- Entradas ocultaba `OperationalActivityHistory` cuando `isDemo`;
- Entradas bloqueaba `Validar` con `isDemo`;
- Reservas pasaba `showActivityHistory={!isDemoBar}`;
- el runtime demo necesitaba paridad UI para reflejar features recientes del panel.

Comportamiento en Entradas demo:

- 20/03 mantiene narrativa de dia anterior;
- 21/03 mantiene narrativa de operacion en vivo;
- 22/03 mantiene narrativa de preventa;
- en el dia operativo, `Validar` simula validacion local;
- el historial puede mostrar `Entrada creada`, `Entrada validada` y `Entrada no utilizada`;
- actores visibles: `Cliente`, `Staff Martin`, `Sistema`.

Comportamiento en Reservas demo:

- Reservas demo muestra `Historial` por registro;
- el historial puede mostrar `Reserva creada`, `Reserva confirmada`, `Reserva cancelada` y `Nota interna actualizada`;
- actores visibles: `Cliente`, `Owner Martin` o `Staff Martin`.

Seguridad visual:

- no se muestra metadata cruda;
- no se muestra PII;
- no se muestra `checkin_token`;
- no se muestra `local_id`;
- no se muestra `actor_user_id`;
- no se muestra `notes`;
- no se muestra `table_note` completo;
- no se muestra metodo QR/manual.

Validaciones registradas:

- `pnpm -C apps/web-next typecheck` -> `OK`;
- `git diff --check` -> `OK`;
- QA runtime `/panel/demo/discoteca` Entradas -> `PASS`;
- QA runtime fechas 20/03, 21/03 y 22/03 -> `PASS`;
- QA runtime `Validar` demo sin backend -> `PASS`;
- QA runtime Historial demo de Entradas -> `PASS`;
- QA runtime `/panel/demo/bar` Reservas -> `PASS`;
- QA runtime Historial demo de Reservas -> `PASS`;
- QA runtime sin datos sensibles visibles -> `PASS`.

Alcance protegido:

- no se toco backend;
- no se tocaron SQL/RLS/migraciones;
- no se tocaron endpoints;
- no se toco B2C;
- no se tocaron paid flows ni `/payments/callback`;
- no se modificaron datos operativos/seed;
- no se modifico identidad operativa de D'Lirio ni McKarthy's;
- demo no se conecto a `GET /panel/activity/entity`;
- demo no se conecto a `PATCH /panel/orders/:id/use`;
- demo no se conecto a `PATCH /panel/checkin/:token`.

Proximo paso:

- QA comercial completo B2C -> B2B;
- validar flujo de reunion `B2C Koala Jack -> /panel/demo/discoteca`;
- validar flujo de reunion `B2C Tairet Bar -> /panel/demo/bar`;
- revisar promociones, perfil, entradas/reservas, metricas e historial como una historia comercial coherente.

### Slice 6 - Perfil del Local demo B2B

- Pulir nombre, descripcion, zona, direccion, horarios, categorias, imagenes y preview.
- Consumir assets demo desde `apps/web-next/lib/panel-demo/assets.ts`.
- Alinear catalogo visible de entradas/mesas para discoteca.
- Alinear reservas/capacidad para bar.
- Evitar `Av. Demo`, telefonos obviamente ficticios y superficies genericas.

### Slice 7 - QA comercial B2C -> B2B

- Validar flujo completo de reunion para discoteca: B2C Koala Jack y luego `/panel/demo/discoteca`.
- Validar flujo completo de reunion para bar: B2C Tairet Bar y luego `/panel/demo/bar`.
- Confirmar que B2C y B2B parecen el mismo local demo.
- Confirmar que no hay placeholders.
- Confirmar que no se alteran datos operativos/seed.
- Confirmar salida limpia con `/panel/demo/off`.

### Slice futuro opcional - Asset manager demo

- Evaluar una herramienta interna para administrar imagenes demo solo si aparece necesidad operativa concreta.
- No usar el panel operativo como CMS de la demo.
- Si se implementa, debe tener storage, permisos, persistencia y separacion demo/live explicitos.
- No forma parte del MVP de demo comercial.

## 13. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Mezclar demo con seed operativo | Confusion comercial y QA fragil | Mantener fixtures demo propios y no modificar D'Lirio/McKarthy's. |
| Duplicar logica del panel | Mantenimiento caro | Reutilizar componentes reales y aislar solo data/adapters demo. |
| Placeholders visibles | Demo poco creible | QA comercial con checklist de copy, imagenes y metricas. |
| Metricas poco creibles | Perdida de confianza en reunion | Alinear metricas con activity, ordenes, reservas y promociones. |
| Assets inconsistentes | Identidad demo debil | Definir set visual por variante. |
| Romper panel operativo | Regresion live | Cambios solo bajo runtime demo y salida con `/panel/demo/off`. |
| Confundir alias B2C con identidad real | Mezcla D'Lirio/Koala Jack | Documentar alias como parcial hasta el slice B2C y no usar seed vivo como fuente demo. |
| Mantener demo atrasada | Demo no refleja features nuevas | Crear slices demo cada vez que un modulo comercial relevante cierre. |
| Superficie demo en produccion | Riesgo de hardening parcial | Mantener flag/rutas documentadas y no venderlo como aislamiento fuerte. |
| B2C y B2B cuentan historias distintas | El journey comercial pierde credibilidad | QA obligatorio B2C -> B2B por variante. |
| Una misma pantalla mezcla `Koala Jack` con `DLirio` | Inconsistencia visible para reuniones | Slice B2C coordinado para unificar superficies visibles. |
| Una misma pantalla mezcla `Tairet Bar` con `Mckharthys Bar` | Inconsistencia visible para reuniones | Definir demo brand de bar y assets/copy separados. |
| `Tairet Bar` se confunde con la plataforma Tairet | Ambiguedad comercial | Usar `Tairet Bar` como nombre recomendado y reservar `Tairet` solo como displayName si se decide. |
| Copiar assets sin ruta demo clara | Vuelve a mezclar seed con demo | Crear estructura de assets demo separada antes de pulir pantallas. |
| Seguir agregando overrides sueltos | Aumenta deuda y comportamiento dificil de auditar | Centralizar demo brands y fixtures; no ampliar overrides sobre slugs operativos. |
| Panel demo pulido pero B2C desalineado | Menor impacto comercial | Tratar B2C como primer paso del flujo de reunion. |

## 14. QA comercial recomendado

Discoteca / Koala Jack:

- abrir B2C Koala Jack;
- revisar hero, galeria, entradas/mesas, ubicacion, informacion, resenas/promos si aplica;
- confirmar que no aparecen nombres mezclados con D'Lirio en superficies visibles;
- abrir `/panel/demo/discoteca`;
- revisar dashboard y metricas;
- abrir Entradas;
- confirmar estados de entradas/free pass;
- abrir historial de una entrada;
- confirmar eventos y actor label;
- revisar Promociones;
- revisar Perfil del Local;
- confirmar que el panel parece administrar el mismo local visto en B2C;
- confirmar que no aparecen `Demo Discoteca Tairet`, `Av. Demo`, copy placeholder ni datos operativos de D'Lirio.

Bar / Tairet Bar:

- abrir B2C Tairet Bar o `Tairet` si se decide ese displayName;
- revisar hero, galeria, reservas, ubicacion, informacion, resenas/promos si aplica;
- confirmar que no aparecen nombres mezclados con McKarthy's en superficies visibles;
- abrir `/panel/demo/bar`;
- revisar dashboard y metricas;
- abrir Reservas;
- abrir historial de una reserva;
- confirmar eventos y actor label;
- revisar Promociones;
- revisar Perfil del Local;
- confirmar que el panel parece administrar el mismo local visto en B2C;
- confirmar que no aparecen `Demo Bar Tairet`, `Av. Demo`, copy placeholder ni datos operativos de McKarthy's.

Transversal:

- confirmar que no hay placeholders visibles;
- confirmar que no se usan datos operativos alterados;
- confirmar que los assets demo no se leen como seed operativo vivo;
- confirmar que `/panel/demo/off` limpia runtime y vuelve al flujo live/login;
- confirmar que paid flows y `/payments/callback` no aparecen como parte de la demo;
- confirmar que no se toca SQL/RLS/backend/endpoints;
- confirmar que los overrides B2C quedan reemplazados o documentados como parciales hasta que el slice B2C cierre.

## 15. Fuera de alcance

Queda fuera de este plan o de este ajuste documental:

- pagos;
- paid flows;
- `/payments/callback`;
- SQL/RLS;
- migraciones;
- backend;
- endpoints;
- cambios de seed operativo;
- cambiar identidad real de D'Lirio;
- cambiar identidad real de McKarthy's;
- conectar demo con datos productivos;
- usar el panel operativo como fuente de imagenes demo;
- subir imagenes demo desde el panel en este bloque;
- Supabase Storage para assets del runtime demo comercial;
- asset manager demo;
- demo CMS;
- almacenamiento dinamico de assets demo;
- redisenar completo el panel;
- reescribir completo el B2C;
- crear modo demo B2C completo en este paso;
- mover o copiar assets en este paso;
- scanner/check-in real en runtime demo;
- exportaciones;
- Sentry;
- service role;
- configs/env vars.

## 16. Decisiones futuras

Decisiones que pueden reabrirse despues:

- si B2C tendra un modo demo formal separado;
- si la demo necesita selector comercial visible para el equipo;
- si se agregan assets propios de Koala Jack y Tairet Bar;
- si se crea un asset manager demo interno;
- si se habilita gestion de imagenes demo desde una herramienta separada del panel operativo;
- si se hace guion de venta por flujo;
- si se generan screenshots oficiales o video demo;
- si el demo se aisla en host/origin propio;
- si Check-in/scanner se simula en runtime demo;
- si se elimina o reemplaza el alias parcial `dlirio -> Koala Jack` en B2C.
