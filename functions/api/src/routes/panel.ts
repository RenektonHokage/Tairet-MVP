import { Router } from "express";
import { ZodError } from "zod";
import { panelAuth } from "../middlewares/panelAuth";
import { requireRole } from "../middlewares/requireRole";
import { calendarRouter } from "./calendar";
import { updateReservationStatusSchema } from "../schemas/reservations";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";
import { sendReservationConfirmedEmail } from "../services/emails";

export const panelRouter = Router();

// GET /panel/me
// Endpoint para obtener información del usuario del panel autenticado
// Requiere autenticación (middleware panelAuth)
panelRouter.get("/me", panelAuth, async (req, res) => {
  // req.panelUser está disponible gracias al middleware panelAuth
  if (!req.panelUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.status(200).json({
    local_id: req.panelUser.localId,
    email: req.panelUser.email,
    role: req.panelUser.role,
  });
});

// PATCH /panel/reservations/:id
// Actualiza estado o table_note de una reserva
// Requiere autenticación y validación de tenant
panelRouter.patch("/reservations/:id", panelAuth, async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

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

    // TENANT CHECK: validar que la reserva pertenece al local del usuario
    if (reservation.local_id !== req.panelUser.localId) {
      logger.warn("Tenant mismatch in reservation update", {
        reservationId: id,
        reservationLocalId: reservation.local_id,
        userLocalId: req.panelUser.localId,
      });
      return res.status(403).json({
        error: "Forbidden: You can only update reservations for your own local",
      });
    }

    // Preparar objeto de actualización
    const updateData: {
      status?: string;
      table_note?: string | null;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    // Si se intenta cambiar el status, validar que solo se puede desde 'en_revision'
    if (validated.status !== undefined) {
      if (reservation.status !== "en_revision") {
        return res.status(400).json({
          error: "La reserva ya fue procesada",
          currentStatus: reservation.status,
        });
      }
      updateData.status = validated.status;
    }

    // Permitir actualizar table_note independientemente del status
    if (validated.table_note !== undefined) {
      updateData.table_note = validated.table_note;
    }

    // Si no hay nada que actualizar, retornar error
    if (Object.keys(updateData).length === 1) {
      // Solo updated_at, no hay cambios reales
      return res.status(400).json({ error: "No hay campos para actualizar" });
    }

    // Actualizar la reserva
    const { data: updated, error: updateError } = await supabase
      .from("reservations")
      .update(updateData)
      .eq("id", id)
      .select("id, local_id, name, last_name, email, phone, date, guests, status, notes, table_note, created_at, updated_at")
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

// PATCH /panel/orders/:id/use (check-in)
// Roles permitidos: owner, staff
panelRouter.patch("/orders/:id/use", panelAuth, requireRole(["owner", "staff"]), async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Missing order id" });
    }

    // Buscar la orden
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // TENANT CHECK: validar que la orden pertenece al local del usuario
    if (order.local_id !== req.panelUser.localId) {
      logger.warn("Tenant mismatch in order check-in", {
        orderId: id,
        orderLocalId: order.local_id,
        userLocalId: req.panelUser.localId,
      });
      return res.status(403).json({
        error: "Forbidden: You can only update orders for your own local",
      });
    }

    // Validar que la orden está pagada
    if (order.status !== "paid") {
      return res.status(400).json({
        error: "Order must be paid before use",
        currentStatus: order.status,
      });
    }

    // Validar que no fue usada previamente
    if (order.used_at !== null) {
      return res.status(400).json({
        error: "Order already used",
        usedAt: order.used_at,
      });
    }

    // Actualizar used_at
    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({ used_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      logger.error("Error updating order for check-in", {
        error: updateError.message,
        orderId: id,
      });
      return res.status(500).json({ error: "Failed to update order" });
    }

    logger.info("Order checked in successfully", {
      orderId: id,
      localId: req.panelUser.localId,
      checkedInBy: req.panelUser.role,
    });

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

// PATCH /panel/checkin/:token
// Check-in por QR token
// Roles permitidos: owner, staff
panelRouter.patch("/checkin/:token", panelAuth, requireRole(["owner", "staff"]), async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: "Missing checkin token" });
    }

    // Buscar order por checkin_token
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, local_id, status, used_at, checkin_token")
      .eq("checkin_token", token)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // TENANT CHECK: validar que la orden pertenece al local del usuario
    if (order.local_id !== req.panelUser.localId) {
      logger.warn("Tenant mismatch in token check-in", {
        token,
        orderLocalId: order.local_id,
        userLocalId: req.panelUser.localId,
      });
      return res.status(403).json({
        error: "Forbidden: This order belongs to another local",
      });
    }

    // Validar que la orden está pagada
    if (order.status !== "paid") {
      return res.status(400).json({
        error: "Order must be paid before use",
        currentStatus: order.status,
      });
    }

    // Validar que no fue usada previamente
    if (order.used_at !== null) {
      return res.status(409).json({
        error: "Order already used",
        usedAt: order.used_at,
      });
    }

    // Actualizar used_at
    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({ used_at: new Date().toISOString() })
      .eq("checkin_token", token)
      .select("id, local_id, status, used_at")
      .single();

    if (updateError) {
      logger.error("Error in token check-in", {
        error: updateError.message,
        token,
      });
      return res.status(500).json({ error: "Failed to check in" });
    }

    logger.info("Token check-in successful", {
      orderId: updated.id,
      localId: req.panelUser.localId,
      checkedInBy: req.panelUser.role,
    });

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

// Rutas de calendario
panelRouter.use("/calendar", calendarRouter);

