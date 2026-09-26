# add-checky-agent

## Why

El bot de Telegram hoy solo notifica y confirma vinculaciones — no conversa. Queremos un **agente conversacional (Checky)** dentro del mismo chat, que entienda el contexto del hogar (listas, productos, lugares) y pueda **actuar** sobre el dominio usando el servidor MCP, pero limitado: pocos mensajes por día, memoria corta y solo temas de compras del hogar.

## What Changes

- **Agente Checky con LangChain + Hugging Face**: el webhook de Telegram, al recibir un mensaje de texto (que no sea `/start`), invoca un agente LangChain cuyo modelo es un LLM de Hugging Face (`HF_API_TOKEN`, `HF_MODEL` en env).
- **Identidad por metadatos de Telegram**: el usuario se resuelve desde `chat_id` del update → `contact.telegram_chat_id` → `user_id`. El mensaje del usuario **nunca** define quién es; si no hay vinculación, el bot responde pidiendo vincular desde la app.
- **Herramientas MCP**: el agente invoca `POST /api/mcp` (`tools/call`) con el token de sesión del usuario resuelto y `source: "telegram"` — places, listas, items, productos, invitados — respetando los permisos del dominio.
- **Límite diario de inputs**: máx. `CHECKY_DAILY_INPUT_MAX` (default **7**) mensajes de usuario por día (UTC) por `user_id`, persistidos en tabla `checky_messages` (D1). Al superar el límite responde que vuelva mañana.
- **Ventana de contexto**: solo las últimas `CHECKY_CONTEXT_MAX` (default **14**) interacciones (pares usuario/asistente) se envían al modelo; el historial más viejo se descarta.
- **Persona y dominio temático**: Checky habla como una chica cute (español rioplatense, tono dulce) y **solo** trata compras del hogar: comida, bebidas, ropa y productos de limpieza/higiene del hogar. No puede entregar scripts, código, ni responder temas ajenos — rechaza con amabilidad y redirige al tema.
- **Solo Telegram**: el agente no se expone por HTTP ni por la app web; su único canal es el webhook del bot.

## Non-goals

- Sin streaming de tokens hacia Telegram (respuesta completa por mensaje).
- Sin voz, imágenes ni stickers.
- No modifica la UI de Checky en la app web (es otra cosa: FAQ estático).
- Sin tool de escritura destructiva masiva (el agente puede borrar una lista/item puntual vía MCP con los permisos del usuario, no operaciones en lote).

## Impact

- Affected specs: `checky-agent` (nuevo), `telegram-reminders` (webhook: manejo de mensajes además de /start y callbacks).
- Affected code:
  - `src/app/api/telegram/webhook/route.ts` — despacha texto → agente Checky.
  - `src/lib/server/checky/` — agente LangChain (prompt de persona + restricciones), rate limit diario, ventana de contexto.
  - `src/lib/server/mcpClient.ts` — cliente interno de `POST /api/mcp` con token del usuario y `source: "telegram"`.
  - `src/db/schema` + migración — tabla `checky_messages` (`user_id`, `role`, `text`, `created_at`) para historial y conteo diario.
  - `.env.example` — `HF_API_TOKEN`, `HF_MODEL`, `CHECKY_DAILY_INPUT_MAX` (7), `CHECKY_CONTEXT_MAX` (14).
  - `package.json` — `langchain`, `@langchain/core`, `@langchain/community` (HuggingFaceInference).
