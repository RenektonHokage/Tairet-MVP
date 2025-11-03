import { Router } from "express";

export const metricsRouter = Router();

// GET /metrics/summary?localId&from&to
metricsRouter.get("/summary", async (req, res, next) => {
  try {
    const { localId, from, to } = req.query;
    // TODO: Agregar métricas desde Supabase
    // - Vistas de perfil
    // - Clics de WhatsApp
    // - Reservas creadas
    // - Entradas vendidas/usadas
    // TODO: Retornar MetricsSummary
    res.status(200).json({
      message: `TODO: Get metrics for local ${localId} from ${from} to ${to}`,
    });
  } catch (error) {
    next(error);
  }
});

