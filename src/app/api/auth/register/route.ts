import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { usersTable } from "@/db/schema";
import {
  PBKDF2_ITERATIONS,
  hashPassword,
  randomHex,
} from "@/lib/server/passwords";
import { createSession } from "@/lib/server/session";

interface RegisterBody {
  username?: string;
  password?: string;
  repeatPassword?: string;
}

const normalize = (s: string) => s.trim().toLowerCase();

export async function POST(request: Request) {
  const body = (await request.json()) as RegisterBody;
  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json(
      { error: "Completá usuario y contraseña." },
      { status: 400 },
    );
  }
  if (password !== (body.repeatPassword ?? "")) {
    return NextResponse.json(
      { error: "Las contraseñas no coinciden." },
      { status: 400 },
    );
  }
  const db = getDb();
  const existing = await db
    .select({ username: usersTable.username })
    .from(usersTable);
  if (existing.some((u) => normalize(u.username) === normalize(username))) {
    return NextResponse.json(
      { error: "El usuario ya existe." },
      { status: 409 },
    );
  }
  const salt = randomHex(16);
  const user = {
    id: crypto.randomUUID(),
    username,
    passwordHash: await hashPassword(password, salt),
    salt,
    iterations: PBKDF2_ITERATIONS,
    createdAt: new Date().toISOString(),
  };
  await db.insert(usersTable).values(user);
  const token = await createSession(user.id);
  return NextResponse.json(
    { token, user: { id: user.id, username: user.username } },
    { status: 201 },
  );
}
