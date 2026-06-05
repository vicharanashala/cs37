/**
 * src/lib/jwt.ts
 *
 * Server-side JWT sign/verify helpers.
 */

import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET ?? 'anythingisvaible';
if (!SECRET) throw new Error("JWT_SECRET is not set in environment variables");

export interface JwtPayload {
  userId: string;
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SECRET) as JwtPayload;
  } catch {
    return null;
  }
}