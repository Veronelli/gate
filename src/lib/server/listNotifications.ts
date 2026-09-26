import { drizzle } from "drizzle-orm/d1";
import { contactsTable } from "@/db/schema";
import { sendTelegramMessage } from "@/lib/telegram";

/** Binding mínimo que necesita el notifier. */
export interface NotifyEnv {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  APP_URL?: string;
}

interface ListDoc {
  id: string;
  placeId: string;
  name: string;
  state: string;
}
interface ItemDoc {
  id: string;
  listId: string;
  units?: number;
}
interface MemberDoc {
  placeId: string;
  userId: string;
}
interface InviteDoc {
  listId: string;
  userId: string;
}
interface PlaceDoc {
  id: string;
  name: string;
}
export interface DomainDoc {
  places?: PlaceDoc[];
  lists?: ListDoc[];
  items?: ItemDoc[];
  memberships?: MemberDoc[];
  invites?: InviteDoc[];
}

const STATE_LABEL: Record<string, string> = {
  listando: "Listando",
  a_comprar: "A comprar",
  comprando: "Comprando",
  listo: "Listo",
};

/**
 * Compara el doc anterior con el nuevo y avisa por Telegram a los
 * relacionados con cada lista (miembros del lugar + invitados de la
 * lista) cuando cambia el estado o se agregan productos.
 */
export async function notifyListChanges(
  env: NotifyEnv,
  oldDoc: DomainDoc,
  newDoc: DomainDoc,
): Promise<{ sent: number; failed: number }> {
  const token = env.TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = env.APP_URL ?? process.env.APP_URL;
  if (!token || !appUrl) return { sent: 0, failed: 0 };

  const placesById = new Map(
    (newDoc.places ?? []).map((p) => [p.id, p.name]),
  );
  const oldLists = new Map((oldDoc.lists ?? []).map((l) => [l.id, l]));

  const countItems = (doc: DomainDoc) => {
    const m = new Map<string, number>();
    for (const it of doc.items ?? []) {
      m.set(it.listId, (m.get(it.listId) ?? 0) + 1);
    }
    return m;
  };
  const oldItems = countItems(oldDoc);
  const newItems = countItems(newDoc);

  const membersOf = (placeId: string) =>
    (newDoc.memberships ?? [])
      .filter((m) => m.placeId === placeId)
      .map((m) => m.userId);
  const invitedTo = (listId: string) =>
    (newDoc.invites ?? [])
      .filter((i) => i.listId === listId)
      .map((i) => i.userId);

  const db = drizzle(env.DB);
  const contacts = await db.select().from(contactsTable);
  const chatByUser = new Map(
    contacts
      .filter((c) => c.telegramChatId)
      .map((c) => [c.userId, c.telegramChatId as string]),
  );

  // Primero armamos los eventos por lista; después consolidamos UN
  // reporte por usuario con todos los cambios que le tocan.
  interface ListEvent {
    list: ListDoc;
    placeName: string;
    lines: string[];
  }
  const events: ListEvent[] = [];

  for (const list of newDoc.lists ?? []) {
    const old = oldLists.get(list.id);
    if (!old) continue; // lista nueva: sin diff previo

    const lines: string[] = [];
    const placeName = placesById.get(list.placeId) ?? "lugar";
    if (old.state !== list.state) {
      lines.push(
        `estado → "${STATE_LABEL[list.state] ?? list.state}"`,
      );
    }
    const added = (newItems.get(list.id) ?? 0) - (oldItems.get(list.id) ?? 0);
    if (added > 0) lines.push(`➕ ${added} producto(s) agregado(s)`);
    const oldById = new Map(
      (oldDoc.items ?? [])
        .filter((i) => i.listId === list.id)
        .map((i) => [i.id, i]),
    );
    const newIds = new Set(
      (newDoc.items ?? [])
        .filter((i) => i.listId === list.id)
        .map((i) => i.id),
    );
    const removed = [...oldById.keys()].filter((id) => !newIds.has(id));
    const modified = (newDoc.items ?? []).filter(
      (i) =>
        i.listId === list.id &&
        oldById.has(i.id) &&
        oldById.get(i.id)!.units !== i.units,
    );
    if (removed.length > 0) {
      lines.push(`➖ ${removed.length} producto(s) quitado(s)`);
    }
    if (modified.length > 0) {
      lines.push(`✏️ ${modified.length} producto(s) modificado(s)`);
    }
    if (lines.length > 0) events.push({ list, placeName, lines });
  }
  if (events.length === 0) return { sent: 0, failed: 0 };

  // Reporte único por usuario: agrupa todos los eventos que le tocan.
  const perUser = new Map<
    string,
    { events: ListEvent[] }
  >();
  for (const ev of events) {
    const recipients = new Set([
      ...membersOf(ev.list.placeId),
      ...invitedTo(ev.list.id),
    ]);
    for (const uid of recipients) {
      const entry = perUser.get(uid) ?? { events: [] };
      entry.events.push(ev);
      perUser.set(uid, entry);
    }
  }

  const jobs: Promise<boolean>[] = [];
  for (const [uid, { events: userEvents }] of perUser) {
    const chatId = chatByUser.get(uid);
    if (!chatId) continue;

    const report = userEvents
      .map(
        (e) =>
          `• "${e.list.name}" (${e.placeName})\n   ${e.lines.join("\n   ")}`,
      )
      .join("\n\n");
    const buttons = userEvents.map((e) => [
      {
        text: `Ver lista: ${e.list.name}`,
        url: `${appUrl}/listas/${e.list.id}`,
      },
    ]);

    jobs.push(
      sendTelegramMessage(
        token,
        chatId,
        `🛒 Reporte de cambios en tus listas:\n\n${report}`,
        buttons,
      ).then((r) => {
        if (!r.ok) console.warn("telegram send:", r.error);
        return r.ok;
      }),
    );
  }

  const results = await Promise.allSettled(jobs);
  let sent = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) sent += 1;
    else failed += 1;
  }
  return { sent, failed };
}
