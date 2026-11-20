# Tairet · Contexto técnico canónico

Corte del **20/11/2026**, hora de Asunción. Para continuar un trabajo, abrir el estado del área. Allí están el contrato aplicable, el último hito probado, el entorno de la prueba y las condiciones pendientes.

| Área | Punto de entrada | Hito al corte |
| --- | --- | --- |
| Bares | [Estado de Bares](bares/CURRENT_STATE.md) | B-01, B-02 y B-03 publicados. Ensayo privado aprobado. Pendiente el primer establecimiento piloto. |
| Discotecas | [Estado de Free Pass y entradas pagadas](discotecas/CURRENT_STATE.md) | Free Pass aprobado con un club sintético en producción y retirado del catálogo. Las entradas pagadas tienen su propio checkpoint Bancard Staging. |
| Events | [Estado de Events](events/CURRENT_STATE.md) | Rama independiente. Bancard Staging aprobó una compra. R5 cerró con la orden pendiente y el E2E incompleto. |
| Access Core | [Estado de Access](access-core/CURRENT_STATE.md) · [Contratos y roadmap](access-core/INDEX.md) | Último cierre de producto 9E.5B4B. Continúan los gates de transferencia de autoridad B6 y de rollout B7. |

**Cómo leer la evidencia.** `VERIFIED_REPOSITORY` identifica código, objetos o relaciones Git comprobados. `VERIFIED_RUNTIME` va acompañado del entorno, la fecha y la observación concreta. Cuando procede de un recibo archivado, la fecha es la del ensayo o despliegue. `REPORTED` identifica la constancia humana y `UNKNOWN` significa **NO VERIFICADO**. Un resultado de ensayo conserva su vertical, revisión y entorno. La [política documental](DOCUMENTATION_STATUS_POLICY.md) y [AGENTS.md](../AGENTS.md) rigen la actualización al siguiente hito material.

## Base Git y web pública

El 20/11 `git ls-remote --heads origin` devolvió `b5a23f4b4f1eb941ff7faff2f2e7fedebcfbfb83` para `main`. Su línea de producto contiene, en orden, Bares `4c40aa3`, Free Pass `c55bcc2`, recuperación B2C `d77674a` y retirada del catálogo `b5a23f4`. Events `b17a1cc` está en una rama local independiente. El mapa y las fuentes del 02/11 se recuperaron del candidato original y de su copia documental local del 03/11 (`eea290e`), que quedó fuera de esta línea de `main`.

La portada pública recuperada en `d77674a3be5727c509c83058874b8bc883f5267d` ofrece acceso a Bares, Discotecas y Eventos. En producción, el 19/11, `tairet.com.py` y `www.tairet.com.py` respondieron 200 con esa portada y `/halloween` respondió 200 con ocho fichas históricas. `TemporaryLanding` corresponde a la portada anterior a esa publicación. El recibo de Free Pass del 20/11 vincula la siguiente publicación de API, B2C y panel a `b5a23f4` y registra 200 en la portada. La inspección de las ocho fichas corresponde a `d77674a`. [Rutas B2C](../apps/web-b2c/src/App.tsx) · [Portada](../apps/web-b2c/src/pages/Index.tsx)

El recorrido público quedó en `publicacion-ui.json`, expediente **Recuperar la web pública B2C** (SHA-256 `a800e68569194db8c563a92938e923a4e97ae2cc37798e845a7501ebf9068665`). El último despliegue figura en el [cierre de Free Pass](discotecas/CURRENT_STATE.md). La guía Halloween es contenido público histórico. Tener una ruta a Eventos acredita navegación, sin acreditar el E2E transaccional de Events V1.

## Fronteras compartidas

| Contrato | Quién lo usa y qué preserva |
| --- | --- |
| Locales, horarios y autorización | Bares y Discotecas comparten `locals`, perfil y panel por establecimiento. Bares usa `is_published` para alta pública y sus reglas de reserva. Discotecas usa `is_club_catalog_hidden` para retirar el club del catálogo. Events tiene entidad y membresía por evento. [Panel local](../functions/api/src/middlewares/panelAuth.ts) · [Panel de Events](../functions/api/src/middlewares/eventPanelAuth.ts) |
| Reservas, entradas y check-in | Bares registra solicitudes en `reservations`. Free Pass emite y consume en `orders`. Las entradas pagadas de Discotecas y el flujo canónico de Events usan `access_entries`, con su propio origen, permisos y estado. Un QR o un ensayo de un recorrido no acredita los demás. |
| Pagos y correo | Access conserva por separado confirmación, emisión, entrega y uso. Bares intenta notificar cambios de reserva después de persistirlos. El correo observado en el QA privado de Bares y el QR de Free Pass tienen alcances distintos. [Invariantes de Access](access-core/INVARIANTS.md) · [Comunicaciones de Bares](bars/B03_RESERVATION_MANAGEMENT.md) |

**Migraciones con números coincidentes.** El nombre, la línea Git, el manifiesto de instalación y el entorno identifican cada migración.

| Número | `main` publicado, `b5a23f4` | Events independiente, `b17a1cc` |
| --- | --- | --- |
| 050 | [Publicación de Bares](../infra/sql/migrations/050_add_bar_publication.sql) | Scope y tandas de Events |
| 051 | [Motivo de cancelación de reservas](../infra/sql/migrations/051_add_bar_reservation_cancel_reason.sql) | Autorización tipada y revisiones de Events |
| 052 | [Visibilidad de Discotecas](../infra/sql/migrations/052_add_club_catalog_visibility.sql) | Ledgers de actividad y reintegros de Events |
| 053–054 | Fuera de la secuencia Bares/Discotecas de este corte | Checkout, confirmación y fulfillment (053), catálogo y check-in canónico (054) |

En R5 se utilizó la selección física del manifiesto `b17a1cc:infra/sql/profiles/events-hosted-r8/manifest.json`. El orden numérico por sí solo no da una correspondencia entre bases, una secuencia para fusionarlas ni permiso para aplicarlas. Para reconstruir un contrato, seguir el archivo y el commit de su área.
