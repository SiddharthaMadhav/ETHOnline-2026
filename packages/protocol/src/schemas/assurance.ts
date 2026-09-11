import { z } from "zod";

/** Optional publisher-supplied assurance metadata (CLAUDE.md section 2.4). */
export const assuranceSchema = z.object({
  type: z.string().min(1),
  provider: z.string().min(1),
  level: z.string().optional(),
  issuedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type Assurance = z.infer<typeof assuranceSchema>;
