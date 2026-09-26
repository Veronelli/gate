import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getEnvVar } from "@/lib/server/env";
import { dispatchChecky } from "@/lib/server/checky/agent";
import {
  answerCallbackQuery,
  getBotMe,
  sendTelegramMessage,
} from "@/lib/telegram";
import {
  cancelLink,
  confirmLink,
  getLinkRequest,
} from "@/lib/server/telegramLink";
import { getContact } from "@/lib/server/contacts";
import { getDb } from "@/db/getDb";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number | string };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat?: { id?: number | string } };
  };
}

/**
 * Webhook del bot de Telegram, corre dentro del deploy (Webflow Cloud).
 * Registrar una vez con:
 *   setWebhook url=<APP_URL>/api/telegram/webhook secret_token=<TELEGRAM_WEBHOOK_SECRET>
 *
 * Contrato de vinculación:
 *   /start <code>  → el bot pregunta "¿Te conectás?" con botones Sí/No
 *   botón Sí     → confirmLink: guarda telegram_chat_id en contact
 *   botón No     → cancelLink
 *   10 min sin respuesta → el request expira solo (lazy)
 */
export async function POST(request: Request) {
  const secret = await getEnvVar("TELEGRAM_WEBHOOK_SECRET");
  const header = request.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || header !== secret) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const token = await getEnvVar("TELEGRAM_BOT_TOKEN");
  const update = (await request.json()) as TelegramUpdate;

  // --- Respuesta a los botones Sí/No del contrato ----------------------
  const cb = update.callback_query;
  if (cb?.id && cb.data) {
    const [action, code] = cb.data.split(":");
    const chatId = cb.message?.chat?.id;
    if (code && chatId != null && token) {
      if (action === "link_yes") {
        const status = await confirmLink(code, String(chatId));
        await sendTelegramMessage(
          token,
          String(chatId),
          status === "confirmed"
            ? "✅ ¡Vinculación completada! Te voy a avisar por acá cuando tengas compras pendientes."
            : "Ese link ya no está activo (confirmado o vencido). Generá uno nuevo desde la app.",
        );
      } else if (action === "link_no") {
        const status = await cancelLink(code);
        await sendTelegramMessage(
          token,
          String(chatId),
          status === "cancelled"
            ? "Vinculación cancelada. Si querés intentar de nuevo, generá otro link desde la app."
            : "Ese link ya no está activo.",
        );
      }
      await answerCallbackQuery(token, cb.id);
    }
    return NextResponse.json({ ok: true });
  }

  // --- /start <code> → preguntar si quiere conectarse -------------------
  const text = update.message?.text?.trim() ?? "";
  const chatId = update.message?.chat?.id;
  if (chatId == null || !text) {
    return NextResponse.json({ ok: true });
  }

  // Texto que no es /start → agente Checky (identidad por chat_id).
  if (!text.startsWith("/start")) {
    if (!token) return NextResponse.json({ ok: true });
    const work = dispatchChecky(String(chatId), text, token).catch((e) =>
      console.warn("checky:", e),
    );
    try {
      const { ctx } = await getCloudflareContext({ async: true });
      if (ctx?.waitUntil) {
        ctx.waitUntil(work);
        return NextResponse.json({ ok: true });
      }
    } catch {
      // Sin contexto CF (next dev): se espera inline.
    }
    await work;
    return NextResponse.json({ ok: true });
  }
  if (!token) return NextResponse.json({ ok: true });

  const code = text.split(/\s+/)[1];
  if (!code) {
    await sendTelegramMessage(
      token,
      String(chatId),
      "¡Hola! Soy Checky, el bot de food2check 🛒 Para vincular tu cuenta generá el link desde la app (botón “Vincular con Telegram”).",
    );
    return NextResponse.json({ ok: true });
  }

  const req = await getLinkRequest(code);
  if (!req || req.status !== "pending") {
    await sendTelegramMessage(
      token,
      String(chatId),
      "Ese link ya no está activo (usado o vencido). Generá uno nuevo desde la app.",
    );
    return NextResponse.json({ ok: true });
  }

  // Datos para identificar quién pide la vinculación.
  const [bot, userRows, contact] = await Promise.all([
    getBotMe(token),
    getDb()
      .select({ username: usersTable.username })
      .from(usersTable)
      .where(eq(usersTable.id, req.userId))
      .limit(1),
    getContact(req.userId),
  ]);
  const botLabel = bot
    ? `${bot.firstName} (@${bot.username})`
    : "el bot de food2check";
  const person = userRows[0]?.username ?? "tu cuenta";
  const phone = contact?.phone ? ` (tel. ${contact.phone})` : "";

  await sendTelegramMessage(
    token,
    String(chatId),
    `🔗 Hola, soy ${botLabel}, el bot de food2check.\n\nLa cuenta de ${person}${phone} quiere vincular este Telegram para recibir recordatorios de compras. ¿Confirmás?\n\nTenés 10 minutos para responder.`,
    [
      [
        { text: "Sí, conectar", callback_data: `link_yes:${code}` },
        { text: "No, cancelar", callback_data: `link_no:${code}` },
      ],
    ],
  );
  return NextResponse.json({ ok: true });
}
