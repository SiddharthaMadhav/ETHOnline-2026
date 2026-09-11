import type { ErrorRequestHandler, Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED_PUBLISHER",
  "INTENT_NOT_FOUND",
  "INTENT_EXPIRED",
  "INTENT_REVOKED",
  "CAMPAIGN_NOT_FOUND",
  "CAMPAIGN_INACTIVE",
  "OPPORTUNITY_NOT_FOUND",
  "OPPORTUNITY_EXPIRED",
  "OPPORTUNITY_CONSUMED",
  "BUDGET_EXCEEDED",
  "IDEMPOTENCY_CONFLICT",
  "PAYMENT_METADATA_MISSING",
  "DELIVERY_NOT_FOUND",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const STATUS_BY_CODE: Partial<Record<ErrorCode, number>> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED_PUBLISHER: 401,
  INTENT_NOT_FOUND: 404,
  INTENT_EXPIRED: 410,
  INTENT_REVOKED: 410,
  CAMPAIGN_NOT_FOUND: 404,
  CAMPAIGN_INACTIVE: 409,
  OPPORTUNITY_NOT_FOUND: 404,
  OPPORTUNITY_EXPIRED: 410,
  OPPORTUNITY_CONSUMED: 409,
  BUDGET_EXCEEDED: 402,
  IDEMPOTENCY_CONFLICT: 409,
  PAYMENT_METADATA_MISSING: 502,
  DELIVERY_NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = STATUS_BY_CODE[code] ?? 500;
    this.details = details;
  }
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    error: { code: "INTERNAL_ERROR", message: "Not found" },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details ?? {} },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: { issues: err.issues },
      },
    });
    return;
  }

  console.error("Unhandled API error:", err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  });
};
