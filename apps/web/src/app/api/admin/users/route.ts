import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser, mapUser } from "@/lib/server/auth";
import { getPool, migrateApp } from "@/lib/server/db";

export const runtime = "nodejs";

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "user"]).optional(),
  status: z.enum(["active", "disabled"]).optional()
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ message: "Forbidden." }, { status: 403 });

  const result = await getPool().query(
    `SELECT id, username, email, role, status, created_at
     FROM users
     ORDER BY created_at DESC`
  );
  return NextResponse.json({ users: result.rows.map(mapUser) });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ message: "Forbidden." }, { status: 403 });

  const payload = updateUserSchema.parse(await request.json());
  const result = await getPool().query(
    `UPDATE users
     SET role = COALESCE($2, role),
         status = COALESCE($3, status),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, username, email, role, status, created_at`,
    [payload.userId, payload.role ?? null, payload.status ?? null]
  );

  const user = result.rows[0];
  if (!user) return NextResponse.json({ message: "User not found." }, { status: 404 });
  return NextResponse.json({ user: mapUser(user) });
}

async function requireAdmin() {
  await migrateApp();
  const user = await getCurrentUser();
  return user?.role === "admin" && user.status === "active" ? user : null;
}
