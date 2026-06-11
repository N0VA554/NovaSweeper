import pg from "pg";

declare global {
  // eslint-disable-next-line no-var
  var novasweeperPool: pg.Pool | undefined;
  // eslint-disable-next-line no-var
  var novasweeperMigrated: Promise<void> | undefined;
}

export function getPool() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  globalThis.novasweeperPool ??= new pg.Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined
  });

  return globalThis.novasweeperPool;
}

function getConnectionString() {
  const candidates = [process.env.DATABASE_URL, process.env.POSTGRES_URL, process.env.POSTGRES_PRISMA_URL].filter(Boolean) as string[];
  const preferred = candidates.find((value) => process.env.NODE_ENV === "production" && !isLocalDatabaseUrl(value));
  return preferred ?? candidates[0];
}

function isLocalDatabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export async function migrateScoresTable() {
  globalThis.novasweeperMigrated ??= getPool().query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(32) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'user',
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_name VARCHAR(32) NOT NULL,
      difficulty VARCHAR(24) NOT NULL,
      result VARCHAR(12) NOT NULL DEFAULT 'won',
      seconds INTEGER NOT NULL CHECK (seconds >= 0),
      moves INTEGER NOT NULL CHECK (moves >= 0),
      score INTEGER NOT NULL CHECK (score >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE scores
      ADD COLUMN IF NOT EXISTS result VARCHAR(12) NOT NULL DEFAULT 'won';

    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

    INSERT INTO system_config (key, value)
    VALUES
      ('registration_enabled', 'true'),
      ('username_unique_enabled', 'false'),
      ('email_unique_enabled', 'false'),
      ('maintenance_message', ''),
      ('default_game_mode', 'solo')
    ON CONFLICT (key) DO NOTHING;

    CREATE INDEX IF NOT EXISTS scores_difficulty_score_idx
      ON scores (difficulty, result DESC, score DESC, seconds ASC, created_at DESC);

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
  `).then(() => undefined);

  return globalThis.novasweeperMigrated;
}

export const migrateApp = migrateScoresTable;
