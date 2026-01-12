/**
 * Rate limiting middleware para proteger endpoints de abuso.
 *
 * Implementación en memoria (MVP). Si se escala horizontalmente (múltiples instancias),
 * se debe migrar a un store compartido como Redis:
 * - npm install rate-limit-redis
 * - Configurar RedisStore en lugar del MemoryStore por defecto
 *
 * @see https://www.npmjs.com/package/express-rate-limit
 */
import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";
import type { Request, Response } from "express";

// Configuración base compartida
const baseConfig = {
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // No rate-limit OPTIONS preflight requests
  skip: (req: Request) => req.method === "OPTIONS",
  // Respuesta JSON consistente en 429
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: "Rate limit exceeded" });
  },
};

// Helper para crear un limiter
function createLimiter(
  windowMs: number,
  limit: number
): RateLimitRequestHandler {
  return rateLimit({
    ...baseConfig,
    windowMs,
    limit,
  });
}

// ============================================================
// /events (tracking fire-and-forget, típicamente 204)
// 120 req/min, 2000 req/día
// ============================================================
export const eventsMinuteLimiter = createLimiter(60 * 1000, 120);
export const eventsDayLimiter = createLimiter(24 * 60 * 60 * 1000, 2000);

// ============================================================
// /reservations (creación de reservas)
// 5 req/min, 20 req/día
// ============================================================
export const reservationsMinuteLimiter = createLimiter(60 * 1000, 5);
export const reservationsDayLimiter = createLimiter(24 * 60 * 60 * 1000, 20);

// ============================================================
// /orders (free_pass y futuro)
// 10 req/min, 50 req/día
// ============================================================
export const ordersMinuteLimiter = createLimiter(60 * 1000, 10);
export const ordersDayLimiter = createLimiter(24 * 60 * 60 * 1000, 50);

// ============================================================
// /panel (opcional, límites amplios para no afectar check-in en puerta)
// 120 req/min, 10000 req/día
// Solo se aplica si RATE_LIMIT_PANEL === "true"
// ============================================================
export const panelMinuteLimiter = createLimiter(60 * 1000, 120);
export const panelDayLimiter = createLimiter(24 * 60 * 60 * 1000, 10000);

/**
 * Indica si el rate limiting del panel está habilitado.
 * Se controla via env var RATE_LIMIT_PANEL=true
 */
export const isPanelRateLimitEnabled = (): boolean => {
  return process.env.RATE_LIMIT_PANEL === "true";
};
