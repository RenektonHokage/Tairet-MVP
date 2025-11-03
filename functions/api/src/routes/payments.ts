import { Router } from "express";
import { handlePaymentCallback } from "../services/payments";

export const paymentsRouter = Router();

// POST /payments/callback
// Endpoint idempotente para recibir callbacks de Bancard/Dinelco
paymentsRouter.post("/callback", async (req, res, next) => {
  try {
    // TODO: Validar firma/callback
    // TODO: Verificar idempotencia (tabla payment_events)
    // TODO: Actualizar order con estado de pago
    // TODO: Retornar confirmación
    
    await handlePaymentCallback(req.body);
    res.status(200).json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

