import { Router } from "express";
import { ZodError } from "zod";
import { createReservationSchema, updateReservationStatusSchema } from "../schemas/reservations";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";
import { sendReservationReceivedEmail, sendReservationConfirmedEmail } from "../services/emails";
import { panelAuth } from "../middlewares/panelAuth";

export const reservationsRouter = Router();

// POST /reservations
reservationsRouter.post("/", async (req, res, next) => {
  try {
    const validated = createReservationSchema.parse(req.body);

    const { data, error } = await supabase
      .from("reservations")
      .insert({
        local_id: validated.local_id,
        name: validated.name,
        email: validated.email,
        phone: validated.phone,
        date: validated.date,
        guests: validated.guests,
        status: "en_revision",
        notes: validated.notes,
      })
      .select()
      .single();

    if (error) {
      logger.error("Error creating reservation", { error: error.message });
      return res.status(400).json({ error: error.message });
    }

    // Enviar email de forma fire-and-forget
    sendReservationReceivedEmail({
      email: validated.email,
      name: validated.name,
      date: validated.date,
      people: validated.guests,
    }).catch((err) => {
      logger.error("Error sending reservation email", { error: err });
    });

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// PATCH /reservations/:id
reservationsRouter.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Missing reservation id" });
    }

    const validated = updateReservationStatusSchema.parse(req.body);

    // Buscar la reserva actual
    const { data: reservation, error: fetchError } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !reservation) {
      logger.error("Error fetching reservation", {
        error: fetchError?.message,
        reservationId: id,
      });
      return res.status(404).json({ error: "Reservation not found" });
    }

    // Validar que solo se puede cambiar desde 'en_revision'
    if (reservation.status !== "en_revision") {
      return res.status(400).json({
        error: "La reserva ya fue procesada",
        currentStatus: reservation.status,
      });
    }

    // Actualizar el estado
    const { data: updated, error: updateError } = await supabase
      .from("reservations")
      .update({
        status: validated.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, local_id, name, email, phone, date, guests, status, notes, created_at, updated_at")
      .single();

    if (updateError) {
      logger.error("Error updating reservation", {
        error: updateError.message,
        reservationId: id,
      });
      return res.status(500).json({ error: updateError.message });
    }

    // Enviar email de confirmación si el nuevo estado es 'confirmed'
    if (validated.status === "confirmed") {
      sendReservationConfirmedEmail({
        email: reservation.email,
        name: reservation.name,
        date: reservation.date,
        people: reservation.guests,
      }).catch((err) => {
        logger.error("Error sending reservation confirmation email", { error: err });
      });
    }

    res.status(200).json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: error.flatten() });
    }
    next(error);
  }
});

// GET /locals/:id/reservations
// Esta ruta se monta en "/locals" en server.ts
// Requiere autenticación del panel
export const localsReservationsRouter = Router();
localsReservationsRouter.get("/:id/reservations", panelAuth, async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Missing local id" });
    }

    // Validar que el localId del path coincida con el del usuario autenticado
    if (id !== req.panelUser.localId) {
      return res.status(403).json({ error: "Forbidden: You can only access your own local's reservations" });
    }

    const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, local_id, name, email, phone, date, guests, status, notes, created_at, updated_at"
    )
    .eq("local_id", id)
    .order("created_at", { ascending: false })
    .limit(20);  

    if (error) {
      logger.error("Error fetching reservations", {
        error: error.message,
        localId: id,
      });
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json(data || []);
  } catch (error) {
    next(error);
  }
});

