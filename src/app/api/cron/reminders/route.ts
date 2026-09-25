import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { runReminders, type RemindersEnv } from "@/lib/server/reminders";
import { getEnvVar } from "@/lib/server/env";

/**
 * Fallback del cron para entornos donde el worker no soporta
 * Cron Triggers (p. ej. Webflow Cloud): un scheduler externo pega
 * POST con `Authorization: Bearer <CRON_SECRET>` cada 8 horas.
 */
export async function POST(request: Request) {
  const secret = await getEnvVar("CRON_SECRET");
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const result = await runReminders(env as unknown as RemindersEnv);
  return NextResponse.json({ ok: true, ...result });
}
