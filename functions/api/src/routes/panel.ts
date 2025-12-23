import { Router } from "express";
import { panelAuth } from "../middlewares/panelAuth";
import { calendarRouter } from "./calendar";

export const panelRouter = Router();

// GET /panel/me
// Endpoint para obtener información del usuario del panel autenticado
// Requiere autenticación (middleware panelAuth)
panelRouter.get("/me", panelAuth, async (req, res) => {
  // req.panelUser está disponible gracias al middleware panelAuth
  if (!req.panelUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.status(200).json({
    local_id: req.panelUser.localId,
    email: req.panelUser.email,
    role: req.panelUser.role,
  });
});

// Rutas de calendario
panelRouter.use("/calendar", calendarRouter);

