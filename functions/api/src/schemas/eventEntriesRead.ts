import { z } from "zod";

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

export const eventEntriesReadQuerySchema = z
  .object({
    q: optionalTrimmedString(z.string().min(2).max(100)),
    ticket_type_id: optionalTrimmedString(z.string().uuid()),
    status: optionalTrimmedString(z.enum(["issued", "voided"])),
    checkin_status: optionalTrimmedString(z.enum(["unused", "used"])),
    page: optionalPositiveInt(),
    page_size: optionalPositiveInt(100),
    sort: optionalTrimmedString(z.enum(["created_at_desc", "created_at_asc"])),
  })
  .strict()
  .transform((query) => ({
    q: query.q,
    ticket_type_id: query.ticket_type_id,
    status: query.status,
    checkin_status: query.checkin_status,
    page: query.page ?? 1,
    page_size: query.page_size ?? 25,
    sort: query.sort ?? "created_at_desc",
  }));

export type EventEntriesReadQuery = z.infer<typeof eventEntriesReadQuerySchema>;
