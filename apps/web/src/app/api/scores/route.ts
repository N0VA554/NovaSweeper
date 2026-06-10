import { NextResponse, type NextRequest } from "next/server";
import { difficulties, type DifficultyKey, type Score } from "@novasweeper/shared";
import { z } from "zod";
import { getPool, migrateScoresTable } from "@/lib/server/db";

export const runtime = "nodejs";

const scoreSchema = z.object({
  playerName: z.string().trim().min(1).max(32),
  difficulty: z.enum(["rookie", "nova", "singularity"]),
  result: z.enum(["won", "lost"]),
  seconds: z.number().int().min(0).max(86400),
  moves: z.number().int().min(0).max(10000),
  score: z.number().int().min(0).max(1000000)
});

const difficultySchema = z.enum(["rookie", "nova", "singularity"]).default("nova");

export async function GET(request: NextRequest) {
  try {
    await migrateScoresTable();
    const difficulty = difficultySchema.parse(request.nextUrl.searchParams.get("difficulty") ?? undefined);
    const result = await getPool().query(
      `SELECT id, player_name, difficulty, result, seconds, moves, score, created_at
       FROM scores
       WHERE difficulty = $1
       ORDER BY result DESC, score DESC, seconds ASC, created_at DESC
       LIMIT 20`,
      [difficulty]
    );

    return NextResponse.json({ scores: result.rows.map(mapScore) });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    const message = error instanceof Error ? error.message : "Unable to load scores.";
    return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    await migrateScoresTable();
    const payload = scoreSchema.parse(await request.json());
    const difficulty = difficulties[payload.difficulty];
    const maxBoardMoves = difficulty.rows * difficulty.cols * 4;

    if (payload.moves > maxBoardMoves) {
      return NextResponse.json({ message: "Move count is too high for this difficulty." }, { status: 422 });
    }

    const result = await getPool().query(
      `INSERT INTO scores (player_name, difficulty, result, seconds, moves, score)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, player_name, difficulty, result, seconds, moves, score, created_at`,
      [payload.playerName, payload.difficulty, payload.result, payload.seconds, payload.moves, payload.score]
    );

    return NextResponse.json({ score: mapScore(result.rows[0]) }, { status: 201 });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    const message = error instanceof Error ? error.message : "Unable to save score.";
    return NextResponse.json({ message }, { status });
  }
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
