import { Router } from "express";
import { z, ZodError } from "zod";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";

export const publicRouter = Router();

// Schema para validar slug
const slugSchema = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/);

// Schema para validar email en query
const emailQuerySchema = z.object({
  email: z.string().email(),
});

/**
 * GET /public/locals/by-slug/:slug
 * Endpoint público (sin auth) para obtener un local por su slug.
 * Usado por B2C para resolver slug → local_id.
 */
publicRouter.get("/locals/by-slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    // Validar slug con Zod
    const validationResult = slugSchema.safeParse(slug);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "INVALID_SLUG",
        message: "Slug inválido. Debe contener solo letras minúsculas, números y guiones.",
      });
    }

    const validSlug = validationResult.data;

    // Buscar local por slug
    const { data: local, error } = await supabase
      .from("locals")
      .select("id, slug, name, whatsapp, ticket_price, type")
      .eq("slug", validSlug)
      .single();

    if (error) {
      // Si no se encuentra, retornar 404
      if (error.code === "PGRST116") {
        // PGRST116 = no rows returned
        return res.status(404).json({
          error: "LOCAL_NOT_FOUND",
          message: `No se encontró un local con slug "${validSlug}"`,
        });
      }

      logger.error("Error fetching local by slug", {
        error: error.message,
        slug: validSlug,
      });
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Error al buscar el local",
      });
    }

    if (!local) {
      return res.status(404).json({
        error: "LOCAL_NOT_FOUND",
        message: `No se encontró un local con slug "${validSlug}"`,
      });
    }

    // Retornar solo los campos necesarios para B2C
    return res.status(200).json({
      id: local.id,
      slug: local.slug,
      name: local.name,
      whatsapp: local.whatsapp || null,
      ticket_price: Number(local.ticket_price) || 0,
      type: local.type as "bar" | "club",
    });
  } catch (error) {
    logger.error("Unexpected error in GET /public/locals/by-slug/:slug", { error });
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error inesperado",
    });
  }
});

/**
 * GET /public/orders?email=...
 * Endpoint público para obtener historial de orders por email.
 * Usado por B2C para mostrar órdenes sin login.
 * Excluye datos sensibles (transaction_id, customer_phone).
 */
publicRouter.get("/orders", async (req, res, next) => {
  try {
    const { email } = emailQuerySchema.parse(req.query);

    const { data, error } = await supabase
      .from("orders")
      .select("id, local_id, checkin_token, quantity, total_amount, currency, status, payment_method, used_at, created_at")
      .eq("customer_email", email)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      logger.error("Error fetching orders by email", { error: error.message });
      return res.status(500).json({ error: "Failed to fetch orders" });
    }

    res.status(200).json(data || []);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: error.flatten() });
    }
    next(error);
  }
});

