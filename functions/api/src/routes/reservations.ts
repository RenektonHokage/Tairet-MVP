import { Router } from "express";
import { createReservationSchema } from "../schemas/reservations";

export const reservationsRouter = Router();

// POST /reservations
reservationsRouter.post("/", async (req, res, next) => {
  try {
    // TODO: Validar con createReservationSchema
    // TODO: Crear reserva en Supabase con estado 'en_revision'
    // TODO: Enviar email de confirmación (stub)
    res.status(200).json({ message: "TODO: Create reservation" });
  } catch (error) {
    next(error);
  }
});

// GET /locals/:id/reservations
// Esta ruta se monta en "/locals" en server.ts
export const localsReservationsRouter = Router();
localsReservationsRouter.get("/:id/reservations", async (req, res, next) => {
  try {
    const { id } = req.params;
    // TODO: Listar reservas del local (con RLS)
    res.status(200).json({ message: `TODO: Get reservations for local ${id}` });
  } catch (error) {
    next(error);
  }
});

