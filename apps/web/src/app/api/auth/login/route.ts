import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getPool, migrateApp } from "@/lib/server/db";
import { createSession, ensureBootstrapAdmin, mapUser, sessionCookieName, verifyPassword } from "@/lib/server/auth";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128)
});

export async function POST(request: NextRequest) {
  try {
    await migrateApp();
    await ensureBootstrapAdmin();
    const payload = loginSchema.parse(await request.json());
    const result = await getPool().query(
      `SELECT id, username, email, password_hash, role, status, created_at
       FROM users
       WHERE email = $1
       ORDER BY created_at DESC`,
      [payload.email]
    );

    let row = null;
    for (const candidate of result.rows) {
      if (candidate.status !== "disabled" && (await verifyPassword(payload.password, String(candidate.password_hash)))) {
        row = candidate;
        break;
      }
    }

    if (!row) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const user = mapUser(row);
    const token = await createSession(user.id);
    const response = NextResponse.json({ user });
    response.cookies.set(sessionCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14
    });
    return response;
  } catch {
    return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
  }
}
