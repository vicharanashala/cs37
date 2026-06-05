/**
 * app/api/auth/signup/route.ts
 *
 * POST /api/auth/signup
 * Body: { email: string, password: string }
 * Response: { ok: true, token: string, user: { userId, email } }
 */

import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import ConnectDB from "@/lib/mongoClient";
import { signToken } from "@/lib/jwt";
import { ok, fail, readJson, errors } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await readJson<{ email?: string; password?: string }>(req);
  if (!body) return errors.badRequest("Invalid JSON body");

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !password) {
    return fail("validation_error", "Email and password are required", 400);
  }
  if (password.length < 8) {
    return fail(
      "validation_error",
      "Password must be at least 8 characters",
      400
    );
  }

  let client;
  try {
    client = await ConnectDB();
  } catch {
    return errors.server("Could not connect to database");
  }

  try {
    const db = client.db(process.env.MONGODB_DB ?? "samagama");

    const existing = await db.collection("users").findOne({ email });
    if (existing) {
      return fail(
        "email_taken",
        "An account with this email already exists",
        409
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.collection("users").insertOne({
      email,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const userId = result.insertedId.toString();
    const token = signToken({ userId, email });

    return ok({ token, user: { userId, email } }, { status: 201 });
  } catch (err) {
    console.error("[/api/auth/signup]", err);
    return errors.server("Failed to create account");
  }
}