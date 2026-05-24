import { supabase } from "./supabase";
import { logger } from "../utils/logger";

export type OperationalActivityEntityType = "order" | "reservation";
export type OperationalActivityActorType = "panel_user" | "customer" | "system";
export type OperationalActivityActorRole = "owner" | "staff";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = Record<string, JsonValue>;

export interface RecordOperationalActivityInput {
  localId: string;
  entityType: OperationalActivityEntityType;
  entityId: string;
  eventType: string;
  actorType: OperationalActivityActorType;
  actorUserId?: string | null;
  actorRole?: OperationalActivityActorRole | null;
  message: string;
  metadata?: Record<string, unknown> | null;
  requestId?: string | null;
}

const SENSITIVE_METADATA_KEYS = new Set([
  "checkin_token",
  "token",
  "customer_email",
  "email",
  "customer_phone",
  "phone",
  "telefono",
  "customer_document",
  "document",
  "documento",
  "customer_name",
  "name",
  "customer_last_name",
  "last_name",
  "table_note",
  "notes",
]);

function normalizeMetadataValue(value: unknown, depth = 0): JsonValue | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    if (depth >= 3) {
      return undefined;
    }

    const normalized = value
      .map((item) => normalizeMetadataValue(item, depth + 1))
      .filter((item): item is JsonValue => item !== undefined);

    return normalized;
  }

  if (typeof value === "object") {
    if (depth >= 3) {
      return undefined;
    }

    const normalized: JsonRecord = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_METADATA_KEYS.has(key.toLowerCase())) {
        continue;
      }

      const normalizedValue = normalizeMetadataValue(nestedValue, depth + 1);
      if (normalizedValue !== undefined) {
        normalized[key] = normalizedValue;
      }
    }

    return normalized;
  }

  return undefined;
}

function normalizeMetadata(metadata: Record<string, unknown> | null | undefined): JsonRecord {
  if (!metadata) {
    return {};
  }

  const normalized = normalizeMetadataValue(metadata);
  if (normalized && !Array.isArray(normalized) && typeof normalized === "object") {
    return normalized;
  }

  return {};
}

export async function recordOperationalActivity(
  input: RecordOperationalActivityInput
): Promise<void> {
  try {
    const eventType = input.eventType.trim();
    const message = input.message.trim();

    if (!eventType || !message) {
      logger.warn("Skipping operational activity event with empty type or message", {
        requestId: input.requestId ?? undefined,
        localId: input.localId,
        entityType: input.entityType,
        entityId: input.entityId,
      });
      return;
    }

    const { error } = await supabase
      .from("operational_activity_events")
      .insert({
        local_id: input.localId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        event_type: eventType,
        actor_type: input.actorType,
        actor_user_id: input.actorUserId ?? null,
        actor_role: input.actorRole ?? null,
        message,
        metadata: normalizeMetadata(input.metadata),
      });

    if (error) {
      logger.warn("Failed to record operational activity event", {
        requestId: input.requestId ?? undefined,
        localId: input.localId,
        entityType: input.entityType,
        entityId: input.entityId,
        eventType,
        error: error.message,
      });
    }
  } catch (error) {
    logger.warn("Unexpected error recording operational activity event", {
      requestId: input.requestId ?? undefined,
      localId: input.localId,
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: input.eventType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
