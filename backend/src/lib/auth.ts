
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { HttpError } from "./httpError";

const SECRET = process.env.JWT_SECRET || "bbt-ledger-dev-secret";

export type Role = "super_admin" | "inventory_manager" | "distributor";
export interface AuthUser {
  id: number;
  role: Role;
  name: string;
  username: string;
}

export function signToken(u: AuthUser): string {
  return jwt.sign(u, SECRET, { expiresIn: "30d" });
}

export function hashPassword(pw: string): string {
  return bcrypt.hashSync(pw, 10);
}

export function verifyPassword(pw: string, hash: string): boolean {
  return bcrypt.compareSync(pw, hash);
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  // Allow a token in the Authorization header OR (for browser file downloads
  // that cannot set headers) a ?token= query param.
  let token: string | undefined;
  if (header && header.startsWith("Bearer ")) token = header.slice(7);
  else if (typeof req.query.token === "string") token = req.query.token;

  if (!token) {
    throw new HttpError(401, "UNAUTHORIZED", "Missing token");
  }
  try {
    const payload = jwt.verify(token, SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid token");
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new HttpError(403, "FORBIDDEN", "Insufficient permissions");
    }
    next();
  };
}
