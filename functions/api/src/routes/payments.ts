import { Router, type RequestHandler } from "express";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";
import {
  createAccessPublicStatusReader,
  type AccessPublicStatusReader,
  type AccessPublicStatusSupabaseClient,
  type AccessPublicStatusVenueLookup,
} from "../services/accessPublicStatus";
import {
  accessBancardSingleBuyErrorCode,
  accessBancardSingleBuySchema,
} from "../schemas/accessBancardSingleBuy";
import { bancardConfirmSchema } from "../schemas/bancardConfirm";
import { createAccessBancardSingleBuy } from "../services/bancardSingleBuy";
import { confirmBancardAccessPayment } from "../services/bancardConfirm";

export const paymentsRouter = Router();

const ACCESS_PUBLIC_REF_PATTERN = /^acc_[0-9a-f]{32}$/;

function parseAccessPublicRef(value: unknown): string | null {
  return typeof value === "string" && ACCESS_PUBLIC_REF_PATTERN.test(value) ? value : null;
}

interface AccessVenuePostgrestResult {
  readonly data: unknown;
  readonly error: unknown;
}

interface AccessVenuePostgrestRequest
  extends PromiseLike<AccessVenuePostgrestResult> {
  eq(column: string, value: string): AccessVenuePostgrestRequest;
  maybeSingle(): PromiseLike<AccessVenuePostgrestResult>;
}

interface AccessVenuePostgrestTable {
  select(columns: string): AccessVenuePostgrestRequest;
}

export interface AccessVenueSupabaseClient {
  from(table: string): AccessVenuePostgrestTable;
}

export type AccessVenueNameResult =
  | Readonly<{ kind: "resolved"; venueName: string | null }>
  | Readonly<{ kind: "read_error" }>;

export type AccessVenueNameResolver = (
  venue: AccessPublicStatusVenueLookup,
) => Promise<AccessVenueNameResult>;

interface AccessStatusRouteLogger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

export interface AccessStatusHandlerDependencies {
  readonly reader: AccessPublicStatusReader;
  readonly resolveVenueName: AccessVenueNameResolver;
  readonly logger: AccessStatusRouteLogger;
}

const VENUE_READ_ERROR = Object.freeze({ kind: "read_error" as const });

function resolvedVenueName(venueName: string | null): AccessVenueNameResult {
  return Object.freeze({ kind: "resolved", venueName });
}

export function createAccessVenueNameResolver(
  client: AccessVenueSupabaseClient,
): AccessVenueNameResolver {
  return async (venue) => {
    if (venue.id === null) return resolvedVenueName(null);

    const table = venue.kind === "local" ? "locals" : "events";
    const field = venue.kind === "local" ? "name" : "title";
    try {
      const result = await client
        .from(table)
        .select(field)
        .eq("id", venue.id)
        .maybeSingle();
      if (result.error !== null) return VENUE_READ_ERROR;
      if (result.data === null) return resolvedVenueName(null);
      if (!result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
        return VENUE_READ_ERROR;
      }

      const value = (result.data as Record<string, unknown>)[field];
      return resolvedVenueName(
        typeof value === "string" && value.trim().length > 0 ? value : null,
      );
    } catch {
      return VENUE_READ_ERROR;
    }
  };
}

function internalStatusError(res: Parameters<RequestHandler>[1]) {
  return res.status(500).json({
    ok: false,
    error: {
      code: "internal_error",
      message: "Internal error",
    },
  });
}

export function createAccessStatusHandler(
  dependencies: AccessStatusHandlerDependencies,
): RequestHandler {
  return async (req, res, next) => {
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

      const result = await dependencies.reader.read(ref);
      if (result.kind === "not_found") {
        return res.status(404).json({
          ok: false,
          error: {
            code: "not_found",
            message: "Payment status not found",
          },
        });
      }

      if (result.kind === "read_error" || result.kind === "invalid_snapshot") {
        dependencies.logger.error("Failed to fetch Access Core public status", {
          publicRef: ref,
          errorCode: result.errorCode,
        });
        return internalStatusError(res);
      }

      let venueName: string | null = null;
      let venueResult: AccessVenueNameResult;
      try {
        venueResult = await dependencies.resolveVenueName(result.venue);
      } catch {
        venueResult = VENUE_READ_ERROR;
      }
      if (venueResult.kind === "read_error") {
        dependencies.logger.warn("Failed to resolve Access Core venue name", {
          publicRef: ref,
          errorCode: "access_public_status_venue_read_error",
        });
      } else {
        venueName = venueResult.venueName;
      }

      return res.status(200).json({
        ok: true,
        order: {
          ...result.order,
          venue_name: venueName,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

const accessPublicStatusReader = createAccessPublicStatusReader(
  supabase as unknown as AccessPublicStatusSupabaseClient,
);
const accessVenueNameResolver = createAccessVenueNameResolver(
  supabase as unknown as AccessVenueSupabaseClient,
);

// GET /payments/access/status?ref=acc_...
// Consulta publica de estado post-pago por public_ref, sin exponer IDs internos.
paymentsRouter.get(
  "/access/status",
  createAccessStatusHandler({
    reader: accessPublicStatusReader,
    resolveVenueName: accessVenueNameResolver,
    logger,
  }),
);

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

