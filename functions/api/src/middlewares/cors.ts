import { RequestHandler } from "express";

// Parsear FRONTEND_ORIGIN como lista separada por comas
// Si está vacío, usar defaults: localhost:3000, 3001, y 5173 (Vite B2C)
// También incluir 127.0.0.1 equivalents
const parseAllowedOrigins = (): string[] => {
  const envOrigins = process.env.FRONTEND_ORIGIN;
  
  if (!envOrigins || envOrigins.trim() === "") {
    return [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://127.0.0.1:5173",
    ];
  }
  
  return envOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

const allowedOrigins = parseAllowedOrigins();

// Middleware CORS propio sin librería externa
// Setea headers en TODOS los requests (OPTIONS y POST/GET/etc)
export const corsMiddleware: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;

  // Si no hay origin (curl, REST Client, etc), permitir
  if (!origin) {
    return next();
  }

  // Verificar si el origin está permitido
  if (!allowedOrigins.includes(origin)) {
    console.warn(`CORS blocked: ${origin}. Allowed: ${allowedOrigins.join(", ")}`);
    return res.status(403).json({ error: "CORS blocked" });
  }

  // Origin permitido: setear headers CORS en TODOS los requests
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Preflight OPTIONS: responder 204 inmediatamente
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
};

