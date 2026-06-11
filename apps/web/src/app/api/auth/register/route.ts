import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getPool, migrateApp } from "@/lib/server/db";
import { createSession, ensureBootstrapAdmin, hashPassword, mapUser, sessionCookieName } from "@/lib/server/auth";

export const runtime = "nodejs";

const registerSchema = z.object({
  username: z.string().trim().min(3).max(32),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128)
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"]
});

export async function POST(request: NextRequest) {
  try {
    await migrateApp();
    await ensureBootstrapAdmin();
    const payload = registerSchema.parse(await request.json());
    const config = await getPool().query("SELECT key, value FROM system_config WHERE key IN ('registration_enabled', 'username_unique_enabled', 'email_unique_enabled')");
    const configMap = new Map(config.rows.map((row) => [String(row.key), String(row.value)]));
    if (configMap.get("registration_enabled") === "false") {
      return NextResponse.json({ message: "Registration is currently disabled." }, { status: 403 });
    }

    if (configMap.get("username_unique_enabled") === "true") {
      const existingUsername = await getPool().query("SELECT 1 FROM users WHERE lower(username) = lower($1) LIMIT 1", [payload.username]);
      if (existingUsername.rowCount) return NextResponse.json({ message: "Username is already in use." }, { status: 409 });
    }

    if (configMap.get("email_unique_enabled") === "true") {
      const existingEmail = await getPool().query("SELECT 1 FROM users WHERE lower(email) = lower($1) LIMIT 1", [payload.email]);
      if (existingEmail.rowCount) return NextResponse.json({ message: "Email is already in use." }, { status: 409 });
    }

    const passwordHash = await hashPassword(payload.password);

    const result = await getPool().query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, role, status, created_at`,
      [payload.username, payload.email, passwordHash, "user"]
    );

    const user = mapUser(result.rows[0]);
    const token = await createSession(user.id);
    const response = NextResponse.json({ user }, { status: 201 });
    response.cookies.set(sessionCookieName, token, cookieOptions());
    return response;
  } catch (error) {
    const message = error instanceof z.ZodError ? "Invalid registration payload." : "Could not create account.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  };
}
