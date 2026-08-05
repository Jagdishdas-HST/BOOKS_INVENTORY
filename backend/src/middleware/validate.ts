import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

/**
 * Validate `req.body` against a zod schema. Use as Express middleware:
 *
 *   import { z } from "zod";
 *   const CreateItem = z.object({ title: z.string().min(1) });
 *   app.post("/api/items", validateBody(CreateItem), (req, res) => {
 *     // req.body is now typed as { title: string }
 *   });
 *
 * Errors throw `ZodError` which the centralized error middleware formats
 * into a standard 400 response.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}

/** Validate `req.query`. Same pattern as validateBody. */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    (req as any).query = schema.parse(req.query);
    next();
  };
}

/** Validate `req.params`. Same pattern as validateBody. */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    (req as any).params = schema.parse(req.params);
    next();
  };
}
