import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { getRequestId } from "./requestId";

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  const requestId = getRequestId(req);

  logger.error("Unhandled request error", {
    requestId,
    method: req.method,
    path: req.originalUrl || req.path,
    statusCode,
    errorName: err.name,
    errorMessage: message,
    ...(statusCode >= 500 && err.stack ? { stack: err.stack } : {}),
  });

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

