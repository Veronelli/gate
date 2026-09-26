import { getLinkRequest } from "@/lib/server/telegramLink";

const POLL_MS = 3000;
const MAX_MS = 11 * 60 * 1000; // corta un poco después del TTL

/**
 * Canal push servidor→página (SSE): emite el estado del contrato de
 * vinculación hasta que llega a un estado terminal
 * (confirmed | cancelled | expired) o se agota el stream.
 */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) {
    return new Response("code requerido", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const started = Date.now();
      const emit = (s: string) =>
        controller.enqueue(encoder.encode(`data: ${s}\n\n`));
      const timer = setInterval(() => {
        void (async () => {
          try {
            const req = await getLinkRequest(code);
            const status = req?.status ?? "expired";
            emit(status);
            if (status !== "pending" || Date.now() - started > MAX_MS) {
              clearInterval(timer);
              controller.close();
            }
          } catch {
            // error transitorio: seguimos intentando hasta MAX_MS
            if (Date.now() - started > MAX_MS) {
              clearInterval(timer);
              controller.close();
            }
          }
        })();
      }, POLL_MS);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
