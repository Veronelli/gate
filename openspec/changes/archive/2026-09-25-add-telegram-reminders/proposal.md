# add-telegram-reminders

## Why

Hoy la app es pasiva: si nadie entra, nadie recuerda que hay una compra pendiente o programada. Un recordatorio proactivo por Telegram — cada 8 horas (00:00, 08:00, 16:00) — avisa a cada persona qué compras tiene pendientes y le da un botón que la lleva directo a la lista, incluso si no tiene sesión iniciada.

## What Changes

- **Cron programado** (`0 */8 * * *`, arrancando a las 00:00) vía Cloudflare Workers Cron Triggers, que corre de forma server-side y recorre los usuarios.
- **Recordatorios por Telegram**: por cada usuario con compras pendientes se envía un mensaje con el detalle de sus listas (estado `a_comprar`/`comprando` o programadas en las próximas 8 h). Los envíos se ejecutan **de forma asincrónica** en paralelo (`Promise.allSettled`) para que un usuario lento o un error no bloquee al resto.
- **Botón de acceso directo**: cada mensaje incluye un `inline_keyboard` con un botón "Ver lista" que abre la app apuntando a esa lista. Si el usuario no está logueado, el link lleva `redirect_path` para que, tras un login exitoso, sea redirigido automáticamente a la lista.
- **Modelo `contact`**: nueva tabla/colección separada `contact` con relación usuario → teléfono. La app pedirá el número de teléfono al usuario y lo guardará ahí; es el dato que vincula al usuario con su chat de Telegram.
- **`redirect_path` en auth**: el flujo de login/registro acepta y respeta un parámetro `redirect_path` (solo rutas internas) para redirigir tras autenticarse.

## Non-goals

- No se envían mensajes por otros canales (WhatsApp, email, push).
- No hay respuestas interactivas del bot más allá del botón de acceso (no comandos `/comprar`, etc.).
- No cambia la lógica de estados de listas ni de sugerencias.
- No se verifica el teléfono por SMS en esta iteración (la vinculación con Telegram se hace por el chat del usuario con el bot).

## Impact

- Affected specs: `telegram-reminders` (nuevo), `contacts` (nuevo), `local-auth` (redirect post-login).
- Affected code:
  - `wrangler.json` / `wrangler.toml` — cron trigger `0 */8 * * *`.
  - `src/worker.ts` (o entrypoint del worker) — handler `scheduled()`.
  - `src/lib/telegram.ts` — cliente del Bot API (`sendMessage`, `inline_keyboard`).
  - `src/lib/contacts.ts` + migración D1 — modelo `contact` (userId → phone, chatId).
  - `src/app/api/*` — endpoint para guardar teléfono; handler scheduled.
  - `src/components/AuthForm.tsx` / `Dashboard.tsx` — pedir teléfono; respetar `redirect_path`.
  - `.env.example` — `TELEGRAM_BOT_TOKEN`, `APP_URL`.
