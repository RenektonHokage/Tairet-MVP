import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

export function requestId(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const id = req.headers["x-request-id"] || uuidv4();
  req.headers["x-request-id"] = id as string;
  res.setHeader("x-request-id", id as string);
  next();
}

