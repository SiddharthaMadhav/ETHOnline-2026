import { z } from "zod";

export const publisherSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  domain: z.string().optional(),
  description: z.string().optional(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
});

export type Publisher = z.infer<typeof publisherSchema>;

export const placementFormatSchema = z.enum(["card", "banner", "text"]);
export type PlacementFormat = z.infer<typeof placementFormatSchema>;

export const placementSchema = z.object({
  id: z.string(),
  publisherId: z.string(),
  slug: z.string(),
  name: z.string(),
  format: placementFormatSchema,
  description: z.string().optional(),
  active: z.boolean(),
});

export type Placement = z.infer<typeof placementSchema>;
