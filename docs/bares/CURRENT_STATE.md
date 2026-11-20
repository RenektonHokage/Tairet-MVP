# Bares · Estado al 20/11/2026

**Bares V1 está publicado. B-01, B-02 y B-03 pasaron un ensayo externo privado con una reserva y tres correos. El primer piloto con un establecimiento real sigue pendiente.**

## Producto, código y Git

`VERIFIED_REPOSITORY`. `4c40aa34498d8aee3ef7b9282bddb9cb0f98772a` integró los tres bloques, presentes en `main` al corte `b5a23f4`. El alta es asistida por TAIRET. El bar conserva su perfil, fotos, horarios, promociones y métricas y decide si acepta cada solicitud. La gestión cotidiana se hace desde el panel.

| Bloque | Contrato implementado |
| --- | --- |
| [B-01 · Publicación](../bars/B01_PUBLICATION.md) | TAIRET publica o retira el bar. El catálogo y el perfil B2C consultan la API. El owner edita su perfil, sin facultad de publicarlo. Un bar oculto queda fuera del listado y del detalle público. |
| [B-02 · Solicitudes](../bars/B02_RESERVATIONS.md) | Sólo bares publicados. De 1 a 15 personas, mínimo 30 minutos de anticipación, mismo día permitido y llegada en horario operativo de Asunción, incluidos turnos nocturnos. La API guarda `en_revision` y descarta campos internos. |
| [B-03 · Gestión](../bars/B03_RESERVATION_MANAGEMENT.md) | Owner o staff del establecimiento confirma o cancela una pendiente. Cancelar una confirmada requiere motivo visible al cliente. El comentario del cliente, la nota privada y el motivo quedan separados. La actualización comprueba el estado previo y sólo la transición ganadora genera efectos. |

B-01 eliminó la dependencia de mocks para la publicación. B-02 llevó al servidor las reglas de personas y horarios y B-03 cerró la cancelación de reservas confirmadas que faltaba el 02/11. B-02 no añade una migración. El aviso automático al bar quedó diferido. La aceptación sigue siendo manual, sin garantía de mesa o cupo.

## Pruebas aceptadas

Las fichas B-01/02/03 distinguen pruebas con PostgreSQL/PostgREST locales de Auth y correo simulados. B-02 cubrió la regla del mismo día y la fecha civil. B-03 cubrió la carrera de dos operadores, un solo cambio ganador y la persistencia del motivo. Las 48 rutas del ensayo y las del commit `4c40aa3` dieron el mismo SHA-256, `179597c1fb566f281903a71635eab832df239d4766618b430923f586474dd0bd`.

`VERIFIED_RUNTIME` **en QA privado, 04/11**. Con Auth y base alojados, un bar sintético publicado recibió una sola solicitud desde B2C. Staff confirmó y owner canceló con motivo. El otro establecimiento recibió 403 al leer o editar. Al retirar el bar, detalle y solicitud nueva devolvieron 404 y el operador aún podía consultar la reserva cancelada. Resend registró `delivered` para solicitud, confirmación y cancelación. El destinatario confirmó su recepción (`REPORTED`). Ninguno incluía la nota privada. Se retiraron el proyecto de QA y los accesos temporales.

Los resultados constan en `ensayo_privado_20261104/RESULTADO_ENSAYO_PRIVADO_BARES.md` y `recorrido-verificado.json` del expediente **Completar integración B2B/B2C de bares**. SHA-256 del informe `af12e303a8c40ca2926f6b7f2cf4698ac6c2596e9ef6ae027775d844981d807f`.

## Publicación, operación y piloto

`VERIFIED_RUNTIME` **en producción, 19/11**, según las lecturas archivadas de publicación. El ledger registró `050_add_bar_publication` con versión `20261119033453` y `051_add_bar_reservation_cancel_reason` con versión `20261119033525`. Los hashes del SQL registrado coinciden con los archivos de Git. El cierre vinculó API, panel y B2C con `4c40aa3` y consignó HTTP 200 en sus comprobaciones. Las lecturas están archivadas en **Diagnosticar alcance comercial de Bares**, turno `01a1f1d8-c3dd-72b3-a3a2-ed0cd7335f43`, lecturas de ledger 03:35 y 03:36 UTC. [050](../../infra/sql/migrations/050_add_bar_publication.sql) · [051](../../infra/sql/migrations/051_add_bar_reservation_cancel_reason.sql)

El catálogo productivo devolvió 200 con **cero bares publicados** en ese cierre y en la comprobación posterior de la [portada B2C](../CONTEXT_INDEX.md). La gestión quedó publicada y ningún establecimiento se habilitó en esas operaciones. Con el catálogo vacío quedó pendiente comprobar una ficha pública real en producción. El piloto requiere un bar real habilitado, un operador y una reserva comercial acreditada. Ese recorrido y la recepción de correos de clientes reales en producción siguen `UNKNOWN`. La última revisión publicada de los servicios que consta en el corte es la del [cierre del 20/11](../discotecas/CURRENT_STATE.md).
