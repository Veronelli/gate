import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { usersTable } from "@/db/schema";
import { hashPassword, safeEqual } from "@/lib/server/passwords";
import { createSession } from "@/lib/server/session";

interface LoginBody {
  username?: string;
  password?: string;
}

const normalize = (s: string) => s.trim().toLowerCase();

export async function POST(request: Request) {
  const body = (await request.json()) as LoginBody;
  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";
  const invalid = () =>
    NextResponse.json(
      { error: "Usuario o contraseña incorrectos." },
      { status: 401 },
    );
  if (!username || !password) return invalid();

  const db = getDb();
  const rows = await db.select().from(usersTable);
  const user = rows.find((u) => normalize(u.username) === normalize(username));
  if (!user) return invalid();

  const hash = await hashPassword(password, user.salt, user.iterations);
  if (!safeEqual(hash, user.passwordHash)) return invalid();

  const token = await createSession(user.id);
  return NextResponse.json({
    token,
    user: { id: user.id, username: user.username },
  });
}
