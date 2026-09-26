# Tasks — add-checky-agent

## 1. Persistencia del historial

- [x] 1.1 Migración Drizzle: tabla `checky_messages` (`id`, `user_id`, `role`, `text`, `day`, `created_at`)
- [x] 1.2 `src/lib/server/checky/history.ts`: leer últimas N interacciones, guardar par user/assistant, conteo diario por `user_id` + `day`, prune a la ventana

## 2. Agente Checky

- [x] 2.1 Tools del dominio compartidas (`src/lib/server/mcpTools.ts`): el agente las invoca con `source: "telegram"` y el userId resuelto (misma lógica y permisos que `POST /api/mcp`)
- [x] 2.2 Dependencias LangChain (`langchain`, `@langchain/core`, `@langchain/openai`) + Hugging Face Inference (`HF_API_TOKEN`, `HF_MODEL`)
- [x] 2.3 `src/lib/server/checky/agent.ts`: agente `createAgent` (v1) con system prompt de persona cute + restricción temática (solo compras del hogar; sin scripts) + respuestas en texto plano y tools MCP mapeados a zod
- [x] 2.4 Rate limit: `CHECKY_DAILY_INPUT_MAX` (7) inputs/usuario/día UTC con respuesta amable al exceder; errores del modelo → silencio (solo logs)

## 3. Integración webhook

- [x] 3.1 `webhook/route.ts`: texto que no es `/start` → resolver `chat_id` → `user_id` vía `contact.telegram_chat_id` → agente; sin vínculo → mensaje guiando a vincular
- [x] 3.2 `.env.example`: `HF_API_TOKEN`, `HF_MODEL`, `CHECKY_DAILY_INPUT_MAX`, `CHECKY_CONTEXT_MAX`

## 4. Verificación

- [x] 4.1 Flujo local: mensaje real al bot → respuesta cute en tema de compras; pedido off-topic/script → rechazo amable
- [x] 4.2 Límite diario: 8.º mensaje → aviso; ventana: el historial no supera 14 interacciones
- [x] 4.3 Tool MCP usada por el agente (ej. "qué listas tengo") respetando permisos — verificado en vivo con Qwen3-4B
- [x] 4.4 `tsc` + `lint` + `openspec validate --strict`
