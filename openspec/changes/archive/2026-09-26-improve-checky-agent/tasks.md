# Tasks — improve-checky-agent

## 1. Catálogo externo

- [x] 1.1 `search_catalog` en el agente: búsqueda server-side sobre `CATALOG_API_URL`, timeout 6 s, `mapCatalogProducts`, tope 8 resultados
- [x] 1.2 Schema zod + descripción de la tool registrada en el agente

## 2. Comportamiento del agente

- [x] 2.1 System prompt: guía de flujo de tools (nunca adivinar IDs; cadena list_places → list_lists → get_list; cadena de alta de productos)
- [x] 2.2 Al agregar producto elegido: usar name/brand/imageUrl/suggestedPrice del catálogo y la cantidad pedida (default 1); ofrecer opciones si no eligió
- [x] 2.3 Regla de honestidad: no afirmar acciones que las tools no confirmaron
- [x] 2.4 Logging server-side de cada tool call (nombre, args, ok/error)

## 3. Verificación

- [x] 3.1 Prueba en vivo: "buscame yerbas en el catálogo" → `search_catalog` ejecutada + `update_list` con datos reales
- [x] 3.2 `tsc` + `lint` limpios
