# telegram-reminders Specification

## Purpose
TBD - created by archiving change add-telegram-reminders. Update Purpose after archive.

## Requirements

### Requirement: Cron de recordatorios cada 8 horas

El sistema DEBERÁ (SHALL) ejecutar un proceso programado mediante Cloudflare Workers Cron Triggers con la expresión `0 */8 * * *` (a las 00:00, 08:00 y 16:00 UTC). La ejecución DEBERÁ (SHALL) completarse dentro de `ctx.waitUntil` para no ser cancelada al finalizar el evento programado.

#### Scenario: Ejecución programada
- **WHEN** el scheduler de Cloudflare dispara el trigger a las 00:00, 08:00 o 16:00 UTC
- **THEN** el handler `scheduled()` recorre los usuarios y envía los recordatorios correspondientes

#### Scenario: Error en un envío no aborta el lote
- **WHEN** el envío a un usuario falla (chat bloqueado, error de red, rate limit)
- **THEN** el error se registra y el proceso continúa con los demás usuarios

### Requirement: Cálculo de compras pendientes por usuario

El sistema DEBERÁ (SHALL) considerar "tareas pendientes" de un usuario a las listas de sus places (donde es miembro) que estén en estado `a_comprar` o `comprando`, o cuyo `scheduledAt` caiga dentro de las próximas 8 horas desde la ejecución. Si un usuario no tiene tareas pendientes, NO se le enviará (SHALL NOT) mensaje.

#### Scenario: Usuario con lista a comprar
- **WHEN** el usuario es miembro de un place con una lista en estado `a_comprar`
- **THEN** esa lista aparece en su recordatorio

#### Scenario: Lista programada próxima
- **WHEN** una lista tiene `scheduledAt` dentro de las próximas 8 horas desde el tick del cron
- **THEN** esa lista aparece en el recordatorio aunque siga en estado `listando`

#### Scenario: Usuario sin pendientes
- **WHEN** el usuario no tiene listas en `a_comprar`, `comprando` ni programadas en la ventana
- **THEN** no se envía ningún mensaje a ese usuario

### Requirement: Envío asincrónico de mensajes por Telegram

Los mensajes DEBERÁN (SHALL) enviarse a través del Bot API de Telegram (`sendMessage`) usando `TELEGRAM_BOT_TOKEN` del entorno (nunca expuesto al cliente). Los envíos a distintos usuarios DEBERÁN (SHALL) realizarse de forma asincrónica en paralelo (`Promise.allSettled`), de modo que la latencia o el fallo de un envío no bloquee ni cancele los demás. Ante una respuesta 429 se respetará `retry_after` con un único reintento.

#### Scenario: Envíos en paralelo
- **WHEN** hay N usuarios con pendientes y `telegram_chat_id` vinculado
- **THEN** los N envíos se disparan en paralelo y cada resultado se procesa de forma independiente

#### Scenario: Usuario sin chat vinculado
- **WHEN** un usuario tiene pendientes pero su `contact` no tiene `telegram_chat_id`
- **THEN** ese usuario se omite sin error y el resto del lote continúa

### Requirement: Botón de acceso directo a la lista

Cada mensaje DEBERÁ (SHALL) incluir un `inline_keyboard` con un botón "Ver lista" cuya `url` apunte a la lista dentro de la app (`<APP_URL>/listas/<listId>`). Si el destinatario no tiene sesión activa al abrirlo, la app DEBERÁ (SHALL) pedirle login conservando `redirect_path` para llevarlo a la lista tras autenticarse.

#### Scenario: Usuario con sesión
- **WHEN** el usuario abre el link del botón y tiene sesión activa
- **THEN** la app abre directamente el detalle de esa lista

#### Scenario: Usuario sin sesión
- **WHEN** el usuario abre el link sin sesión activa
- **THEN** se lo lleva al login con `redirect_path` y, tras autenticarse con éxito, termina en la lista indicada

### Requirement: Vinculación del usuario con el bot

El sistema DEBERÁ (SHALL) vincular el `telegram_chat_id` del usuario cuando este inicie conversación con el bot mediante `/start <userId>`, procesado por un webhook (`POST /api/telegram/webhook`) que valide el header `X-Telegram-Bot-Api-Secret-Token`.

#### Scenario: Vinculación exitosa
- **WHEN** el usuario envía `/start <userId>` al bot tras tocar "Vincular Telegram" en la app
- **THEN** el webhook guarda el `chat_id` en el `contact` de ese usuario

#### Scenario: Webhook sin secret válido
- **WHEN** llega un POST al webhook sin el header secreto correcto
- **THEN** se responde 401 y no se modifica ningún dato
