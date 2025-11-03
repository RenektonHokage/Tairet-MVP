import { Router } from "express";
import { promoUpsertSchema } from "../schemas/promos";

export const promosRouter = Router();

// GET /locals/:id/promos
promosRouter.get("/:id/promos", async (req, res, next) => {
  try {
    const { id } = req.params;
    // TODO: Listar promos del local (con RLS)
    res.status(200).json({ message: `TODO: Get promos for local ${id}` });
  } catch (error) {
    next(error);
  }
});

// POST /locals/:id/promos
promosRouter.post("/:id/promos", async (req, res, next) => {
  try {
    const { id } = req.params;
    // TODO: Validar con promoUpsertSchema
    // TODO: Crear/editar promo (imagen + fechas informativas)
    res.status(200).json({ message: `TODO: Upsert promo for local ${id}` });
  } catch (error) {
    next(error);
  }
});

