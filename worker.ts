// Entrypoint del worker: envuelve el worker generado por OpenNext y
// agrega el handler `scheduled` para los Cron Triggers de Cloudflare.
// .open-next/worker.js se genera con `opennextjs-cloudflare build`.
//
// @ts-expect-error - archivo generado en build time
import openNextWorker from "./.open-next/worker.js";
import { runReminders, type RemindersEnv } from "./src/lib/server/reminders";

const worker = openNextWorker as {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response>;
};

const handler = {
  fetch: worker.fetch,
  async scheduled(
    _controller: unknown,
    env: unknown,
    ctx: { waitUntil: (p: Promise<unknown>) => void },
  ) {
    ctx.waitUntil(
      runReminders(env as RemindersEnv).then((r) =>
        console.log(
          `recordatorios: ${r.sent} enviados, ${r.failed} fallidos, ${r.skipped} omitidos`,
        ),
      ),
    );
  },
};

export default handler;
