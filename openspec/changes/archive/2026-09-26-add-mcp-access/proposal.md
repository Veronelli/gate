# add-mcp-access

## Why

Hoy food2check solo se puede operar desde la interfaz web. Para que agentes e integraciones externas (asistentes, automatizaciones) puedan trabajar con los datos de la app — lugares, listas, items y permisos — necesitamos un servidor MCP expuesto dentro del mismo deploy de Webflow Cloud, siguiendo las convenciones del protocolo MCP (streamable HTTP).

## What Changes

- **Endpoint MCP** `POST /api/mcp` (JSON-RPC sobre HTTP streamable) dentro del deploy de Next.js/Webflow Cloud: `initialize`, `tools/list`, `tools/call`, `notifications/initialized`.
- **Identidad por token, nunca por parámetro**: el cliente se autentica con `Authorization: Bearer <session-token>` (el mismo token que emite `/api/auth/login`). El `userId` se resuelve en el servidor desde la sesión — un usuario **no puede declarar** ser otro; cualquier `userId` que llegue por parámetro solo se admite como *objetivo* de una acción (invitar, cambiar rol), nunca como identidad.
- **Parámetro `source` obligatorio**: cada `tools/call` DEBERÁ incluir `source: "site" | "telegram"` indicando el canal de origen (la app web vs. el flujo del bot). El servidor valida el valor y lo usa para la atribución de la operación (el reporte de cambios puede distinguir el origen). Valores fuera del enum → error `-32602`.
- **Permisos reales del dominio**: cada tool valida las reglas ya existentes (`canEditList`, `isListAdmin`, `getPlaceRole`, invitaciones) reimplementadas server-side sobre el documento `app_state`. Sin permiso → error, sin efecto lateral.
- **Tools expuestas**:
  - Lugares: `list_places`, `get_place`, `create_place`, `invite_place_member`, `set_place_member_role`, `remove_place_member`.
  - Listas: `list_lists`, `get_list`, `create_list`, `update_list` (reemplazo completo del contenido — coherente con el PUT único del editor), `delete_list`, `set_list_state`.
  - Invitados de lista: `invite_to_list`, `set_list_invite_permission`, `remove_list_invite`.
  - Catálogo del lugar: `list_products`, `create_product`.
- **Mutaciones atómicas sobre `app_state`**: leer doc → verificar permisos → aplicar → escribir doc → disparar el mismo diff de `notifyListChanges`, de modo que los cambios hechos vía MCP generen el mismo reporte consolidado por Telegram.
- **Errores JSON-RPC estándar** y mensajes de dominio en español.

## Non-goals

- Sin API keys ni OAuth nuevos: se reutilizan los tokens de sesión existentes.
- Sin transporte stdio ni servidor MCP separado: el endpoint vive en el mismo deploy.
- Sin tools de Telegram/contactos ni de usuarios (registro/login) en esta iteración.
- Sin sesiones MCP persistentes ni suscripciones; cada request es stateless sobre el doc actual.

## Impact

- Affected specs: `mcp-access` (nuevo).
- Affected code:
  - `src/app/api/mcp/route.ts` — endpoint JSON-RPC (initialize/tools/list/tools/call).
  - `src/lib/server/mcpDomain.ts` — capa de dominio server-side sobre `app_state` (permisos + mutaciones).
  - `src/lib/server/listNotifications.ts` — reutilizado para el diff post-mutación.
  - `src/lib/server/session.ts` — reutilizado para resolver el usuario por Bearer token.
