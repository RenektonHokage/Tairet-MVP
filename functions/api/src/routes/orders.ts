import { Router } from "express";
import { ZodError } from "zod";
import { createOrderSchema } from "../schemas/orders";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";
import { sendOrderConfirmationEmail } from "../services/emails";
import { getNightWindow, getWeekendWindow, shouldMarkLegacyOrder, validateIntendedDateRange } from "../services/weekendWindow";

export const ordersRouter = Router();

// Tipo para snapshot de items guardado en DB (usa qty, NO quantity)
interface OrderItemSnapshot {
  kind: "ticket";
  ticket_type_id: string | null;
  name: string;
  price: number;
  qty: number;
}

// POST /orders
ordersRouter.post("/", async (req, res, next) => {
  try {
    const validated = createOrderSchema.parse(req.body);
    const now = new Date();

    const { data: local, error: localError } = await supabase
      .from("locals")
      .select("id, type")
      .eq("id", validated.local_id)
      .single();

    if (localError || !local) {
      logger.warn("Local not found while creating order", {
        localId: validated.local_id,
        error: localError?.message,
      });
      return res.status(400).json({ error: "Local inválido" });
    }

    const isClubOrder = local.type === "club";
    let validFrom: string | null = null;
    let validTo: string | null = null;
    let validWindowKey: string | null = null;
    let intendedDate: string | null = null;
    let isWindowLegacy = false;

    if (isClubOrder && validated.intended_date) {
      const dateValidation = validateIntendedDateRange(validated.intended_date, now, 30);
      if (!dateValidation.ok) {
        if (dateValidation.reason === "invalid_format") {
          return res.status(400).json({
            error: "intended_date debe tener formato YYYY-MM-DD",
          });
        }

        return res.status(400).json({
          error: `intended_date fuera de rango permitido (${dateValidation.minDate} a ${dateValidation.maxDate})`,
        });
      }

      const nightWindow = await getNightWindow(validated.intended_date);
      intendedDate = validated.intended_date;
      validFrom = nightWindow.validFrom;
      validTo = nightWindow.validTo;
      validWindowKey = nightWindow.windowKey;
    } else if (isClubOrder && validated.valid_window) {
      const weekendWindow = await getWeekendWindow(validated.valid_window, now);
      validFrom = weekendWindow.validFrom;
      validTo = weekendWindow.validTo;
      validWindowKey = weekendWindow.windowKey;
    } else if (isClubOrder) {
      // Compatibilidad temporal para órdenes de club sin ventana explícita.
      isWindowLegacy = shouldMarkLegacyOrder(now);
    }

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

        // Agregar al snapshot (usa qty, NO quantity)
        itemsSnapshot.push({
          kind: "ticket",
          ticket_type_id: ticketType.id,
          name: ticketType.name,
          price: Number(ticketType.price),
          qty: item.quantity,
        });
      }

      // Calcular total y cantidad desde snapshot (fuente de verdad)
      calculatedTotal = itemsSnapshot.reduce((sum, item) => sum + item.price * item.qty, 0);
      totalQuantity = itemsSnapshot.reduce((sum, item) => sum + item.qty, 0);

      // Validar que el total enviado coincida (prevenir manipulación)
      if (Math.abs(calculatedTotal - validated.total_amount) > 0.01) {
        logger.warn("Order total mismatch", {
          sent: validated.total_amount,
          calculated: calculatedTotal,
          localId: validated.local_id,
        });
        // Usar el calculado por seguridad
      }
    } else {
      // FALLBACK: Si items NO viene o viene vacío, construir desde campos legacy
      const qty = validated.quantity ?? 1;
      const unitPrice = qty > 0 ? validated.total_amount / qty : validated.total_amount;
      const isFreePas = validated.total_amount === 0;

      itemsSnapshot = [
        {
          kind: "ticket",
          ticket_type_id: null,
          name: isFreePas ? "Free Pass" : "Entrada",
          price: unitPrice,
          qty,
        },
      ];
      // Mantener valores originales
      calculatedTotal = validated.total_amount;
      totalQuantity = qty;
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
        items: itemsSnapshot, // Siempre tiene al menos 1 item (fallback)
        intended_date: intendedDate,
        valid_from: validFrom,
        valid_to: validTo,
        valid_window_key: validWindowKey,
        is_window_legacy: isWindowLegacy,
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

/*
================================================================================
BACKFILL SQL (solo documentación - NO ejecutar automáticamente)
================================================================================

Rellenar items[] en órdenes existentes que tienen items vacío.
Usa formato con `qty` (no `quantity`) para compatibilidad con breakdown metrics.

-- Backfill órdenes de últimos 90 días con items vacío
UPDATE orders
SET items = jsonb_build_array(
  jsonb_build_object(
    'kind', 'ticket',
    'ticket_type_id', NULL,
    'name', CASE WHEN total_amount = 0 THEN 'Free Pass' ELSE 'Entrada' END,
    'price', CASE WHEN quantity > 0 THEN total_amount / quantity ELSE total_amount END,
    'qty', quantity
  )
)
WHERE items = '[]'::jsonb
  AND quantity > 0
  AND created_at >= NOW() - INTERVAL '90 days';

-- Verificar resultado:
SELECT id, quantity, total_amount, items
FROM orders
WHERE created_at >= NOW() - INTERVAL '90 days'
ORDER BY created_at DESC
LIMIT 10;

================================================================================
*/

