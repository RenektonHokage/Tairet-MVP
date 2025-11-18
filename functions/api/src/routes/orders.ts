import { Router } from "express";
import { createOrderSchema } from "../schemas/orders";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";

export const ordersRouter = Router();

// POST /orders
ordersRouter.post("/", async (req, res, next) => {
  try {
    const validated = createOrderSchema.parse(req.body);

    const { data, error } = await supabase
      .from("orders")
      .insert({
        local_id: validated.local_id,
        quantity: validated.quantity,
        total_amount: validated.total_amount,
        currency: validated.currency || "PYG",
        status: "pending",
        customer_email: validated.customer_email,
        customer_name: validated.customer_name,
        customer_phone: validated.customer_phone,
      })
      .select()
      .single();

    if (error) {
      logger.error("Error creating order", { error: error.message });
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (error) {
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

// PATCH /orders/:id/use (check-in manual sin QR en MVP)
ordersRouter.patch("/:id/use", async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar que la orden existe y está pagada
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status !== "paid") {
      return res.status(400).json({
        error: "Order must be paid before use",
        currentStatus: order.status,
      });
    }

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
      logger.error("Error updating order", { error: updateError.message, orderId: id });
      return res.status(500).json({ error: "Failed to update order" });
    }

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

