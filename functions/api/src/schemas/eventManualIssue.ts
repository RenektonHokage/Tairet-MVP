import { z } from "zod";

const nonEmptyTrimmedString = z.string().trim().min(1);

const attendeeSchema = z
  .object({
    name: nonEmptyTrimmedString,
    last_name: nonEmptyTrimmedString,
    email: nonEmptyTrimmedString.email(),
    phone: nonEmptyTrimmedString,
    document: nonEmptyTrimmedString,
  })
  .strict();

const buyerSchema = z
  .object({
    name: nonEmptyTrimmedString,
    last_name: nonEmptyTrimmedString,
    email: nonEmptyTrimmedString.email(),
    phone: nonEmptyTrimmedString,
    document: nonEmptyTrimmedString,
  })
  .strict();

const manualIssueItemSchema = z
  .object({
    ticket_type_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(100),
    attendees: z.array(attendeeSchema).min(1).max(1000),
  })
  .strict();

export const eventManualIssueSchema = z
  .object({
    buyer: buyerSchema,
    items: z.array(manualIssueItemSchema).min(1).max(20),
    notes: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const ticketTypeIds = new Set<string>();

    for (const [index, item] of data.items.entries()) {
      if (ticketTypeIds.has(item.ticket_type_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate ticket_type_id",
          path: ["items", index, "ticket_type_id"],
        });
      }

      ticketTypeIds.add(item.ticket_type_id);
    }
  });

export type EventManualIssueInput = z.infer<typeof eventManualIssueSchema>;
