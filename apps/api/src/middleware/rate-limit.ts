import rateLimit from "express-rate-limit";

/** Applied to free discovery endpoints per CLAUDE.md section 51. */
export const discoveryRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
