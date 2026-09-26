# Design — add-mcp-access

## Transporte y ubicación

El servidor MCP corre **dentro del mismo deploy de Webflow Cloud** como API route de Next.js: `POST /api/mcp`. Usa el transporte *streamable HTTP* del protocolo MCP en su modo simple: cada request JSON-RPC recibe una respuesta JSON (sin streaming SSE por ahora — el protocolo permite respuestas planas cuando el método no las requiere).

Métodos soportados:

| Método | Respuesta |
|---|---|
| `initialize` | `protocolVersion`, `capabilities.tools`, `serverInfo` (`food2check-mcp`) |
| `notifications/initialized` | 202 sin body |
| `tools/list` | listado de tools con `inputSchema` (JSON Schema) |
| `tools/call` | ejecuta el tool y devuelve `{ content: [{type:"text", text}], isError }` |
| `ping` | `{}` |

## Identidad y permisos (lo pedido por el usuario)

El usuario/agente **provee sus credenciales como token Bearer** (el token de sesión que ya devuelve `/api/auth/login`). El servidor:

1. Resuelve `userId` desde `sessions_table` — nunca del body ni de parámetros.
2. Cada tool vuelve a verificar permisos sobre el doc: `getPlaceRole`, `isPlaceAdmin`, `canEditList`, `isListAdmin`, `canReadList`, `getListInvite` — mismas reglas que el cliente, reimplementadas server-side en `src/lib/server/mcpDomain.ts` operando sobre las colecciones del `app_state`.
3. Cualquier `userId` en los argumentos es un **objetivo** (ej. a quién invitar), validado: existencia, membresía, no-admin, etc. Un usuario sin permiso recibe error sin mutar nada.

## Parámetro `source`

Cada `tools/call` DEBERÁ incluir `source` con uno de estos valores:

| `source` | Origen |
|---|---|
| `site` | Llamadas originadas desde la app web |
| `telegram` | Llamadas originadas desde el bot/flujo de Telegram |

Se valida contra el enum (`-32602` si falta o es otro valor) y se propaga a la capa de dominio como metadato de la operación: sirve para atribuir la mutación (ej. marcar en el reporte de Telegram si el cambio vino del sitio o del bot) y, a futuro, para reglas por canal.

## Mutaciones sobre `app_state`

El dominio vive en un único documento JSON compartido (`app_state`, `STATE_ID=1`). Las mutaciones MCP:

```
doc viejo → aplicar mutación (con chequeo de permiso) → escribir doc →
notifyListChanges(docViejo, docNuevo)  // mismo reporte Telegram que la app
```

Así los cambios vía MCP producen exactamente las mismas notificaciones consolidadas que los cambios desde la UI.

## Concurrencia

D1 serializa escrituras por fila; el read→write del doc puede perder updates concurrentes (igual que el sync actual). Se acepta el mismo comportamiento que `PUT /api/state`. Si se vuelve un problema, migrar a transacciones por entidad es un change aparte.

## Tools — resumen de contratos

- `list_places` → places donde el usuario es miembro (+ su rol).
- `get_place` `{placeId}` → miembros con roles + propietario. Requiere membresía.
- `create_place` `{name}` → crea place; el usuario queda propietario/admin.
- `invite_place_member` `{placeId, username, role: read|write}` → solo admin del place.
- `set_place_member_role` `{placeId, userId, role}` → solo admin; no aplica al propietario.
- `remove_place_member` `{placeId, userId}` → solo admin; no al propietario.
- `list_lists` `{placeId}` → listas visibles (membresía o invitación).
- `get_list` `{listId}` → meta + items + invitados. Requiere `canReadList`.
- `create_list` `{placeId, name, description?, tags?, scheduledAt?, importance?}` → requiere escritura en el place.
- `update_list` `{listId, name?, description?, state?, tags?, scheduledAt?, importance?, items?}` → reemplazo completo del contenido provisto (PUT semantics); requiere `canEditList`.
- `delete_list` `{listId}` → borra lista + items + invitados; requiere `canEditList`.
- `set_list_state` `{listId, state}` → requiere `canEditList`.
- `invite_to_list` `{listId, userId|username}` → requiere `isListAdmin`.
- `set_list_invite_permission` `{listId, userId, permission: read|edit}` → `isListAdmin`.
- `remove_list_invite` `{listId, userId}` → `isListAdmin`.
- `list_products` `{placeId}` → catálogo del place. Requiere membresía.
- `create_product` `{placeId, name, brand?, imageUrl?, suggestedPrice?, unitsRemaining?}` → requiere escritura.

## Errores

- JSON-RPC `-32601` método desconocido, `-32602` params inválidos, `-32603` interno.
- Sin sesión válida → HTTP 401 (antes del JSON-RPC).
- Sin permiso → `tools/call` responde `isError: true` con mensaje en español (ej. "No tenés permiso para editar esta lista.").
