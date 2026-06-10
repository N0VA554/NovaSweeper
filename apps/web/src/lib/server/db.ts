import pg from "pg";

const connectionString = process.env.DATABASE_URL;

declare global {
  // eslint-disable-next-line no-var
  var novasweeperPool: pg.Pool | undefined;
  // eslint-disable-next-line no-var
  var novasweeperMigrated: Promise<void> | undefined;
}

export function getPool() {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  globalThis.novasweeperPool ??= new pg.Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined
  });

  return globalThis.novasweeperPool;
}

export async function migrateScoresTable() {
  globalThis.novasweeperMigrated ??= getPool().query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

    CREATE INDEX IF NOT EXISTS scores_difficulty_score_idx
      ON scores (difficulty, result DESC, score DESC, seconds ASC, created_at DESC);
  `).then(() => undefined);

  return globalThis.novasweeperMigrated;
}
