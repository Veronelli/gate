import { NextResponse } from "next/server";
import { createLinkRequest } from "@/lib/server/telegramLink";
import { getEnvVar } from "@/lib/server/env";
import { getSessionUser, unauthorized } from "@/lib/server/session";

/**
 * Inicia el contrato de vinculación: crea un código que expira a los
 * 10 minutos y devuelve el link `t.me/<bot>?start=<code>` para abrir.
 */
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  const req = await createLinkRequest(user.id);
  const bot = (await getEnvVar("NEXT_PUBLIC_TELEGRAM_BOT_USERNAME")) ?? "";
  return NextResponse.json({
    code: req.id,
    expiresAt: req.expiresAt,
    url: bot ? `https://t.me/${bot}?start=${req.id}` : null,
  });
}
