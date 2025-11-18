# Diffs Propuestos - Auditoría Técnica Backend

## 1. CORS - Permitir Múltiples Orígenes (CRÍTICO)

### Archivo: `functions/api/src/middlewares/cors.ts`

```diff
 import cors from "cors";

-const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
+const allowedOrigins = [
+  "http://localhost:3000",
+  "http://localhost:5173",
+  "https://lovable.dev",
+  "https://tairet.lovable.app",
+  ...(process.env.FRONTEND_ORIGIN ? [process.env.FRONTEND_ORIGIN] : []),
+  // Permitir túneles ngrok/Cloudflare (patrón)
+  ...(process.env.TUNNEL_ORIGIN ? [process.env.TUNNEL_ORIGIN] : []),
+];
+
+// Permitir orígenes que coincidan con patrón ngrok
+const ngrokPattern = /^https:\/\/[a-z0-9-]+\.ngrok\.io$/;
+const cloudflarePattern = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;

 export const corsMiddleware = cors({
-  origin: frontendOrigin,
+  origin: (origin, callback) => {
+    // Permitir requests sin origin (Postman, curl, etc.)
+    if (!origin) {
+      return callback(null, true);
+    }
+
+    // Verificar orígenes permitidos
+    if (allowedOrigins.includes(origin)) {
+      return callback(null, true);
+    }
+
+    // Verificar túneles (ngrok, Cloudflare)
+    if (ngrokPattern.test(origin) || cloudflarePattern.test(origin)) {
+      return callback(null, true);
+    }
+
+    // Denegar origen no permitido
+    callback(new Error("Not allowed by CORS"));
+  },
   credentials: true,
 });
```

---

## 2. Logging - Mejorar Middleware de Error (RECOMENDADO)

### Archivo: `functions/api/src/middlewares/error.ts`

```diff
 import { Request, Response, NextFunction } from "express";
+import { logger } from "../utils/logger";

 export interface AppError extends Error {
   statusCode?: number;
 }

 export function errorHandler(
   err: AppError,
-  _req: Request,
+  req: Request,
   res: Response,
   _next: NextFunction
 ) {
   const statusCode = err.statusCode || 500;
   const message = err.message || "Internal Server Error";

-  // Log error (TODO: usar logger)
-  console.error(`[${statusCode}] ${message}`, err);
+  // Log error con logger
+  logger.error("Request error", {
+    statusCode,
+    message,
+    method: req.method,
+    path: req.path,
+    body: req.body,
+    error: err.stack || err.message,
+  });

   res.status(statusCode).json({
     error: message,
     ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
   });
 }
```

---

## 3. Variables de Entorno - Crear .env.example (RECOMENDADO)

### Archivo: `functions/api/.env.example` (NUEVO)

```env
# Puerto del servidor
PORT=4000

# Orígenes permitidos (CORS)
FRONTEND_ORIGIN=http://localhost:3000
TUNNEL_ORIGIN=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE=

# Entorno
NODE_ENV=development
```

---

## 4. Documentación - Instrucciones de Túnel (RECOMENDADO)

### Archivo: `README.md` (Agregar sección)

```markdown
## Túnel HTTPS para Desarrollo

Para exponer el backend local a través de HTTPS (necesario para Lovable):

### Opción 1: ngrok (Recomendado)

1. **Instalar ngrok:**
   ```bash
   # Windows (con Chocolatey)
   choco install ngrok
   
   # O descargar desde https://ngrok.com/download
   ```

2. **Levantar túnel:**
   ```bash
   ngrok http 4000
   ```

3. **Obtener URL:**
   ```
   Forwarding: https://abc123.ngrok.io -> http://localhost:4000
   ```

4. **Configurar backend:**
   ```bash
   # En functions/api/.env
   TUNNEL_ORIGIN=https://abc123.ngrok.io
   ```

5. **Configurar frontend (Lovable):**
   ```bash
   # En Lovable, setear variable de entorno:
   VITE_API_URL=https://abc123.ngrok.io
   ```

### Opción 2: Cloudflare Tunnel (Alternativa)

1. **Instalar cloudflared:**
   ```bash
   # Windows
   choco install cloudflared
   ```

2. **Levantar túnel:**
   ```bash
   cloudflared tunnel --url http://localhost:4000
   ```

3. **Obtener URL:**
   ```
   https://abc123.trycloudflare.com
   ```

4. **Configurar igual que ngrok**
```

---

## Resumen de Cambios

| Prioridad | Archivo | Cambio | Estado |
|-----------|---------|--------|--------|
| 🔴 CRÍTICO | `functions/api/src/middlewares/cors.ts` | Permitir múltiples orígenes | Pendiente |
| 🟡 RECOMENDADO | `functions/api/src/middlewares/error.ts` | Mejorar logging | Pendiente |
| 🟡 RECOMENDADO | `functions/api/.env.example` | Crear archivo | Pendiente |
| 🟡 RECOMENDADO | `README.md` | Agregar sección de túnel | Pendiente |

---

## Aplicar Cambios

### 1. Aplicar CORS (CRÍTICO)
```bash
# Editar functions/api/src/middlewares/cors.ts
# Aplicar diff de la sección 1
```

### 2. Aplicar Logging (RECOMENDADO)
```bash
# Editar functions/api/src/middlewares/error.ts
# Aplicar diff de la sección 2
```

### 3. Crear .env.example (RECOMENDADO)
```bash
# Crear functions/api/.env.example
# Copiar contenido de la sección 3
```

### 4. Actualizar Documentación (RECOMENDADO)
```bash
# Editar README.md
# Agregar sección de la sección 4
```

---

## Testing

Después de aplicar los cambios:

1. **Reiniciar backend:**
   ```bash
   pnpm -C functions/api dev
   ```

2. **Probar CORS desde Lovable:**
   ```javascript
   fetch("https://abc123.ngrok.io/events/profile_view", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
       local_id: "550e8400-e29b-41d4-a716-446655440001",
       source: "lovable_test",
     }),
   });
   ```

3. **Verificar logs:**
   ```bash
   # Deberías ver logs con body y error completo
   ```

---

**Fin de Diffs Propuestos**

