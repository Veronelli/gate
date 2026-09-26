import { eq } from "drizzle-orm";
import { getDb } from "@/db/getDb";
import { telegramLinkRequestsTable } from "@/db/schema";
import { linkTelegramChat } from "./contacts";
import { randomHex } from "./passwords";

export type LinkStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "expired";

export interface LinkRequest {
  id: string;
  userId: string;
  status: string;
  expiresAt: string;
}

export const LINK_TTL_MS = 10 * 60 * 1000; // 10 minutos

/** Crea un contrato de vinculación pendiente (expira a los 10 min). */
export async function createLinkRequest(userId: string): Promise<LinkRequest> {
  const now = Date.now();
  const req: LinkRequest = {
    id: randomHex(16),
    userId,
    status: "pending",
    expiresAt: new Date(now + LINK_TTL_MS).toISOString(),
  };
  await getDb()
    .insert(telegramLinkRequestsTable)
    .values({ ...req, createdAt: new Date(now).toISOString() });
  return req;
}

/**
 * Devuelve el request por código. Si está pendiente y venció,
 * lo marca `expired` antes de responder (expiración perezosa).
 */
export async function getLinkRequest(
  code: string,
): Promise<LinkRequest | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(telegramLinkRequestsTable)
    .where(eq(telegramLinkRequestsTable.id, code))
    .limit(1);
  const req = rows[0];
  if (!req) return null;
  if (req.status === "pending" && Date.parse(req.expiresAt) <= Date.now()) {
    await setStatus(req.id, "expired");
    return { ...req, status: "expired" };
  }
  return req;
}

async function setStatus(id: string, status: LinkStatus): Promise<void> {
  await getDb()
    .update(telegramLinkRequestsTable)
    .set({ status })
    .where(eq(telegramLinkRequestsTable.id, id));
}

/** El usuario confirmó en el bot → queda vinculado el chat. */
export async function confirmLink(
  code: string,
  chatId: string,
): Promise<LinkStatus> {
  const req = await getLinkRequest(code);
  if (!req) return "expired";
  if (req.status !== "pending") return req.status as LinkStatus;
  await linkTelegramChat(req.userId, chatId);
  await setStatus(req.id, "confirmed");
  return "confirmed";
}

/** El usuario respondió que no → cancela el contrato. */
export async function cancelLink(code: string): Promise<LinkStatus> {
  const req = await getLinkRequest(code);
  if (!req) return "expired";
  if (req.status !== "pending") return req.status as LinkStatus;
  await setStatus(req.id, "cancelled");
  return "cancelled";
}
