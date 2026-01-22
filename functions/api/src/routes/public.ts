import { Router } from "express";
import { z, ZodError } from "zod";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";

export const publicRouter = Router();

// Schema para validar slug
const slugSchema = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/);

// Schema para validar parámetros de listado
const listLocalsQuerySchema = z.object({
  type: z.enum(["bar", "club"]).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

/**
 * GET /public/locals
 * Endpoint público para listar locales con información básica.
 * Incluye cover image de gallery para usar en cards del listado.
 */
publicRouter.get("/locals", async (req, res) => {
  try {
    const queryResult = listLocalsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({
        error: "INVALID_QUERY",
        message: "Parámetros inválidos",
      });
    }

    const { type, limit } = queryResult.data;

    // Query base
    let query = supabase
      .from("locals")
      .select("id, slug, name, type, location, city, gallery, attributes, min_age")
      .order("name", { ascending: true })
      .limit(limit);

    // Filtrar por tipo si se especifica
    if (type) {
      query = query.eq("type", type);
    }

    const { data: locals, error } = await query;

    if (error) {
      logger.error("Error fetching locals list", { error: error.message });
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Error al listar locales",
      });
    }

    // Transformar respuesta: extraer cover_url de gallery, normalizar attributes
    const result = (locals || []).map((local) => {
      const gallery = Array.isArray(local.gallery) ? local.gallery : [];
      const coverItem = gallery.find((g: { kind?: string }) => g.kind === "cover");
      
      return {
        id: local.id,
        slug: local.slug,
        name: local.name,
        type: local.type,
        location: local.location || null,
        city: local.city || null,
        cover_url: coverItem?.url || null,
        attributes: Array.isArray(local.attributes) ? local.attributes : [],
        min_age: typeof local.min_age === "number" ? local.min_age : null,
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Unexpected error in GET /public/locals", { error });
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error inesperado",
    });
  }
});

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
      .select("id, slug, name, address, location, city, hours, additional_info, phone, whatsapp, ticket_price, type, gallery")
      .eq("slug", validSlug)
      .single();

    if (error) {
      // Si no se encuentra, retornar 404
      if (error.code === "PGRST116") {
        // PGRST116 = no rows returned
        return res.status(404).json({
          error: "LOCAL_NOT_FOUND",
          message: `No se encontro un local con slug "${validSlug}"`,
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
        message: `No se encontro un local con slug "${validSlug}"`,
      });
    }

    // Retornar solo los campos necesarios para B2C
    return res.status(200).json({
      id: local.id,
      slug: local.slug,
      name: local.name,
      address: local.address || null,
      location: local.location || null,
      city: local.city || null,
      hours: Array.isArray(local.hours) ? local.hours : [],
      additional_info: Array.isArray(local.additional_info) ? local.additional_info : [],
      phone: local.phone || null,
      whatsapp: local.whatsapp || null,
      ticket_price: Number(local.ticket_price) || 0,
      type: local.type as "bar" | "club",
      gallery: Array.isArray(local.gallery) ? local.gallery : [],
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
    const emailLower = email.trim().toLowerCase();

    const { data, error } = await supabase
      .from("orders")
      .select("id, local_id, checkin_token, quantity, total_amount, currency, status, payment_method, used_at, created_at")
      .eq("customer_email_lower", emailLower)
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

/**
 * GET /public/locals/by-slug/:slug/catalog
 * Endpoint público para obtener el catálogo de un club (tickets y mesas).
 * Solo retorna items con is_active = true.
 * Solo funciona para locales tipo "club".
 */
publicRouter.get("/locals/by-slug/:slug/catalog", async (req, res) => {
  try {
    const { slug } = req.params;

    // Validar slug
    const validationResult = slugSchema.safeParse(slug);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "INVALID_SLUG",
        message: "Slug inválido. Debe contener solo letras minúsculas, números y guiones.",
      });
    }

    const validSlug = validationResult.data;

    // Buscar local por slug y verificar que sea club
    const { data: local, error: localError } = await supabase
      .from("locals")
      .select("id, type")
      .eq("slug", validSlug)
      .single();

    if (localError || !local) {
      if (localError?.code === "PGRST116") {
        return res.status(404).json({
          error: "LOCAL_NOT_FOUND",
          message: `No se encontró un local con slug "${validSlug}"`,
        });
      }
      logger.error("Error fetching local for catalog", { error: localError?.message, slug: validSlug });
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Error al buscar el local",
      });
    }

    // Verificar que sea club
    if (local.type !== "club") {
      return res.status(400).json({
        error: "NOT_A_CLUB",
        message: "El catálogo de entradas y mesas solo está disponible para discotecas",
      });
    }

    // Obtener tickets activos (ordenados por precio ASC)
    const { data: tickets, error: ticketsError } = await supabase
      .from("ticket_types")
      .select("id, name, price, description, sort_order")
      .eq("local_id", local.id)
      .eq("is_active", true)
      .order("price", { ascending: true })
      .order("sort_order", { ascending: true });

    if (ticketsError) {
      logger.error("Error fetching ticket types for catalog", { error: ticketsError.message, localId: local.id });
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Error al obtener entradas",
      });
    }

    // Obtener mesas activas (ordenadas por precio ASC, NULLS LAST)
    const { data: tables, error: tablesError } = await supabase
      .from("table_types")
      .select("id, name, price, capacity, includes, sort_order")
      .eq("local_id", local.id)
      .eq("is_active", true)
      .order("price", { ascending: true, nullsFirst: false })
      .order("sort_order", { ascending: true });

    if (tablesError) {
      logger.error("Error fetching table types for catalog", { error: tablesError.message, localId: local.id });
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Error al obtener mesas",
      });
    }

    // Transformar precios a number para consistencia
    const formattedTickets = (tickets || []).map((t) => ({
      id: t.id,
      name: t.name,
      price: Number(t.price),
      description: t.description || null,
    }));

    const formattedTables = (tables || []).map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price !== null ? Number(t.price) : null,
      capacity: t.capacity || null,
      includes: t.includes || null,
    }));

    return res.status(200).json({
      local_id: local.id,
      tickets: formattedTickets,
      tables: formattedTables,
    });
  } catch (error) {
    logger.error("Unexpected error in GET /public/locals/by-slug/:slug/catalog", { error });
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error inesperado",
    });
  }
});
