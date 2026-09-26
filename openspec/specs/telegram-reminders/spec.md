# telegram-reminders Specification

## Purpose
Recordatorios y notificaciones por Telegram: cron cada 8 h con las compras pendientes, contrato de vinculación con expiración y confirmación desde el bot, y reporte único consolidado de cambios en listas.

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

### Requirement: Contrato de vinculación del usuario con el bot

La vinculación DEBERÁ (SHALL) seguir un contrato persistente (tabla `telegram_link_requests`): al tocar "Vincular con Telegram" la app crea un request con código único y expiración de 10 minutos (`pending`), abre `t.me/<bot>?start=<code>`, y escucha el estado por SSE (`/api/contacts/link/stream`). El webhook (`POST /api/telegram/webhook`, validando `X-Telegram-Bot-Api-Secret-Token`) responde al `/start <code>` con un mensaje que identifica el bot (`getMe`) y la cuenta que solicita la vinculación (username + teléfono del `contact`), junto a botones inline **Sí, conectar / No, cancelar**. Sí → `confirmed` y se guarda `telegram_chat_id`; No → `cancelled`; 10 minutos sin respuesta → `expired` (expiración perezosa).

#### Scenario: Confirmación con botones
- **WHEN** el usuario envía `/start <code>` y toca "Sí, conectar"
- **THEN** el webhook guarda el `chat_id` en el `contact`, el request pasa a `confirmed` y la página muestra "¡Vinculación completada!" vía SSE

#### Scenario: Rechazo en el bot
- **WHEN** el usuario toca "No, cancelar"
- **THEN** el request pasa a `cancelled` y la página lo refleja sin vincular

#### Scenario: Expiración
- **WHEN** pasan 10 minutos sin respuesta en Telegram
- **THEN** el request se marca `expired` al consultarse y la página invita a generar un link nuevo

#### Scenario: Webhook sin secret válido
- **WHEN** llega un POST al webhook sin el header secreto correcto
- **THEN** se responde 401 y no se modifica ningún dato

### Requirement: Reporte único de cambios en listas

El sistema DEBERÁ (SHALL) notificar por Telegram los cambios en listas, comparando el documento anterior y el nuevo en `PUT /api/state`. Se detectan: cambios de estado, productos agregados, quitados y modificados (unidades). Los eventos DEBERÁN (SHALL) consolidarse en **un único mensaje por usuario destinatario** con una sección por lista afectada y un botón "Ver lista" por cada una. Los destinatarios son los miembros del place más los invitados de la lista que tengan `telegram_chat_id` — **incluido quien originó el cambio**. Los envíos se hacen en paralelo con `Promise.allSettled`.

#### Scenario: Varios cambios, un mensaje
- **WHEN** en un mismo guardado una lista cambia de estado y otra agrega un producto
- **THEN** el usuario recibe un solo mensaje con ambas secciones y un botón de acceso por lista

#### Scenario: El actor también recibe
- **WHEN** un usuario modifica una lista de un lugar donde tiene Telegram vinculado
- **THEN** también recibe el reporte junto al resto de relacionados
