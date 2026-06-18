import { z } from "zod";

const ACCESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const trimmedText = z.string().transform((value) => value.trim());
const nonEmptyText = trimmedText.refine((value) => value.length > 0, {
  message: "invalid_request",
});

const buyerSchema = z
  .object({
    name: nonEmptyText,
    last_name: nonEmptyText,
    email: nonEmptyText.refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: "invalid_request",
    }),
    phone: nonEmptyText,
    document: nonEmptyText,
  })
  .strict();

const accessItemSchema = z
  .object({
    access_ticket_type_id: nonEmptyText.pipe(z.string().uuid("invalid_request")),
    quantity: z
      .number()
      .int("invalid_request")
      .min(1, "invalid_request")
      .max(10, "quantity_limit_exceeded"),
  })
  .strict();

export const accessBancardSingleBuySchema = z
  .object({
    source_type: z.enum(["local", "event"], {
      errorMap: () => ({ message: "invalid_request" }),
    }),
    local_id: z.string().uuid("invalid_request").nullable().optional(),
    event_id: z.string().uuid("invalid_request").nullable().optional(),
    access_date: z.string().regex(ACCESS_DATE_PATTERN, "invalid_request"),
    buyer: buyerSchema,
    items: z.array(accessItemSchema).min(1, "invalid_request"),
    idempotency_key: trimmedText.refine((value) => value.length >= 8 && value.length <= 128, {
      message: "invalid_request",
    }),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      (value.source_type === "local" && (!value.local_id || value.event_id)) ||
      (value.source_type === "event" && (!value.event_id || value.local_id))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "invalid_request",
        path: ["source_type"],
      });
    }

    const ticketIds = new Set<string>();
    let totalQuantity = 0;

    for (const item of value.items) {
      if (ticketIds.has(item.access_ticket_type_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "invalid_request",
          path: ["items"],
        });
        continue;
      }

      ticketIds.add(item.access_ticket_type_id);
      totalQuantity += item.quantity;
    }

    if (ticketIds.size > 10 || totalQuantity > 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "quantity_limit_exceeded",
        path: ["items"],
      });
    }
  });

export type AccessBancardSingleBuyInput = z.infer<typeof accessBancardSingleBuySchema>;

export function accessBancardSingleBuyErrorCode(error: z.ZodError): "invalid_request" | "quantity_limit_exceeded" {
  return error.issues.some((issue) => issue.message === "quantity_limit_exceeded")
    ? "quantity_limit_exceeded"
    : "invalid_request";
}
