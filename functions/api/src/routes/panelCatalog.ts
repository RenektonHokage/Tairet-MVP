import { Router } from "express";
import { panelAuth } from "../middlewares/panelAuth";
import { requireRole } from "../middlewares/requireRole";
import { supabase } from "../services/supabase";
import { logger } from "../utils/logger";

export const panelCatalogRouter = Router();

const MAX_TICKET_TYPES = 4;
const MAX_ACTIVE_TICKETS = 2;
const MAX_TABLE_TYPES = 6;

async function verifyClubOnly(localId: string): Promise<{ isClub: boolean; error?: string }> {
  const { data: local, error } = await supabase
    .from("locals")
    .select("type")
    .eq("id", localId)
    .single();

  if (error || !local) {
    return { isClub: false, error: "Local no encontrado" };
  }

  if (local.type !== "club") {
    return { isClub: false, error: "Solo discotecas pueden gestionar catálogo de entradas y mesas" };
  }

  return { isClub: true };
}

async function hasTicketSales(localId: string, ticketId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("local_id", localId)
    .contains("items", [{ kind: "ticket", ticket_type_id: ticketId }]);

  if (error) {
    logger.error("Error checking ticket sales", { error: error.message, ticketId });
    return true;
  }

  return (count ?? 0) > 0;
}

async function countActiveTickets(localId: string): Promise<number> {
  const { count, error } = await supabase
    .from("ticket_types")
    .select("id", { count: "exact", head: true })
    .eq("local_id", localId)
    .eq("is_active", true);

  if (error) {
    logger.error("Error counting active tickets", { error: error.message });
    return 0;
  }

  return count ?? 0;
}

panelCatalogRouter.get(
  "/tickets",
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { isClub, error: clubError } = await verifyClubOnly(req.panelUser.localId);
      if (!isClub) {
        return res.status(403).json({ error: clubError });
      }

      const { data: tickets, error } = await supabase
        .from("ticket_types")
        .select("id, name, price, description, is_active, sort_order, created_at, updated_at")
        .eq("local_id", req.panelUser.localId)
        .order("price", { ascending: true })
        .order("sort_order", { ascending: true });

      if (error) {
        logger.error("Error fetching ticket types", { error: error.message });
        return res.status(500).json({ error: "Error al obtener entradas" });
      }

      const normalizedTickets = (tickets ?? []).map((ticket) => ({
        ...ticket,
        price: Number(ticket.price),
      }));

      res.status(200).json({ tickets: normalizedTickets });
    } catch (error) {
      next(error);
    }
  }
);

panelCatalogRouter.post(
  "/tickets",
  panelAuth,
  requireRole(["owner"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { isClub, error: clubError } = await verifyClubOnly(req.panelUser.localId);
      if (!isClub) {
        return res.status(403).json({ error: clubError });
      }

      const { count, error: countError } = await supabase
        .from("ticket_types")
        .select("id", { count: "exact", head: true })
        .eq("local_id", req.panelUser.localId);

      if (countError) {
        logger.error("Error counting ticket types", { error: countError.message });
        return res.status(500).json({ error: "Error al verificar límite" });
      }

      if ((count ?? 0) >= MAX_TICKET_TYPES) {
        return res.status(400).json({
          error: `Máximo ${MAX_TICKET_TYPES} tipos de entrada permitidos. Elimina uno existente si necesitas agregar otro.`,
        });
      }

      const { name, price, description, is_active } = req.body;
      const willBeActive = is_active !== false;

      if (willBeActive) {
        const activeCount = await countActiveTickets(req.panelUser.localId);
        if (activeCount >= MAX_ACTIVE_TICKETS) {
          return res.status(400).json({
            error: `Máximo ${MAX_ACTIVE_TICKETS} entradas activas simultáneamente. Desactiva una antes de crear otra activa.`,
          });
        }
      }

      if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
        return res.status(400).json({ error: "El nombre debe tener entre 2 y 100 caracteres" });
      }

      const priceNum = typeof price === "string" ? parseFloat(price) : price;
      if (typeof priceNum !== "number" || isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: "El precio debe ser un número mayor o igual a 0" });
      }

      const descTrimmed = typeof description === "string" ? description.trim() : null;
      if (descTrimmed && descTrimmed.length > 500) {
        return res.status(400).json({ error: "La descripción no puede superar 500 caracteres" });
      }

      const { data: maxOrder } = await supabase
        .from("ticket_types")
        .select("sort_order")
        .eq("local_id", req.panelUser.localId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();

      const nextOrder = (maxOrder?.sort_order ?? -1) + 1;

      const { data: ticket, error: insertError } = await supabase
        .from("ticket_types")
        .insert({
          local_id: req.panelUser.localId,
          name: name.trim(),
          price: priceNum,
          description: descTrimmed || null,
          is_active: willBeActive,
          sort_order: nextOrder,
        })
        .select()
        .single();

      if (insertError) {
        logger.error("Error creating ticket type", { error: insertError.message });
        return res.status(500).json({ error: "Error al crear entrada" });
      }

      res.status(201).json({
        ticket: { ...ticket, price: Number(ticket.price) },
      });
    } catch (error) {
      next(error);
    }
  }
);

panelCatalogRouter.patch(
  "/tickets/:id",
  panelAuth,
  requireRole(["owner"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const { isClub, error: clubError } = await verifyClubOnly(req.panelUser.localId);
      if (!isClub) {
        return res.status(403).json({ error: clubError });
      }

      const { data: existing, error: fetchError } = await supabase
        .from("ticket_types")
        .select("id, local_id, is_active")
        .eq("id", id)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ error: "Entrada no encontrada" });
      }

      if (existing.local_id !== req.panelUser.localId) {
        return res.status(403).json({ error: "No tienes permiso para editar esta entrada" });
      }

      const { name, price, description, is_active, sort_order } = req.body;
      const wantsToChangeName = name !== undefined;
      const wantsToChangePrice = price !== undefined;

      if (wantsToChangeName || wantsToChangePrice) {
        const sales = await hasTicketSales(req.panelUser.localId, id);
        if (sales) {
          return res.status(409).json({
            error: "No se puede modificar nombre o precio de una entrada que ya tuvo ventas. Solo podés activar/desactivar.",
          });
        }
      }

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (wantsToChangeName) {
        if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
          return res.status(400).json({ error: "El nombre debe tener entre 2 y 100 caracteres" });
        }
        updateData.name = name.trim();
      }

      if (wantsToChangePrice) {
        const priceNum = typeof price === "string" ? parseFloat(price) : price;
        if (typeof priceNum !== "number" || isNaN(priceNum) || priceNum < 0) {
          return res.status(400).json({ error: "El precio debe ser un número mayor o igual a 0" });
        }
        updateData.price = priceNum;
      }

      if (description !== undefined) {
        const descTrimmed = typeof description === "string" ? description.trim() : null;
        if (descTrimmed && descTrimmed.length > 500) {
          return res.status(400).json({ error: "La descripción no puede superar 500 caracteres" });
        }
        updateData.description = descTrimmed || null;
      }

      if (is_active !== undefined) {
        if (typeof is_active !== "boolean") {
          return res.status(400).json({ error: "is_active debe ser un booleano" });
        }

        if (is_active === true && existing.is_active === false) {
          const activeCount = await countActiveTickets(req.panelUser.localId);
          if (activeCount >= MAX_ACTIVE_TICKETS) {
            return res.status(400).json({
              error: `Máximo ${MAX_ACTIVE_TICKETS} entradas activas simultáneamente. Desactiva una antes de activar otra.`,
            });
          }
        }

        updateData.is_active = is_active;
      }

      if (sort_order !== undefined) {
        const orderNum = typeof sort_order === "string" ? parseInt(sort_order, 10) : sort_order;
        if (typeof orderNum !== "number" || isNaN(orderNum) || orderNum < 0) {
          return res.status(400).json({ error: "sort_order debe ser un número mayor o igual a 0" });
        }
        updateData.sort_order = orderNum;
      }

      const { data: ticket, error: updateError } = await supabase
        .from("ticket_types")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        logger.error("Error updating ticket type", { error: updateError.message });
        return res.status(500).json({ error: "Error al actualizar entrada" });
      }

      res.status(200).json({
        ticket: { ...ticket, price: Number(ticket.price) },
      });
    } catch (error) {
      next(error);
    }
  }
);

panelCatalogRouter.delete(
  "/tickets/:id",
  panelAuth,
  requireRole(["owner"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const { isClub, error: clubError } = await verifyClubOnly(req.panelUser.localId);
      if (!isClub) {
        return res.status(403).json({ error: clubError });
      }

      const { data: existing, error: fetchError } = await supabase
        .from("ticket_types")
        .select("id, local_id, name")
        .eq("id", id)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ error: "Entrada no encontrada" });
      }

      if (existing.local_id !== req.panelUser.localId) {
        return res.status(403).json({ error: "No tienes permiso para eliminar esta entrada" });
      }

      const sales = await hasTicketSales(req.panelUser.localId, id);
      if (sales) {
        return res.status(409).json({
          error: `No se puede eliminar "${existing.name}" porque ya tuvo ventas. Desactívala (is_active=false) en lugar de eliminarla.`,
        });
      }

      const { error: deleteError } = await supabase
        .from("ticket_types")
        .delete()
        .eq("id", id)
        .eq("local_id", req.panelUser.localId);

      if (deleteError) {
        logger.error("Error deleting ticket type", { error: deleteError.message });
        return res.status(500).json({ error: "Error al eliminar entrada" });
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

panelCatalogRouter.get(
  "/tables",
  panelAuth,
  requireRole(["owner", "staff"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { isClub, error: clubError } = await verifyClubOnly(req.panelUser.localId);
      if (!isClub) {
        return res.status(403).json({ error: clubError });
      }

      const { data: tables, error } = await supabase
        .from("table_types")
        .select("id, name, price, capacity, includes, is_active, sort_order, created_at, updated_at")
        .eq("local_id", req.panelUser.localId)
        .order("price", { ascending: true, nullsFirst: false })
        .order("sort_order", { ascending: true });

      if (error) {
        logger.error("Error fetching table types", { error: error.message });
        return res.status(500).json({ error: "Error al obtener mesas" });
      }

      const normalizedTables = (tables ?? []).map((table) => ({
        ...table,
        price: table.price !== null ? Number(table.price) : null,
      }));

      res.status(200).json({ tables: normalizedTables });
    } catch (error) {
      next(error);
    }
  }
);

panelCatalogRouter.post(
  "/tables",
  panelAuth,
  requireRole(["owner"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { isClub, error: clubError } = await verifyClubOnly(req.panelUser.localId);
      if (!isClub) {
        return res.status(403).json({ error: clubError });
      }

      const { count, error: countError } = await supabase
        .from("table_types")
        .select("id", { count: "exact", head: true })
        .eq("local_id", req.panelUser.localId);

      if (countError) {
        logger.error("Error counting table types", { error: countError.message });
        return res.status(500).json({ error: "Error al verificar límite" });
      }

      if ((count ?? 0) >= MAX_TABLE_TYPES) {
        return res.status(400).json({
          error: `Máximo ${MAX_TABLE_TYPES} tipos de mesa permitidos. Desactiva una existente si necesitas agregar otra.`,
        });
      }

      const { name, price, capacity, includes } = req.body;

      if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
        return res.status(400).json({ error: "El nombre debe tener entre 2 y 100 caracteres" });
      }

      let priceNum: number | null = null;
      if (price !== undefined && price !== null && price !== "") {
        priceNum = typeof price === "string" ? parseFloat(price) : price;
        if (typeof priceNum !== "number" || isNaN(priceNum) || priceNum < 0) {
          return res.status(400).json({ error: "El precio debe ser un número mayor o igual a 0" });
        }
      }

      let capacityNum: number | null = null;
      if (capacity !== undefined && capacity !== null && capacity !== "") {
        capacityNum = typeof capacity === "string" ? parseInt(capacity, 10) : capacity;
        if (typeof capacityNum !== "number" || isNaN(capacityNum) || capacityNum < 1 || capacityNum > 50) {
          return res.status(400).json({ error: "La capacidad debe ser un número entre 1 y 50" });
        }
      }

      const includesTrimmed = typeof includes === "string" ? includes.trim() : null;
      if (includesTrimmed && includesTrimmed.length > 500) {
        return res.status(400).json({ error: "La descripción de incluye no puede superar 500 caracteres" });
      }

      const { data: maxOrder } = await supabase
        .from("table_types")
        .select("sort_order")
        .eq("local_id", req.panelUser.localId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();

      const nextOrder = (maxOrder?.sort_order ?? -1) + 1;

      const { data: table, error: insertError } = await supabase
        .from("table_types")
        .insert({
          local_id: req.panelUser.localId,
          name: name.trim(),
          price: priceNum,
          capacity: capacityNum,
          includes: includesTrimmed || null,
          is_active: true,
          sort_order: nextOrder,
        })
        .select()
        .single();

      if (insertError) {
        logger.error("Error creating table type", { error: insertError.message });
        return res.status(500).json({ error: "Error al crear mesa" });
      }

      res.status(201).json({ table });
    } catch (error) {
      next(error);
    }
  }
);

panelCatalogRouter.patch(
  "/tables/:id",
  panelAuth,
  requireRole(["owner"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const { isClub, error: clubError } = await verifyClubOnly(req.panelUser.localId);
      if (!isClub) {
        return res.status(403).json({ error: clubError });
      }

      const { data: existing, error: fetchError } = await supabase
        .from("table_types")
        .select("id, local_id")
        .eq("id", id)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ error: "Mesa no encontrada" });
      }

      if (existing.local_id !== req.panelUser.localId) {
        return res.status(403).json({ error: "No tienes permiso para editar esta mesa" });
      }

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const { name, price, capacity, includes, is_active, sort_order } = req.body;

      if (name !== undefined) {
        if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
          return res.status(400).json({ error: "El nombre debe tener entre 2 y 100 caracteres" });
        }
        updateData.name = name.trim();
      }

      if (price !== undefined) {
        if (price === null || price === "") {
          updateData.price = null;
        } else {
          const priceNum = typeof price === "string" ? parseFloat(price) : price;
          if (typeof priceNum !== "number" || isNaN(priceNum) || priceNum < 0) {
            return res.status(400).json({ error: "El precio debe ser un número mayor o igual a 0" });
          }
          updateData.price = priceNum;
        }
      }

      if (capacity !== undefined) {
        if (capacity === null || capacity === "") {
          updateData.capacity = null;
        } else {
          const capacityNum = typeof capacity === "string" ? parseInt(capacity, 10) : capacity;
          if (typeof capacityNum !== "number" || isNaN(capacityNum) || capacityNum < 1 || capacityNum > 50) {
            return res.status(400).json({ error: "La capacidad debe ser un número entre 1 y 50" });
          }
          updateData.capacity = capacityNum;
        }
      }

      if (includes !== undefined) {
        const includesTrimmed = typeof includes === "string" ? includes.trim() : null;
        if (includesTrimmed && includesTrimmed.length > 500) {
          return res.status(400).json({ error: "La descripción de incluye no puede superar 500 caracteres" });
        }
        updateData.includes = includesTrimmed || null;
      }

      if (is_active !== undefined) {
        if (typeof is_active !== "boolean") {
          return res.status(400).json({ error: "is_active debe ser un booleano" });
        }
        updateData.is_active = is_active;
      }

      if (sort_order !== undefined) {
        const orderNum = typeof sort_order === "string" ? parseInt(sort_order, 10) : sort_order;
        if (typeof orderNum !== "number" || isNaN(orderNum) || orderNum < 0) {
          return res.status(400).json({ error: "sort_order debe ser un número mayor o igual a 0" });
        }
        updateData.sort_order = orderNum;
      }

      const { data: table, error: updateError } = await supabase
        .from("table_types")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        logger.error("Error updating table type", { error: updateError.message });
        return res.status(500).json({ error: "Error al actualizar mesa" });
      }

      res.status(200).json({ table });
    } catch (error) {
      next(error);
    }
  }
);

panelCatalogRouter.delete(
  "/tables/:id",
  panelAuth,
  requireRole(["owner"]),
  async (req, res, next) => {
    try {
      if (!req.panelUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const { isClub, error: clubError } = await verifyClubOnly(req.panelUser.localId);
      if (!isClub) {
        return res.status(403).json({ error: clubError });
      }

      const { data, error: deleteError } = await supabase
        .from("table_types")
        .delete()
        .eq("id", id)
        .eq("local_id", req.panelUser.localId)
        .select("id")
        .single();

      if (deleteError) {
        if (deleteError.code === "PGRST116") {
          return res.status(404).json({ error: "Mesa no encontrada" });
        }
        logger.error("Error deleting table type", { error: deleteError.message });
        return res.status(500).json({ error: "Error al eliminar mesa" });
      }

      if (!data) {
        return res.status(404).json({ error: "Mesa no encontrada" });
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);
