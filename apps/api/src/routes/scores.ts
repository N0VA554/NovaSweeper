import { Router } from "express";
import { z } from "zod";
import { difficulties, type DifficultyKey, type Score } from "@novasweeper/shared";
import { pool } from "../db/pool.js";

const scoreSchema = z.object({
  playerName: z.string().trim().min(1).max(32),
  difficulty: z.enum(["rookie", "nova", "singularity"]),
  result: z.enum(["won", "lost"]),
  seconds: z.number().int().min(0).max(86400),
  moves: z.number().int().min(0).max(10000),
  score: z.number().int().min(0).max(1000000)
});

const difficultyQuerySchema = z.object({
  difficulty: z.enum(["rookie", "nova", "singularity"]).default("nova")
});

export const scoresRouter = Router();

scoresRouter.get("/", async (request, response, next) => {
  try {
    const { difficulty } = difficultyQuerySchema.parse(request.query);
    const rows = await getScores(difficulty);
    response.json({ scores: rows });
  } catch (error) {
    next(error);
  }
});

scoresRouter.post("/", async (request, response, next) => {
  try {
    const payload = scoreSchema.parse(request.body);
    const difficulty = difficulties[payload.difficulty];
    const maxBoardMoves = difficulty.rows * difficulty.cols * 3;

    if (payload.moves > maxBoardMoves) {
      response.status(422).json({ message: "Move count is too high for this difficulty." });
      return;
    }

    const result = await pool.query(
      `INSERT INTO scores (player_name, difficulty, result, seconds, moves, score)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, player_name, difficulty, result, seconds, moves, score, created_at`,
      [payload.playerName, payload.difficulty, payload.result, payload.seconds, payload.moves, payload.score]
    );

    response.status(201).json({ score: mapScore(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

async function getScores(difficulty: DifficultyKey): Promise<Score[]> {
  const result = await pool.query(
    `SELECT id, player_name, difficulty, result, seconds, moves, score, created_at
     FROM scores
     WHERE difficulty = $1
     ORDER BY result DESC, score DESC, seconds ASC, created_at DESC
     LIMIT 20`,
    [difficulty]
  );

  return result.rows.map(mapScore);
}

function mapScore(row: Record<string, unknown>): Score {
  return {
    id: String(row.id),
    playerName: String(row.player_name),
    difficulty: row.difficulty as DifficultyKey,
    result: row.result === "lost" ? "lost" : "won",
    seconds: Number(row.seconds),
    moves: Number(row.moves),
    score: Number(row.score),
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}
