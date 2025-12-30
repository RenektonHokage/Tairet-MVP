# Ejecutar Tairet Mono-2 Localmente

Guía rápida para correr el proyecto en desarrollo local.

## Requisitos

- **Node.js**: 18 o superior
- **pnpm**: 10 o superior
- **Supabase**: Proyecto creado y listo para usar

## Setup Inicial

### 1. Variables de Entorno

Copia los archivos `.env.example` y completa con tus valores:

**Frontend:**
```bash
# Copiar desde
apps/web-next/.env.example
# A
apps/web-next/.env
```

**Backend:**
```bash
# Copiar desde
functions/api/.env.example
# A
functions/api/.env
```

Completa las variables con tus credenciales de Supabase, PostHog, etc.

**Nota:** `NEXT_PUBLIC_API_URL=http://localhost:4000` debe estar configurado para que el frontend se conecte al backend.

### 2. Setup de Supabase

Ejecuta los scripts SQL en tu proyecto de Supabase (en orden):

1. **Schema** - Crear tablas:
   ```sql
   -- Ejecutar: infra/sql/schema.sql
   ```

2. **RLS** - Configurar Row Level Security:
   ```sql
   -- Ejecutar: infra/sql/rls.sql
   ```

3. **Seed** (opcional) - Datos de prueba:
   ```sql
   -- Ejecutar: infra/sql/seed.sql
   ```

## Comandos de Desarrollo

### Instalar Dependencias

```bash
pnpm install
```

### Frontend (Next.js)

```bash
pnpm -C apps/web-next dev
```

El frontend estará disponible en: **http://localhost:3000**

### Backend (Express API)

```bash
pnpm -C functions/api dev
```

El backend estará disponible en: **http://localhost:4000**

Verifica el healthcheck: **http://localhost:4000/health**

### Build Aprobado (Opcional)

```bash
pnpm approve-builds
```

## Próximos Pasos

Una vez que el proyecto esté corriendo, los próximos pasos sugeridos son:

1. **Implementar endpoints básicos**:
   - `POST /orders` - Crear orden con validación Zod
   - `GET /orders/:id` - Obtener orden desde Supabase
   - `POST /reservations` - Crear reserva con validación

2. **Implementar callbacks de pago**:
   - `POST /payments/callback` - Callback idempotente de Bancard/Dinelco

3. **Implementar métricas**:
   - `GET /metrics/summary` - KPIs agregados desde Supabase

4. **Conectar frontend con backend**:
   - Usar TanStack Query para cargar datos
   - Mostrar KPIs en el dashboard del panel

## Probar el Flujo de Órdenes

Para probar el flujo completo de órdenes:

1. **Crear una orden** usando `scripts/smoke.http`:
   - Ejecuta `POST http://localhost:4000/orders` con el body de ejemplo
   - Copia el `id` de la respuesta

2. **Simular callback de pago**:
   - Ejecuta `POST http://localhost:4000/payments/callback` con:
     ```json
     {
       "event_id": "txn_123456789",
       "order_id": "<id_de_la_orden>",
       "status": "approved"
     }
     ```

3. **Verificar en el panel**:
   - Abre `http://localhost:3000/panel`
   - En la sección "Probar Órdenes", pega el `id` de la orden
   - Haz clic en "Cargar orden" para ver el estado
   - Si la orden está pagada (`status: "paid"`), puedes hacer clic en "Check-in" para marcarla como usada

## URLs Locales

| Servicio | URL | Descripción |
|----------|-----|-------------|
| Frontend | http://localhost:3000 | Next.js App Router |
| Backend API | http://localhost:4000 | Express API |
| Healthcheck | http://localhost:4000/health | Status del API |

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Verifica que `apps/web-next/.env` y `functions/api/.env` existan
- Completa todas las variables de entorno requeridas

### Error: "Cannot connect to Supabase"
- Verifica que `SUPABASE_URL` y `SUPABASE_ANON_KEY` (o `SUPABASE_SERVICE_ROLE`) sean correctos
- Asegúrate de que el proyecto Supabase esté activo

### Error: "Port already in use"
- Verifica que los puertos 3000 y 4000 no estén ocupados
- Cambia el puerto en `.env` si es necesario

### Backend no responde
- Verifica que `pnpm -C functions/api dev` esté corriendo
- Verifica que el archivo `.env` del backend tenga `PORT=4000` (o el puerto configurado)
- Revisa los logs del backend para errores


