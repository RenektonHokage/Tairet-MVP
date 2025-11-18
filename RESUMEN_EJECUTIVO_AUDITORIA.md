# Resumen Ejecutivo - Auditoría Técnica Backend Tairet MVP

**Fecha:** 2025-01-XX  
**Repo:** `C:\Importante\Python\tairet-mono-2`

---

## 1. Estructura del Proyecto

| Componente | Ubicación | Descripción |
|------------|-----------|-------------|
| Backend | `functions/api/` | Express + TypeScript, puerto 4000 |
| Frontend | `apps/web-next/` | Next.js 15 (App Router) |
| SQL | `infra/sql/` | schema.sql, rls.sql, seed.sql |
| Scripts | `scripts/smoke.http` | Requests de prueba (REST Client) |

**Gestor:** PNPM v10+  
**Node.js:** v22.19.0

---

## 2. Tabla de Endpoints (Los 4 del MVP)

| Endpoint | Archivo | Método | Validador | Status Codes | Body Ejemplo |
|----------|---------|--------|-----------|--------------|--------------|
| `POST /events/profile_view` | `functions/api/src/routes/events.ts:111-140` | POST | `profileViewSchema` (Zod) | 201, 400, 500 | `{ local_id: "uuid", ip_address?: string, user_agent?: string, source?: string }` |
| `POST /events/whatsapp_click` | `functions/api/src/routes/events.ts:22-49` | POST | `whatsappClickSchema` (Zod) | 201, 400, 500 | `{ local_id: "uuid", phone?: string, source?: string }` |
| `POST /events/promo_open` | `functions/api/src/routes/events.ts:75-109` | POST | `promoOpenSchema` (Zod) | 201, 400, 500 | `{ promo_id: "uuid", local_id: "uuid", source?: string }` |
| `POST /reservations` | `functions/api/src/routes/reservations.ts:9-48` | POST | `createReservationSchema` (Zod) | 201, 400, 500 | `{ local_id: "uuid", name: string, email: string, phone: string, date: ISO-8601, guests: number, notes?: string }` |

### Validaciones

- ✅ Todos los endpoints usan Zod para validación
- ✅ `local_id` y `promo_id` son UUIDs válidos (Zod)
- ✅ `reservations` valida email, guests >= 1, fecha ISO-8601
- ✅ Campos opcionales manejados correctamente

---

## 3. Estado de CORS

| Origen | Estado Actual | Estado Deseado |
|--------|---------------|----------------|
| `http://localhost:3000` | ✅ Permitido | ✅ Permitido |
| `https://lovable.dev` | ❌ **FALTA** | ✅ Permitido |
| `https://tairet.lovable.app` | ❌ **FALTA** | ✅ Permitido |
| `http://localhost:5173` | ❌ **FALTA** | ✅ Permitido |
| `https://*.ngrok.io` | ❌ **FALTA** | ✅ Permitido (patrón) |
| `https://*.trycloudflare.com` | ❌ **FALTA** | ✅ Permitido (patrón) |

**Problema:** CORS actual solo permite UN origen (`FRONTEND_ORIGIN`).  
**Solución:** Ver diff en `DIFFS_PROPUESTOS.md` sección 1.

---

## 4. Supabase / Postgres

| Tabla | Usada por | Columnas Relevantes |
|-------|-----------|---------------------|
| `profile_views` | `POST /events/profile_view` | `local_id`, `ip_address`, `user_agent`, `source` |
| `whatsapp_clicks` | `POST /events/whatsapp_click` | `local_id`, `phone`, `metadata` (JSONB) |
| `events_public` | `POST /events/promo_open` | `type`, `local_id`, `metadata` (JSONB) |
| `reservations` | `POST /reservations` | `local_id`, `name`, `email`, `phone`, `date`, `guests`, `status` |

**RLS:** ✅ Habilitado, políticas permiten INSERT público (correcto para MVP).

**Comandos para aplicar schema:**
```bash
# En Supabase Dashboard > SQL Editor:
# 1. Ejecutar infra/sql/schema.sql
# 2. Ejecutar infra/sql/rls.sql
# 3. Ejecutar infra/sql/seed.sql (opcional)
```

---

## 5. Formato de Respuesta

| Endpoint | Suceso (201) | Error (400/500) |
|----------|--------------|-----------------|
| `POST /events/*` | `{ ok: true }` | `{ error: "message" }` o `{ error: { fieldErrors: ... } }` |
| `POST /reservations` | Objeto completo de reserva | `{ error: "message" }` |
| `GET /health` | `{ ok: true }` | N/A |

**Estado:** Inconsistente pero funcional para MVP.  
**Recomendación:** Documentar en README, mantener formato actual.

---

## 6. Logging

| Componente | Estado Actual | Estado Deseado |
|------------|---------------|----------------|
| Logger | ✅ Implementado (`utils/logger.ts`) | ✅ Mejorar uso en error handler |
| Middleware de error | ❌ Usa `console.error` | ✅ Usar logger, loguear body |
| Logueo de body | ❌ **FALTA** | ✅ Loguear body en errores 4xx/5xx |

**Solución:** Ver diff en `DIFFS_PROPUESTOS.md` sección 2.

---

## 7. Variables de Entorno

| Variable | Obligatorio | Default | Estado |
|----------|-------------|---------|--------|
| `PORT` | No | `4000` | ✅ OK |
| `FRONTEND_ORIGIN` | No | `http://localhost:3000` | ✅ OK |
| `TUNNEL_ORIGIN` | No | - | ❌ **FALTA** documentar |
| `SUPABASE_URL` | Sí | - | ✅ OK |
| `SUPABASE_SERVICE_ROLE` | Sí | - | ✅ OK |
| `NODE_ENV` | No | - | ✅ OK |

**Problema:** No existe `.env.example` en `functions/api/`.  
**Solución:** Ver `DIFFS_PROPUESTOS.md` sección 3.

---

## 8. HTTPS / Túnel

| Componente | Estado | Acción |
|------------|--------|--------|
| Documentación ngrok | ❌ **FALTA** | Agregar a README.md |
| Documentación Cloudflare | ❌ **FALTA** | Agregar a README.md |
| Script de túnel | ❌ **FALTA** | Opcional (no crítico) |

**Solución:** Ver `DIFFS_PROPUESTOS.md` sección 4.

---

## 9. Healthcheck

| Ruta | Status | Respuesta |
|------|--------|-----------|
| `GET /health` | ✅ Funcional | `{ ok: true }` |

**Estado:** ✅ OK, no requiere cambios.

---

## 10. Zona Horaria

| Componente | Estado | Nota |
|------------|--------|------|
| SQL Schema | ✅ `TIMESTAMPTZ` | Comentario: `-- Zona horaria: America/Asuncion` |
| Backend | ✅ ISO-8601 | Fechas en UTC, formato ISO-8601 en respuestas |
| Configuración explícita | ❌ No | No crítico para MVP |

**Estado:** ✅ Funcional, no requiere cambios.

---

## 11. Idempotencia

| Endpoint | Estado | Mecanismo |
|----------|--------|-----------|
| `POST /payments/callback` | ✅ Implementado | `transaction_id` único en `payment_events` |

**Nota:** No se usa en los 4 endpoints del MVP, pero está disponible.

---

## 12. Seguridad

| Componente | Estado | Recomendación |
|------------|--------|---------------|
| Rate limiting | ❌ No implementado | Opcional (post-MVP) |
| Helmet | ❌ No implementado | Opcional (post-MVP) |
| CORS | ⚠️ Parcial | **CRÍTICO:** Permitir Lovable y túneles |
| Validación | ✅ Zod en todos | ✅ OK |
| RLS | ✅ Habilitado | ✅ OK |

---

## 13. Lista de TODOs Mínimos (Máx. 5)

| Prioridad | Tarea | Archivo | Estado |
|-----------|-------|---------|--------|
| 🔴 **CRÍTICO** | Actualizar CORS para permitir Lovable y túneles | `functions/api/src/middlewares/cors.ts` | Pendiente |
| 🟡 RECOMENDADO | Crear `.env.example` | `functions/api/.env.example` | Pendiente |
| 🟡 RECOMENDADO | Mejorar logging en error handler | `functions/api/src/middlewares/error.ts` | Pendiente |
| 🟡 RECOMENDADO | Documentar túnel HTTPS | `README.md` | Pendiente |
| 🟢 OPCIONAL | Probar endpoints desde Lovable con túnel | - | Pendiente |

---

## 14. Comandos Reproducibles

### Desarrollo Local

```bash
# Instalar dependencias
pnpm install

# Backend
pnpm -C functions/api dev

# Frontend (opcional)
pnpm -C apps/web-next dev
```

### Túnel HTTPS (ngrok)

```bash
# Instalar ngrok
choco install ngrok  # Windows

# Levantar túnel
ngrok http 4000

# Configurar en functions/api/.env
TUNNEL_ORIGIN=https://abc123.ngrok.io

# Configurar en Lovable
VITE_API_URL=https://abc123.ngrok.io
```

### Testing

```bash
# Abrir scripts/smoke.http en VS Code
# Instalar extensión "REST Client"
# Ejecutar requests individuales
```

---

## 15. Conclusión

### Estado General

- ✅ **Endpoints:** Los 4 endpoints del MVP están implementados y funcionan correctamente
- ✅ **Validación:** Zod en todos los endpoints
- ✅ **Supabase:** Configuración correcta, tablas y RLS aplicados
- ✅ **Healthcheck:** Funcional
- ⚠️ **CORS:** Necesita ajustes para permitir Lovable y túneles (**CRÍTICO**)
- ⚠️ **Logging:** Mejorable (loguear body en errores) (**RECOMENDADO**)
- ⚠️ **Variables de entorno:** Falta `.env.example` (**RECOMENDADO**)

### Criterio de Éxito

✅ **Claridad total de:**
- Dónde tocar CORS: `functions/api/src/middlewares/cors.ts`
- Cómo exponer HTTPS: Usar ngrok/Cloudflare Tunnel
- Cómo setear API_URL en Lovable: Variable de entorno `VITE_API_URL`
- Endpoints listos: Los 4 endpoints están validados, con status claros, sin sorpresas

✅ **Comandos reproducibles:** Ver sección 14

✅ **Diffs mínimos listos:** Ver `DIFFS_PROPUESTOS.md`

---

## Archivos Generados

1. **AUDITORIA_TECNICA_BACKEND.md** - Auditoría completa con detalles técnicos
2. **DIFFS_PROPUESTOS.md** - Diffs listos para aplicar
3. **RESUMEN_EJECUTIVO_AUDITORIA.md** - Este archivo (resumen ejecutivo)

---

**Fin del Resumen Ejecutivo**

