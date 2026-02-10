import { Router } from "express";
import { ZodError } from "zod";
import { v4 as uuidv4 } from "uuid";
import { panelAuth } from "../middlewares/panelAuth";
import { requireRole } from "../middlewares/requireRole";
import { calendarRouter } from "./calendar";
import { updateReservationStatusSchema } from "../schemas/reservations";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";
import { sendReservationConfirmedEmail } from "../services/emails";
import { CheckinWindowValidationResult, getActiveNightWindow, validateOrderWindowForCheckin } from "../services/weekendWindow";

// ============================================================================
// Attributes/Tags Allowlists (sync with packages/types/src/attributes.ts)
// ============================================================================

const BAR_SPECIALTIES = [
  "Cervezas artesanales",
  "Cocteles",
  "Vinos",
  "Terraza",
  "After Office",
  "Música en vivo",
  "Después de las 12 am",
  "Temáticas"
] as const;

const CLUB_GENRES = [
  "Reggaeton",
  "Electronica",
  "Pop",
  "Latino",
  "Mix"
] as const;

function getAttributesAllowlist(localType: "bar" | "club"): readonly string[] {
  return localType === "bar" ? BAR_SPECIALTIES : CLUB_GENRES;
}

// Zones allowlist (sync with packages/types/src/zones.ts)
const ZONES = [
  "Carmelitas",
  "Centro",
  "Villa Morra",
  "Las Mercedes",
  "Recoleta",
  "Costanera",
  "Mburucuyá"
] as const;

// Min age allowlist (strict validation)
const MIN_AGES = [18, 21, 22, 25] as const;

// Cities allowlist (for geocoding and display)
const CITIES = ["Asunción", "San Bernardino", "Ciudad del Este"] as const;

// ============================================================================
// Gallery Types and Validation
// ============================================================================

const GALLERY_KINDS = ["cover", "hero", "carousel", "menu", "drinks", "food", "interior"] as const;
type GalleryKind = (typeof GALLERY_KINDS)[number];

// Kinds permitidos por tipo de local
// hero: imagen principal del perfil (bar y club)
// cover: foto de perfil para cards/listado
const BAR_GALLERY_KINDS: GalleryKind[] = ["cover", "hero", "food", "menu", "drinks", "interior"];
const CLUB_GALLERY_KINDS: GalleryKind[] = ["cover", "hero", "carousel"];

interface LocalGalleryItem {
  id: string;
  url: string;
  path: string; // Storage object path for robust DELETE
  kind: GalleryKind;
  order: number;
}

const MAX_GALLERY_ITEMS = 12;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const STORAGE_BUCKET = "local-gallery";

/**
 * Validates and normalizes gallery array from request body.
 * Returns validated array or throws error message.
 * @param localType - Type of local (bar/club) to validate allowed kinds
 */
function validateGalleryItems(gallery: unknown, localType?: "bar" | "club"): LocalGalleryItem[] {
  if (!Array.isArray(gallery)) {
    throw new Error("gallery debe ser un array");
  }

  const allowedKinds = localType === "club" ? CLUB_GALLERY_KINDS : BAR_GALLERY_KINDS;
  const validated: LocalGalleryItem[] = [];
  let coverCount = 0;
  let heroCount = 0;

  for (let i = 0; i < Math.min(gallery.length, MAX_GALLERY_ITEMS); i++) {
    const item = gallery[i];
    if (!item || typeof item !== "object") continue;

    const { id, url, path, kind, order } = item as Record<string, unknown>;

    // Validate id
    if (typeof id !== "string" || id.trim().length === 0) continue;

    // Validate url (must be non-empty string)
    if (typeof url !== "string" || url.trim().length === 0) continue;

    // Validate path (must be non-empty string for robust DELETE)
    if (typeof path !== "string" || path.trim().length === 0) continue;

    // Validate kind (must be in allowed kinds for this local type)
    if (!allowedKinds.includes(kind as GalleryKind)) continue;

    // Validate order
    const orderNum = typeof order === "number" ? order : parseInt(String(order), 10);
    if (isNaN(orderNum) || orderNum < 0) continue;

    // Count covers (max 1)
    if (kind === "cover") {
      coverCount++;
      if (coverCount > 1) continue; // Skip additional covers
    }

    // Count heroes (max 1, solo para bar)
    if (kind === "hero") {
      heroCount++;
      if (heroCount > 1) continue; // Skip additional heroes
    }

    validated.push({
      id: id.trim(),
      url: url.trim(),
      path: path.trim(),
      kind: kind as GalleryKind,
      order: orderNum,
    });
  }

  // Normalize order values (0..n-1)
  validated.sort((a, b) => a.order - b.order);
  validated.forEach((item, idx) => {
    item.order = idx;
  });

  return validated;
}

function buildCheckinWindowErrorPayload(validation: Extract<CheckinWindowValidationResult, { allowed: false }>) {
  if (validation.reason === "not_yet_valid") {
    return {
      status: 409,
      body: {
        error: "Aun no valida para check-in",
        code: "not_yet_valid",
        valid_from: validation.validFrom,
        valid_to: validation.validTo,
      },
    };
  }

  if (validation.reason === "expired") {
    return {
      status: 409,
      body: {
        error: "Entrada caducada para check-in",
        code: "expired",
        valid_from: validation.validFrom,
        valid_to: validation.validTo,
      },
    };
  }

  return {
    status: 409,
    body: {
      error: "Orden legacy sin ventana valida no permitida para check-in",
      code: "legacy_not_allowed",
      cutoff_iso: validation.cutoffIso,
    },
  };
}

export const panelRouter = Router();

// GET /panel/me
// Endpoint para obtener información del usuario del panel autenticado
// Requiere autenticación (middleware panelAuth)
panelRouter.get("/me", panelAuth, async (req, res) => {
  // req.panelUser está disponible gracias al middleware panelAuth
  if (!req.panelUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Obtener información del local (con JOIN)
    const { data: local, error: localError } = await supabase
      .from("locals")
      .select("id, name, slug, type")
      .eq("id", req.panelUser.localId)
      .single();

    if (localError || !local) {
      logger.warn("Local not found for panel user", {
        localId: req.panelUser.localId,
        error: localError?.message,
      });
      return res.status(404).json({ error: "Local not found for panel user" });
    }

    res.status(200).json({
      role: req.panelUser.role,
      email: req.panelUser.email,
      local: {
        id: local.id,
        name: local.name,
        slug: local.slug,
        type: local.type,
      },
    });
  } catch (error) {
    logger.error("Error fetching panel user info", {
      localId: req.panelUser.localId,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /panel/local
// Obtiene datos completos del local (incluyendo campos editables y gallery)
// Roles permitidos: owner, staff
panelRouter.get(
  "/local",
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data: local, error } = await supabase
        .from("locals")
        .select("id, name, slug, type, address, location, city, hours, additional_info, phone, whatsapp, gallery, attributes, min_age")
        .eq("id", req.panelUser.localId)
        .single();

      if (error || !local) {
        logger.error("Error fetching local profile", {
          error: error?.message,
          localId: req.panelUser.localId,
        });
        return res.status(404).json({ error: "Local not found" });
      }

      // Normalizar arrays JSONB y campos opcionales
      const normalizedLocal = {
        ...local,
        hours: Array.isArray(local.hours) ? local.hours : [],
        additional_info: Array.isArray(local.additional_info) ? local.additional_info : [],
        gallery: Array.isArray(local.gallery) ? local.gallery : [],
        attributes: Array.isArray(local.attributes) ? local.attributes : [],
        min_age: typeof local.min_age === "number" ? local.min_age : null,
        city: typeof local.city === "string" ? local.city : null,
      };

      res.status(200).json({ local: normalizedLocal });
    } catch (error) {
      logger.error("Unexpected error in GET /panel/local", {
        localId: req.panelUser?.localId,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// PATCH /panel/local
// Actualiza datos del local (solo owner puede editar)
// Roles permitidos: owner
panelRouter.patch(
  "/local",
  panelAuth,
  requireRole(["owner"]),
  async (req, res) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Whitelist de campos permitidos (extraer solo estos del body)
      const { name, address, location, city, hours, additional_info, phone, whatsapp, gallery, attributes, min_age } = req.body;

      // Construir objeto de actualizacion (solo campos presentes en body)
      const updateData: {
        name?: string;
        address?: string | null;
        location?: string | null;
        city?: string | null;
        hours?: string[];
        additional_info?: string[];
        phone?: string | null;
        whatsapp?: string | null;
        gallery?: LocalGalleryItem[];
        attributes?: string[];
        min_age?: number | null;
        updated_at: string;
      } = {
        updated_at: new Date().toISOString(),
      };

      let hasFieldsToUpdate = false;

      // Validar y procesar name (requerido si se envia, min 2 chars)
      if (name !== undefined) {
        const trimmedName = typeof name === "string" ? name.trim() : "";
        if (trimmedName.length < 2) {
          return res.status(400).json({
            error: "El nombre del local debe tener al menos 2 caracteres",
          });
        }
        updateData.name = trimmedName;
        hasFieldsToUpdate = true;
      }

      // Procesar address (casting seguro)
      if (address !== undefined) {
        const val = typeof address === "string" ? address.trim() : "";
        updateData.address = val || null;
        hasFieldsToUpdate = true;
      }

      // Procesar location (zona - validar contra allowlist)
      if (location !== undefined) {
        const val = typeof location === "string" ? location.trim() : "";
        if (val === "") {
          updateData.location = null;
        } else if (!ZONES.includes(val as typeof ZONES[number])) {
          return res.status(400).json({
            error: `Zona no válida: "${val}". Zonas permitidas: ${ZONES.join(", ")}`,
          });
        } else {
          updateData.location = val;
        }
        hasFieldsToUpdate = true;
      }

      // Procesar min_age (validar contra allowlist estricta)
      if (min_age !== undefined) {
        // null, "", 0 => guardar null (sin restricción)
        if (min_age === null || min_age === "" || min_age === 0) {
          updateData.min_age = null;
        } else {
          const ageNum = typeof min_age === "string" ? parseInt(min_age, 10) : min_age;
          if (isNaN(ageNum)) {
            return res.status(400).json({ error: "Edad mínima inválida" });
          }
          if (!MIN_AGES.includes(ageNum as typeof MIN_AGES[number])) {
            return res.status(400).json({
              error: `Edad mínima no permitida: ${ageNum}. Valores permitidos: ${MIN_AGES.join(", ")}`,
            });
          }
          updateData.min_age = ageNum;
        }
        hasFieldsToUpdate = true;
      }

      // Procesar city (validar contra allowlist)
      if (city !== undefined) {
        const val = typeof city === "string" ? city.trim() : "";
        if (val === "") {
          updateData.city = null;
        } else if (!CITIES.includes(val as typeof CITIES[number])) {
          return res.status(400).json({
            error: `Ciudad no válida: "${val}". Ciudades permitidas: ${CITIES.join(", ")}`,
          });
        } else {
          updateData.city = val;
        }
        hasFieldsToUpdate = true;
      }

      // Procesar hours (array de strings, max 14 items, item max 120 chars)
      if (hours !== undefined) {
        const arr = Array.isArray(hours)
          ? hours
              .filter((h): h is string => typeof h === "string" && h.trim().length > 0)
              .map((h) => h.trim())
              .slice(0, 14)
          : [];
        if (arr.some((h) => h.length > 120)) {
          return res.status(400).json({ error: "Cada horario max 120 caracteres" });
        }
        updateData.hours = arr;
        hasFieldsToUpdate = true;
      }

      // Procesar additional_info (array de strings, max 20 items, item max 120 chars)
      if (additional_info !== undefined) {
        const arr = Array.isArray(additional_info)
          ? additional_info
              .filter((i): i is string => typeof i === "string" && i.trim().length > 0)
              .map((i) => i.trim())
              .slice(0, 20)
          : [];
        if (arr.some((i) => i.length > 120)) {
          return res.status(400).json({ error: "Cada item max 120 caracteres" });
        }
        updateData.additional_info = arr;
        hasFieldsToUpdate = true;
      }

      // Procesar phone (casting seguro)
      if (phone !== undefined) {
        const val = typeof phone === "string" ? phone.trim() : "";
        updateData.phone = val || null;
        hasFieldsToUpdate = true;
      }

      // Procesar whatsapp (casting seguro)
      if (whatsapp !== undefined) {
        const val = typeof whatsapp === "string" ? whatsapp.trim() : "";
        updateData.whatsapp = val || null;
        hasFieldsToUpdate = true;
      }

      // Obtener tipo del local una sola vez si se necesita validar attributes o gallery
      let localType: "bar" | "club" | undefined;
      if (attributes !== undefined || gallery !== undefined) {
        const { data: localData } = await supabase
          .from("locals")
          .select("type")
          .eq("id", req.panelUser.localId)
          .single();
        localType = localData?.type as "bar" | "club" | undefined;
      }

      // Procesar attributes (array de strings, max 3 items, validar contra allowlist)
      if (attributes !== undefined) {
        if (!Array.isArray(attributes)) {
          return res.status(400).json({ error: "attributes debe ser un array" });
        }
        if (!localType) {
          return res.status(400).json({ error: "No se pudo determinar el tipo del local" });
        }
        const allowlist = getAttributesAllowlist(localType);
        const seen = new Set<string>();
        const normalized: string[] = [];
        const invalidAttrs: string[] = [];

        for (const item of attributes) {
          if (typeof item !== "string") continue;
          const trimmed = item.trim();
          if (!trimmed) continue;
          if (seen.has(trimmed)) continue; // dedupe
          
          if (!allowlist.includes(trimmed)) {
            invalidAttrs.push(trimmed);
            continue;
          }
          
          seen.add(trimmed);
          normalized.push(trimmed);
          
          if (normalized.length >= 3) break; // max 3
        }

        if (invalidAttrs.length > 0) {
          return res.status(400).json({
            error: `Atributos no permitidos: ${invalidAttrs.join(", ")}`,
          });
        }

        updateData.attributes = normalized;
        hasFieldsToUpdate = true;
      }

      // Procesar gallery (array validado, max 12 items, max 1 cover)
      if (gallery !== undefined) {
        try {
          updateData.gallery = validateGalleryItems(gallery, localType);
          hasFieldsToUpdate = true;
        } catch (err) {
          return res.status(400).json({
            error: err instanceof Error ? err.message : "gallery inválida",
          });
        }
      }

      // Si no hay campos para actualizar, retornar error
      if (!hasFieldsToUpdate) {
        return res.status(400).json({ error: "No fields to update" });
      }

      // Actualizar local
      const { data: updated, error } = await supabase
        .from("locals")
        .update(updateData)
        .eq("id", req.panelUser.localId)
        .select("id, name, slug, type, address, location, city, hours, additional_info, phone, whatsapp, gallery, attributes, min_age")
        .single();

      if (error) {
        logger.error("Error updating local profile", {
          error: error.message,
          localId: req.panelUser.localId,
        });
        return res.status(500).json({ error: "Error al actualizar el perfil" });
      }

      // Normalizar arrays en response
      const normalizedUpdated = {
        ...updated,
        hours: Array.isArray(updated.hours) ? updated.hours : [],
        additional_info: Array.isArray(updated.additional_info) ? updated.additional_info : [],
        gallery: Array.isArray(updated.gallery) ? updated.gallery : [],
      };

      res.status(200).json({ local: normalizedUpdated });
    } catch (error) {
      logger.error("Unexpected error in PATCH /panel/local", {
        localId: req.panelUser?.localId,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /panel/local/gallery/signed-upload
// Generate signed upload URL for direct browser upload to Supabase Storage
// This avoids the express.json() body limit issue with base64
// Roles permitidos: owner
// Supports kind="promo" for promo images (separate path: promos/{localId}/...)
panelRouter.post(
  "/local/gallery/signed-upload",
  panelAuth,
  requireRole(["owner"]),
  async (req, res) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { contentType, kind, fileName } = req.body;

      // Validate contentType
      if (!contentType || !ALLOWED_MIME_TYPES.includes(contentType)) {
        return res.status(400).json({
          error: `contentType inválido. Permitidos: ${ALLOWED_MIME_TYPES.join(", ")}`,
        });
      }

      // Special case: kind="promo" bypasses gallery kind validation
      const isPromoUpload = kind === "promo";

      if (!isPromoUpload) {
        // Get local type to validate kind (only for gallery uploads)
        const { data: localData, error: localError } = await supabase
          .from("locals")
          .select("type")
          .eq("id", req.panelUser.localId)
          .single();

        if (localError || !localData) {
          return res.status(404).json({ error: "Local not found" });
        }

        const localType = localData.type as "bar" | "club";
        const allowedKinds = localType === "club" ? CLUB_GALLERY_KINDS : BAR_GALLERY_KINDS;

        // Validate kind
        if (!kind || !allowedKinds.includes(kind as GalleryKind)) {
          return res.status(400).json({
            error: `kind inválido para ${localType}. Permitidos: ${allowedKinds.join(", ")}`,
          });
        }
      }

      // Generate unique path
      const fileId = uuidv4();
      const extension = contentType.split("/")[1]; // jpeg, png, webp
      const safeName = fileName ? fileName.replace(/[^a-zA-Z0-9.-]/g, "_").substring(0, 50) : "image";
      
      // Use separate path for promos to not mix with gallery
      const storagePath = isPromoUpload
        ? `promos/${req.panelUser.localId}/${fileId}_${safeName}.${extension}`
        : `${req.panelUser.localId}/${fileId}_${safeName}.${extension}`;

      // Create signed upload URL (expires in 5 minutes)
      const { data: signedData, error: signedError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUploadUrl(storagePath);

      if (signedError || !signedData) {
        logger.error("Error creating signed upload URL", {
          error: signedError?.message,
          localId: req.panelUser.localId,
        });
        return res.status(500).json({ error: "Error al crear URL de subida" });
      }

      // Get public URL for after upload
      const { data: publicUrlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      logger.info("Signed upload URL created", {
        localId: req.panelUser.localId,
        fileId,
        kind,
      });

      res.status(200).json({
        signedUrl: signedData.signedUrl,
        token: signedData.token,
        path: storagePath,
        publicUrl: publicUrlData.publicUrl,
        id: fileId,
        kind,
      });
    } catch (error) {
      logger.error("Unexpected error in POST /panel/local/gallery/signed-upload", {
        localId: req.panelUser?.localId,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// DELETE /panel/local/gallery/:id
// Delete image from storage and remove from gallery array
// Roles permitidos: owner
panelRouter.delete(
  "/local/gallery/:id",
  panelAuth,
  requireRole(["owner"]),
  async (req, res) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: "Missing image id" });
      }

      // Get current gallery to find the item
      const { data: local, error: fetchError } = await supabase
        .from("locals")
        .select("gallery")
        .eq("id", req.panelUser.localId)
        .single();

      if (fetchError || !local) {
        return res.status(404).json({ error: "Local not found" });
      }

      const gallery: LocalGalleryItem[] = Array.isArray(local.gallery) ? local.gallery : [];
      const itemIndex = gallery.findIndex((g) => g.id === id);

      if (itemIndex === -1) {
        return res.status(404).json({ error: "Image not found in gallery" });
      }

      const item = gallery[itemIndex];

      // Delete from storage using path (robust, no URL parsing needed)
      if (item.path) {
        try {
          const { error: deleteError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .remove([item.path]);
          
          if (deleteError) {
            logger.warn("Error deleting file from storage", {
              error: deleteError.message,
              localId: req.panelUser.localId,
              path: item.path,
            });
          } else {
            logger.info("File deleted from storage", {
              localId: req.panelUser.localId,
              path: item.path,
            });
          }
        } catch {
          // Log but don't fail if storage delete fails (file may not exist)
          logger.warn("Could not delete file from storage", {
            localId: req.panelUser.localId,
            imageId: id,
          });
        }
      } else {
        // Fallback for legacy items without path (try to extract from URL)
        try {
          const urlPath = new URL(item.url).pathname;
          const storagePath = urlPath.replace(`/storage/v1/object/public/${STORAGE_BUCKET}/`, "");
          if (storagePath && storagePath !== urlPath) {
            await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
          }
        } catch {
          logger.warn("Could not parse URL for storage delete", {
            localId: req.panelUser.localId,
            imageId: id,
          });
        }
      }

      // Remove from gallery array
      gallery.splice(itemIndex, 1);

      // Normalize order
      gallery.forEach((g, idx) => {
        g.order = idx;
      });

      // Update local
      const { error: updateError } = await supabase
        .from("locals")
        .update({ gallery, updated_at: new Date().toISOString() })
        .eq("id", req.panelUser.localId);

      if (updateError) {
        logger.error("Error updating gallery after delete", {
          error: updateError.message,
          localId: req.panelUser.localId,
        });
        return res.status(500).json({ error: "Error al eliminar imagen" });
      }

      logger.info("Gallery image deleted", {
        localId: req.panelUser.localId,
        imageId: id,
      });

      res.status(200).json({ success: true, gallery });
    } catch (error) {
      logger.error("Unexpected error in DELETE /panel/local/gallery/:id", {
        localId: req.panelUser?.localId,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /panel/reservations/search?q=<term>
// Buscar reservas por email, phone, name o last_name
// Roles permitidos: owner, staff
panelRouter.get(
  "/reservations/search",
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { q } = req.query;
      if (!q || typeof q !== "string" || q.trim().length === 0) {
        return res.status(400).json({ error: "Missing search query (q)" });
      }

      const searchTerm = q.trim();

      // Búsqueda multi-criterio: email, phone, name, last_name
      const { data, error } = await supabase
        .from("reservations")
        .select("id, local_id, name, last_name, email, phone, date, guests, status, notes, table_note, created_at, updated_at")
        .eq("local_id", req.panelUser.localId) // TENANT SEGURO
        .or(`email.ilike.%${searchTerm}%,phone.eq.${searchTerm},name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        logger.error("Error searching reservations", {
          error: error.message,
          localId: req.panelUser.localId,
        });
        return res.status(500).json({ error: error.message });
      }

      res.status(200).json(data || []);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /panel/reservations/:id
// Actualiza estado o table_note de una reserva
// Requiere autenticación y validación de tenant
panelRouter.patch("/reservations/:id", panelAuth, async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Missing reservation id" });
    }

    const validated = updateReservationStatusSchema.parse(req.body);

    // Buscar la reserva actual
    const { data: reservation, error: fetchError } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !reservation) {
      logger.error("Error fetching reservation", {
        error: fetchError?.message,
        reservationId: id,
      });
      return res.status(404).json({ error: "Reservation not found" });
    }

    // TENANT CHECK: validar que la reserva pertenece al local del usuario
    if (reservation.local_id !== req.panelUser.localId) {
      logger.warn("Tenant mismatch in reservation update", {
        reservationId: id,
        reservationLocalId: reservation.local_id,
        userLocalId: req.panelUser.localId,
      });
      return res.status(403).json({
        error: "Forbidden: You can only update reservations for your own local",
      });
    }

    // Preparar objeto de actualización
    const updateData: {
      status?: string;
      table_note?: string | null;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    // Si se intenta cambiar el status, validar que solo se puede desde 'en_revision'
    if (validated.status !== undefined) {
      if (reservation.status !== "en_revision") {
        return res.status(400).json({
          error: "La reserva ya fue procesada",
          currentStatus: reservation.status,
        });
      }
      updateData.status = validated.status;
    }

    // Permitir actualizar table_note independientemente del status
    if (validated.table_note !== undefined) {
      updateData.table_note = validated.table_note;
    }

    // Si no hay nada que actualizar, retornar error
    if (Object.keys(updateData).length === 1) {
      // Solo updated_at, no hay cambios reales
      return res.status(400).json({ error: "No hay campos para actualizar" });
    }

    // Actualizar la reserva
    const { data: updated, error: updateError } = await supabase
      .from("reservations")
      .update(updateData)
      .eq("id", id)
      .select("id, local_id, name, last_name, email, phone, date, guests, status, notes, table_note, created_at, updated_at")
      .single();

    if (updateError) {
      logger.error("Error updating reservation", {
        error: updateError.message,
        reservationId: id,
      });
      return res.status(500).json({ error: updateError.message });
    }

    // Enviar email de confirmación si el nuevo estado es 'confirmed'
    if (validated.status === "confirmed") {
      sendReservationConfirmedEmail({
        email: reservation.email,
        name: reservation.name,
        date: reservation.date,
        people: reservation.guests,
      }).catch((err) => {
        logger.error("Error sending reservation confirmation email", { error: err });
      });
    }

    res.status(200).json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: error.flatten() });
    }
    next(error);
  }
});

// PATCH /panel/orders/:id/use (check-in)
// Roles permitidos: owner, staff
panelRouter.patch("/orders/:id/use", panelAuth, requireRole(["owner", "staff"]), async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Missing order id" });
    }

    // Buscar la orden
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // TENANT CHECK: validar que la orden pertenece al local del usuario
    if (order.local_id !== req.panelUser.localId) {
      logger.warn("Tenant mismatch in order check-in", {
        orderId: id,
        orderLocalId: order.local_id,
        userLocalId: req.panelUser.localId,
      });
      return res.status(403).json({
        error: "Forbidden: You can only update orders for your own local",
      });
    }

    // Validar que la orden está pagada
    if (order.status !== "paid") {
      return res.status(400).json({
        error: "Order must be paid before use",
        currentStatus: order.status,
      });
    }

    // Validar que no fue usada previamente
    if (order.used_at !== null) {
      return res.status(400).json({
        error: "Order already used",
        usedAt: order.used_at,
      });
    }

    const { data: local, error: localError } = await supabase
      .from("locals")
      .select("type")
      .eq("id", order.local_id)
      .single();

    if (localError || !local) {
      logger.error("Local not found while validating check-in window", {
        orderId: id,
        localId: order.local_id,
        error: localError?.message,
      });
      return res.status(404).json({ error: "Local not found for order" });
    }

    if (local.type === "club") {
      const windowValidation = validateOrderWindowForCheckin(order, new Date());
      if (!windowValidation.allowed) {
        const payload = buildCheckinWindowErrorPayload(windowValidation);
        return res.status(payload.status).json(payload.body);
      }
    }

    // Actualizar used_at
    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({ used_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      logger.error("Error updating order for check-in", {
        error: updateError.message,
        orderId: id,
      });
      return res.status(500).json({ error: "Failed to update order" });
    }

    logger.info("Order checked in successfully", {
      orderId: id,
      localId: req.panelUser.localId,
      checkedInBy: req.panelUser.role,
    });

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

// PATCH /panel/checkin/:token
// Check-in por QR token
// Roles permitidos: owner, staff
panelRouter.patch("/checkin/:token", panelAuth, requireRole(["owner", "staff"]), async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: "Missing checkin token" });
    }

    // Buscar order por checkin_token
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, local_id, status, used_at, checkin_token, valid_from, valid_to, is_window_legacy, created_at")
      .eq("checkin_token", token)
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // TENANT CHECK: validar que la orden pertenece al local del usuario
    if (order.local_id !== req.panelUser.localId) {
      logger.warn("Tenant mismatch in token check-in", {
        token,
        orderLocalId: order.local_id,
        userLocalId: req.panelUser.localId,
      });
      return res.status(403).json({
        error: "Forbidden: This order belongs to another local",
      });
    }

    // Validar que la orden está pagada
    if (order.status !== "paid") {
      return res.status(400).json({
        error: "Order must be paid before use",
        currentStatus: order.status,
      });
    }

    // Validar que no fue usada previamente
    if (order.used_at !== null) {
      return res.status(409).json({
        error: "Order already used",
        usedAt: order.used_at,
      });
    }

    const { data: local, error: localError } = await supabase
      .from("locals")
      .select("type")
      .eq("id", order.local_id)
      .single();

    if (localError || !local) {
      logger.error("Local not found while validating token check-in window", {
        token,
        localId: order.local_id,
        error: localError?.message,
      });
      return res.status(404).json({ error: "Local not found for order" });
    }

    if (local.type === "club") {
      const windowValidation = validateOrderWindowForCheckin(order, new Date());
      if (!windowValidation.allowed) {
        const payload = buildCheckinWindowErrorPayload(windowValidation);
        return res.status(payload.status).json(payload.body);
      }
    }

    // Actualizar used_at y devolver datos del comprador para verificación
    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({ used_at: new Date().toISOString() })
      .eq("checkin_token", token)
      .select("id, local_id, status, used_at, customer_name, customer_last_name, customer_document")
      .single();

    if (updateError) {
      logger.error("Error in token check-in", {
        error: updateError.message,
        token,
      });
      return res.status(500).json({ error: "Failed to check in" });
    }

    logger.info("Token check-in successful", {
      orderId: updated.id,
      localId: req.panelUser.localId,
      checkedInBy: req.panelUser.role,
    });

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

// GET /panel/checkins
// Últimos check-ins del local (used_at NOT NULL)
// Roles permitidos: owner, staff
panelRouter.get("/checkins", panelAuth, requireRole(["owner", "staff"]), async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const limitParam = req.query.limit;
    const limit = typeof limitParam === "string" ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20;
    const now = new Date();
    const nowIso = now.toISOString();

    let pendingCount = 0;
    let unusedCount = 0;
    let currentWindow: { intended_date: string; valid_from: string; valid_to: string; window_key: string } | null = null;

    const { data: local, error: localError } = await supabase
      .from("locals")
      .select("type")
      .eq("id", req.panelUser.localId)
      .single();

    if (localError || !local) {
      logger.error("Error fetching local type for /panel/checkins", {
        error: localError?.message,
        localId: req.panelUser.localId,
      });
      return res.status(404).json({ error: "Local not found" });
    }

    const { data: checkins, error } = await supabase
      .from("orders")
      .select("id, status, used_at, checkin_token, customer_name, customer_last_name, customer_email, customer_document")
      .eq("local_id", req.panelUser.localId)
      .not("used_at", "is", null)
      .order("used_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error("Error fetching checkins", { error: error.message });
      return res.status(500).json({ error: "Failed to fetch checkins" });
    }

    if (local.type === "club") {
      try {
        const activeNightWindow = await getActiveNightWindow(now);
        currentWindow = {
          intended_date: activeNightWindow.intendedDate,
          valid_from: activeNightWindow.validFrom,
          valid_to: activeNightWindow.validTo,
          window_key: activeNightWindow.windowKey,
        };

        const { count: pending, error: pendingError } = await supabase
          .from("orders")
          .select("id", { head: true, count: "exact" })
          .eq("local_id", req.panelUser.localId)
          .eq("status", "paid")
          .is("used_at", null)
          .not("valid_from", "is", null)
          .not("valid_to", "is", null)
          .lte("valid_from", nowIso)
          .gt("valid_to", nowIso);

        if (pendingError) {
          logger.error("Error fetching pending_count in /panel/checkins", {
            error: pendingError.message,
            localId: req.panelUser.localId,
          });
        } else {
          pendingCount = pending ?? 0;
        }

        const { count: unused, error: unusedError } = await supabase
          .from("orders")
          .select("id", { head: true, count: "exact" })
          .eq("local_id", req.panelUser.localId)
          .eq("status", "paid")
          .is("used_at", null)
          .not("valid_to", "is", null)
          .gte("valid_to", new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .lte("valid_to", nowIso);

        if (unusedError) {
          logger.error("Error fetching unused_count in /panel/checkins", {
            error: unusedError.message,
            localId: req.panelUser.localId,
          });
        } else {
          unusedCount = unused ?? 0;
        }
      } catch (windowError) {
        logger.error("Error calculating current weekend window in /panel/checkins", {
          error: windowError instanceof Error ? windowError.message : String(windowError),
          localId: req.panelUser.localId,
        });
      }
    }

    res.status(200).json({
      items: checkins ?? [],
      count: checkins?.length ?? 0,
      pending_count: pendingCount,
      unused_count: unusedCount,
      current_window: currentWindow,
    });
  } catch (error) {
    next(error);
  }
});

// GET /panel/orders/search
// Buscar órdenes por email o documento
// Roles permitidos: owner, staff
panelRouter.get("/orders/search", panelAuth, requireRole(["owner", "staff"]), async (req, res, next) => {
  try {
    if (!req.panelUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { email, document } = req.query;

    // Validar que venga exactamente uno
    const hasEmail = typeof email === "string" && email.trim().length > 0;
    const hasDocument = typeof document === "string" && document.trim().length > 0;

    if (!hasEmail && !hasDocument) {
      return res.status(400).json({ error: "Missing required parameter: email or document" });
    }

    if (hasEmail && hasDocument) {
      return res.status(400).json({ error: "Provide only one parameter: email or document" });
    }

    const limitParam = req.query.limit;
    const limit = typeof limitParam === "string" ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20;

    let query = supabase
      .from("orders")
      .select("id, status, used_at, checkin_token, customer_name, customer_last_name, customer_email, customer_document, created_at")
      .eq("local_id", req.panelUser.localId);

    if (hasEmail) {
      const emailLower = email.trim().toLowerCase();
      query = query.eq("customer_email_lower", emailLower);
    } else if (hasDocument) {
      query = query.eq("customer_document", document.trim());
    }

    const { data: orders, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error("Error searching orders", { error: error.message });
      return res.status(500).json({ error: "Failed to search orders" });
    }

    res.status(200).json({ items: orders ?? [], count: orders?.length ?? 0 });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// CATALOG MANAGEMENT (solo discotecas)
// ============================================================================

// Limits
const MAX_TICKET_TYPES = 4;      // Máximo de tickets creados (activos + inactivos)
const MAX_ACTIVE_TICKETS = 2;    // Máximo de tickets activos simultáneamente
const MAX_TABLE_TYPES = 6;

/**
 * Helper: Verifica que el local sea un club.
 * Retorna el tipo o null si no es club.
 */
async function verifyClubOnly(localId: string): Promise<{ isClub: boolean; error?: string }> {
  const { data: local, error } = await supabase
    .from("locals")
    .select("type")
    .eq("id", localId)
    .single();

  if (error || !local) {
    return { isClub: false, error: "Local no encontrado" };
  }

  if (local.type !== "club") {
    return { isClub: false, error: "Solo discotecas pueden gestionar catálogo de entradas y mesas" };
  }

  return { isClub: true };
}

/**
 * Helper: Verifica si un ticket ha tenido ventas (aparece en orders.items).
 * Usado para sold-lock (bloquear cambios de name/price y delete).
 */
async function hasTicketSales(localId: string, ticketId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("local_id", localId)
    .contains("items", [{ kind: "ticket", ticket_type_id: ticketId }]);

  if (error) {
    logger.error("Error checking ticket sales", { error: error.message, ticketId });
    // En caso de error, asumir que tiene ventas para ser conservadores
    return true;
  }

  return (count ?? 0) > 0;
}

/**
 * Helper: Cuenta tickets activos del local.
 */
async function countActiveTickets(localId: string): Promise<number> {
  const { count, error } = await supabase
    .from("ticket_types")
    .select("id", { count: "exact", head: true })
    .eq("local_id", localId)
    .eq("is_active", true);

  if (error) {
    logger.error("Error counting active tickets", { error: error.message });
    return 0;
  }

  return count ?? 0;
}

// ----------------------------------------------------------------------------
// TICKETS (Entradas)
// ----------------------------------------------------------------------------

// GET /panel/catalog/tickets
// Lista todos los tickets del local (activos e inactivos)
// Roles: owner, staff
panelRouter.get(
  "/catalog/tickets",
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verificar que sea club
      const { isClub, error: clubError } = await verifyClubOnly(req.panelUser.localId);
      if (!isClub) {
        return res.status(403).json({ error: clubError });
      }

      const { data: tickets, error } = await supabase
        .from("ticket_types")
        .select("id, name, price, description, is_active, sort_order, created_at, updated_at")
        .eq("local_id", req.panelUser.localId)
        .order("price", { ascending: true })
        .order("sort_order", { ascending: true });

      if (error) {
        logger.error("Error fetching ticket types", { error: error.message });
        return res.status(500).json({ error: "Error al obtener entradas" });
      }

      // Normalizar price de BIGINT (string) a number
      const normalizedTickets = (tickets ?? []).map((t) => ({
        ...t,
        price: Number(t.price),
      }));

      res.status(200).json({ tickets: normalizedTickets });
    } catch (error) {
      next(error);
    }
  }
);

// POST /panel/catalog/tickets
// Crear nuevo ticket
// Roles: owner
panelRouter.post(
  "/catalog/tickets",
  panelAuth,
  requireRole(["owner"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verificar que sea club
      const { isClub, error: clubError } = await verifyClubOnly(req.panelUser.localId);
      if (!isClub) {
        return res.status(403).json({ error: clubError });
      }

      // Verificar límite
      const { count, error: countError } = await supabase
        .from("ticket_types")
        .select("id", { count: "exact", head: true })
        .eq("local_id", req.panelUser.localId);

      if (countError) {
        logger.error("Error counting ticket types", { error: countError.message });
        return res.status(500).json({ error: "Error al verificar límite" });
      }

      if ((count ?? 0) >= MAX_TICKET_TYPES) {
        return res.status(400).json({ 
          error: `Máximo ${MAX_TICKET_TYPES} tipos de entrada permitidos. Elimina uno existente si necesitas agregar otro.` 
        });
      }

      // Validar campos
      const { name, price, description, is_active } = req.body;

      // Si se quiere crear activo, verificar límite de activos
      const willBeActive = is_active !== false; // Por defecto true
      if (willBeActive) {
        const activeCount = await countActiveTickets(req.panelUser.localId);
        if (activeCount >= MAX_ACTIVE_TICKETS) {
          return res.status(400).json({
            error: `Máximo ${MAX_ACTIVE_TICKETS} entradas activas simultáneamente. Desactiva una antes de crear otra activa.`,
          });
        }
      }

      if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
        return res.status(400).json({ error: "El nombre debe tener entre 2 y 100 caracteres" });
      }

      const priceNum = typeof price === "string" ? parseFloat(price) : price;
      if (typeof priceNum !== "number" || isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: "El precio debe ser un número mayor o igual a 0" });
      }

      const descTrimmed = typeof description === "string" ? description.trim() : null;
      if (descTrimmed && descTrimmed.length > 500) {
        return res.status(400).json({ error: "La descripción no puede superar 500 caracteres" });
      }

      // Obtener siguiente sort_order
      const { data: maxOrder } = await supabase
        .from("ticket_types")
        .select("sort_order")
        .eq("local_id", req.panelUser.localId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();

      const nextOrder = (maxOrder?.sort_order ?? -1) + 1;

      // Insertar
      const { data: ticket, error: insertError } = await supabase
        .from("ticket_types")
        .insert({
          local_id: req.panelUser.localId,
          name: name.trim(),
          price: priceNum,
          description: descTrimmed || null,
          is_active: willBeActive,
          sort_order: nextOrder,
        })
        .select()
        .single();

      if (insertError) {
        logger.error("Error creating ticket type", { error: insertError.message });
        return res.status(500).json({ error: "Error al crear entrada" });
      }

      // Normalizar price en respuesta
      res.status(201).json({ 
        ticket: { ...ticket, price: Number(ticket.price) } 
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /panel/catalog/tickets/:id
// Editar ticket (incluye soft-disable con is_active)
// Roles: owner
panelRouter.patch(
  "/catalog/tickets/:id",
  panelAuth,
  requireRole(["owner"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;

      // Verificar que sea club
      const { isClub, error: clubError } = await verifyClubOnly(req.panelUser.localId);
      if (!isClub) {
        return res.status(403).json({ error: clubError });
      }

      // Verificar que el ticket pertenece al local (multi-tenant)
      const { data: existing, error: fetchError } = await supabase
        .from("ticket_types")
        .select("id, local_id, is_active")
        .eq("id", id)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ error: "Entrada no encontrada" });
      }

      if (existing.local_id !== req.panelUser.localId) {
        return res.status(403).json({ error: "No tienes permiso para editar esta entrada" });
      }

      const { name, price, description, is_active, sort_order } = req.body;

      // Sold-lock: si el ticket tiene ventas, no permitir cambios de name/price
      const wantsToChangeName = name !== undefined;
      const wantsToChangePrice = price !== undefined;

      if (wantsToChangeName || wantsToChangePrice) {
        const hasSales = await hasTicketSales(req.panelUser.localId, id);
        if (hasSales) {
          return res.status(409).json({
            error: "No se puede modificar nombre o precio de una entrada que ya tuvo ventas. Solo podés activar/desactivar.",
          });
        }
      }

      // Validar y construir update
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (wantsToChangeName) {
        if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
          return res.status(400).json({ error: "El nombre debe tener entre 2 y 100 caracteres" });
        }
        updateData.name = name.trim();
      }

      if (wantsToChangePrice) {
        const priceNum = typeof price === "string" ? parseFloat(price) : price;
        if (typeof priceNum !== "number" || isNaN(priceNum) || priceNum < 0) {
          return res.status(400).json({ error: "El precio debe ser un número mayor o igual a 0" });
        }
        updateData.price = priceNum;
      }

      if (description !== undefined) {
        const descTrimmed = typeof description === "string" ? description.trim() : null;
        if (descTrimmed && descTrimmed.length > 500) {
          return res.status(400).json({ error: "La descripción no puede superar 500 caracteres" });
        }
        updateData.description = descTrimmed || null;
      }

      if (is_active !== undefined) {
        if (typeof is_active !== "boolean") {
          return res.status(400).json({ error: "is_active debe ser un booleano" });
        }

        // Si se quiere activar, verificar límite de activos
        if (is_active === true && existing.is_active === false) {
          const activeCount = await countActiveTickets(req.panelUser.localId);
          if (activeCount >= MAX_ACTIVE_TICKETS) {
            return res.status(400).json({
              error: `Máximo ${MAX_ACTIVE_TICKETS} entradas activas simultáneamente. Desactiva una antes de activar otra.`,
            });
          }
        }

        updateData.is_active = is_active;
      }

      if (sort_order !== undefined) {
        const orderNum = typeof sort_order === "string" ? parseInt(sort_order, 10) : sort_order;
        if (typeof orderNum !== "number" || isNaN(orderNum) || orderNum < 0) {
          return res.status(400).json({ error: "sort_order debe ser un número mayor o igual a 0" });
        }
        updateData.sort_order = orderNum;
      }

      // Actualizar
      const { data: ticket, error: updateError } = await supabase
        .from("ticket_types")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        logger.error("Error updating ticket type", { error: updateError.message });
        return res.status(500).json({ error: "Error al actualizar entrada" });
      }

      // Normalizar price en respuesta
      res.status(200).json({ 
        ticket: { ...ticket, price: Number(ticket.price) } 
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /panel/catalog/tickets/:id
// Eliminar ticket (hard delete, solo si NO tiene ventas)
// Roles: owner
panelRouter.delete(
  "/catalog/tickets/:id",
  panelAuth,
  requireRole(["owner"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;

      // Verificar que sea club
      const { isClub, error: clubError } = await verifyClubOnly(req.panelUser.localId);
      if (!isClub) {
        return res.status(403).json({ error: clubError });
      }

      // Verificar que el ticket pertenece al local
      const { data: existing, error: fetchError } = await supabase
        .from("ticket_types")
        .select("id, local_id, name")
        .eq("id", id)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ error: "Entrada no encontrada" });
      }

      if (existing.local_id !== req.panelUser.localId) {
        return res.status(403).json({ error: "No tienes permiso para eliminar esta entrada" });
      }

      // Sold-lock: no permitir eliminar si tiene ventas
      const hasSales = await hasTicketSales(req.panelUser.localId, id);
      if (hasSales) {
        return res.status(409).json({
          error: `No se puede eliminar "${existing.name}" porque ya tuvo ventas. Desactívala (is_active=false) en lugar de eliminarla.`,
        });
      }

      // Eliminar
      const { error: deleteError } = await supabase
        .from("ticket_types")
        .delete()
        .eq("id", id)
        .eq("local_id", req.panelUser.localId);

      if (deleteError) {
        logger.error("Error deleting ticket type", { error: deleteError.message });
        return res.status(500).json({ error: "Error al eliminar entrada" });
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// ----------------------------------------------------------------------------
// TABLES (Mesas)
// ----------------------------------------------------------------------------

// GET /panel/catalog/tables
// Lista todas las mesas del local (activas e inactivas)
// Roles: owner, staff
panelRouter.get(
  "/catalog/tables",
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verificar que sea club
      const { isClub, error: clubError } = await verifyClubOnly(req.panelUser.localId);
      if (!isClub) {
        return res.status(403).json({ error: clubError });
      }

      const { data: tables, error } = await supabase
        .from("table_types")
        .select("id, name, price, capacity, includes, is_active, sort_order, created_at, updated_at")
        .eq("local_id", req.panelUser.localId)
        .order("price", { ascending: true, nullsFirst: false })
        .order("sort_order", { ascending: true });

      if (error) {
        logger.error("Error fetching table types", { error: error.message });
        return res.status(500).json({ error: "Error al obtener mesas" });
      }

      // Normalizar price de BIGINT (string) a number
      const normalizedTables = (tables ?? []).map((t) => ({
        ...t,
        price: t.price !== null ? Number(t.price) : null,
      }));

      res.status(200).json({ tables: normalizedTables });
    } catch (error) {
      next(error);
    }
  }
);

// POST /panel/catalog/tables
// Crear nueva mesa
// Roles: owner
panelRouter.post(
  "/catalog/tables",
  panelAuth,
  requireRole(["owner"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verificar que sea club
      const { isClub, error: clubError } = await verifyClubOnly(req.panelUser.localId);
      if (!isClub) {
        return res.status(403).json({ error: clubError });
      }

      // Verificar límite
      const { count, error: countError } = await supabase
        .from("table_types")
        .select("id", { count: "exact", head: true })
        .eq("local_id", req.panelUser.localId);

      if (countError) {
        logger.error("Error counting table types", { error: countError.message });
        return res.status(500).json({ error: "Error al verificar límite" });
      }

      if ((count ?? 0) >= MAX_TABLE_TYPES) {
        return res.status(400).json({ 
          error: `Máximo ${MAX_TABLE_TYPES} tipos de mesa permitidos. Desactiva una existente si necesitas agregar otra.` 
        });
      }

      // Validar campos
      const { name, price, capacity, includes } = req.body;

      if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
        return res.status(400).json({ error: "El nombre debe tener entre 2 y 100 caracteres" });
      }

      let priceNum: number | null = null;
      if (price !== undefined && price !== null && price !== "") {
        priceNum = typeof price === "string" ? parseFloat(price) : price;
        if (typeof priceNum !== "number" || isNaN(priceNum) || priceNum < 0) {
          return res.status(400).json({ error: "El precio debe ser un número mayor o igual a 0" });
        }
      }

      let capacityNum: number | null = null;
      if (capacity !== undefined && capacity !== null && capacity !== "") {
        capacityNum = typeof capacity === "string" ? parseInt(capacity, 10) : capacity;
        if (typeof capacityNum !== "number" || isNaN(capacityNum) || capacityNum < 1 || capacityNum > 50) {
          return res.status(400).json({ error: "La capacidad debe ser un número entre 1 y 50" });
        }
      }

      const includesTrimmed = typeof includes === "string" ? includes.trim() : null;
      if (includesTrimmed && includesTrimmed.length > 500) {
        return res.status(400).json({ error: "La descripción de incluye no puede superar 500 caracteres" });
      }

      // Obtener siguiente sort_order
      const { data: maxOrder } = await supabase
        .from("table_types")
        .select("sort_order")
        .eq("local_id", req.panelUser.localId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();

      const nextOrder = (maxOrder?.sort_order ?? -1) + 1;

      // Insertar
      const { data: table, error: insertError } = await supabase
        .from("table_types")
        .insert({
          local_id: req.panelUser.localId,
          name: name.trim(),
          price: priceNum,
          capacity: capacityNum,
          includes: includesTrimmed || null,
          is_active: true,
          sort_order: nextOrder,
        })
        .select()
        .single();

      if (insertError) {
        logger.error("Error creating table type", { error: insertError.message });
        return res.status(500).json({ error: "Error al crear mesa" });
      }

      res.status(201).json({ table });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /panel/catalog/tables/:id
// Editar mesa (incluye soft-disable con is_active)
// Roles: owner
panelRouter.patch(
  "/catalog/tables/:id",
  panelAuth,
  requireRole(["owner"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;

      // Verificar que sea club
      const { isClub, error: clubError } = await verifyClubOnly(req.panelUser.localId);
      if (!isClub) {
        return res.status(403).json({ error: clubError });
      }

      // Verificar que la mesa pertenece al local (multi-tenant)
      const { data: existing, error: fetchError } = await supabase
        .from("table_types")
        .select("id, local_id")
        .eq("id", id)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ error: "Mesa no encontrada" });
      }

      if (existing.local_id !== req.panelUser.localId) {
        return res.status(403).json({ error: "No tienes permiso para editar esta mesa" });
      }

      // Validar y construir update
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

      const { name, price, capacity, includes, is_active, sort_order } = req.body;

      if (name !== undefined) {
        if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
          return res.status(400).json({ error: "El nombre debe tener entre 2 y 100 caracteres" });
        }
        updateData.name = name.trim();
      }

      if (price !== undefined) {
        if (price === null || price === "") {
          updateData.price = null;
        } else {
          const priceNum = typeof price === "string" ? parseFloat(price) : price;
          if (typeof priceNum !== "number" || isNaN(priceNum) || priceNum < 0) {
            return res.status(400).json({ error: "El precio debe ser un número mayor o igual a 0" });
          }
          updateData.price = priceNum;
        }
      }

      if (capacity !== undefined) {
        if (capacity === null || capacity === "") {
          updateData.capacity = null;
        } else {
          const capacityNum = typeof capacity === "string" ? parseInt(capacity, 10) : capacity;
          if (typeof capacityNum !== "number" || isNaN(capacityNum) || capacityNum < 1 || capacityNum > 50) {
            return res.status(400).json({ error: "La capacidad debe ser un número entre 1 y 50" });
          }
          updateData.capacity = capacityNum;
        }
      }

      if (includes !== undefined) {
        const includesTrimmed = typeof includes === "string" ? includes.trim() : null;
        if (includesTrimmed && includesTrimmed.length > 500) {
          return res.status(400).json({ error: "La descripción de incluye no puede superar 500 caracteres" });
        }
        updateData.includes = includesTrimmed || null;
      }

      if (is_active !== undefined) {
        if (typeof is_active !== "boolean") {
          return res.status(400).json({ error: "is_active debe ser un booleano" });
        }
        updateData.is_active = is_active;
      }

      if (sort_order !== undefined) {
        const orderNum = typeof sort_order === "string" ? parseInt(sort_order, 10) : sort_order;
        if (typeof orderNum !== "number" || isNaN(orderNum) || orderNum < 0) {
          return res.status(400).json({ error: "sort_order debe ser un número mayor o igual a 0" });
        }
        updateData.sort_order = orderNum;
      }

      // Actualizar
      const { data: table, error: updateError } = await supabase
        .from("table_types")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        logger.error("Error updating table type", { error: updateError.message });
        return res.status(500).json({ error: "Error al actualizar mesa" });
      }

      res.status(200).json({ table });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /panel/catalog/tables/:id
// Eliminar mesa (hard delete)
// Roles: owner
panelRouter.delete(
  "/catalog/tables/:id",
  panelAuth,
  requireRole(["owner"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;

      // Verificar que sea club
      const { isClub, error: clubError } = await verifyClubOnly(req.panelUser.localId);
      if (!isClub) {
        return res.status(403).json({ error: clubError });
      }

      // Eliminar solo si pertenece al local (multi-tenant)
      const { data, error: deleteError } = await supabase
        .from("table_types")
        .delete()
        .eq("id", id)
        .eq("local_id", req.panelUser.localId)
        .select("id")
        .single();

      if (deleteError) {
        // PGRST116 = no rows returned (not found or not owned)
        if (deleteError.code === "PGRST116") {
          return res.status(404).json({ error: "Mesa no encontrada" });
        }
        logger.error("Error deleting table type", { error: deleteError.message });
        return res.status(500).json({ error: "Error al eliminar mesa" });
      }

      if (!data) {
        return res.status(404).json({ error: "Mesa no encontrada" });
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

// Rutas de calendario
panelRouter.use("/calendar", calendarRouter);
