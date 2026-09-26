import { and, count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/getDb";
import { checkyMessagesTable } from "@/db/schema";
import { randomHex } from "../passwords";

export type CheckyRole = "user" | "assistant";

export interface CheckyMessage {
  role: CheckyRole;
  text: string;
}

export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

/** Últimas `maxRows` filas del usuario, en orden cronológico. */
export async function recentMessages(
  userId: string,
  maxRows: number,
): Promise<CheckyMessage[]> {
  const rows = await getDb()
    .select({ role: checkyMessagesTable.role, text: checkyMessagesTable.text, createdAt: checkyMessagesTable.createdAt })
    .from(checkyMessagesTable)
    .where(eq(checkyMessagesTable.userId, userId))
    .orderBy(desc(checkyMessagesTable.createdAt), desc(checkyMessagesTable.id))
    .limit(maxRows);
  return rows
    .reverse()
    .map((r) => ({ role: r.role as CheckyRole, text: r.text }));
}

/** Cuántos inputs del usuario van en el día (UTC). */
export async function countInputsToday(
  userId: string,
  day: string,
): Promise<number> {
  const rows = await getDb()
    .select({ n: count() })
    .from(checkyMessagesTable)
    .where(
      and(
        eq(checkyMessagesTable.userId, userId),
        eq(checkyMessagesTable.day, day),
        eq(checkyMessagesTable.role, "user"),
      ),
    );
  return rows[0]?.n ?? 0;
}

/**
 * Persiste el intercambio (mensaje del usuario + respuesta del agente) y
 * poda el historial para conservar solo las últimas `keepRows` filas.
 */
export async function appendExchange(
  userId: string,
  userText: string,
  assistantText: string,
  day: string,
  keepRows: number,
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.insert(checkyMessagesTable).values([
    { id: randomHex(16), userId, role: "user", text: userText, day, createdAt: now },
    { id: randomHex(16), userId, role: "assistant", text: assistantText, day, createdAt: now },
  ]);
  // Poda: borra todo lo que quede fuera de la ventana.
  const cutoff = await db
    .select({ createdAt: checkyMessagesTable.createdAt })
    .from(checkyMessagesTable)
    .where(eq(checkyMessagesTable.userId, userId))
    .orderBy(desc(checkyMessagesTable.createdAt), desc(checkyMessagesTable.id))
    .limit(1)
    .offset(keepRows - 1);
  if (cutoff[0]) {
    await db
      .delete(checkyMessagesTable)
      .where(
        and(
          eq(checkyMessagesTable.userId, userId),
          sql`(${checkyMessagesTable.createdAt} < ${cutoff[0].createdAt})`,
        ),
      );
  }
}
