import { Request, Response, NextFunction } from "express";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";


/**
 * Middleware de autenticación para endpoints del panel B2B.
 * 
 * Flujo:
 * 1. Extrae Bearer token del header Authorization
 * 2. Valida token con supabase.auth.getUser() (verifica firma y expiración)
 * 3. Busca usuario en panel_users por auth_user_id
 * 4. Adjunta req.panelUser con: userId, email, localId, role
 * 
 * Respuestas de error:
 * - 401: Token faltante, inválido o expirado
 * - 403: Token válido pero usuario no existe en panel_users (no autorizado para panel)
 * - 500: Error interno del servidor
 * 
 * IMPORTANTE: Este middleware NO se aplica a endpoints públicos, por ejemplo:
 * - GET /public/*
 * - POST /events/* (tracking público)
 * - POST /reservations (crear reserva)
 * - POST /orders (crear orden)
 * Estos endpoints funcionan sin autenticación.
 */

export interface PanelUser {
  userId: string;
  email: string;
  localId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      panelUser?: PanelUser;
    }
  }
}

export async function panelAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Obtener requestId del header (puede ser string o array)
  const requestIdHeader = req.headers["x-request-id"];
  const requestId = Array.isArray(requestIdHeader) 
    ? requestIdHeader[0] 
    : (requestIdHeader || "unknown");
  
  const method = req.method;
  const path = req.originalUrl || req.path;

  try {
    // Permitir preflight CORS (OPTIONS) sin autenticación
    // Si no se permite, el navegador bloquea requests desde el frontend
    if (req.method === "OPTIONS") return next();

    // Authorization esperado: "Bearer <access_token>"
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.warn("Missing or invalid Authorization header", {
        requestId,
        method,
        path,
      });
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const accessToken = authHeader.substring(7); // Remover "Bearer "

    if (!accessToken) {
      logger.warn("Missing access token", {
        requestId,
        method,
        path,
      });
      return res.status(401).json({ error: "Missing access token" });
    }

    // Validar token con Supabase Auth (verifica firma y expiración)
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      logger.warn("Invalid or expired token", {
        requestId,
        method,
        path,
        error: authError?.message,
      });
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Buscar usuario en panel_users por auth_user_id (autorización para panel)
    // Si no existe, retorna 403 (usuario válido en Auth pero no autorizado para panel)
    const { data: panelUser, error: dbError } = await supabase
      .from("panel_users")
      .select("id, auth_user_id, email, local_id, role")
      .eq("auth_user_id", user.id)
      .single();

    if (dbError || !panelUser) {
      logger.warn("Panel user not found", {
        requestId,
        method,
        path,
        authUserId: user.id,
        error: dbError?.message,
      });
      return res.status(403).json({ error: "User not authorized for panel access" });
    }

    // Adjuntar información del usuario autenticado al request
    // Disponible en req.panelUser para handlers siguientes (usado para multi-tenant por localId)
    req.panelUser = {
      userId: user.id,
      email: panelUser.email,
      localId: panelUser.local_id,
      role: panelUser.role,
    };

    // Log exitoso con información de trazabilidad
    logger.info("Panel authentication successful", {
      requestId,
      method,
      path,
      authUserId: user.id,
      localId: panelUser.local_id,
    });

    next();
  } catch (error) {
    logger.error("Error in panelAuth middleware", {
      requestId,
      method,
      path,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: "Internal server error" });
  }
}

