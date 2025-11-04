import express from "express";
import { errorHandler } from "./middlewares/error";
import { requestId } from "./middlewares/requestId";
import { corsMiddleware } from "./middlewares/cors";
import { ordersRouter } from "./routes/orders";
import { paymentsRouter } from "./routes/payments";
import { reservationsRouter, localsReservationsRouter } from "./routes/reservations";
import { promosRouter } from "./routes/promos";
import { metricsRouter } from "./routes/metrics";
import { eventsRouter } from "./routes/events";

export const app = express();

// Middlewares
app.use(corsMiddleware);
app.use(requestId);
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Routes
app.use("/orders", ordersRouter);
app.use("/payments", paymentsRouter);

// Reservas globales (crear reserva de bar)
app.use("/reservations", reservationsRouter);

// Rutas bajo /locals
app.use("/locals", localsReservationsRouter); // GET /locals/:id/reservations
app.use("/locals", promosRouter);

app.use("/metrics", metricsRouter);
app.use("/events", eventsRouter);

// Error handler (último middleware)
app.use(errorHandler);

export const server = app;

