import { z } from "zod";

export const poolNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Pool name must be at least 3 characters")
    .max(50, "Pool name must be at most 50 characters"),
});
