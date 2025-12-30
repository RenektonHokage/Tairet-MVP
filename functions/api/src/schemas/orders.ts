import { z } from "zod";

export const createOrderSchema = z
  .object({
    local_id: z.string().uuid(),
    quantity: z.number().int().min(1),
    total_amount: z.number().min(0), // Permitir 0, validacion condicional abajo
    currency: z.string().default("PYG"),
    payment_method: z.literal("free_pass").optional(),
    customer_email: z.string().email().optional(),
    customer_name: z.string().optional(),
    customer_last_name: z.string().optional(),
    customer_phone: z.string().optional(),
    customer_document: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Si total_amount es 0, payment_method DEBE ser "free_pass"
    if (data.total_amount === 0 && data.payment_method !== "free_pass") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "total_amount=0 is only allowed with payment_method='free_pass'",
        path: ["total_amount"],
      });
    }
    // Si total_amount > 0, no puede ser free_pass
    if (data.total_amount > 0 && data.payment_method === "free_pass") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "free_pass requires total_amount=0",
        path: ["payment_method"],
      });
    }

    // Si es free_pass, campos de cliente son obligatorios
    if (data.payment_method === "free_pass") {
      if (!data.customer_email) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "customer_email is required for free_pass",
          path: ["customer_email"],
        });
      }
      if (!data.customer_name?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "customer_name is required for free_pass",
          path: ["customer_name"],
        });
      }
      if (!data.customer_last_name?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "customer_last_name is required for free_pass",
          path: ["customer_last_name"],
        });
      }
      if (!data.customer_phone?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "customer_phone is required for free_pass",
          path: ["customer_phone"],
        });
      }
      if (!data.customer_document?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "customer_document is required for free_pass",
          path: ["customer_document"],
        });
      }
    }
  });

export type OrderCreate = z.infer<typeof createOrderSchema>;
