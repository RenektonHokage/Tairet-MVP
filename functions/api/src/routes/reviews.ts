import { createHash } from "node:crypto";
import { Router, type Request } from "express";
import { z, ZodError } from "zod";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";

export const reviewsRouter = Router();

const VENUE_COOLDOWN_HOURS = 24;
const DAILY_MAX_REVIEWS = 5;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const REVIEW_HASH_PEPPER = process.env.REVIEW_HASH_PEPPER || "tairet_reviews_dev_pepper";

const listReviewsQuerySchema = z.object({
  venue_id: z.string().uuid().optional(),
  venue_type: z.enum(["bar", "club"]).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

const createReviewBodySchema = z.object({
  venue_id: z.string().uuid(),
  venue_type: z.enum(["bar", "club"]),
  display_name: z.string().trim().min(1).max(80),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(80).optional().nullable(),
  comment: z.string().trim().min(1).max(1000),
  fingerprint: z.string().trim().min(8).max(255).optional(),
});

type ReviewRow = {
  id: string;
  venue_id: string;
  venue_type: "bar" | "club";
  display_name: string;
  rating: number;
  title: string | null;
  comment: string;
  created_at: string;
  user_agent: string | null;
  locals?: {
    name?: string | null;
    slug?: string | null;
    type?: string | null;
  } | null;
};

function getRequestIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]?.split(",")[0]?.trim() || "";
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

function hashIp(ip: string) {
  return createHash("sha256")
    .update(`${REVIEW_HASH_PEPPER}:${ip}`)
    .digest("hex");
}

function toRetryAfterSeconds(date: Date) {
  const diff = Math.ceil((date.getTime() - Date.now()) / 1000);
  return Math.max(1, diff);
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function getStats(filters: { venueId?: string; venueType?: "bar" | "club" }) {
  let query = supabase.from("reviews").select("rating");

  if (filters.venueId) {
    query = query.eq("venue_id", filters.venueId);
  }
  if (filters.venueType) {
    query = query.eq("venue_type", filters.venueType);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const totalReviews = data?.length ?? 0;
  const ratingSum = (data || []).reduce((sum, row) => sum + Number(row.rating || 0), 0);
  const averageRating = totalReviews > 0 ? Number((ratingSum / totalReviews).toFixed(1)) : 0;

  return { totalReviews, averageRating };
}

function mapReviewRow(row: ReviewRow) {
  return {
    id: row.id,
    venue_id: row.venue_id,
    venue_type: row.venue_type,
    display_name: row.display_name,
    rating: row.rating,
    title: row.title,
    comment: row.comment,
    created_at: row.created_at,
    user_agent: row.user_agent,
    venue_name: row.locals?.name ?? null,
    venue_slug: row.locals?.slug ?? null,
  };
}

reviewsRouter.get("/", async (req, res) => {
  try {
    const parsed = listReviewsQuerySchema.parse(req.query);
    const { venue_id, venue_type, limit, offset } = parsed;

    let query = supabase
      .from("reviews")
      .select(
        "id, venue_id, venue_type, display_name, rating, title, comment, created_at, user_agent, locals:venue_id(name, slug, type)"
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (venue_id) {
      query = query.eq("venue_id", venue_id);
    }
    if (venue_type) {
      query = query.eq("venue_type", venue_type);
    }

    const { data, error } = await query;
    if (error) {
      logger.error("Error listing reviews", { error: error.message, venue_id, venue_type });
      return res.status(500).json({ error: "INTERNAL_ERROR", message: "No se pudieron cargar las reseñas." });
    }

    const stats = await getStats({ venueId: venue_id, venueType: venue_type });
    const items = ((data || []) as ReviewRow[]).map(mapReviewRow);

    return res.status(200).json({
      items,
      stats,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "INVALID_QUERY", details: error.flatten() });
    }
    logger.error("Unexpected error in GET /reviews", { error });
    return res.status(500).json({ error: "INTERNAL_ERROR", message: "Error inesperado." });
  }
});

reviewsRouter.post("/", async (req, res) => {
  try {
    const parsed = createReviewBodySchema.parse(req.body);
    const fingerprintHeader = req.header("x-tairet-fp")?.trim();
    const fingerprint = (fingerprintHeader || parsed.fingerprint || "").trim();

    if (!fingerprint) {
      return res.status(400).json({
        error: "INVALID_FINGERPRINT",
        message: "Falta el fingerprint de la reseña.",
      });
    }

    if (fingerprint.length < 8 || fingerprint.length > 255) {
      return res.status(400).json({
        error: "INVALID_FINGERPRINT",
        message: "Fingerprint inválido.",
      });
    }

    const now = new Date();
    const cooldownStart = new Date(now.getTime() - VENUE_COOLDOWN_HOURS * 60 * 60 * 1000);
    const dayStart = startOfUtcDay(now);
    const nextDay = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    // Regla 1: máx 1 reseña por venue cada 24h por fingerprint
    const { data: latestVenueReview, error: venueReviewError } = await supabase
      .from("reviews")
      .select("created_at")
      .eq("fingerprint", fingerprint)
      .eq("venue_id", parsed.venue_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (venueReviewError) {
      logger.error("Error checking venue review cooldown", { error: venueReviewError.message, venue_id: parsed.venue_id });
      return res.status(500).json({ error: "INTERNAL_ERROR", message: "No se pudo validar el límite de reseñas." });
    }

    if (latestVenueReview?.created_at) {
      const latestDate = new Date(latestVenueReview.created_at);
      if (latestDate >= cooldownStart) {
        const retryAt = new Date(latestDate.getTime() + VENUE_COOLDOWN_HOURS * 60 * 60 * 1000);
        return res.status(429).json({
          error: "RATE_LIMIT",
          scope: "venue",
          retryAfterSeconds: toRetryAfterSeconds(retryAt),
          message: "Ya enviaste una reseña para este local. Probá de nuevo más tarde.",
        });
      }
    }

    // Regla 2: máx 5 reseñas por día por fingerprint
    const { count: dailyCount, error: dailyCountError } = await supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("fingerprint", fingerprint)
      .gte("created_at", dayStart.toISOString());

    if (dailyCountError) {
      logger.error("Error checking daily review limit", { error: dailyCountError.message });
      return res.status(500).json({ error: "INTERNAL_ERROR", message: "No se pudo validar el límite diario." });
    }

    if ((dailyCount || 0) >= DAILY_MAX_REVIEWS) {
      return res.status(429).json({
        error: "RATE_LIMIT",
        scope: "daily",
        retryAfterSeconds: toRetryAfterSeconds(nextDay),
        message: "Alcanzaste el límite diario de reseñas.",
      });
    }

    const ip = getRequestIp(req);
    const ipHash = hashIp(ip);
    const userAgent = req.header("user-agent") || null;

    const { data: insertedReview, error: insertError } = await supabase
      .from("reviews")
      .insert({
        venue_id: parsed.venue_id,
        venue_type: parsed.venue_type,
        display_name: parsed.display_name,
        rating: parsed.rating,
        title: parsed.title ?? null,
        comment: parsed.comment,
        fingerprint,
        ip_hash: ipHash,
        user_agent: userAgent,
      })
      .select(
        "id, venue_id, venue_type, display_name, rating, title, comment, created_at, user_agent, locals:venue_id(name, slug, type)"
      )
      .single();

    if (insertError) {
      logger.error("Error creating review", { error: insertError.message, venue_id: parsed.venue_id });
      return res.status(500).json({ error: "INTERNAL_ERROR", message: "No se pudo crear la reseña." });
    }

    return res.status(201).json({ item: mapReviewRow(insertedReview as ReviewRow) });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "INVALID_BODY", details: error.flatten() });
    }
    logger.error("Unexpected error in POST /reviews", { error });
    return res.status(500).json({ error: "INTERNAL_ERROR", message: "Error inesperado." });
  }
});
