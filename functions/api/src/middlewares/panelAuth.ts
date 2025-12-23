import { Request, Response, NextFunction } from "express";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";


/**
 * Middleware de autenticación SOLO para endpoints del panel B2B.
 * 
 * Este middleware:
 * - Valida el access token de Supabase Auth desde el header Authorization
 * - Busca el usuario en la tabla panel_users
 * - Adjunta req.panelUser con localId del usuario
 * 
 * IMPORTANTE: Este middleware NO se aplica a endpoints públicos como:
 * - POST /reservations
 * - POST /events/*
 * - POST /orders
 * Estos endpoints siguen funcionando sin autenticación.
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
  try {
    // ✅ IMPORTANTÍSIMO: dejar pasar el preflight CORS (OPTIONS) sin autenticar
    if (req.method === "OPTIONS") return next();

    // Leer token del header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const accessToken = authHeader.substring(7); // Remover "Bearer "

    if (!accessToken) {
      return res.status(401).json({ error: "Missing access token" });
    }

    // Validar token con Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      logger.warn("Invalid access token", { error: authError?.message });
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Buscar usuario en panel_users
    const { data: panelUser, error: dbError } = await supabase
      .from("panel_users")
      .select("id, auth_user_id, email, local_id, role")
      .eq("auth_user_id", user.id)
      .single();

    if (dbError || !panelUser) {
      logger.warn("Panel user not found", {
        authUserId: user.id,
        error: dbError?.message,
      });
      return res.status(403).json({ error: "User not authorized for panel access" });
    }

    // Adjuntar información del usuario al request
    req.panelUser = {
      userId: user.id,
      email: panelUser.email,
      localId: panelUser.local_id,
      role: panelUser.role,
    };

    next();
  } catch (error) {
    logger.error("Error in panelAuth middleware", { error });
    return res.status(500).json({ error: "Internal server error" });
  }
}

