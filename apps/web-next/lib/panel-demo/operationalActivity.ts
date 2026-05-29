import type { OperationalActivityItem } from "@/lib/activity";

type DemoOrderActivityInput = {
  id: string;
  created_at?: string;
  used_at: string | null;
  checkin_state?: "used" | "pending" | "unused" | "other";
};

type DemoReservationActivityInput = {
  id: string;
  created_at?: string;
  updated_at?: string | null;
  status: "en_revision" | "confirmed" | "cancelled";
  table_note?: string | null;
};

function addMinutes(value: string | undefined | null, minutes: number): string {
  const baseMs = value ? Date.parse(value) : NaN;
  const base = Number.isFinite(baseMs) ? baseMs : Date.now();
  return new Date(base + minutes * 60 * 1000).toISOString();
}

function createActivityItem(
  input: Omit<OperationalActivityItem, "metadata">
): OperationalActivityItem {
  return {
    ...input,
    metadata: {},
  };
}

export function getPanelDemoOrderActivityItems(
  order: DemoOrderActivityInput
): OperationalActivityItem[] {
  const items: OperationalActivityItem[] = [
    createActivityItem({
      id: `${order.id}-activity-created`,
      entity_type: "order",
      entity_id: order.id,
      event_type: "order_created",
      actor_type: "customer",
      actor_role: null,
      actor_label: "Cliente",
      message: "Entrada creada",
      created_at: order.created_at ?? addMinutes(null, -60),
    }),
  ];

  if (order.used_at) {
    items.push(
      createActivityItem({
        id: `${order.id}-activity-validated`,
        entity_type: "order",
        entity_id: order.id,
        event_type: "order_checked_in",
        actor_type: "panel_user",
        actor_role: "staff",
        actor_label: "Staff Martin",
        message: "Entrada validada",
        created_at: order.used_at,
      })
    );
  } else if (order.checkin_state === "unused") {
    items.push(
      createActivityItem({
        id: `${order.id}-activity-unused`,
        entity_type: "order",
        entity_id: order.id,
        event_type: "order_not_used",
        actor_type: "system",
        actor_role: null,
        actor_label: "Sistema",
        message: "Entrada no utilizada",
        created_at: addMinutes(order.created_at, 120),
      })
    );
  }

  return items;
}

export function getPanelDemoReservationActivityItems(
  reservation: DemoReservationActivityInput
): OperationalActivityItem[] {
  const createdAt = reservation.created_at ?? addMinutes(null, -120);
  const updatedAt = reservation.updated_at ?? addMinutes(createdAt, 30);
  const items: OperationalActivityItem[] = [
    createActivityItem({
      id: `${reservation.id}-activity-created`,
      entity_type: "reservation",
      entity_id: reservation.id,
      event_type: "reservation_created",
      actor_type: "customer",
      actor_role: null,
      actor_label: "Cliente",
      message: "Reserva creada",
      created_at: createdAt,
    }),
  ];

  if (reservation.status === "confirmed") {
    items.push(
      createActivityItem({
        id: `${reservation.id}-activity-confirmed`,
        entity_type: "reservation",
        entity_id: reservation.id,
        event_type: "reservation_confirmed",
        actor_type: "panel_user",
        actor_role: "owner",
        actor_label: "Owner Martin",
        message: "Reserva confirmada",
        created_at: addMinutes(createdAt, 18),
      })
    );
  }

  if (reservation.status === "cancelled") {
    items.push(
      createActivityItem({
        id: `${reservation.id}-activity-cancelled`,
        entity_type: "reservation",
        entity_id: reservation.id,
        event_type: "reservation_cancelled",
        actor_type: "panel_user",
        actor_role: "owner",
        actor_label: "Owner Martin",
        message: "Reserva cancelada",
        created_at: addMinutes(createdAt, 18),
      })
    );
  }

  if (reservation.table_note?.trim()) {
    items.push(
      createActivityItem({
        id: `${reservation.id}-activity-table-note`,
        entity_type: "reservation",
        entity_id: reservation.id,
        event_type: "reservation_table_note_updated",
        actor_type: "panel_user",
        actor_role: "staff",
        actor_label: "Staff Martin",
        message: "Nota interna actualizada",
        created_at: updatedAt,
      })
    );
  }

  return items;
}
