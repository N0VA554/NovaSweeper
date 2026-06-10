import type { Score, ScoreInput } from "@novasweeper/shared";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

function apiPath(path: string) {
  return `${apiUrl}${path}`;
}

export async function fetchScores(difficulty: string): Promise<Score[]> {
  const response = await fetch(apiPath(`/api/scores?difficulty=${difficulty}`), {
    cache: "no-store"
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as { scores: Score[] };
  return payload.scores;
}

export async function submitScore(input: ScoreInput): Promise<Score> {
  const response = await fetch(apiPath("/api/scores"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Score submit failed.");
  }

  const payload = (await response.json()) as { score: Score };
  return payload.score;
}
