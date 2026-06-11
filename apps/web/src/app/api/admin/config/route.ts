import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/server/auth";
import { getPool, migrateApp } from "@/lib/server/db";

export const runtime = "nodejs";

const configSchema = z.object({
  registrationEnabled: z.boolean(),
  usernameUniqueEnabled: z.boolean(),
  emailUniqueEnabled: z.boolean(),
  maintenanceMessage: z.string().max(240),
  defaultGameMode: z.enum(["solo", "pve"])
});

export async function GET() {
  await migrateApp();
  const rows = await getPool().query("SELECT key, value FROM system_config ORDER BY key");
  return NextResponse.json({ config: toConfig(rows.rows) });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== "admin" || user.status !== "active") {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  await migrateApp();
  const payload = configSchema.parse(await request.json());
  const entries = [
    ["registration_enabled", String(payload.registrationEnabled)],
    ["username_unique_enabled", String(payload.usernameUniqueEnabled)],
    ["email_unique_enabled", String(payload.emailUniqueEnabled)],
    ["maintenance_message", payload.maintenanceMessage],
    ["default_game_mode", payload.defaultGameMode]
  ];

  for (const [key, value] of entries) {
    await getPool().query(
      `INSERT INTO system_config (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value]
    );
  }

  return NextResponse.json({ config: payload });
}

function toConfig(rows: Array<{ key: string; value: string }>) {
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    registrationEnabled: map.get("registration_enabled") !== "false",
    usernameUniqueEnabled: map.get("username_unique_enabled") === "true",
    emailUniqueEnabled: map.get("email_unique_enabled") === "true",
    maintenanceMessage: map.get("maintenance_message") ?? "",
    defaultGameMode: map.get("default_game_mode") === "pve" ? "pve" : "solo"
  };
}
