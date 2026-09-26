# checky-agent Specification

## Purpose

Agente conversacional (Checky) dentro del bot de Telegram: LangChain + Hugging Face, con acceso al dominio vía MCP, identidad resuelta por metadatos de Telegram, límites de uso configurables y restricción temática a compras del hogar.

## ADDED Requirements

### Requirement: Canal exclusivo de Telegram

El agente DEBERÁ (SHALL) ser accesible únicamente a través del webhook del bot de Telegram (`POST /api/telegram/webhook`). Mensajes de texto que no sean `/start <code>` se despachan al agente. NO DEBERÁ (SHALL NOT) exponerse por rutas HTTP propias ni en la app web.

#### Scenario: Mensaje de texto al bot
- **WHEN** llega un update con texto que no es un comando `/start`
- **THEN** el webhook lo despacha al agente Checky y responde por Telegram

### Requirement: Identidad desde metadatos de Telegram

El usuario DEBERÁ (SHALL) resolverse desde `chat_id` del update → `contact.telegram_chat_id` → `user_id`. Ningún contenido del mensaje PUEDE definir la identidad. Sin contact vinculado, el bot DEBERÁ (SHALL) responder indicando que vincule la cuenta desde la app y no invocar al agente.

#### Scenario: Usuario vinculado
- **WHEN** un `chat_id` asociado a un `contact` envía un mensaje
- **THEN** el agente opera con ese `user_id` real

#### Scenario: Usuario sin vincular
- **WHEN** llega un mensaje de un `chat_id` sin `contact` asociado
- **THEN** se responde que debe vincular desde la app y no se procesa como input del agente

### Requirement: Límite diario de inputs

El agente DEBERÁ (SHALL) aceptar como máximo `CHECKY_DAILY_INPUT_MAX` mensajes de usuario por día (UTC) por usuario — default **7**, configurable por env. Al excederse DEBERÁ (SHALL) responder un aviso amable sin invocar al modelo.

#### Scenario: Dentro del límite
- **WHEN** el usuario tiene menos de `CHECKY_DAILY_INPUT_MAX` inputs hoy
- **THEN** el mensaje se procesa y cuenta contra el límite

#### Scenario: Límite excedido
- **WHEN** el usuario supera el máximo diario
- **THEN** se responde que vuelva mañana, sin llamar al modelo

### Requirement: Ventana de contexto limitada

La memoria del agente DEBERÁ (SHALL) limitarse a las últimas `CHECKY_CONTEXT_MAX` interacciones (default **14**, configurable por env). El historial se persiste en D1 (`checky_messages`) y se poda automáticamente. **Tanto los mensajes del usuario como las respuestas del propio agente** DEBERÁN (SHALL) persistirse y formar parte del contexto: cada interacción es el par (mensaje del usuario, respuesta de Checky), de modo que el agente recuerda lo que él mismo respondió.

#### Scenario: Contexto recortado
- **WHEN** el usuario supera la ventana de contexto
- **THEN** solo las últimas interacciones (pares usuario/assistant) se incluyen en el prompt y las antiguas se descartan

#### Scenario: Respuestas del agente en el contexto
- **WHEN** Checky responde un mensaje
- **THEN** su respuesta se persiste en `checky_messages` con `role: "assistant"` y se incluye en las próximas invocaciones del modelo

### Requirement: Persona y dominio temático restringido

El agente DEBERÁ (SHALL) responder como una chica cute (español, tono dulce) y SOLO sobre compras del hogar: comida, bebidas, ropa y productos de limpieza/higiene del hogar. NO DEBERÁ (SHALL NOT) entregar scripts, código ni asistencia de programación; ante temas ajenos rechaza amablemente y redirige al tema.

#### Scenario: Pedido dentro del tema
- **WHEN** el usuario pide algo de compras del hogar ("agregá fideos a la lista")
- **THEN** responde y actúa en ese dominio

#### Scenario: Pedido de código o tema ajeno
- **WHEN** el usuario pide un script, código o un tema fuera de compras del hogar
- **THEN** rechaza con amabilidad sin ejecutar ninguna acción

### Requirement: Silencio ante errores internos

Ante un fallo del modelo, de las tools o de configuración (p. ej. falta `HF_API_TOKEN`), el agente NO DEBERÁ (SHALL NOT) enviar respuestas automáticas de error al usuario por Telegram; DEBERÁ (SHALL) registrar el error en logs del servidor y quedarse en silencio para no romper la conversación ni mandar mensajes confusos.

#### Scenario: Fallo del modelo
- **WHEN** la invocación del agente lanza una excepción
- **THEN** el webhook responde `200` a Telegram, el error queda en logs y el usuario no recibe mensaje automático

#### Scenario: Configuración faltante
- **WHEN** `HF_API_TOKEN` no está configurada
- **THEN** el agente no se invoca y no se envía mensaje al usuario

### Requirement: Uso del MCP con permisos

El agente DEBERÁ (SHALL) operar el dominio exclusivamente a través de `POST /api/mcp` (`tools/call`) usando la sesión del usuario resuelto y `source: "telegram"`, de modo que los permisos del llamante real rijan cada acción.

#### Scenario: Acción autorizada vía MCP
- **WHEN** el agente ejecuta un tool para el usuario (ej. `list_lists`, `update_list`)
- **THEN** el servidor MCP lo ejecuta con la identidad y permisos de ese usuario, y las mutaciones disparan el reporte consolidado de Telegram

#### Scenario: Acción sin permiso
- **WHEN** el tool rechaza por permisos
- **THEN** el agente informa al usuario que no puede hacerlo, sin efectos laterales
