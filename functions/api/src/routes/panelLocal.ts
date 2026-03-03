import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { panelAuth } from "../middlewares/panelAuth";
import { requireRole } from "../middlewares/requireRole";
import { supabase } from "../services/supabase";
import {
  normalizeLegacyHours,
  validateOpeningHoursV1,
  type OpeningHoursV1,
} from "../services/openingHours";
import { logger } from "../utils/logger";

const BAR_SPECIALTIES = [
  "Cervezas artesanales",
  "Cocteles",
  "Vinos",
  "Terraza",
  "After Office",
  "Música en vivo",
  "Después de las 12 am",
  "Temáticas",
] as const;

const CLUB_GENRES = [
  "Reggaeton",
  "Electronica",
  "Pop",
  "Latino",
  "Mix",
] as const;

function getAttributesAllowlist(localType: "bar" | "club"): readonly string[] {
  return localType === "bar" ? BAR_SPECIALTIES : CLUB_GENRES;
}

const ZONES = [
  "Carmelitas",
  "Centro",
  "Villa Morra",
  "Las Mercedes",
  "Recoleta",
  "Costanera",
  "Mburucuyá",
] as const;

const MIN_AGES = [18, 21, 22, 25] as const;
const CITIES = ["Asunción", "San Bernardino", "Ciudad del Este"] as const;

const GALLERY_KINDS = ["cover", "hero", "carousel", "menu", "drinks", "food", "interior"] as const;
type GalleryKind = (typeof GALLERY_KINDS)[number];

const BAR_GALLERY_KINDS: GalleryKind[] = ["cover", "hero", "food", "menu", "drinks", "interior"];
const CLUB_GALLERY_KINDS: GalleryKind[] = ["cover", "hero", "carousel"];

interface LocalGalleryItem {
  id: string;
  url: string;
  path: string;
  kind: GalleryKind;
  order: number;
}

const MAX_GALLERY_ITEMS = 12;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const STORAGE_BUCKET = "local-gallery";

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

    if (typeof id !== "string" || id.trim().length === 0) continue;
    if (typeof url !== "string" || url.trim().length === 0) continue;
    if (typeof path !== "string" || path.trim().length === 0) continue;
    if (!allowedKinds.includes(kind as GalleryKind)) continue;
    if (typeof order !== "number" || order < 0 || !Number.isFinite(order)) continue;

    if (kind === "cover") {
      coverCount++;
      if (coverCount > 1) continue;
    }

    if (kind === "hero") {
      heroCount++;
      if (heroCount > 1) continue;
    }

    validated.push({
      id: id.trim(),
      url: url.trim(),
      path: path.trim(),
      kind: kind as GalleryKind,
      order,
    });
  }

  validated.sort((a, b) => a.order - b.order);
  validated.forEach((item, index) => {
    item.order = index;
  });

  return validated;
}

export const panelLocalRouter = Router();

panelLocalRouter.get(
  "/",
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data: local, error } = await supabase
        .from("locals")
        .select("id, name, slug, type, address, location, city, latitude, longitude, hours, opening_hours, additional_info, phone, whatsapp, gallery, attributes, min_age")
        .eq("id", req.panelUser.localId)
        .single();

      if (error || !local) {
        logger.error("Error fetching local profile", {
          error: error?.message,
          localId: req.panelUser.localId,
        });
        return res.status(404).json({ error: "Local not found" });
      }

      const openingHoursValidation =
        local.opening_hours && typeof local.opening_hours === "object"
          ? validateOpeningHoursV1(local.opening_hours)
          : null;

      const normalizedLocal = {
        ...local,
        hours: normalizeLegacyHours(local.hours),
        opening_hours: openingHoursValidation?.ok ? openingHoursValidation.value : null,
        additional_info: Array.isArray(local.additional_info) ? local.additional_info : [],
        gallery: Array.isArray(local.gallery) ? local.gallery : [],
        attributes: Array.isArray(local.attributes) ? local.attributes : [],
        min_age: typeof local.min_age === "number" ? local.min_age : null,
        city: typeof local.city === "string" ? local.city : null,
        latitude: typeof local.latitude === "number" ? local.latitude : null,
        longitude: typeof local.longitude === "number" ? local.longitude : null,
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

panelLocalRouter.patch(
  "/",
  panelAuth,
  requireRole(["owner"]),
  async (req, res) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const {
        name,
        address,
        location,
        city,
        latitude,
        longitude,
        hours,
        opening_hours,
        additional_info,
        phone,
        whatsapp,
        gallery,
        attributes,
        min_age,
      } = req.body;

      const updateData: {
        name?: string;
        address?: string | null;
        location?: string | null;
        city?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        hours?: string[];
        opening_hours?: OpeningHoursV1 | null;
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

      if (address !== undefined) {
        const val = typeof address === "string" ? address.trim() : "";
        updateData.address = val || null;
        hasFieldsToUpdate = true;
      }

      if (location !== undefined) {
        const val = typeof location === "string" ? location.trim() : "";
        if (val === "") {
          updateData.location = null;
        } else if (!ZONES.includes(val as (typeof ZONES)[number])) {
          return res.status(400).json({
            error: `Zona no válida: "${val}". Zonas permitidas: ${ZONES.join(", ")}`,
          });
        } else {
          updateData.location = val;
        }
        hasFieldsToUpdate = true;
      }

      if (min_age !== undefined) {
        if (min_age === null || min_age === "" || min_age === 0) {
          updateData.min_age = null;
        } else {
          const ageNum = typeof min_age === "string" ? parseInt(min_age, 10) : min_age;
          if (isNaN(ageNum)) {
            return res.status(400).json({ error: "Edad mínima inválida" });
          }
          if (!MIN_AGES.includes(ageNum as (typeof MIN_AGES)[number])) {
            return res.status(400).json({
              error: `Edad mínima no permitida: ${ageNum}. Valores permitidos: ${MIN_AGES.join(", ")}`,
            });
          }
          updateData.min_age = ageNum;
        }
        hasFieldsToUpdate = true;
      }

      if (city !== undefined) {
        const val = typeof city === "string" ? city.trim() : "";
        if (val === "") {
          updateData.city = null;
        } else if (!CITIES.includes(val as (typeof CITIES)[number])) {
          return res.status(400).json({
            error: `Ciudad no válida: "${val}". Ciudades permitidas: ${CITIES.join(", ")}`,
          });
        } else {
          updateData.city = val;
        }
        hasFieldsToUpdate = true;
      }

      const toOptionalCoordinate = (value: unknown): number | null | "invalid" => {
        if (value === undefined || value === null || value === "") return null;
        const parsed = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
        if (!Number.isFinite(parsed)) return "invalid";
        return parsed;
      };

      if (latitude !== undefined) {
        const parsedLat = toOptionalCoordinate(latitude);
        if (parsedLat === "invalid" || (parsedLat !== null && (parsedLat < -90 || parsedLat > 90))) {
          return res.status(400).json({ error: "Latitud inválida. Debe estar entre -90 y 90." });
        }
        updateData.latitude = parsedLat;
        hasFieldsToUpdate = true;
      }

      if (longitude !== undefined) {
        const parsedLng = toOptionalCoordinate(longitude);
        if (parsedLng === "invalid" || (parsedLng !== null && (parsedLng < -180 || parsedLng > 180))) {
          return res.status(400).json({ error: "Longitud inválida. Debe estar entre -180 y 180." });
        }
        updateData.longitude = parsedLng;
        hasFieldsToUpdate = true;
      }

      if (hours !== undefined) {
        const arr = normalizeLegacyHours(hours).slice(0, 14);
        if (arr.some((h) => h.length > 120)) {
          return res.status(400).json({ error: "Cada horario max 120 caracteres" });
        }
        updateData.hours = arr;
        hasFieldsToUpdate = true;
      }

      if (opening_hours !== undefined) {
        if (opening_hours === null || opening_hours === "") {
          updateData.opening_hours = null;
          hasFieldsToUpdate = true;
        } else {
          const openingHoursValidation = validateOpeningHoursV1(opening_hours);
          if (!openingHoursValidation.ok) {
            return res.status(400).json({
              error: "opening_hours inválido",
              details: openingHoursValidation.errors,
            });
          }
          updateData.opening_hours = openingHoursValidation.value;
          hasFieldsToUpdate = true;
        }
      }

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

      if (phone !== undefined) {
        const val = typeof phone === "string" ? phone.trim() : "";
        updateData.phone = val || null;
        hasFieldsToUpdate = true;
      }

      if (whatsapp !== undefined) {
        const val = typeof whatsapp === "string" ? whatsapp.trim() : "";
        updateData.whatsapp = val || null;
        hasFieldsToUpdate = true;
      }

      let localType: "bar" | "club" | undefined;
      if (attributes !== undefined || gallery !== undefined) {
        const { data: localData } = await supabase
          .from("locals")
          .select("type")
          .eq("id", req.panelUser.localId)
          .single();
        localType = localData?.type as "bar" | "club" | undefined;
      }

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
          if (seen.has(trimmed)) continue;

          if (!allowlist.includes(trimmed)) {
            invalidAttrs.push(trimmed);
            continue;
          }

          seen.add(trimmed);
          normalized.push(trimmed);

          if (normalized.length >= 3) break;
        }

        if (invalidAttrs.length > 0) {
          return res.status(400).json({
            error: `Atributos no permitidos: ${invalidAttrs.join(", ")}`,
          });
        }

        updateData.attributes = normalized;
        hasFieldsToUpdate = true;
      }

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

      if (!hasFieldsToUpdate) {
        return res.status(400).json({ error: "No fields to update" });
      }

      const { data: updated, error } = await supabase
        .from("locals")
        .update(updateData)
        .eq("id", req.panelUser.localId)
        .select("id, name, slug, type, address, location, city, latitude, longitude, hours, opening_hours, additional_info, phone, whatsapp, gallery, attributes, min_age")
        .single();

      if (error) {
        logger.error("Error updating local profile", {
          error: error.message,
          localId: req.panelUser.localId,
        });
        return res.status(500).json({ error: "Error al actualizar el perfil" });
      }

      const updatedOpeningHoursValidation =
        updated.opening_hours && typeof updated.opening_hours === "object"
          ? validateOpeningHoursV1(updated.opening_hours)
          : null;

      const normalizedUpdated = {
        ...updated,
        hours: normalizeLegacyHours(updated.hours),
        opening_hours: updatedOpeningHoursValidation?.ok ? updatedOpeningHoursValidation.value : null,
        additional_info: Array.isArray(updated.additional_info) ? updated.additional_info : [],
        gallery: Array.isArray(updated.gallery) ? updated.gallery : [],
        latitude: typeof updated.latitude === "number" ? updated.latitude : null,
        longitude: typeof updated.longitude === "number" ? updated.longitude : null,
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

panelLocalRouter.post(
  "/gallery/signed-upload",
  panelAuth,
  requireRole(["owner"]),
  async (req, res) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { contentType, kind, fileName } = req.body;

      if (!contentType || !ALLOWED_MIME_TYPES.includes(contentType)) {
        return res.status(400).json({
          error: `contentType inválido. Permitidos: ${ALLOWED_MIME_TYPES.join(", ")}`,
        });
      }

      const isPromoUpload = kind === "promo";

      if (!isPromoUpload) {
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

        if (!kind || !allowedKinds.includes(kind as GalleryKind)) {
          return res.status(400).json({
            error: `kind inválido para ${localType}. Permitidos: ${allowedKinds.join(", ")}`,
          });
        }
      }

      const fileId = uuidv4();
      const extension = contentType.split("/")[1];
      const safeName = fileName ? fileName.replace(/[^a-zA-Z0-9.-]/g, "_").substring(0, 50) : "image";
      const storagePath = isPromoUpload
        ? `promos/${req.panelUser.localId}/${fileId}_${safeName}.${extension}`
        : `${req.panelUser.localId}/${fileId}_${safeName}.${extension}`;

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

panelLocalRouter.delete(
  "/gallery/:id",
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
          logger.warn("Could not delete file from storage", {
            localId: req.panelUser.localId,
            imageId: id,
          });
        }
      } else {
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

      gallery.splice(itemIndex, 1);
      gallery.forEach((g, idx) => {
        g.order = idx;
      });

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
