# B02 Solicitudes públicas de reserva de Bares

## Contrato de producto

Las solicitudes son para **1 a 15 personas, entero**, con al menos **30 minutos** de anticipación al instante de recepción en el servidor. Se admite el mismo día. La llegada debe caer en un rango operativo verificable del bar. Una solicitud válida se guarda como `en_revision`; la aprobación sigue siendo manual. No implica cupo, mesa física ni disponibilidad garantizada.

La elegibilidad del establecimiento se obtiene de la fila real: tipo `bar` y publicación explícita. Véase [B01_PUBLICATION.md](B01_PUBLICATION.md). Retirar publicación impide solicitudes nuevas, sin alterar reservas existentes ni la gestión privada.

## Contrato público

`POST /reservations` admite `local_id` UUID, `name`, `last_name` opcional, `email`, `phone`, `date` ISO-8601 con zona explícita (Z u offset), `guests` número entero y `notes` opcional. Se conservan los requisitos de contacto existentes. `guests` no convierte strings ni redondea fracciones. `date` se normaliza a ISO UTC antes de persistir y notificar.

Zod descarta campos desconocidos: `table_note`, `status`, `cancel_reason`, IDs y campos administrativos no pertenecen a la creación pública. `notes` es el comentario legítimo del cliente; `table_note` pertenece al personal y `cancel_reason` al flujo de cancelación destinado al cliente. No se modifica ese flujo privado. La respuesta 201 conserva `id`, `status`, `date`, `guests`, `created_at` y no expone notas internas.

Datos inválidos o anticipación insuficiente producen 400; un local inexistente, oculto o de otro tipo produce 404; horario fuera de rango o cierre produce 409. Horario semanal ausente/inválido produce `SCHEDULE_UNAVAILABLE` (409); error al consultar excepciones produce el mismo código (503). Todo rechazo sucede antes de insertar, registrar actividad de creación o notificar.

## Fecha civil y turno operativo

La fecha seleccionada es la **fecha civil de llegada en America/Asuncion**, no la fecha del inicio del turno. La API conserva un instante absoluto en `reservations.date`; PostgreSQL, panel y correo deben representar ese mismo instante en Asunción.

Se reutiliza `opening_hours` v1 y su normalización existente. Un rango se interpreta como **inicio incluido, cierre excluido**. Si fin es menor que inicio, termina al día civil siguiente. Para sábado 01:00 se examinan el tramo nocturno iniciado el viernes y los rangos propios del sábado; no se aplica un corte global de 06:00. Si rangos se superponen, basta un tramo permitido que contenga la llegada.

Se conserva la precedencia de `local_daily_ops`: `is_open=false` cierra el turno de la fecha en que comenzó ese rango; `true` no crea aperturas ni rangos especiales. Un viernes cerrado por excepción invalida su tramo del sábado 01:00. Un cierre del sábado no elimina por sí solo el tramo que comenzó el viernes. No hay `override_ranges` en el contrato vigente: no se inventan aperturas excepcionales. El texto libre `hours` no permite verificar rangos y no se usa como respaldo para aceptar.

La regla de reservas queda localizada en Bares y no cambia `computeOperationalDate`, Orders, Events o Access. El documento histórico general de horarios no sustituye estas decisiones específicas aprobadas para B-02.

## Implementación y verificación

**Implementado localmente:** validación del servidor, formulario sin horarios ficticios, conversión explícita de llegada, protección de campos, persistencia UTC y formato de fecha del panel/correos. El calendario usa un predicado por día; los slots se generan solo para la fecha seleccionada. El servidor vuelve a validar al recibir, aunque el formulario haya quedado desactualizado. Las excepciones por fecha se comprueban al enviar: el formulario muestra el error del servidor si un cierre invalida un horario semanal ofrecido.

| Responsable | Alcance |
| --- | --- |
| `functions/api/src/schemas/reservations.ts` | Campos públicos, fecha con zona, entero 1–15 y descarte de campos internos. |
| `functions/api/src/routes/reservations.ts` | Publicación/tipo reales, reloj de recepción, excepciones, inserción pendiente y efectos posteriores. Lectura privada existente preservada. |
| `functions/api/src/services/barReservationSchedule.ts` | Fecha civil Asunción, rangos de los días de apertura actual/anterior y límites [inicio, fin). |
| `apps/web-b2c/src/lib/barReservationTime.ts` y `pages/ReservaForm.tsx` | Conversión explícita, calendario/slots y validación al enviar. |
| `apps/web-b2c/src/lib/api.ts` | Contrato numérico de creación y propagación del mensaje de rechazo. |
| `apps/web-next/lib/reservationDate.ts`, `ReservationCard.tsx` | Fecha civil de llegada en la tarjeta; hora usa el formatter Asunción existente. Se conservan etiquetas legacy del demo. No se modifica el cálculo de métricas. |
| `functions/api/src/services/emails.ts` | Solo formato Asunción de las plantillas existentes; entrega, destinatarios y reintentos sin cambios. |

**Probado localmente:** pruebas unitarias con reloj fijo y TZ UTC/Asunción/Los Ángeles/Tokio; HTTP directo → PostgreSQL/PostgREST → lectura autenticada; formulario en UTC/Tokio/Los Ángeles con persistencia; falta de efectos ante rechazo, cierre excepcional, retiro de publicación y esquema de respuesta mínimo. Auth es un proveedor sintético; `panelAuth` y la consulta de `panel_users` son reales. Correo y actividad de creación se interceptan como dependencias del handler y se cuentan; no se envían correos ni se llama al proveedor.

Pruebas reproducibles desde la raíz, con Node, pnpm y Docker:

```powershell
pnpm -C functions/api exec tsx --test tests/bar-reservations/unit.test.ts
$env:B02_POSTGREST_IMAGE = 'postgrest/postgrest@sha256:c847127074bd26e1b8d3f7c0e6e01e5346f4b85dd34f5d699fd230af960827c0'
pnpm -C functions/api exec tsx tests/bar-reservations/integration.ts '<directorio persistente absoluto>'
```

La integración reutiliza el enfoque aislado de B-01 y su script de publicación, sin modificarlos. Crea contenedores propios con prefijo `tairet-b02-`, con una fixture mínima de locales, operadores, horarios, proyección de promociones y reservas. No crea tablas de pagos, entradas, Events o Access. Aplica 021/050 únicamente en esos contenedores y crea la tabla de reservas desde el schema existente; no introduce una migración. `--serve` conserva temporalmente la API para QA. `local-runtime.json` indica la URL local. El script de navegador y el informe B02 se entregan en el directorio persistente de evidencias. Su reloj fijo es `2026-11-06T21:00:00Z` (18:00 Asunción). El endpoint `/__b02/stop` pertenece únicamente al harness y permite limpiarlo al terminar.

Los resultados exactos, comandos de build/lint/typecheck y comparación de diagnósticos están en `B02_INFORME_TECNICO.md` y su paquete. No se interpreta un typecheck ampliado con deuda previa como un PASS global: se comparan archivo, código y mensaje entre la referencia inicial B-01 y B-02.

**Pendiente de verificación externa:** producción/ledger, Auth real, entrega real de correo y recorrido completo de la UI B2B con sesión real. No son condiciones para el cierre local. No se garantiza cupo ni disponibilidad comercial. No hay migración nueva en B-02 ni decisiones adicionales de calendario pendientes.
