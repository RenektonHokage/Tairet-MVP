import { z } from "zod";

export const accessCheckinTokenParamsSchema = z
  .object({
    token: z.preprocess(
      (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
      z.string().uuid("invalid_checkin_token")
    ),
  })
  .strict();

export type AccessCheckinTokenParams = z.infer<typeof accessCheckinTokenParamsSchema>;
