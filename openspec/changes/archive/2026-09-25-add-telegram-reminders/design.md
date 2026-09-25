# Design — add-telegram-reminders

## Context

food2check corre sobre OpenNext/Cloudflare con persistencia en D1 (SQLite). El estado de dominio (places, listas, items, productos) vive en el documento `app_state`; usuarios y sesiones tienen tablas propias. No hay hoy ningún mecanismo de notificación ni jobs programados.

## Decisions

### Cron: Cloudflare Workers Cron Triggers

- `wrangler` config: `triggers.crons = ["0 */8 * * *"]` → ejecuta a las 00:00, 08:00 y 16:00 UTC (cumple "cada 8 horas iniciando a las 00").
- El entrypoint del worker exporta `scheduled(event, env, ctx)` que dispara el proceso de recordatorios con `ctx.waitUntil(...)` para que complete aunque la ejecución programada termine.
- **Contingencia Webflow Cloud**: si el worker gestionado por Webflow Cloud no permite declarar cron triggers, el fallback es una API route protegida `POST /api/cron/reminders` (mismo deploy) invocada por un scheduler externo (GitHub Actions schedule, cron-job.org, etc.) con un `Authorization: Bearer <CRON_SECRET>`. La lógica de recordatorios es la misma; solo cambia quién la dispara.

### Qué se notifica ("tareas que deben realizar")

Por usuario, se buscan sus places (miembros con cualquier permiso) y dentro de ellos las listas que requieren acción:

- listas en estado `a_comprar` o `comprando`;
- listas con `scheduledAt` dentro de las próximas 8 horas (hasta el próximo tick del cron).

Si el usuario no tiene nada pendiente, **no se le manda mensaje** (evita spam).

### Envío asincrónico

- `Promise.allSettled` sobre el fan-out de usuarios: cada envío es un `fetch` a `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage` independiente.
- Un fallo de Telegram (chat bloqueado, red, rate limit) se loguea y no aborta el resto.
- Se respeta `retry_after` de Telegram si responde 429 (reintento una vez dentro de `waitUntil`).

### Botón "Ver lista" + `redirect_path`

- `inline_keyboard: [[{ text: "Ver lista", url: "<APP_URL>/listas/<listId>" }]]`.
- La URL de botones inline de Telegram debe ser http(s) absoluta → `APP_URL` en env vars (ej. `https://food2check.example.com`).
- En la app, la ruta de lista requiere sesión:
  - si hay sesión → abre el detalle directo;
  - si no hay sesión → redirige a `/login?redirect_path=<ruta-codificada>`.
- Tras login/registro exitoso, si existe `redirect_path` y es una **ruta interna** (empieza con `/`, sin `//` ni esquema — anti open-redirect), se navega ahí; caso contrario al dashboard.

### Modelo `contact`

Nueva tabla `contacts` en D1 (migración Drizzle):

| columna          | tipo    | notas                                   |
| ---------------- | ------- | --------------------------------------- |
| `id`             | text PK | uuid                                    |
| `user_id`        | text FK | → `users.id`, unique (un contacto por usuario) |
| `phone`          | text    | formato E.164 normalizado               |
| `telegram_chat_id` | text  | null hasta que el usuario hable con el bot |
| `created_at`     | integer | epoch ms                                |

- **Por qué separado**: el usuario pidió explícitamente un modelo aparte (`contact`) con relación usuario→teléfono, no un campo en `users`.
- **Vinculación con Telegram**: para mandar mensajes hace falta `chat_id`, que Telegram solo da cuando el usuario inicia el bot. Flujo elegido: la app muestra el botón "Vincular Telegram" que abre `t.me/<bot>?start=<userId>`; cuando el usuario manda `/start`, el webhook guarda `chat_id` en su `contact`. El teléfono se pide igualmente (requisito) y se usa como dato de contacto + posible verificación futura.
- **El webhook corre dentro del servidor de Webflow Cloud**: es una API route del mismo deploy de Next.js (`POST /api/telegram/webhook`), no un servicio aparte. Telegram hace `POST` HTTPS a `<APP_URL>/api/telegram/webhook` (se registra una sola vez con `setWebhook` apuntando a esa URL + `secret_token`). Al ser una route del app, tiene acceso directo a D1 y a las env vars del deploy.
- Alternativa descartada: pedir `chat_id` manual — mala UX, nadie sabe su chat_id.

### Pedir el teléfono

- En el sidebar/perfil: si el usuario no tiene `contact`, se muestra un prompt no bloqueante ("Agregá tu teléfono para recibir recordatorios") con input `tel`.
- Endpoint `PUT /api/contacts` (auth por Bearer) que hace upsert del contact del usuario actual.

### Seguridad y privacidad

- `TELEGRAM_BOT_TOKEN` solo en env del worker — nunca `NEXT_PUBLIC_`.
- El webhook valida un `secret_token` configurado en `setWebhook` (`X-Telegram-Bot-Api-Secret-Token`).
- El teléfono se guarda asociado al user, nunca dentro del documento `app_state` compartido.
- `redirect_path` se valida como ruta interna para evitar open redirects.

## Env vars nuevas

- `TELEGRAM_BOT_TOKEN` (secreto)
- `TELEGRAM_WEBHOOK_SECRET` (secreto)
- `APP_URL` (URL pública de la app)
- `TELEGRAM_BOT_USERNAME` (para armar el link `t.me/...`)

## Risks

- Si el usuario nunca habla con el bot, no hay `chat_id` y no recibe mensajes → mitigado con el prompt de vinculación en UI.
- Cron en UTC: las 08:00 UTC son 05:00 ART — puede ser temprano; aceptable v1, configurable después.
- El documento `app_state` es global: el cron lo lee una vez y recorre usuarios en memoria — O(n) aceptable al tamaño actual.
