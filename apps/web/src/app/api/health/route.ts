import { NextResponse } from "next/server";
import { getPool, migrateScoresTable } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await migrateScoresTable();
    await getPool().query("SELECT 1");
    return NextResponse.json({ status: "ok", service: "novasweeper-web-api" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error.";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
