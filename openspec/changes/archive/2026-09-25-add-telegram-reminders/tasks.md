# Tasks — add-telegram-reminders

## 1. Modelo `contact`

- [x] 1.1 Migración Drizzle + tabla `contacts` (`id`, `user_id` único, `phone`, `telegram_chat_id`, `created_at`) — `drizzle/0001_chunky_vertigo.sql`, aplicada a D1 local
- [x] 1.2 `src/lib/server/contacts.ts`: `getContact`, `upsertContact`, `linkTelegramChat`
- [x] 1.3 `GET/PUT /api/contacts`: upsert del teléfono del usuario autenticado (Bearer); valida formato básico
- [x] 1.4 UI: bloque "Recordatorios" en el sidebar del Dashboard (input teléfono si falta + botón "Vincular Telegram" → `t.me/<bot>?start=<userId>`)

## 2. Vinculación con Telegram

- [x] 2.1 `src/lib/telegram.ts`: `sendTelegramMessage(chatId, text, buttons)`, manejo de error y `retry_after` (1 reintento)
- [x] 2.2 `POST /api/telegram/webhook`: valida `X-Telegram-Bot-Api-Secret-Token`, procesa `/start <userId>` → guarda `telegram_chat_id` en `contacts` (corre dentro del deploy de Webflow Cloud)
- [x] 2.3 `setWebhook` documentado en el comentario de la route (`url=<APP_URL>/api/telegram/webhook` + `secret_token`)

## 3. Cron de recordatorios

- [x] 3.1 `wrangler.json` triggers: `crons = ["0 */8 * * *"]` + `worker.ts` (entrypoint que envuelve `.open-next/worker.js`); fallback: `POST /api/cron/reminders` con `CRON_SECRET` para scheduler externo
- [x] 3.2 Handler `scheduled()` → `runReminders(env)`: lee `app_state`, calcula listas pendientes por usuario (`a_comprar`/`comprando` o `scheduledAt` en las próximas 8 h)
- [x] 3.3 Mensaje en español + `inline_keyboard` con botón "Ver lista" → `<APP_URL>/listas/<listId>` (una fila por lista)
- [x] 3.4 Fan-out asincrónico con `Promise.allSettled` dentro de `ctx.waitUntil`; resultado logueado (`sent/failed/skipped`)

## 4. `redirect_path` en auth

- [x] 4.1 Ruta `/listas/[id]` que abre el detalle de la lista si hay sesión (`Dashboard` acepta `initialListId`)
- [x] 4.2 Sin sesión → `/?redirect_path=/listas/<id>`; tras login/registro exitoso, `AuthScreen` navega a `redirect_path` (solo rutas internas: `/...` sin `//`)
- [x] 4.3 Al salir del detalle desde `/listas/[id]`, la app vuelve a `/` (`router.replace`)

## 5. Env vars y docs

- [x] 5.1 `.env.example`: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, `APP_URL`, `CRON_SECRET`
- [ ] 5.2 Configurar secrets en el entorno de deploy (manual, no commitear valores)

## 6. Verificación

- [x] 6.1 `npx tsc --noEmit` y `npm run lint` limpios
- [x] 6.2 `POST /api/cron/reminders` verificado en dev (401 sin secret, `ok` con `CRON_SECRET`); el trigger nativo se prueba tras el deploy o con `wrangler dev --test-scheduled`
- [x] 6.3 Login con `redirect_path` implementado y validado como ruta interna; `/listas/test123` → 200 y redirige a login sin sesión
- [x] 6.4 Usuario sin `chat_id` o sin pendientes se omite (`skipped`); fallo individual no aborta el lote (`allSettled`)
- [x] 6.5 `openspec validate add-telegram-reminders --strict` ✓
