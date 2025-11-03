import { Router } from "express";
import { createOrderSchema } from "../schemas/orders";

export const ordersRouter = Router();

// POST /orders
ordersRouter.post("/", async (req, res, next) => {
  try {
    // TODO: Validar con createOrderSchema
    // TODO: Crear orden en Supabase
    // TODO: Retornar orden creada
    res.status(200).json({ message: "TODO: Create order" });
  } catch (error) {
    next(error);
  }
});

// GET /orders/:id
ordersRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    // TODO: Obtener orden desde Supabase
    // TODO: Validar acceso (RLS debería manejar esto)
    res.status(200).json({ message: `TODO: Get order ${id}` });
  } catch (error) {
    next(error);
  }
});

// PATCH /orders/:id/use (check-in manual sin QR en MVP)
ordersRouter.patch("/:id/use", async (req, res, next) => {
  try {
    const { id } = req.params;
    // TODO: Verificar que order existe y está pagada
    // TODO: Verificar que used_at es null
    // TODO: Actualizar used_at con timestamp actual
    // TODO: Retornar orden actualizada
    res.status(200).json({ message: `TODO: Mark order ${id} as used` });
  } catch (error) {
    next(error);
  }
});

