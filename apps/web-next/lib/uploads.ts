/**
 * Helpers para upload de imágenes en Panel
 */

import { apiPostWithAuth } from "./api";

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface SignedUploadResponse {
  signedUrl: string;
  token: string;
  path: string;
  publicUrl: string;
  id: string;
  kind: string;
}

export interface UploadResult {
  imageUrl: string;
  path: string;
  id: string;
}

export interface ValidationError {
  error: string;
}

/**
 * Valida un archivo de imagen para promo
 * @returns null si es válido, o un objeto con error si no
 */
export function validatePromoImageFile(file: File): ValidationError | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      error: "Formato no permitido. Usá JPG, PNG o WebP.",
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      error: `La imagen pesa ${sizeMB}MB. Máximo ${MAX_FILE_SIZE_MB}MB.`,
    };
  }

  return null;
}

/**
 * Sube una imagen de promo a Storage usando signed upload
 * @param file Archivo de imagen
 * @returns URL pública de la imagen y path en storage
 */
export async function uploadPromoImage(file: File): Promise<UploadResult> {
  // 1. Validate file
  const validationError = validatePromoImageFile(file);
  if (validationError) {
    throw new Error(validationError.error);
  }

  // 2. Get signed upload URL from backend
  const signedData = await apiPostWithAuth<SignedUploadResponse>(
    "/panel/local/gallery/signed-upload",
    {
      contentType: file.type,
      kind: "promo", // Special kind for promo images
      fileName: file.name,
    }
  );

  // 3. Upload binary directly to signed URL
  const uploadResponse = await fetch(signedData.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Error al subir imagen a storage");
  }

  // 4. Return public URL
  return {
    imageUrl: signedData.publicUrl,
    path: signedData.path,
    id: signedData.id,
  };
}

/**
 * Valida una URL de imagen (para opción avanzada de pegar URL)
 * @returns null si parece válida, o error message si no
 */
export function validateImageUrl(url: string): string | null {
  if (!url.trim()) {
    return "La URL no puede estar vacía";
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "La URL debe empezar con http:// o https://";
    }
    return null;
  } catch {
    return "URL inválida";
  }
}
