import { eq } from "drizzle-orm";
import { getDb } from "@/db/getDb";
import { contactsTable } from "@/db/schema";
import { randomHex } from "./passwords";

export interface Contact {
  id: string;
  userId: string;
  phone: string;
  telegramChatId: string | null;
}

export async function getContact(userId: string): Promise<Contact | null> {
  const rows = await getDb()
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** Upsert del teléfono: un contact por usuario. */
export async function upsertContact(
  userId: string,
  phone: string,
): Promise<Contact> {
  const db = getDb();
  const existing = await getContact(userId);
  if (existing) {
    await db
      .update(contactsTable)
      .set({ phone })
      .where(eq(contactsTable.id, existing.id));
    return { ...existing, phone };
  }
  const contact: Contact = {
    id: randomHex(16),
    userId,
    phone,
    telegramChatId: null,
  };
  await db.insert(contactsTable).values({
    ...contact,
    createdAt: new Date().toISOString(),
  });
  return contact;
}

/** Quita solo la vinculación con Telegram; conserva el teléfono. */
export async function unlinkTelegram(userId: string): Promise<void> {
  await getDb()
    .update(contactsTable)
    .set({ telegramChatId: null })
    .where(eq(contactsTable.userId, userId));
}

export async function deleteContact(userId: string): Promise<void> {
  await getDb()
    .delete(contactsTable)
    .where(eq(contactsTable.userId, userId));
}

/** Guarda el chat_id cuando el usuario habla con el bot (/start). */
export async function linkTelegramChat(
  userId: string,
  chatId: string,
): Promise<void> {
  const db = getDb();
  const existing = await getContact(userId);
  if (existing) {
    await db
      .update(contactsTable)
      .set({ telegramChatId: chatId })
      .where(eq(contactsTable.id, existing.id));
    return;
  }
  await db.insert(contactsTable).values({
    id: randomHex(16),
    userId,
    phone: "",
    telegramChatId: chatId,
    createdAt: new Date().toISOString(),
  });
}
