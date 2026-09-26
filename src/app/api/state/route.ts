import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db/getDb";
import { appStateTable } from "@/db/schema";
import { getSessionUser, unauthorized } from "@/lib/server/session";
import {
  notifyListChanges,
  type DomainDoc,
  type NotifyEnv,
} from "@/lib/server/listNotifications";

const STATE_ID = 1;

interface UsersDoc {
  users?: Record<string, unknown>[];
}

/** Quita material de contraseñas del documento antes de persistirlo. */
function sanitizeDoc(doc: UsersDoc): UsersDoc {
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

  // Guardamos el doc previo para detectar cambios en listas e items.
  const prev = await getDb()
    .select()
    .from(appStateTable)
    .where(eq(appStateTable.id, STATE_ID))
    .limit(1);
  const oldDoc = (prev[0] ? JSON.parse(prev[0].doc) : {}) as DomainDoc;

  const newDoc = sanitizeDoc(raw.doc as UsersDoc);
  const doc = JSON.stringify(newDoc);
  const now = new Date().toISOString();
  await getDb()
    .insert(appStateTable)
    .values({ id: STATE_ID, doc, updatedAt: now })
    .onConflictDoUpdate({
      target: appStateTable.id,
      set: { doc, updatedAt: now },
    });

  // Aviso por Telegram a los relacionados (asincrónico; no bloquea la respuesta).
  try {
    const { env, ctx } = await getCloudflareContext({ async: true });
    const notify = notifyListChanges(
      env as unknown as NotifyEnv,
      oldDoc,
      newDoc as DomainDoc,
    );
    if (ctx?.waitUntil) ctx.waitUntil(notify);
    else await notify;
  } catch (e) {
    console.warn("notifyListChanges:", e);
  }

  return NextResponse.json({ ok: true });
}
