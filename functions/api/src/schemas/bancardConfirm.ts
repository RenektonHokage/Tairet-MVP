import { z } from "zod";

const MD5_HEX_PATTERN = /^[0-9a-f]{32}$/i;
const DECIMAL_AMOUNT_PATTERN = /^[0-9]+\.[0-9]{2}$/;

const requiredTrimmedText = z.string().transform((value) => value.trim()).refine(
  (value) => value.length > 0,
  { message: "invalid_request" }
);

const optionalTrimmedText = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((value) => {
    if (value === null || value === undefined) return null;

    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const shopProcessIdSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "invalid_request",
        });
        return z.NEVER;
      }

      return String(value);
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "invalid_request",
      });
      return z.NEVER;
    }

    return trimmed;
  });

const operationSchema = z
  .object({
    token: requiredTrimmedText
      .refine((value) => MD5_HEX_PATTERN.test(value), { message: "invalid_request" })
      .transform((value) => value.toLowerCase()),
    shop_process_id: shopProcessIdSchema,
    amount: requiredTrimmedText.refine((value) => DECIMAL_AMOUNT_PATTERN.test(value), {
      message: "invalid_request",
    }),
    currency: requiredTrimmedText.refine((value) => value === "PYG", {
      message: "invalid_request",
    }),
    response_code: requiredTrimmedText,
    response: optionalTrimmedText,
    response_details: optionalTrimmedText,
    extended_response_description: optionalTrimmedText,
    iva_amount: optionalTrimmedText,
    authorization_number: optionalTrimmedText,
    ticket_number: optionalTrimmedText,
    response_description: optionalTrimmedText,
    security_information: z.unknown().optional(),
    billing_response: z.unknown().optional(),
  })
  .passthrough();

export const bancardConfirmSchema = z
  .object({
    operation: operationSchema,
  })
  .passthrough();

export type BancardConfirmInput = z.infer<typeof bancardConfirmSchema>;
