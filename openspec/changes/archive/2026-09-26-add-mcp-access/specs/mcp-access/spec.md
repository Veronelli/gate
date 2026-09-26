# mcp-access Specification

## Purpose

Exponer las operaciones del dominio food2check (lugares, listas, items, permisos, catálogo) a agentes e integraciones externas mediante un servidor MCP (streamable HTTP) dentro del deploy de Webflow Cloud, con identidad resuelta por sesión y permisos verificados en cada acción.

## ADDED Requirements

### Requirement: Endpoint MCP sobre HTTP

El sistema DEBERÁ (SHALL) exponer `POST /api/mcp` implementando JSON-RPC con los métodos `initialize`, `ping`, `notifications/initialized`, `tools/list` y `tools/call`. `tools/list` DEBERÁ (SHALL) devolver cada tool con su `inputSchema` JSON Schema.

#### Scenario: Inicialización
- **WHEN** un cliente MCP autenticado envía `initialize`
- **THEN** responde con `protocolVersion`, `capabilities.tools` y `serverInfo` del servidor

#### Scenario: Listado de tools
- **WHEN** un cliente autenticado envía `tools/list`
- **THEN** recibe las tools de places, listas, invitados y productos con sus esquemas

### Requirement: Identidad por token, nunca por parámetro

La identidad del llamante DEBERÁ (SHALL) resolverse exclusivamente desde el Bearer token de sesión (`Authorization`) validado contra `sessions_table`. Ningún argumento del request PUEDE declarar la identidad del llamante: los `userId` en argumentos solo se aceptan como objetivo de una acción y siempre se validan contra permisos.

#### Scenario: Sin token o inválido
- **WHEN** se llama a `/api/mcp` sin Bearer válido
- **THEN** responde 401 sin ejecutar nada

#### Scenario: Suplantación imposible
- **WHEN** los argumentos de un tool incluyen el `userId` de otro usuario
- **THEN** ese valor se trata como objetivo de la acción (invitar, cambiar rol) y la operación se valida con los permisos del llamante real — el llamante nunca puede actuar como otro

### Requirement: Parámetro `source` obligatorio

Cada `tools/call` DEBERÁ (SHALL) incluir el argumento `source` con valor `site` o `telegram`, indicando el canal de origen de la operación. El servidor DEBERÁ (SHALL) validarlo contra ese enum y rechazar (`-32602`) llamadas sin `source` o con otro valor. El `source` se propaga como metadato de la operación para atribuir el origen del cambio (ej. en el reporte de notificaciones).

#### Scenario: Source válido
- **WHEN** un tool se llama con `source: "site"` o `source: "telegram"`
- **THEN** la operación se ejecuta y queda atribuida a ese canal

#### Scenario: Source ausente o inválido
- **WHEN** un tool se llama sin `source` o con un valor fuera del enum
- **THEN** responde error `-32602` sin ejecutar la operación

### Requirement: Permisos del dominio verificados server-side

Cada `tools/call` DEBERÁ (SHALL) verificar los permisos del llamante sobre el `app_state` con las mismas reglas del dominio: membresía y rol del place, `isListAdmin` (creador o admin del place), `canEditList` (creador, escritura del place o invitado con edición) y `canReadList`. Sin permiso, el tool DEBERÁ (SHALL) responder `isError` sin mutar datos.

#### Scenario: Lectura permitida
- **WHEN** un miembro del place llama `list_lists`/`get_list`
- **THEN** recibe las listas e items visibles para él

#### Scenario: Escritura denegada
- **WHEN** un usuario sin permiso de edición llama `update_list` o `delete_list`
- **THEN** responde `isError` en español y el documento no cambia

#### Scenario: Gestión de permisos solo para admins
- **WHEN** un no-admin llama `invite_place_member`, `set_place_member_role`, `remove_place_member` o tools de invitados de lista
- **THEN** responde `isError`; solo `isPlaceAdmin`/`isListAdmin` pueden ejecutarlos

### Requirement: Cobertura del dominio

El servidor DEBERÁ (SHALL) ofrecer tools para: places (listar, ver miembros, crear, invitar, cambiar rol, quitar), listas (listar, ver detalle con items e invitados, crear, actualizar contenido completo, cambiar estado, eliminar), invitados de lista (invitar, cambiar permiso, quitar) y productos del place (listar, crear).

#### Scenario: Edición completa de lista
- **WHEN** un editor llama `update_list` con nuevo contenido (meta e items)
- **THEN** el contenido provisto reemplaza al existente en una sola escritura del documento

### Requirement: Mutaciones con notificación

Las mutaciones vía MCP DEBERÁN (SHALL) escribirse en `app_state` y disparar el mismo diff de notificaciones por Telegram que `PUT /api/state`, de modo que los cambios hechos por agentes generen el reporte consolidado a los relacionados.

#### Scenario: Cambio vía MCP notifica
- **WHEN** un agente modifica items o estado de una lista vía `tools/call`
- **THEN** los usuarios relacionados con Telegram vinculado reciben el reporte único con el botón "Ver lista"
