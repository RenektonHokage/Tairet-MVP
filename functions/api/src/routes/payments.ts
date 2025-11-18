import { Router } from "express";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";

export const paymentsRouter = Router();

// POST /payments/callback
// Endpoint idempotente para recibir callbacks de Bancard/Dinelco
// Body esperado: { event_id: string, order_id: string, status: string, ... }
// event_id es el transaction_id único usado para idempotencia
paymentsRouter.post("/callback", async (req, res, next) => {
  try {
    const { event_id, order_id, status } = req.body;

    if (!event_id || !order_id) {
      return res.status(400).json({
        error: "Missing required fields: event_id and order_id are required",
      });
    }

    // Verificar idempotencia: intentar insertar en payment_events
    // Si el transaction_id ya existe (unique constraint), retornar idempotente
    const { data: existingEvent, error: selectError } = await supabase
      .from("payment_events")
      .select("id")
      .eq("transaction_id", event_id)
      .single();

    if (existingEvent) {
      // Ya procesado, retornar idempotente
      return res.status(200).json({
        idempotent: true,
        message: "Event already processed",
      });
    }

    // Insertar evento (si falla por unique, es idempotente)
    const { data: event, error: insertError } = await supabase
      .from("payment_events")
      .insert({
        order_id,
        transaction_id: event_id,
        status: status || "pending",
        payload: req.body,
      })
      .select()
      .single();

    if (insertError) {
      // Si es error de unique constraint, es idempotente
      if (insertError.code === "23505") {
        return res.status(200).json({
          idempotent: true,
          message: "Event already processed",
        });
      }

      logger.error("Error inserting payment event", {
        error: insertError.message,
        eventId: event_id,
      });
      return res.status(500).json({ error: "Failed to process payment event" });
    }

    // Si el status es 'approved' o 'paid', actualizar la orden
    if (status === "approved" || status === "paid") {
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          status: "paid",
          transaction_id: event_id,
        })
        .eq("id", order_id);

      if (updateError) {
        logger.error("Error updating order status", {
          error: updateError.message,
          orderId: order_id,
        });
        // No fallar el callback, solo loguear
      }
    }

    res.status(200).json({
      idempotent: false,
      eventId: event.id,
      message: "Payment event processed",
    });
  } catch (error) {
    next(error);
  }
});

