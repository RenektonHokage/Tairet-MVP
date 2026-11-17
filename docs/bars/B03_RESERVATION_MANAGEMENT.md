# Gestión privada de reservas de Bares

La creación y la fecha civil se rigen por [B-02](B02_RESERVATIONS.md). La publicación se rige por [B-01](B01_PUBLICATION.md). El bar gestiona las solicitudes existentes desde el panel, incluso después de retirarse del catálogo.

## Estado de implementación local

El endpoint autenticado `PATCH /panel/reservations/:id` conserva los roles `owner` y `staff` y verifica el establecimiento de la reserva. El PATCH público permanece deshabilitado con 410. El servidor toma `en_revision` como estado previo de un cliente anterior y permite al panel indicar `expected_status`. El UPDATE comprueba el UUID, el establecimiento y el estado previo. Un conflicto devuelve 409. Solo una escritura ganadora origina los efectos de la transición.

Una pendiente se puede confirmar o cancelar. El motivo de una pendiente es opcional. Para cancelar una confirmada, el operador de un bar abre «Cancelar», escribe en un campo inicialmente vacío el motivo que se comunicará al cliente y confirma. La tarjeta cancelada muestra ese motivo también después de recargar. La nota privada sigue editable en cualquier estado. Una edición exclusivamente de nota no genera correo de estado. `notes` identifica el comentario del cliente y `table_note` la nota del personal.

## Conservación del motivo

La migración `051_add_bar_reservation_cancel_reason.sql` incorpora `public.reservations.cancel_reason` como texto nullable. Las filas anteriores conservan NULL, incluidas las ya canceladas. Cuando se guarda un motivo, el constraint exige estado cancelado, texto sin espacios exteriores y entre 1 y 160 caracteres. La API recorta el texto y, para un bar, guarda motivo, estado y fecha de actualización en un único UPDATE condicionado. El intento ganador proporciona el motivo al correo. Una edición de nota mantiene el motivo guardado y no se admite cambiarlo de forma independiente.

El motivo está disponible en la lectura privada por establecimiento. La creación pública conserva su proyección mínima. El historial operativo registra el estado en una escritura de mejor esfuerzo. Para consultar el motivo, el operador abre la reserva en el panel.

| Acción | Comportamiento verificado |
| --- | --- |
| Confirmar una pendiente | 200 con la fila actualizada. La actividad `reservation_confirmed` y el intento de correo se generan después de guardar. |
| Cancelar una pendiente | 200 con estado `cancelled`. La actividad es `reservation_cancelled`. Un motivo explícito se recorta y admite hasta 160 caracteres. |
| Repetir una acción o competir sobre la misma pendiente | 409 cuando el estado previo dejó de coincidir. El intento perdedor no genera actividad ni correo. |
| Cancelar una confirmada de un bar | Requiere `expected_status: "confirmed"` y motivo válido. Devuelve 200 con estado y motivo persistidos. Un motivo inválido recibe 400. La acción se ofrece en el panel autenticado de Bares. |
| Editar una nota | Permitido al operador del establecimiento, incluida una cancelada. Una modificación efectiva genera actividad de nota y conserva el estado. |

El panel usa el recibo persistido para actualizar la tarjeta e inhibe la repetición mientras el PATCH está en curso. Aplica solo el campo editado y lo conserva si llega una lectura anterior. Por ejemplo, si la respuesta al guardar una nota llega después de la confirmación, la tarjeta muestra tanto la nota guardada como el estado confirmado. Permanece disponible la consulta autenticada por fecha. El PATCH público devuelve 410, una solicitud sin sesión válida recibe 401 y una sesión de otro local recibe 403.

## Comunicaciones

El servicio existente renderiza solicitud recibida, confirmación y cancelación. Usa el destinatario de la reserva, escapa los valores incorporados al HTML y representa la llegada en Asunción. Con envío deshabilitado o sin clave configurada, devuelve normalmente después de registrar `[EMAIL STUB]`. Con el envío habilitado y configurado, invoca el SDK. Un error del proveedor o transporte produce un diagnóstico sanitizado. El intento sucede tras la persistencia. La confirmación del panel describe el estado guardado. Una respuesta satisfactoria del proveedor acredita aceptación del intento. La entrega efectiva requiere comprobación externa.

Ante una incidencia de correo el operador puede consultar el estado persistido y los datos de contacto existentes en la reserva y coordinar manualmente con el cliente. No se identificó una dirección específica de notificaciones operativas del bar. El aviso opcional queda diferido y el bar continúa revisando el panel.

## Pruebas locales y límites

El runner de gestión reutiliza la fixture de B-02 en PostgreSQL y PostgREST desechables. Ejecuta los routers y middleware reales con proveedor Auth simulado. El SDK de correo apunta a un receptor de loopback, que comprueba el estado ya persistido al recibir la solicitud y puede rechazarla. La carrera sincroniza dos peticiones inmediatamente antes de las escrituras de PostgREST. El navegador abre la pantalla real del panel con sesión sintética en escritorio y móvil.

Desde la raíz del repositorio, indicar un destino persistente y ejecutar

```powershell
$b03Evidence = Join-Path $env:LOCALAPPDATA 'Tairet/B03-QA'
$env:B03_POSTGREST_IMAGE = 'postgrest/postgrest@sha256:c847127074bd26e1b8d3f7c0e6e01e5346f4b85dd34f5d699fd230af960827c0'
pnpm -C functions/api exec tsx tests/bar-management/integration.ts $b03Evidence
foreach ($mode in 'disabled','missing-key','network-error') {
  pnpm -C functions/api exec tsx tests/bar-management/mail-modes.ts $mode $b03Evidence
}
```

Con `--serve`, el runner deja una API local para reproducir la prueba de navegador incluida en las evidencias. La fixture comienza con el esquema anterior y filas históricas, ejecuta el archivo 051 y comprueba su constraint. El informe de cierre identifica el candidato, los resultados de concurrencia, la recarga en escritorio y móvil y las limitaciones de Auth y correo externos.

## Dependencias de una futura puesta en marcha

El orden es **migración → API → panel**. La API requiere la nueva columna para las lecturas y escrituras privadas. Un panel anterior sigue pudiendo gestionar pendientes. Una reversión de aplicación debe conservar la columna, el constraint y todos los motivos almacenados. Al volver a una API anterior se perdería temporalmente la capacidad de consultarlos y de guardar nuevos motivos desde esa versión. Cualquier eliminación de datos requeriría una decisión aparte.
