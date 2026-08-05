/**
 * Typed HTTP error class. Throw this anywhere in a request handler instead of
 * res.status(N).json(...); the centralized error middleware in src/middleware/error.ts
 * formats it into the standard `{ error: { code, message } }` response shape.
 *
 *   throw new HttpError(404, "NOT_FOUND", "Item not found");
 *   throw new HttpError(401, "UNAUTHORIZED", "Invalid token");
 *
 * In an `async` route handler, wrap it in `asyncHandler` below — Express 4 does not
 * catch errors thrown inside async functions, so an uncaught one becomes an unhandled
 * promise rejection and crashes the entire process, not just that one request.
 */
export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "HttpError";
  }
}

/**
 * Wrap every async route handler that can throw (including via HttpError) in this —
 * forwards the rejection to next(err) instead of letting it crash the process.
 *   router.get("/:id", asyncHandler(async (req, res) => { ... }));
 */
export const asyncHandler =
  <T extends (req: any, res: any, next: any) => Promise<any>>(fn: T) =>
  (req: any, res: any, next: any) =>
    fn(req, res, next).catch(next);
