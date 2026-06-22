import { Router } from "express";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";
import {
  accessBancardSingleBuyErrorCode,
  accessBancardSingleBuySchema,
} from "../schemas/accessBancardSingleBuy";
import { bancardConfirmSchema } from "../schemas/bancardConfirm";
import { createAccessBancardSingleBuy } from "../services/bancardSingleBuy";
import { confirmBancardAccessPayment } from "../services/bancardConfirm";

export const paymentsRouter = Router();

const ACCESS_PUBLIC_REF_PATTERN = /^acc_[0-9a-f]{32}$/;
const PUBLIC_ACCESS_ORDER_STATUSES = new Set([
  "pending_payment",
  "paid",
  "cancelled",
  "manual_review",
  "expired",
]);

type PublicAccessOrderStatus =
  | "pending_payment"
  | "paid"
  | "cancelled"
  | "manual_review"
  | "expired";

interface AccessStatusOrderRow {
  public_ref: string;
  status: string;
  source_type: string;
  local_id: string | null;
  event_id: string | null;
  access_date: string;
  amount_gs: number | string;
  currency: string;
  expires_at: string | null;
}

function parseAccessPublicRef(value: unknown): string | null {
  return typeof value === "string" && ACCESS_PUBLIC_REF_PATTERN.test(value) ? value : null;
}

function normalizeAccessOrderStatus(status: string, expiresAt: string | null): PublicAccessOrderStatus | null {
  if (!PUBLIC_ACCESS_ORDER_STATUSES.has(status)) {
    return null;
  }

  if (status === "pending_payment" && expiresAt) {
    const expiresAtMs = Date.parse(expiresAt);
    if (Number.isFinite(expiresAtMs) && expiresAtMs < Date.now()) {
      return "expired";
    }
  }

  return status as PublicAccessOrderStatus;
}

function normalizeAmountGs(value: number | string): number | null {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

async function resolveAccessVenueName(order: AccessStatusOrderRow): Promise<string | null> {
  if (order.source_type === "local" && order.local_id) {
    const { data, error } = await supabase
      .from("locals")
      .select("name")
      .eq("id", order.local_id)
      .maybeSingle();

    if (error) {
      logger.warn("Failed to resolve Access Core local venue name", {
        error: error.message,
        publicRef: order.public_ref,
      });
      return null;
    }

    return typeof data?.name === "string" && data.name.trim().length > 0 ? data.name : null;
  }

  if (order.source_type === "event" && order.event_id) {
    const { data, error } = await supabase
      .from("events")
      .select("title")
      .eq("id", order.event_id)
      .maybeSingle();

    if (error) {
      logger.warn("Failed to resolve Access Core event venue name", {
        error: error.message,
        publicRef: order.public_ref,
      });
      return null;
    }

    return typeof data?.title === "string" && data.title.trim().length > 0 ? data.title : null;
  }

  return null;
}

// GET /payments/access/status?ref=acc_...
// Consulta publica de estado post-pago por public_ref, sin exponer IDs internos.
paymentsRouter.get("/access/status", async (req, res, next) => {
  try {
    const ref = parseAccessPublicRef(req.query.ref);
    if (!ref) {
      return res.status(400).json({
        ok: false,
        error: {
          code: "invalid_ref",
          message: "Invalid reference",
        },
      });
    }

    const { data, error } = await supabase
      .from("access_orders")
      .select("public_ref, status, source_type, local_id, event_id, access_date, amount_gs, currency, expires_at")
      .eq("public_ref", ref)
      .maybeSingle();

    if (error) {
      logger.error("Failed to fetch Access Core public status", {
        error: error.message,
        publicRef: ref,
      });
      return res.status(500).json({
        ok: false,
        error: {
          code: "internal_error",
          message: "Internal error",
        },
      });
    }

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: {
          code: "not_found",
          message: "Payment status not found",
        },
      });
    }

    const order = data as AccessStatusOrderRow;
    const status = normalizeAccessOrderStatus(order.status, order.expires_at);
    const amountGs = normalizeAmountGs(order.amount_gs);

    if (!status || (order.source_type !== "local" && order.source_type !== "event") || amountGs === null) {
      logger.error("Access Core public status row has invalid public shape", {
        publicRef: ref,
      });
      return res.status(500).json({
        ok: false,
        error: {
          code: "internal_error",
          message: "Internal error",
        },
      });
    }

    const venueName = await resolveAccessVenueName(order);

    return res.status(200).json({
      ok: true,
      order: {
        ref: order.public_ref,
        status,
        source_type: order.source_type,
        access_date: order.access_date,
        amount_gs: amountGs,
        currency: order.currency,
        expires_at: order.expires_at,
        venue_name: venueName,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /payments/access/bancard/single-buy
// Inicia un checkout Bancard Single Buy sobre Access Core.
paymentsRouter.post("/access/bancard/single-buy", async (req, res, next) => {
  try {
    const parsedBody = accessBancardSingleBuySchema.safeParse(req.body);
    if (!parsedBody.success) {
      const code = accessBancardSingleBuyErrorCode(parsedBody.error);
      return res.status(400).json({
        ok: false,
        error: {
          code,
          message: code === "quantity_limit_exceeded" ? "Quantity limit exceeded" : "Invalid request",
        },
      });
    }

    const result = await createAccessBancardSingleBuy(parsedBody.data);
    return res.status(result.status).json(result.body);
  } catch (error) {
    next(error);
  }
});

// POST /payments/bancard/confirm
// Recibe confirmaciones server-to-server de Bancard para Access Core.
paymentsRouter.post("/bancard/confirm", async (req, res, next) => {
  try {
    const parsedBody = bancardConfirmSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ status: "error" });
    }

    const result = await confirmBancardAccessPayment(parsedBody.data);
    return res.status(result.status).json(result.body);
  } catch (error) {
    next(error);
  }
});

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

