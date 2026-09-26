# Design — improve-checky-agent

## search_catalog (server-side)

El cliente web busca productos vía `/api/productos` (proxy por CORS). El agente corre server-side, así que consulta `CATALOG_API_URL` directamente con el mismo contrato (`{q}` placeholder o `?query=`), timeout 6 s, y mapea con `mapCatalogProducts` → tope 8 resultados serializados como JSON para el modelo. Sin env → texto de error para el modelo (no rompe el turno).

## Prompt: guía de flujo

El system prompt incorpora una sección "CÓMO USAR LAS HERRAMIENTAS" con dos reglas operativas:

1. **Nunca adivinar IDs**: los IDs salen de respuestas de tools (`list_places` → `list_lists` → `get_list`).
2. **Productos del catálogo**: `search_catalog` devuelve opciones; si el usuario no eligió, se presentan nombre+marca+precio; el alta usa toda la info del seleccionado (`name`, `brand`, `imageUrl`, `suggestedPrice`) y la `units` pedida (default 1).

## Honestidad operativa

Regla explícita: solo se afirma lo que las tools confirmaron. Medido en pruebas: modelos 4B afirmaban escrituras sin llamar la tool; la regla + un modelo más capaz (`HF_MODEL` configurable) mitigan el riesgo. Si la tool devuelve error, el agente reintenta con datos correctos o informa que no pudo hacerlo.

## Logging

Cada tool call del agente emite `console.log` con nombre, args y resultado (ok/error): trazabilidad mínima para depurar comportamiento del modelo sin exponer datos al usuario.
