import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { appStateTable, contactsTable } from "@/db/schema";
import { sendTelegramMessage, type InlineButton } from "@/lib/telegram";
import type { ListState, Membership, Place, ShoppingList, User } from "@/lib/types";

/** Binding mínimo que necesita el job (env del worker o del contexto CF). */
export interface RemindersEnv {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  APP_URL?: string;
}

interface DomainDoc {
  users?: Pick<User, "id" | "username">[];
  places?: Place[];
  memberships?: Membership[];
  lists?: ShoppingList[];
}

const STATE_LABEL: Record<ListState, string> = {
  listando: "armando",
  a_comprar: "a comprar",
  comprando: "comprando",
  listo: "listo",
};

const WINDOW_MS = 8 * 60 * 60 * 1000; // próximas 8 h (hasta el próximo tick)

function pendingListsFor(userId: string, doc: DomainDoc): ShoppingList[] {
  const placeIds = new Set(
    (doc.memberships ?? [])
      .filter((m) => m.userId === userId)
      .map((m) => m.placeId),
  );
  const now = Date.now();
  return (doc.lists ?? []).filter((l) => {
    if (!placeIds.has(l.placeId)) return false;
    if (l.state === "a_comprar" || l.state === "comprando") return true;
    const scheduled = l.scheduledAt ? Date.parse(l.scheduledAt) : null;
    return (
      scheduled !== null && scheduled >= now && scheduled <= now + WINDOW_MS
    );
  });
}

function formatWhen(list: ShoppingList): string {
  if (list.state === "listando" && list.scheduledAt) {
    const d = new Date(list.scheduledAt);
    return `programada ${d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return STATE_LABEL[list.state] ?? list.state;
}

/**
 * Job de recordatorios: recorre usuarios, calcula pendientes y manda
 * mensajes de Telegram en paralelo (allSettled) con botón "Ver lista".
 */
export async function runReminders(env: RemindersEnv): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const token = env.TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = env.APP_URL ?? process.env.APP_URL;
  if (!token || !appUrl) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const db = drizzle(env.DB);
  const rows = await db
    .select()
    .from(appStateTable)
    .where(eq(appStateTable.id, 1))
    .limit(1);
  const doc = (rows[0] ? JSON.parse(rows[0].doc) : {}) as DomainDoc;
  const placesById = new Map((doc.places ?? []).map((p) => [p.id, p]));

  const contacts = await db.select().from(contactsTable);
  const chatByUser = new Map(
    contacts
      .filter((c) => c.telegramChatId)
      .map((c) => [c.userId, c.telegramChatId as string]),
  );

  const jobs = (doc.users ?? []).map(async (user) => {
    const chatId = chatByUser.get(user.id);
    const pending = pendingListsFor(user.id, doc);
    if (!chatId || pending.length === 0) return "skipped" as const;

    const lines = pending.map(
      (l) =>
        `• ${l.name} — ${placesById.get(l.placeId)?.name ?? "lugar"} (${formatWhen(l)})`,
    );
    const buttons: InlineButton[][] = pending.map((l) => [
      { text: `Ver lista: ${l.name}`, url: `${appUrl}/listas/${l.id}` },
    ]);

    const result = await sendTelegramMessage(
      token,
      chatId,
      `🛒 Tenés compras pendientes:\n\n${lines.join("\n")}`,
      buttons,
    );
    return result.ok ? ("sent" as const) : ("failed" as const);
  });

  const results = await Promise.allSettled(jobs);
  const tally = { sent: 0, failed: 0, skipped: 0 };
  for (const r of results) {
    if (r.status === "fulfilled") tally[r.value] += 1;
    else tally.failed += 1;
  }
  return tally;
}
