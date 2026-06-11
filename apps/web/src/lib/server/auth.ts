import { cookies } from "next/headers";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { getPool, migrateApp } from "./db";

const scrypt = promisify(scryptCallback);
export const sessionCookieName = "novasweeper_session";

export type AppUser = {
  id: string;
  username: string;
  email: string;
  role: "admin" | "user";
  status: "active" | "disabled";
  createdAt: string;
};

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [algorithm, salt, storedKey] = passwordHash.split(":");
  if (algorithm !== "scrypt" || !salt || !storedKey) return false;

  const key = (await scrypt(password, salt, 64)) as Buffer;
  const stored = Buffer.from(storedKey, "hex");
  return stored.length === key.length && timingSafeEqual(stored, key);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  await migrateApp();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

  await getPool().query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt.toISOString()]
  );

  return token;
}

export async function ensureBootstrapAdmin() {
  await migrateApp();
  const result = await getPool().query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
  if (Number(result.rows[0]?.count ?? 0) > 0) return;

  const username = process.env.ADMIN_USERNAME ?? "Nova Admin";
  const email = (process.env.ADMIN_EMAIL ?? "admin@novasweeper.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "NovaAdmin@123";

  await getPool().query(
    `INSERT INTO users (username, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'admin', 'active')`,
    [username, email, await hashPassword(password)]
  );
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const token = (await cookies()).get(sessionCookieName)?.value;
  if (!token) return null;

  await migrateApp();
  const result = await getPool().query(
    `SELECT users.id, users.username, users.email, users.role, users.status, users.created_at
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = $1 AND sessions.expires_at > NOW()
     LIMIT 1`,
    [hashToken(token)]
  );

  const user = result.rows[0];
  return user ? mapUser(user) : null;
}

export async function destroyCurrentSession() {
  await migrateApp();
  const token = (await cookies()).get(sessionCookieName)?.value;
  if (!token) return;
  await getPool().query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}

export function mapUser(row: Record<string, unknown>): AppUser {
  return {
    id: String(row.id),
    username: String(row.username),
    email: String(row.email),
    role: row.role === "admin" ? "admin" : "user",
    status: row.status === "disabled" ? "disabled" : "active",
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}
