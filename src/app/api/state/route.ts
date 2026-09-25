import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/getDb";
import { appStateTable } from "@/db/schema";
import { getSessionUser, unauthorized } from "@/lib/server/session";

const STATE_ID = 1;

interface DomainDoc {
  users?: Record<string, unknown>[];
}

/** Quita material de contraseñas del documento antes de persistirlo. */
function sanitizeDoc(doc: DomainDoc): DomainDoc {
  return {
    ...doc,
    users: (doc.users ?? []).map((u) => {
      const clean = { ...u };
      delete clean.passwordHash;
      delete clean.salt;
      return clean;
    }),
  };
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  const rows = await getDb()
    .select()
    .from(appStateTable)
    .where(eq(appStateTable.id, STATE_ID))
    .limit(1);
  return NextResponse.json({ doc: rows[0] ? JSON.parse(rows[0].doc) : null });
}

export async function PUT(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  const raw = (await request.json()) as { doc?: unknown };
  if (!raw.doc || typeof raw.doc !== "object") {
    return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  }
  const doc = JSON.stringify(sanitizeDoc(raw.doc as DomainDoc));
  const now = new Date().toISOString();
  await getDb()
    .insert(appStateTable)
    .values({ id: STATE_ID, doc, updatedAt: now })
    .onConflictDoUpdate({
      target: appStateTable.id,
      set: { doc, updatedAt: now },
    });
  return NextResponse.json({ ok: true });
}
