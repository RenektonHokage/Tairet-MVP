import express from "express";
import { errorHandler } from "./middlewares/error";
import { requestId } from "./middlewares/requestId";
import { corsMiddleware } from "./middlewares/cors";
import {
  eventsMinuteLimiter,
  eventsDayLimiter,
  reservationsMinuteLimiter,
  reservationsDayLimiter,
  ordersMinuteLimiter,
  ordersDayLimiter,
  panelMinuteLimiter,
  panelDayLimiter,
  isPanelRateLimitEnabled,
} from "./middlewares/rateLimit";
import { ordersRouter } from "./routes/orders";
import { paymentsRouter } from "./routes/payments";
import { reservationsRouter, localsReservationsRouter } from "./routes/reservations";
import { promosRouter } from "./routes/promos";
import { metricsRouter } from "./routes/metrics";
import { eventsRouter } from "./routes/events";
import { activityRouter } from "./routes/activity";
import { panelRouter } from "./routes/panel";
import { publicRouter } from "./routes/public";

export const app = express();

// Trust proxy en producción (Railway, etc.) para obtener IP real
// Soporta TRUST_PROXY_HOPS env para configurar número de proxies (default: 1)
if (process.env.NODE_ENV === "production") {
  const hops = parseInt(process.env.TRUST_PROXY_HOPS || "1", 10);
  app.set("trust proxy", hops);
}

// Middlewares
app.use(corsMiddleware);
app.use(requestId);
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Public routes (sin auth)
app.use("/public", publicRouter);

// Routes con rate limiting
app.use("/orders", ordersMinuteLimiter, ordersDayLimiter, ordersRouter);
app.use("/payments", paymentsRouter);

// Reservas globales (crear reserva de bar)
app.use("/reservations", reservationsMinuteLimiter, reservationsDayLimiter, reservationsRouter);

// Rutas bajo /locals
app.use("/locals", localsReservationsRouter); // GET /locals/:id/reservations
app.use("/locals", promosRouter);

app.use("/metrics", metricsRouter);
app.use("/events", eventsMinuteLimiter, eventsDayLimiter, eventsRouter);
app.use("/activity", activityRouter);

// Panel: rate limit opcional (RATE_LIMIT_PANEL=true)
if (isPanelRateLimitEnabled()) {
  app.use("/panel", panelMinuteLimiter, panelDayLimiter, panelRouter);
} else {
  app.use("/panel", panelRouter);
}

// Error handler (último middleware)
app.use(errorHandler);

export const server = app;

