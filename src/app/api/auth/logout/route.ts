import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/getDb";
import { sessionsTable } from "@/db/schema";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token) {
    await getDb()
      .delete(sessionsTable)
      .where(eq(sessionsTable.token, token));
  }
  return NextResponse.json({ ok: true });
}
