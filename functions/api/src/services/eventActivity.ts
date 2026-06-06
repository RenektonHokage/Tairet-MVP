import { supabase } from "./supabase";
import { logger } from "../utils/logger";

export const EVENT_ACTIVITY_SOURCES = [
  "qr",
  "manual",
  "automatic_email",
  "manual_email",
  "system",
] as const;

export const EVENT_ACTIVITY_ACTIONS = [
  "event_order_manual_issued",
  "event_entry_issued",
  "event_entry_email_sent",
  "event_entry_email_failed",
  "event_entry_checked_in",
  "event_entry_already_used_attempt",
  "event_entry_outside_window_attempt",
  "event_entry_voided_attempt",
  "event_entry_invalid_token_attempt",
] as const;

export const EVENT_ACTIVITY_ENTITY_TYPES = [
  "event_order",
  "event_order_entry",
  "event_email",
  "event_checkin",
] as const;

export type EventActivitySource = (typeof EVENT_ACTIVITY_SOURCES)[number];
export type EventActivityAction = (typeof EVENT_ACTIVITY_ACTIONS)[number];
export type EventActivityEntityType = (typeof EVENT_ACTIVITY_ENTITY_TYPES)[number];
export type EventActivityActorRole = "owner" | "staff";

export type EventActivityActor =
  | {
      type: "event_panel_user";
      authUserId: string;
      role: EventActivityActorRole;
      displayName?: string | null;
    }
  | {
      type: "system";
      displayName?: string | null;
    };

export interface RecordEventActivityInput {
  eventId: string;
  action: EventActivityAction;
  entityType: EventActivityEntityType;
  entityId?: string | null;
  source?: EventActivitySource | null;
  actor: EventActivityActor;
  message: string;
  eventOrderId?: string | null;
  eventOrderItemId?: string | null;
  eventOrderEntryId?: string | null;
  eventTicketTypeId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export type RecordEventActivityResult =
  | { ok: true; id: string | null }
  | { ok: false; error: "invalid_event_activity_input" | "event_activity_insert_failed" | "event_activity_unexpected_error" };

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = Record<string, JsonValue>;

interface ValidatedEventActivityInput {
  eventId: string;
  action: EventActivityAction;
  entityType: EventActivityEntityType;
  entityId: string | null;
  source: EventActivitySource | null;
  actorType: "event_panel_user" | "system";
  actorAuthUserId: string | null;
  actorRole: EventActivityActorRole | null;
  actorDisplayName: string | null;
  message: string;
  eventOrderId: string | null;
  eventOrderItemId: string | null;
  eventOrderEntryId: string | null;
  eventTicketTypeId: string | null;
  metadata: JsonRecord;
}

const FORBIDDEN_METADATA_KEYS = new Set([
  "checkintoken",
  "token",
  "accesstoken",
  "refreshtoken",
  "qrpayload",
  "qrbase64",
  "rawurl",
  "scannedurl",
  "request",
  "response",
  "headers",
  "body",
  "stack",
  "resendresponse",
  "buyeremail",
  "buyerphone",
  "buyerdocument",
  "attendeeemail",
  "attendeephone",
  "attendeedocument",
  "actorauthuserid",
  "authuserid",
  "createdbyauthuserid",
  "usedbyauthuserid",
  "localid",
  "metadata",
  "source",
]);

const MAX_METADATA_KEYS = 50;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 500;
const MAX_METADATA_DEPTH = 2;
const MAX_DISPLAY_NAME_LENGTH = 80;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isAllowedSource(value: unknown): value is EventActivitySource {
  return typeof value === "string" && EVENT_ACTIVITY_SOURCES.includes(value as EventActivitySource);
}

function isAllowedAction(value: unknown): value is EventActivityAction {
  return typeof value === "string" && EVENT_ACTIVITY_ACTIONS.includes(value as EventActivityAction);
}

function isAllowedEntityType(value: unknown): value is EventActivityEntityType {
  return typeof value === "string" && EVENT_ACTIVITY_ENTITY_TYPES.includes(value as EventActivityEntityType);
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeDisplayName(value: unknown): string | null {
  const trimmed = normalizeOptionalString(value);
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, MAX_DISPLAY_NAME_LENGTH);
}

function normalizeMetadataValue(value: unknown, depth: number): JsonValue | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) : value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_METADATA_DEPTH) {
      return undefined;
    }

    const normalized = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => normalizeMetadataValue(item, depth + 1))
      .filter((item): item is JsonValue => item !== undefined);

    return normalized;
  }

  if (isPlainObject(value)) {
    if (depth >= MAX_METADATA_DEPTH) {
      return undefined;
    }

    const normalized: JsonRecord = {};
    for (const [key, nestedValue] of Object.entries(value).slice(0, MAX_METADATA_KEYS)) {
      if (FORBIDDEN_METADATA_KEYS.has(normalizeKey(key))) {
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

function sanitizeEventActivityMetadata(metadata: unknown): JsonRecord {
  if (!isPlainObject(metadata)) {
    return {};
  }

  const sanitized: JsonRecord = {};
  for (const [key, value] of Object.entries(metadata).slice(0, MAX_METADATA_KEYS)) {
    if (FORBIDDEN_METADATA_KEYS.has(normalizeKey(key))) {
      continue;
    }

    const sanitizedValue = normalizeMetadataValue(value, 0);
    if (sanitizedValue !== undefined) {
      sanitized[key] = sanitizedValue;
    }
  }

  return sanitized;
}

function validateRecordEventActivityInput(input: unknown): ValidatedEventActivityInput | null {
  if (!isPlainObject(input)) {
    return null;
  }

  const eventId = normalizeOptionalString(input.eventId);
  const message = normalizeOptionalString(input.message);

  if (!eventId || !message || !isAllowedAction(input.action) || !isAllowedEntityType(input.entityType)) {
    return null;
  }

  if (input.source !== null && input.source !== undefined && !isAllowedSource(input.source)) {
    return null;
  }

  const eventOrderId = normalizeOptionalString(input.eventOrderId);
  const eventOrderItemId = normalizeOptionalString(input.eventOrderItemId);
  const eventOrderEntryId = normalizeOptionalString(input.eventOrderEntryId);
  const eventTicketTypeId = normalizeOptionalString(input.eventTicketTypeId);
  const entityId = normalizeOptionalString(input.entityId);

  const relationIds = [eventOrderId, eventOrderItemId, eventOrderEntryId, eventTicketTypeId, entityId];
  if (
    relationIds.some((value) => value !== null && value.length === 0)
  ) {
    return null;
  }

  if (!isPlainObject(input.actor)) {
    return null;
  }

  const actor = input.actor;

  if (actor.type === "event_panel_user") {
    const actorAuthUserId = normalizeOptionalString(actor.authUserId);
    if (!actorAuthUserId || (actor.role !== "owner" && actor.role !== "staff")) {
      return null;
    }

    return {
      eventId,
      action: input.action,
      entityType: input.entityType,
      entityId,
      source: input.source ?? null,
      actorType: "event_panel_user",
      actorAuthUserId,
      actorRole: actor.role,
      actorDisplayName: normalizeDisplayName(actor.displayName),
      message,
      eventOrderId,
      eventOrderItemId,
      eventOrderEntryId,
      eventTicketTypeId,
      metadata: sanitizeEventActivityMetadata(input.metadata),
    };
  }

  if (actor.type === "system") {
    if (actor.authUserId !== undefined || actor.role !== undefined) {
      return null;
    }

    return {
      eventId,
      action: input.action,
      entityType: input.entityType,
      entityId,
      source: input.source ?? null,
      actorType: "system",
      actorAuthUserId: null,
      actorRole: null,
      actorDisplayName: normalizeDisplayName(actor.displayName),
      message,
      eventOrderId,
      eventOrderItemId,
      eventOrderEntryId,
      eventTicketTypeId,
      metadata: sanitizeEventActivityMetadata(input.metadata),
    };
  }

  return null;
}

export async function recordEventActivity(input: RecordEventActivityInput): Promise<RecordEventActivityResult> {
  const validated = validateRecordEventActivityInput(input);

  if (!validated) {
    const inputRecord: Record<string, unknown> = isPlainObject(input) ? input : {};

    logger.warn("Skipping invalid event activity input", {
      eventId: normalizeOptionalString(inputRecord.eventId) ?? undefined,
      action: typeof inputRecord.action === "string" ? inputRecord.action : undefined,
      entityType: typeof inputRecord.entityType === "string" ? inputRecord.entityType : undefined,
      source: typeof inputRecord.source === "string" ? inputRecord.source : undefined,
    });

    return { ok: false, error: "invalid_event_activity_input" };
  }

  try {
    const { data, error } = await supabase
      .from("event_activity_events")
      .insert({
        event_id: validated.eventId,
        event_order_id: validated.eventOrderId,
        event_order_item_id: validated.eventOrderItemId,
        event_order_entry_id: validated.eventOrderEntryId,
        event_ticket_type_id: validated.eventTicketTypeId,
        entity_type: validated.entityType,
        entity_id: validated.entityId,
        action: validated.action,
        source: validated.source,
        actor_type: validated.actorType,
        actor_auth_user_id: validated.actorAuthUserId,
        actor_role: validated.actorRole,
        actor_display_name: validated.actorDisplayName,
        message: validated.message,
        metadata: validated.metadata,
      })
      .select("id")
      .single();

    if (error) {
      logger.warn("Failed to record event activity", {
        eventId: validated.eventId,
        action: validated.action,
        entityType: validated.entityType,
        source: validated.source ?? undefined,
        errorCode: error.code ?? "supabase_error",
      });

      return { ok: false, error: "event_activity_insert_failed" };
    }

    return { ok: true, id: typeof data?.id === "string" ? data.id : null };
  } catch {
    logger.warn("Unexpected error recording event activity", {
      eventId: validated.eventId,
      action: validated.action,
      entityType: validated.entityType,
      source: validated.source ?? undefined,
      errorCode: "event_activity_unexpected_error",
    });

    return { ok: false, error: "event_activity_unexpected_error" };
  }
}
