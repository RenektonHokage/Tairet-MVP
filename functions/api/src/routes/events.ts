import { Router } from "express";

export const eventsRouter = Router();

// POST /events/whatsapp_click
eventsRouter.post("/whatsapp_click", async (req, res, next) => {
  try {
    const { localId, phone } = req.body;
    // TODO: Validar localId y phone
    // TODO: Registrar evento en Supabase (tabla events_public o whatsapp_clicks)
    // TODO: Enviar a PostHog si está configurado
    res.status(200).json({ message: "TODO: Track WhatsApp click" });
  } catch (error) {
    next(error);
  }
});

