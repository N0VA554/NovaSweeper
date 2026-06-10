import pg from "pg";
import { config } from "../config.js";

export const pool = new pg.Pool({
  connectionString: config.databaseUrl
});

export async function migrate(): Promise<void> {
  await pool.query(`
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
      ON scores (difficulty, score DESC, seconds ASC, created_at DESC);
  `);
}
