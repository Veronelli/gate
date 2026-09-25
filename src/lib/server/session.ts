import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/getDb";
import { sessionsTable, usersTable } from "@/db/schema";
import { randomHex } from "./passwords";

export interface SessionUser {
  id: string;
  username: string;
}

/** Lee `Authorization: Bearer <token>` y devuelve el usuario o null. */
export async function getSessionUser(
  request: Request,
): Promise<SessionUser | null> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const db = getDb();
  const rows = await db
    .select({ userId: sessionsTable.userId })
    .from(sessionsTable)
    .where(eq(sessionsTable.token, token))
    .limit(1);
  const userId = rows[0]?.userId;
  if (!userId) return null;
  const users = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return users[0] ?? null;
}

export async function createSession(userId: string): Promise<string> {
  const token = randomHex(32);
  await getDb()
    .insert(sessionsTable)
    .values({ token, userId, createdAt: new Date().toISOString() });
  return token;
}

export function unauthorized() {
  return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
}
