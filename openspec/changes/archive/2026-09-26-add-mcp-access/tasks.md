# Tasks — add-mcp-access

## 1. Dominio server-side

- [x] 1.1 `src/lib/server/mcpDomain.ts`: lectura del doc `app_state` + helpers de permisos (`getPlaceRole`, `isPlaceAdmin`, `canEditList`, `isListAdmin`, `canReadList`, `getListInvite`) equivalentes a las reglas del cliente
- [x] 1.2 Mutaciones sobre el doc: places (crear, miembros, roles), listas (crear, update completo, estado, borrar con items+invites), invitados de lista, productos
- [x] 1.3 Escritura atómica del doc + invocación de `notifyListChanges` tras cada mutación

## 2. Endpoint MCP

- [x] 2.1 `POST /api/mcp`: auth Bearer → `getSessionUser` (401 sin sesión); dispatch JSON-RPC (`initialize`, `ping`, `notifications/initialized`, `tools/list`, `tools/call`)
- [x] 2.2 Definición de tools con `inputSchema` (JSON Schema) y validación de argumentos — incluye `source: "site" | "telegram"` obligatorio en cada `tools/call`
- [x] 2.3 Errores JSON-RPC estándar + mensajes de dominio en español

## 3. Verificación

- [x] 3.1 `tools/list` y `initialize` responden con token válido; 401 sin token
- [x] 3.2 `tools/call` end-to-end: crear place, crear lista, agregar item, invitar, cambiar rol — respetando permisos (casos de rechazo incluidos)
- [x] 3.3 Una mutación vía MCP dispara el reporte consolidado de Telegram
- [x] 3.4 `npx tsc --noEmit` + `npm run lint` + `openspec validate --strict`
