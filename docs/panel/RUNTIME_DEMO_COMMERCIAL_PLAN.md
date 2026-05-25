# Runtime Demo Comercial Plan

## 1. Proposito

Este documento define el plan para convertir el runtime demo del panel de Tairet en la demo comercial oficial para reuniones.

El objetivo es tener una demo solida, coherente y controlada para mostrar el producto sin modificar datos operativos, seeds ni perfiles reales usados para QA. Este documento no implementa cambios de codigo, fixtures, assets, backend, SQL ni configuracion. Es una guia de discovery y roadmap para los siguientes slices.

## 2. Decision de producto

La decision de producto es no convertir D'Lirio ni McKarthy's en demo comercial.

Separacion vigente:

- panel operativo / seed actual:
  - D'Lirio, McKarthy's y otros locales de prueba o QA siguen siendo datos operativos/seed;
  - no deben inflarse metricas ni cambiarse identidad de esos locales para vender;
  - cualquier override temporal sobre esos slugs debe tratarse como deuda demo/video, no como estrategia final.
- runtime demo comercial:
  - debe usar datos demo propios;
  - debe mantenerse front-only y separado de datos operativos;
  - debe tener dos variantes comerciales: demo discoteca y demo bar.
- B2C demo visual temporal:
  - existe un alias visual parcial donde `dlirio` se muestra como `Koala Jack` en una parte del perfil B2C;
  - ese alias no cambia la identidad operativa del local ni debe interpretarse como renombre de D'Lirio.

## 3. Problema actual

El runtime demo ya existe y sirve para mostrar el panel, pero todavia no esta pulido como demo comercial oficial.

Problemas detectados:

- las identidades demo actuales son genericas: `Demo Bar Tairet` y `Demo Discoteca Tairet`;
- Promociones demo tiene contenido funcional, pero con copy generico y assets SVG de demostracion;
- Perfil del Local demo usa nombres, direccion y telefonos claramente ficticios;
- hay superficies graficas con textos como `Superficie demo para Perfil del Local`;
- el historial operativo por registro existe en el panel live, pero no esta integrado al runtime demo;
- algunas mejoras recientes del panel operativo, como activity log y actor label, no se reflejan todavia en demo;
- existen overrides temporales sobre `dlirio` y `mckharthys-bar` que pueden confundirse con estrategia demo si no se documentan;
- el alias B2C `D'Lirio -> Koala Jack` es parcial y puede mezclar nombres dentro de la misma pantalla.

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
- historial operativo por registro dentro del runtime demo;
- paid flows.

Brechas puntuales:

- `apps/web-next/lib/panel-demo/identity.ts` usa `Demo Bar Tairet` y `Demo Discoteca Tairet`, no `Tairet Bar` ni `Koala Jack`;
- `apps/web-next/lib/panel-demo/promos.ts` genera imagenes SVG con copy `Promo demo para el panel Tairet`;
- `apps/web-next/lib/panel-demo/profile.ts` usa `Av. Demo 1234`, `Demo Bar Tairet`, `Demo Discoteca Tairet` y superficies demo;
- Entradas oculta `OperationalActivityHistory` cuando `isDemo`;
- Reservas pasa `showActivityHistory={!isDemoBar}`;
- `apps/web-next/lib/panel-demo/activity.ts` alimenta actividad global de metricas/lineup, no historial por registro;
- `apps/web-next/lib/panelContext.tsx` tiene overrides visuales temporales para `dlirio` y `mckharthys-bar`;
- `apps/web-next/app/panel/(authenticated)/marketing/promos/page.tsx` tiene overrides temporales de vistas para `dlirio` y `mckharthys-bar`.

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
3. B2C demo visual:
   - el alias `Koala Jack` sobre `dlirio` debe documentarse como visual/acotado;
   - no debe bloquear ni reemplazar la demo oficial del panel;
   - si se formaliza, debe hacerse como modo demo B2C separado.

La demo comercial debe reutilizar componentes reales del panel cuando sea posible, pero alimentar esos componentes con una fuente de verdad demo consistente y no con datos operativos alterados.

## 6. Variantes demo

### Demo discoteca

Nombre recomendado: `Koala Jack`.

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
- no renderizar placeholders visibles;
- no mostrar PII real;
- no mostrar tokens reales;
- no distinguir QR/manual en el historial demo;
- no conectar demo a paid flows.

## 8. Pantallas a pulir

Promociones:

- reemplazar copy generico de SVG;
- eliminar textos internos como `Promo demo para el panel Tairet`;
- usar promociones coherentes por variante;
- evitar metricas infladas sobre slugs operativos.

Perfil del Local:

- reemplazar `Demo Bar Tairet` por `Tairet Bar`;
- reemplazar `Demo Discoteca Tairet` por `Koala Jack`;
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

## 9. B2C y alias visual Koala Jack

Estado detectado:

- `apps/web-b2c/src/pages/ClubProfile.tsx` define `heroDisplayName = clubId === "dlirio" ? "Koala Jack" : clubData.name`;
- el alias se usa en el hero;
- otras zonas siguen usando `clubData.name`, por ejemplo galeria, compra/reserva y mapa;
- los assets y datos base siguen saliendo de mocks/data asociados a `dlirio`.

Lectura recomendada:

- este alias es un override visual parcial;
- no cambia la identidad operativa de D'Lirio;
- no debe tomarse como demo comercial oficial;
- tiene riesgo de inconsistencia visible porque una misma pantalla puede mezclar `Koala Jack` con `DLirio`;
- si B2C necesita demo formal, debe tener un slice futuro separado.

## 10. Roadmap por slices

### Slice 0 - Discovery/documentacion

- Crear este documento.
- Registrar estado actual del runtime demo.
- Confirmar separacion entre seed operativo, runtime demo y alias B2C.
- No tocar codigo, fixtures, SQL, backend ni endpoints.

### Slice 1 - Fuente de verdad demo

- Definir `demoClub` y `demoBar` como fuente de verdad conceptual.
- Renombrar la identidad demo a `Koala Jack` y `Tairet Bar`.
- Centralizar nombres, imagenes, metricas, promociones, perfil, activity, ordenes y reservas demo.
- Mantener compatibilidad con escenarios actuales `discoteca` y `bar`.

### Slice 2 - Promociones demo

- Pulir promociones para `demoClub` y `demoBar`.
- Reemplazar placeholders y copy interno.
- Alinear preview, estados y metricas demo.
- No usar overrides sobre `dlirio` o `mckharthys-bar` como estrategia nueva.

### Slice 3 - Perfil del Local demo

- Pulir nombre, descripcion, zona, direccion, horarios, categorias, imagenes y preview.
- Alinear catalogo visible de entradas/mesas para discoteca.
- Alinear reservas/capacidad para bar.
- Evitar `Av. Demo`, telefonos obviamente ficticios y superficies genericas.

### Slice 4 - Activity log demo

- Agregar historial operativo mock por registro dentro del runtime demo.
- Entradas demo: `Entrada creada`, `Entrada validada`, `Intento de validacion duplicado` si aplica.
- Reservas demo: `Reserva creada`, `Reserva confirmada`, `Reserva cancelada`, `Nota interna actualizada`.
- Mostrar actores seguros tipo `Owner Martin` / `Staff Martin`.
- No mostrar PII, tokens, `table_note`, `notes` ni metodo QR/manual.
- No usar `GET /panel/activity/entity` para demo mock.

### Slice 5 - QA comercial de demo

- Validar flujo completo de reunion para discoteca.
- Validar flujo completo de reunion para bar.
- Confirmar que no hay placeholders.
- Confirmar que no se alteran datos operativos/seed.
- Confirmar salida limpia con `/panel/demo/off`.

## 11. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Mezclar demo con seed operativo | Confusion comercial y QA fragil | Mantener fixtures demo propios y no modificar D'Lirio/McKarthy's. |
| Duplicar logica del panel | Mantenimiento caro | Reutilizar componentes reales y aislar solo data/adapters demo. |
| Placeholders visibles | Demo poco creible | QA comercial con checklist de copy, imagenes y metricas. |
| Metricas poco creibles | Perdida de confianza en reunion | Alinear metricas con activity, ordenes, reservas y promociones. |
| Assets inconsistentes | Identidad demo debil | Definir set visual por variante. |
| Romper panel operativo | Regresion live | Cambios solo bajo runtime demo y salida con `/panel/demo/off`. |
| Confundir alias B2C con identidad real | Mezcla D'Lirio/Koala Jack | Documentar alias como temporal y no usarlo como fuente del panel demo. |
| Mantener demo atrasada | Demo no refleja features nuevas | Crear slices demo cada vez que un modulo comercial relevante cierre. |
| Superficie demo en produccion | Riesgo de hardening parcial | Mantener flag/rutas documentadas y no venderlo como aislamiento fuerte. |

## 12. QA comercial recomendado

Discoteca / Koala Jack:

- abrir `/panel/demo/discoteca`;
- revisar dashboard y metricas;
- abrir Entradas;
- confirmar estados de entradas/free pass;
- abrir historial de una entrada;
- confirmar eventos y actor label;
- revisar Promociones;
- revisar Perfil del Local;
- confirmar que no aparecen `Demo Discoteca Tairet`, `Av. Demo`, copy placeholder ni datos de D'Lirio.

Bar / Tairet Bar:

- abrir `/panel/demo/bar`;
- revisar dashboard y metricas;
- abrir Reservas;
- abrir historial de una reserva;
- confirmar eventos y actor label;
- revisar Promociones;
- revisar Perfil del Local;
- confirmar que no aparecen `Demo Bar Tairet`, `Av. Demo`, copy placeholder ni datos de McKarthy's.

Transversal:

- confirmar que no hay placeholders visibles;
- confirmar que no se usan datos operativos alterados;
- confirmar que `/panel/demo/off` limpia runtime y vuelve al flujo live/login;
- confirmar que paid flows y `/payments/callback` no aparecen como parte de la demo;
- confirmar que no se toca SQL/RLS/backend/endpoints;
- confirmar que el alias B2C `dlirio -> Koala Jack` queda documentado como visual parcial.

## 13. Fuera de alcance

Queda fuera de este plan:

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
- redisenar completo el panel;
- scanner/check-in real en runtime demo;
- B2C demo formal;
- exportaciones;
- Sentry;
- service role;
- configs/env vars.

## 14. Decisiones futuras

Decisiones que pueden reabrirse despues:

- si B2C tendra un modo demo formal separado;
- si la demo necesita selector comercial visible para el equipo;
- si se agregan assets propios de Koala Jack y Tairet Bar;
- si se hace guion de venta por flujo;
- si se generan screenshots oficiales o video demo;
- si el demo se aisla en host/origin propio;
- si Check-in/scanner se simula en runtime demo;
- si se elimina o reemplaza el alias parcial `dlirio -> Koala Jack` en B2C.
