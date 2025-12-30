import { Router } from "express";
import { ZodError } from "zod";
import { createOrderSchema } from "../schemas/orders";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";
import { sendOrderConfirmationEmail } from "../services/emails";

export const ordersRouter = Router();

// POST /orders
ordersRouter.post("/", async (req, res, next) => {
  try {
    const validated = createOrderSchema.parse(req.body);

    // Free pass nace como "paid", el resto como "pending"
    const status = validated.payment_method === "free_pass" ? "paid" : "pending";

    const { data, error } = await supabase
      .from("orders")
      .insert({
        local_id: validated.local_id,
        quantity: validated.quantity,
        total_amount: validated.total_amount,
        currency: validated.currency || "PYG",
        status, // Dinamico segun payment_method
        payment_method: validated.payment_method || null,
        customer_email: validated.customer_email,
        customer_name: validated.customer_name,
        customer_last_name: validated.customer_last_name,
        customer_phone: validated.customer_phone,
        customer_document: validated.customer_document,
      })
      .select()
      .single();

    if (error) {
      logger.error("Error creating order", { error: error.message });
      return res.status(400).json({ error: error.message });
    }

    // Enviar email de confirmación (best-effort, no bloquea compra)
    if (validated.customer_email && data.checkin_token) {
      sendOrderConfirmationEmail({
        email: validated.customer_email,
        name: validated.customer_name || "Cliente",
        orderId: data.id,
        checkinToken: data.checkin_token,
        quantity: data.quantity,
        totalAmount: data.total_amount,
      }).catch((emailErr) => {
        // Log sin exponer PII (no loguear cedula ni token completo)
        logger.warn("Failed to send order confirmation email", {
          orderId: data.id,
          error: emailErr instanceof Error ? emailErr.message : String(emailErr),
        });
      });
    }

    res.status(201).json(data);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: error.flatten() });
    }
    next(error);
  }
});

// GET /orders/:id
ordersRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      logger.error("Error fetching order", { error: error.message, orderId: id });
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
});

// PATCH /orders/:id/use (DEPRECATED)
// Este endpoint público ha sido deshabilitado por seguridad.
// Usar PATCH /panel/orders/:id/use con autenticación.
ordersRouter.patch("/:id/use", (_req, res) => {
  return res.status(410).json({
    error: "This endpoint is deprecated. Use PATCH /panel/orders/:id/use with authentication.",
  });
});

