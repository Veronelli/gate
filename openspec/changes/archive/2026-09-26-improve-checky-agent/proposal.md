# Proposal — improve-checky-agent

## Why

El agente Checky (`add-checky-agent`, archivado) ya conversa por Telegram y ejecuta las tools del dominio. Las pruebas en vivo mostraron dos brechas: **no accedía al catálogo externo de productos** (solo al catálogo del lugar) y **podía afirmar acciones que no ejecutó** en modelos chicos. Este change endurece el comportamiento del agente y le da acceso a la búsqueda real de productos.

## What Changes

- **Tool `search_catalog`**: búsqueda server-side en el catálogo externo (`CATALOG_API_URL`, la API de productos del supermercado) que devuelve al modelo hasta 8 productos reales con nombre, marca, imagen y precio sugerido. Se ofrece como tool adicional del agente junto a las del dominio MCP.
- **Guía de flujo de tools en el system prompt**: el agente nunca adivina IDs; para ubicar recursos usa `list_places` → `list_lists` → `get_list`; para agregar productos usa `list_products` → `search_catalog` → `create_product` → `update_list` con todos los items.
- **Producto seleccionado con info completa y cantidad**: si el usuario no nombró un producto puntual, el agente ofrece las opciones del catálogo (nombre + marca + precio) para que elija; al agregar, `create_product`/`update_list` usa nombre, marca, imagen y precio sugerido del producto elegido y la cantidad pedida (1 por defecto).
- **Honestidad de acciones**: el agente no debe afirmar una acción si la tool devolvió error o no fue llamada; solo confirma lo que las tools verificaron.
- **Trazabilidad**: cada invocación de tool del agente queda logueada server-side (nombre, args, ok/error) para depuración.

## Impact

- `src/lib/server/checky/agent.ts` — system prompt, tool `search_catalog`, logging de tool calls.
- `src/lib/catalog.ts` — reutiliza `mapCatalogProducts`/`CatalogSearchResponse` (la búsqueda server-side pega directo a `CATALOG_API_URL`, sin pasar por `/api/productos`).
- Specs: requisitos nuevos en la capacidad `checky-agent`.
