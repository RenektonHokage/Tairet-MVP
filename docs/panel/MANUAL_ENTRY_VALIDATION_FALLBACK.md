# Manual Entry Validation Fallback

## 1. Proposito

Este documento registra el fallback manual de validacion de entradas/free pass desde el apartado Entradas del panel.

El scanner QR sigue siendo el metodo principal de validacion en puerta. Este fallback permite operar cuando el scanner no es practico o falla por camara, iluminacion, QR danado, rapidez operativa o preferencia del local.

Este flujo no es fallback offline. Requiere panel, API y backend funcionando.

## 2. Alcance

Aplica al panel autenticado de Tairet para el corte `free_pass only`.

Roles habilitados:

- `owner`;
- `staff`.

No aprueba paid flows, pagos reales ni `/payments/callback`.

## 3. Flujo operativo

1. El usuario ingresa al apartado Entradas del panel.
2. Busca una entrada por email/Gmail o documento/cedula.
3. Revisa la card de la entrada encontrada.
4. Si la entrada esta pendiente, aparece el boton `Validar manualmente`.
5. Al tocar el boton, el panel muestra una confirmacion: `Esta accion marcara la entrada como usada.`
6. Al confirmar, el panel llama a `PATCH /panel/orders/:id/use`.
7. La entrada queda marcada como usada.
8. La card/lista se actualiza.
9. Si luego se intenta validar la misma entrada por scanner/check-in, el sistema responde que ya esta usada.

## 4. Implementacion actual

Backend:

- usa `PATCH /panel/orders/:id/use`;
- valida por `order.id` desde panel autenticado;
- no depende de `checkin_token` para validar manualmente;
- mantiene `panelAuth`;
- mantiene `requireRole(["owner", "staff"])`;
- mantiene tenant check contra el local del usuario de panel;
- mantiene validacion `status === "paid"`;
- mantiene bloqueo si `used_at` ya existe;
- mantiene validacion de ventana para locales tipo `club`;
- `Order already used` responde `409`;
- no toca `PATCH /panel/checkin/:token`.

Success DTO:

```ts
{
  id,
  status,
  used_at,
  customer_name,
  customer_last_name,
  customer_document
}
```

Frontend:

- agrega la accion `Validar manualmente` en la card de Entradas;
- exige confirmacion antes de ejecutar;
- muestra estado de loading, exito o error;
- actualiza la card/lista/summary despues del exito;
- mantiene busqueda vigente por email y documento.

## 5. Reglas de visibilidad del boton

- El boton aparece solo cuando `checkin_state === "pending"`.
- No aparece en entradas usadas.
- No aparece en entradas fuera de estado pendiente.
- No aparece en demo mode si la accion haria una llamada real.
- No agrega busqueda por telefono o nombre en este slice.

## 6. Validaciones backend conservadas

El endpoint conserva:

- autenticacion de panel;
- rol `owner` o `staff`;
- tenant/local check;
- validacion de orden pagada;
- bloqueo por `used_at`;
- validacion de ventana para `club`;
- errores controlados para orden inexistente, tenant incorrecto, orden no pagada, orden ya usada y ventana invalida.

## 7. QA runtime ejecutado

- Busqueda por Gmail/email -> `PASS`.
- Busqueda por documento/cedula -> `PASS`.
- Owner valida manualmente entrada valida -> `PASS`.
- Staff valida manualmente entrada valida -> `PASS`.
- Boton manual funciona -> `PASS`.
- Card pasa a usada despues de validar -> `PASS`.
- Scanner posterior sobre la misma entrada responde como ya usada -> `PASS`.
- Scanner sigue funcionando -> `PASS`.
- `GET /panel/orders/search` sin regresion -> `PASS`.
- `GET /panel/checkins` sin regresion -> `PASS`.
- `/health` 200 -> `PASS`.
- `x-request-id` presente -> `PASS`.
- `git diff --check` -> `PASS`.
- Entrada expirada/fuera de ventana -> `N/A`, sin dato disponible para esta validacion.

## 8. Limitaciones aceptadas

- No se distingue durablemente QR vs manual.
- No existe `checkin_method`, `checkin_source` ni `used_method` en este MVP.
- La trazabilidad QR/manual queda como mejora futura.
- Este fallback no funciona offline.
- Requiere panel/API operativo.

## 9. Fuera de alcance

No incluye:

- paid flows;
- `/payments/callback`;
- cambios SQL/RLS;
- migraciones;
- cambios al scanner QR;
- busqueda por telefono/nombre;
- redisenar Entradas;
- cambios visuales profundos del boton;
- B2C;
- exports;
- cambios al service role global.

## 10. Mejoras futuras

- Agregar `checkin_method` o equivalente con valores `qr`/`manual` si se requiere auditoria.
- Registrar actor de panel que valida manualmente si el negocio lo requiere.
- Agregar busqueda por telefono/nombre.
- Mejorar polish visual del boton.
- Reemplazar la confirmacion inline por modal mas robusto si el flujo crece.
- Agregar reporting por metodo de validacion.
- Disenar fallback offline real en un bloque separado.
