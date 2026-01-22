import { Router } from "express";
import { ZodError } from "zod";
import { createOrderSchema } from "../schemas/orders";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";
import { sendOrderConfirmationEmail } from "../services/emails";

export const ordersRouter = Router();

// Tipo para snapshot de items guardado en DB
interface OrderItemSnapshot {
  kind: "ticket";
  ticket_type_id: string;
  name: string;
  price: number;
  quantity: number;
}

// POST /orders
ordersRouter.post("/", async (req, res, next) => {
  try {
    const validated = createOrderSchema.parse(req.body);

    // Variables para el snapshot y total calculado
    let itemsSnapshot: OrderItemSnapshot[] = [];
    let calculatedTotal = validated.total_amount;
    let totalQuantity = validated.quantity;

    // Si vienen items, validar contra ticket_types y crear snapshot
    if (validated.items && validated.items.length > 0) {
      const ticketTypeIds = validated.items.map((i) => i.ticket_type_id);

      // Buscar los ticket_types en DB
      const { data: ticketTypes, error: ticketError } = await supabase
        .from("ticket_types")
        .select("id, name, price, local_id, is_active")
        .in("id", ticketTypeIds);

      if (ticketError) {
        logger.error("Error fetching ticket types for order", { error: ticketError.message });
        return res.status(500).json({ error: "Error al validar entradas" });
      }

      // Crear mapa para búsqueda rápida
      const ticketMap = new Map(ticketTypes?.map((t) => [t.id, t]) || []);

      // Validar cada item
      for (const item of validated.items) {
        const ticketType = ticketMap.get(item.ticket_type_id);

        if (!ticketType) {
          return res.status(400).json({
            error: `Entrada no encontrada: ${item.ticket_type_id}`,
          });
        }

        if (ticketType.local_id !== validated.local_id) {
          return res.status(400).json({
            error: "Las entradas no pertenecen al local especificado",
          });
        }

        if (!ticketType.is_active) {
          return res.status(400).json({
            error: `La entrada "${ticketType.name}" ya no está disponible`,
          });
        }

        // Agregar al snapshot
        itemsSnapshot.push({
          kind: "ticket",
          ticket_type_id: ticketType.id,
          name: ticketType.name,
          price: Number(ticketType.price),
          quantity: item.quantity,
        });
      }

      // Calcular total y cantidad desde snapshot (fuente de verdad)
      calculatedTotal = itemsSnapshot.reduce((sum, item) => sum + item.price * item.quantity, 0);
      totalQuantity = itemsSnapshot.reduce((sum, item) => sum + item.quantity, 0);

      // Validar que el total enviado coincida (prevenir manipulación)
      if (Math.abs(calculatedTotal - validated.total_amount) > 0.01) {
        logger.warn("Order total mismatch", {
          sent: validated.total_amount,
          calculated: calculatedTotal,
          localId: validated.local_id,
        });
        // Usar el calculado por seguridad
      }
    }

    // Free pass nace como "paid", el resto como "pending"
    const status = validated.payment_method === "free_pass" ? "paid" : "pending";

    const { data, error } = await supabase
      .from("orders")
      .insert({
        local_id: validated.local_id,
        quantity: totalQuantity,
        total_amount: calculatedTotal,
        currency: validated.currency || "PYG",
        status, // Dinamico segun payment_method
        payment_method: validated.payment_method || null,
        customer_email: validated.customer_email,
        customer_name: validated.customer_name,
        customer_last_name: validated.customer_last_name,
        customer_phone: validated.customer_phone,
        customer_document: validated.customer_document,
        items: itemsSnapshot.length > 0 ? itemsSnapshot : [],
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

