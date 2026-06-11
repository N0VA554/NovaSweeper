import { NextResponse } from "next/server";
import { destroyCurrentSession, sessionCookieName } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST() {
  await destroyCurrentSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}
