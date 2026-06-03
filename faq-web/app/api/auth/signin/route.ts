/**
 * app/api/auth/signin/route.ts
 *
 * POST /api/auth/signin
 * Body: { email: string, password: string }
 * Response: { ok: true, token: string, user: { userId, email } }
 */

import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import ConnectDB from "@/lib/mongoClient";
import { signToken } from "@/lib/jwt";
import { errors, ok, readJson } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await readJson<{ email?: string; password?: string }>(req);
  if (!body) return errors.badRequest("Invalid JSON body");

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !password) {
    return errors.unauthorized("Email and password are required");
  }

  let client;
  try {
    client = await ConnectDB();
  } catch {
    return errors.server("Could not connect to database");
  }

  try {
    const db = client.db(process.env.MONGODB_DB ?? "samagama");

    const userDoc = await db.collection("users").findOne({ email });
    if (!userDoc) {
      return errors.unauthorized("Invalid email or password");
    }

    const valid = await bcrypt.compare(password, userDoc.passwordHash);
    if (!valid) {
      return errors.unauthorized("Invalid email or password");
    }

    const userId = userDoc._id.toString();
    const token = signToken({ userId, email });

    return ok({ token, user: { userId, email } });
  } catch (err) {
    console.error("[/api/auth/signin]", err);
    return errors.server("Sign in failed");
  }
}