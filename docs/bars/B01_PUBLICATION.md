# B01 Publicación de bares

## Contrato

`locals.is_published` es un booleano no nulo, inicialmente `false`. En B-01 se aplica **solo a Bares**. Ningún registro existente queda publicado por la migración 050. TAIRET debe verificar cada establecimiento antes de autorizarlo. Los demos permanecen en `false`.

El propietario sigue leyendo y editando su perfil, galería y promociones desde B2B. Guardar un perfil conserva su publicación; intentar enviar `is_published` a `PATCH /panel/local` devuelve 403 sin guardar el resto del payload. No se agrega un panel ni un endpoint administrativo público.

La API filtra los bares sin publicar antes de paginar `/public/locals`, tanto con `type=bar` como sin tipo. El detalle por slug devuelve el mismo 404 que un local inexistente. Las reseñas públicas y sus estadísticas excluyen los bares sin publicar. Promociones privadas continúan detrás de `panelAuth`; los catálogos públicos de entradas siguen siendo exclusivos de Discotecas.

Listados y detalles de bares incluyen `is_published: true`. B2C exige esta señal y no recurre a mocks; un backend anterior sin esa señal no habilita descubrimiento. Las respuestas de catálogo, detalle y reseñas llevan `Cache-Control: no-store`. El cliente vuelve a consultar al montar y recuperar foco; una pantalla ya abierta no constituye una suscripción en tiempo real.

Se preservan Discotecas y sus catálogos legacy/Access. El indicador existe físicamente en la tabla compartida, pero **no habilita publicación dinámica de Discotecas**. Activarlo allí requiere otro alcance que considere sus recorridos y contratos sensibles.

## Preparación y aplicación

La migración preparada es `infra/sql/migrations/050_add_bar_publication.sql`. Requiere la frontera de acceso de la migración 021: `anon` y `authenticated` no tienen acceso directo a `locals`. Si encuentra privilegios incompatibles, aborta. No se modifican migraciones cerradas.

La entrega B-01 no aplica nada en producción. Para una futura aplicación autorizada: verificar el destino y ledger, aplicar 050 antes de arrancar la nueva API, luego desplegar API y B2C coordinadamente. Si falta la columna, la consulta falla cerrada; no hay fallback que publique registros. No marcar masivamente registros como publicados.

## Publicar o retirar con control de TAIRET

Solo un operador de TAIRET con acceso administrativo de base de datos puede ejecutar `infra/sql/admin/set_bar_publication.sql`. Usar una conexión previamente verificada, fuera del frontend y del panel de propietarios. No copiar credenciales en comandos, archivos de evidencia o informes; usar un servicio de conexión/secret manager ya configurado.

1. Verificar entorno, autorización, UUID, slug, tipo, contenido del perfil y estado actual mediante una consulta administrativa de solo lectura.
2. Confirmar que el local no es demo y registrar la autorización operativa de TAIRET por el canal vigente.
3. Ejecutar el script con las tres variables obligatorias. Ejemplo sobre un servicio **local de pruebas** ya configurado:

```powershell
psql 'service=tairet_local_test' -v ON_ERROR_STOP=1 -v local_id='<UUID verificado>' -v expected=false -v publish=true -f infra/sql/admin/set_bar_publication.sql
```

Para retirar: `expected=true`, `publish=false`. El script actualiza únicamente un bar que coincida con UUID y estado esperado, dentro de una transacción. Un UUID inexistente, una Discoteca o un estado distinto abortan sin commit. Nunca omitir la revisión de destino ni reutilizar este ejemplo como permiso para operar producción.

4. Verificar la fila devuelta y volver a leer el estado. Comprobar listado y URL directa: aparece/200 al publicar, desaparece/404 al retirar. B2B debe conservar el perfil y permitir su gestión.

No hay permiso de publicación para `anon`, `authenticated`, owner o staff. El backend usa su credencial existente, pero sus handlers de perfil mantienen una lista explícita de campos; la publicación no forma parte de ella. No se agrega una credencial administrativa nueva.

## Verificación reproducible

Desde la raíz del repositorio, con Node, pnpm y Docker disponibles:

```powershell
pnpm -C functions/api exec tsx tests/bar-publication/integration.ts '<directorio persistente absoluto>'
```

El runner crea sus propios contenedores PostgreSQL/PostgREST, sin leer `.env`, aplica la frontera 021 y la nueva migración sobre datos sintéticos y ejecuta los routers HTTP reales. Simula únicamente el proveedor Auth; ejecuta `panelAuth` y `requireRole` reales. No monta el servidor completo ni ejecuta pagos, reservas o check-in. Limpia sus contenedores al finalizar. Requiere las imágenes `postgres:17-bookworm` y `postgrest/postgrest:v12.2.3`, o `B01_POSTGREST_IMAGE` con una imagen compatible disponible. La ejecución entregada registra la imagen exacta en sus evidencias.

`--serve` mantiene el entorno después de las pruebas para QA de navegador. `local-runtime.json` contiene URL local e identidades de los contenedores, sin credenciales. Terminar con Ctrl+C. El runner de navegador se entrega junto a las evidencias y utiliza este archivo; las pruebas del proveedor de mapas y de Auth real quedan fuera de esa comprobación.
