# Design — add-checky-agent

## Flujo

```
Telegram update (texto) → webhook
  → resolveUser(chat_id)            // contacts.telegram_chat_id → user_id
  → sin vínculo → "vinculá tu cuenta desde la app"
  → rate limit: count hoy ≥ CHECKY_DAILY_INPUT_MAX (7) → aviso cute
  → cargar últimas CHECKY_CONTEXT_MAX (14) interacciones
  → agente LangChain (HF LLM) con tools MCP (source "telegram")
  → guardar par (user_msg, assistant_msg) en checky_messages
  → sendTelegramMessage(respuesta)
```

## Identidad

`chat_id` del update → `contacts.telegram_chat_id` → `user_id`. El token de sesión del usuario para las tools MCP se obtiene de `sessions_table` (si no hay sesión activa, se crea una interna de servicio ligada al usuario — documentado). Ningún texto del usuario puede suplantar identidad.

## Persistencia (`checky_messages`)

Tabla D1: `id`, `user_id`, `role` (`user`|`assistant`), `text`, `created_at`, `day` (YYYY-MM-DD UTC para el conteo). Se conservan solo las últimas N = 2 × CHECKY_CONTEXT_MAX filas por usuario (prune al insertar).

## Persona y restricciones

System prompt fijo:

- Sos Checky, una chica cute: tono dulce, rioplatense, emojis suaves.
- SOLO hablás de compras del hogar: comida, bebidas, ropa, limpieza/higiene.
- Podés usar herramientas para ver/crear/editar lugares, listas, productos e invitados — siempre respetando los permisos del usuario.
- NO escribís scripts, código ni instrucciones de programación; ante pedidos de código rechazás con amabilidad.
- Ante temas ajenos: "¡Eso no es de compras del hogar! 🥺 ¿Qué necesitás comprar?"

## Tools MCP

Wrapper `mcpClient.callTool(userToken, name, args)` → `POST /api/mcp` con `source: "telegram"`. Expuestos al agente como tools LangChain con el MISMO set del servidor (los permisos los valida el servidor con el usuario real).

## Env vars

| Var | Default | Uso |
|---|---|---|
| `HF_API_TOKEN` | — | Token de Hugging Face Inference |
| `HF_MODEL` | `meta-llama/Llama-3.2-3B-Instruct` | Modelo conversacional |
| `CHECKY_DAILY_INPUT_MAX` | `7` | Máx. mensajes de usuario/día (UTC) |
| `CHECKY_CONTEXT_MAX` | `14` | Interacciones en la ventana de contexto |

## Errores y límites

- Sin vínculo: mensaje guiando a vincular (no cuenta como input).
- Límite diario: respuesta cute "ya hablamos mucho por hoy 💤".
- Fallo del LLM/MCP: respuesta de error amable; el mensaje del usuario sí se registra.
