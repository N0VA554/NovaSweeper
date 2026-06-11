import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/admin-panel";
import { getCurrentUser, mapUser } from "@/lib/server/auth";
import { getPool, migrateApp } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin" || user.status !== "active") redirect("/profile");

  await migrateApp();
  const [usersResult, configResult] = await Promise.all([
    getPool().query(
      `SELECT id, username, email, role, status, created_at
       FROM users
       ORDER BY created_at DESC`
    ),
    getPool().query("SELECT key, value FROM system_config ORDER BY key")
  ]);

  return (
    <main className="auth-page">
      <section className="auth-card admin-card">
        <Link className="back-link" href="/">Back to game</Link>
        <p className="eyebrow">Admin console</p>
        <h1>System control</h1>
        <AdminPanel initialUsers={usersResult.rows.map(mapUser)} initialConfig={toConfig(configResult.rows)} />
      </section>
    </main>
  );
}

function toConfig(rows: Array<{ key: string; value: string }>) {
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    registrationEnabled: map.get("registration_enabled") !== "false",
    usernameUniqueEnabled: map.get("username_unique_enabled") === "true",
    emailUniqueEnabled: map.get("email_unique_enabled") === "true",
    maintenanceMessage: map.get("maintenance_message") ?? "",
    defaultGameMode: map.get("default_game_mode") === "pve" ? "pve" as const : "solo" as const
  };
}
