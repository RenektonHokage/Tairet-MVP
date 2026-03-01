import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

export function getRequestId(req: Request): string {
  const requestIdHeader = req.headers["x-request-id"];

  if (Array.isArray(requestIdHeader)) {
    const requestId = requestIdHeader[0]?.trim();
    return requestId || "unknown";
  }

  if (typeof requestIdHeader === "string") {
    const requestId = requestIdHeader.trim();
    return requestId || "unknown";
  }

  return "unknown";
}

export function requestId(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const existingRequestId = getRequestId(req);
  const id = existingRequestId === "unknown" ? uuidv4() : existingRequestId;
  req.headers["x-request-id"] = id;
  res.setHeader("x-request-id", id);
  next();
}

