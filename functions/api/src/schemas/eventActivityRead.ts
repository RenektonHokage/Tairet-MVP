import { z } from "zod";

const EVENT_ACTIVITY_ACTIONS = [
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

const EVENT_ACTIVITY_SOURCES = [
  "qr",
  "manual",
  "automatic_email",
  "manual_email",
  "system",
] as const;

const EVENT_ACTIVITY_ENTITY_TYPES = [
  "event_order",
  "event_order_entry",
  "event_email",
  "event_checkin",
] as const;

const optionalTrimmedString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (value === undefined) return undefined;
    if (typeof value !== "string") return value;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, schema.optional());

const optionalPositiveInt = (max?: number) =>
  z.preprocess((value) => {
    if (value === undefined) return undefined;
    if (typeof value !== "string") return value;

    const trimmed = value.trim();
    if (!/^[0-9]+$/.test(trimmed)) return Number.NaN;

    return Number(trimmed);
  }, (max ? z.number().int().min(1).max(max) : z.number().int().min(1)).optional());

export const eventActivityReadQuerySchema = z
  .object({
    action: optionalTrimmedString(z.enum(EVENT_ACTIVITY_ACTIONS)),
    source: optionalTrimmedString(z.enum(EVENT_ACTIVITY_SOURCES)),
    entity_type: optionalTrimmedString(z.enum(EVENT_ACTIVITY_ENTITY_TYPES)),
    event_order_id: optionalTrimmedString(z.string().uuid()),
    event_order_entry_id: optionalTrimmedString(z.string().uuid()),
    event_ticket_type_id: optionalTrimmedString(z.string().uuid()),
    page: optionalPositiveInt(),
    page_size: optionalPositiveInt(100),
    sort: optionalTrimmedString(z.enum(["created_at_desc", "created_at_asc"])),
  })
  .strict()
  .transform((query) => ({
    action: query.action,
    source: query.source,
    entity_type: query.entity_type,
    event_order_id: query.event_order_id,
    event_order_entry_id: query.event_order_entry_id,
    event_ticket_type_id: query.event_ticket_type_id,
    page: query.page ?? 1,
    page_size: query.page_size ?? 25,
    sort: query.sort ?? "created_at_desc",
  }));

export type EventActivityReadQuery = z.infer<typeof eventActivityReadQuerySchema>;
