import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/httpError";

/**
 * Centralized error middleware. MUST be the last `app.use()` call in
 * src/index.ts so it catches errors from every route.
 *
 * Response shape (stable across the app):
 *   { error: { code: "STRING_CODE", message: "human readable" } }
 *
 * Logging:
 *   - ZodError: logs every field-level issue to stderr with method+path
 *     so `tool_get_error_logs` can surface them in the AI fix-loop. Without
 *     this, 400 responses are silent at the log layer and the AI keeps
 *     regenerating the same broken schema.
 *   - HttpError: logs the deliberate failure (4xx/5xx) at warn level.
 *   - Unknown: logs full stack at error level, redacts the response.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    // Surface every field-level failure so the AI fix-loop sees the
    // actual issue (not just "400"). One log line per issue keeps grep-ability.
    for (const issue of err.errors) {
      const path = (issue.path ?? []).join(".") || "<root>";
      const code = (issue as any).code || "invalid";
      const validation = (issue as any).validation || "";
      console.error(
        `[validation-error] ${req.method} ${req.originalUrl} field=${path} code=${code}${validation ? ` validation=${validation}` : ""} message="${issue.message}"`,
      );
    }
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.errors,
      },
    });
    return;
  }

  if (err instanceof HttpError) {
    console.warn(
      `[http-error] ${req.method} ${req.originalUrl} status=${err.status} code=${err.code} message="${err.message}"`,
    );
    res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // Unknown error — log full detail server-side, redact in response.
  const e = err as Error;
  console.error(`[error] ${req.method} ${req.originalUrl}`, e?.stack || e);
  res.status(500).json({
    error: { code: "INTERNAL", message: "Internal server error" },
  });
}
