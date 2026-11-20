# Events · Estado al 20/11/2026

**E2E de Events V1 pendiente.** Bancard Staging aprobó la compra del 20/11. La notificación original recibió 403 en el perímetro QA y la orden de Events seguía `pending_payment` al cierre. El expediente final de R5 registra `SAFE_CLOSURE`.

## Producto, código y aceptación local

`VERIFIED_REPOSITORY`. Events tiene entidad y membresía propias. La decisión R6C2 sitúa en Access la autoridad transaccional de órdenes, pago, emisión y validación. R2C2 conserva el roadmap. Las banderas iniciales de Stage B del índice P0-01 y el plan Ibiza describen cortes anteriores. Los documentos de decisión están en `docs/events/00_EVENTS_CANONICAL_INDEX.md` y `docs/events/EVENTS_CANONICAL_DATA_PLANE_DECISION_R6.md` del commit de Events.

| Hito local | Alcance aceptado |
| --- | --- |
| `9b08827` → `159deeca` | M053 V30 con F01/F02 cerrados y flujo R2/054 de catálogo, checkout, recuperación y check-in QR/manual en `access_entries`. En PostgREST local, 10 casos de compra/recuperación pasaron con proveedores simulados. Check-in conservó 8 PASS/1 FAIL de expectativa ACL y un suplemento PASS. |
| `91f9df9` | Perfil hosted R8 para instalación nueva. El manifiesto fija las fuentes físicas y el orden, incluido el bootstrap RLS. |
| `b17a1cc47cbbcf09fab593c944e7ce5b4cecd65c` | Listado canónico del EventPanel con lectura autenticada por evento. La aceptación local del listado registró 15 pruebas unitarias y 12 PostgreSQL/PostgREST con proveedor Auth simulado. |

El HEAD de `codex/events-v1-functional-flow-r1-906bd5fb` es `b17a1cc`. No es ancestro de `main` (`b5a23f4`) y esa rama no figuró entre las heads anunciadas por `origin` el 20/11. Las migraciones Events 050–054 pertenecen a esta línea. El manifiesto `infra/sql/profiles/events-hosted-r8/manifest.json` se lee en ese commit. La [tabla de migraciones por área](../CONTEXT_INDEX.md) distingue esta instalación de las 050–052 publicadas para locales.

## Sandbox, banco y estado de la orden

`VERIFIED_RUNTIME` **histórico del sandbox privado R5 y Bancard Staging**. El 07/11 se completaron los 57 pasos del perfil R8 en el destino aislado. El 08/11 la creación del proceso había recibido un 403 del proveedor. El 20/11, una comprobación directa de Single Buy obtuvo HTTP 200 y un proceso válido. Después, el ensayo atendido usó el checkout alojado del producto. El expediente vinculó sus 658 archivos de producto a `b17a1cc`.

| Tramo del 20/11 | Resultado más reciente acreditado |
| --- | --- |
| Checkout y banco | Una orden, un despacho y una operación aprobada en el portal de Staging. |
| Callback y estado canónico | El POST original devolvió `403 QA_OPERATIONS_DISABLED` antes de persistir confirmación. Orden `pending_payment`, intento `provider_ready`, reserva `reserved` al último cotejo. |
| Corrección del receptor | Se corrigió la capa QA de despliegue. Pasaron 28 controles locales y dos sondas alojadas con cuerpo inválido alcanzaron el handler (400 esperado). Cero reentregas auténticas hasta la parada. |
| Emisión, correo y puerta | Cero entradas emitidas, ciclos del worker, intentos de correo y usos de QR. Quedan pendientes la recuperación, la recepción real en buzón, el primer check-in físico y el duplicado. |

El propietario informó que solicitó a Bancard la reentrega de la notificación original (`REPORTED`). Al cerrar el expediente seguían pendientes respuesta y número de caso. La aprobación del banco conserva su procedencia externa. El comercio requiere una confirmación auténtica registrada para continuar la orden.

## Cierre operativo y comercial

`VERIFIED_RUNTIME` **al cierre del 20/11, hora de Asunción**. Se cotejaron las copias de respaldo y los datos preservados. A las 18:45 la API y el worker de Railway figuraban offline, con cero despliegues activos. El proyecto de base QA se trasladó a Free y a las 18:54 se verificó su pausa. La evidencia de preparación previa (`READY_FOR_ATTENDED_E2E`) quedó superada por este cierre. Una reapertura, reentrega o ensayo posterior requiere su propia autorización.

La integración funcional local continúa aceptada. Siguen pendientes el E2E externo completo y la habilitación de un Event comercial. Un despliegue productivo de este candidato, ventas reales y un resultado posterior de soporte están `UNKNOWN`. Los [gates de autoridad Access](../access-core/ROADMAP.md) siguen vigentes.

**Fuentes del expediente `TAIRET-Events-Flow`.** `REVIEW-R2-054-R1-c61dce27` y `REVIEW-EVENTPANEL-ENTRIES-R1-e604eb88` documentan las aceptaciones locales. `EV_SANDBOX_CANONICAL_READY_R5_e349e1c5/001_RESULTADO_R5_e349e1c5.md` documenta la instalación. Para el cierre atendido, consultar `EV_R5_20261120_R1_91788560/entrega-atendida/RESUMEN.md` (SHA-256 `dea2fd2d8d0eca4bf51cc73b9036f288a0bea037c95a9dbdfd105566d9ee4f1c`) y sus recibos `evidence/FINAL_STAGE_RESULTS_PUBLIC_RECORD.json` y `evidence/FINAL_CLOSURE_COMPLETION_PUBLIC_RECORD.json`. La prueba directa figura aparte en `TAIRET_BANCARD_STAGING_SINGLE_BUY_RECHECK_20261120_R1/RESULTADO_SINGLE_BUY_STAGING_20261120.md`.
