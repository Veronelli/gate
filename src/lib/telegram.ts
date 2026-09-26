/** Cliente mínimo del Bot API de Telegram. Server-side only. */

export interface InlineButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

/**
 * Envía un mensaje por Telegram. Ante un 429 respeta `retry_after`
 * y reintenta una única vez.
 */
export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  buttons?: InlineButton[][],
): Promise<SendResult> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (buttons?.length) {
    body.reply_markup = { inline_keyboard: buttons };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return { ok: true };
      const data = (await res.json().catch(() => null)) as {
        description?: string;
        parameters?: { retry_after?: number };
      } | null;
      if (res.status === 429 && attempt === 0) {
        const wait = (data?.parameters?.retry_after ?? 1) * 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      return {
        ok: false,
        error: data?.description ?? `HTTP ${res.status}`,
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "fetch" };
    }
  }
  return { ok: false, error: "retry agotado" };
}

/** Datos públicos del bot (getMe). */
export async function getBotMe(
  token: string,
): Promise<{ username: string; firstName: string } | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = (await res.json()) as {
      ok?: boolean;
      result?: { username?: string; first_name?: string };
    };
    if (!data.ok || !data.result?.username) return null;
    return {
      username: data.result.username,
      firstName: data.result.first_name ?? data.result.username,
    };
  } catch {
    return null;
  }
}

/** Cierra el "loading" del botón inline (answerCallbackQuery). */
export async function answerCallbackQuery(
  token: string,
  queryId: string,
  text?: string,
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: queryId, text }),
    });
  } catch {
    // best-effort
  }
}
