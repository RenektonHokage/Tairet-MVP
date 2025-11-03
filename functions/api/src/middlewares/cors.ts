import cors from "cors";

const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

export const corsMiddleware = cors({
  origin: frontendOrigin,
  credentials: true,
});

