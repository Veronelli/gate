import { NextResponse } from "next/server";
import { linkTelegramChat } from "@/lib/server/contacts";
import { getEnvVar } from "@/lib/server/env";
import { sendTelegramMessage } from "@/lib/telegram";
import { getDb } from "@/db/getDb";
import { usersTable } from "@/db/schema";

interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number | string };
  };
}

/**
 * Webhook del bot de Telegram, corre dentro del deploy (Webflow Cloud).
 * Registrar una vez con:
 *   setWebhook url=<APP_URL>/api/telegram/webhook secret_token=<TELEGRAM_WEBHOOK_SECRET>
 */
export async function POST(request: Request) {
  const secret = await getEnvVar("TELEGRAM_WEBHOOK_SECRET");
  const header = request.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || header !== secret) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const text = update.message?.text?.trim() ?? "";
  const chatId = update.message?.chat?.id;
  if (!text.startsWith("/start") || chatId == null) {
    return NextResponse.json({ ok: true });
  }

  const userId = text.split(/\s+/)[1];
  const token = await getEnvVar("TELEGRAM_BOT_TOKEN");
  const reply = async (msg: string) => {
    if (token) await sendTelegramMessage(token, String(chatId), msg);
  };

  if (!userId) {
    await reply(
      "¡Hola! Soy el bot de food2check 🛒 Vinculá tu cuenta desde la app (botón “Vincular Telegram”).",
    );
    return NextResponse.json({ ok: true });
  }

  const users = await getDb().select({ id: usersTable.id }).from(usersTable);
  if (!users.some((u) => u.id === userId)) {
    await reply("No reconozco esa cuenta. Volvé a generar el link desde la app.");
    return NextResponse.json({ ok: true });
  }

  await linkTelegramChat(userId, String(chatId));
  await reply(
    "✅ ¡Listo! Tu cuenta quedó vinculada. Te voy a avisar por acá cuando tengas compras pendientes.",
  );
  return NextResponse.json({ ok: true });
}
