# contacts Specification

## Purpose
Datos de contacto del usuario (teléfono y chat de Telegram) en un modelo separado de `users`, con captura del teléfono, vinculación/desvinculación del bot y borrado del registro.

## Requirements

### Requirement: Modelo `contact` separado

El sistema DEBERÁ (SHALL) persistir los datos de contacto en un modelo separado llamado `contact`, con relación usuario → teléfono. En D1 será la tabla `contacts` con `id`, `user_id` (único, referencia a `users.id`), `phone`, `telegram_chat_id` (nullable) y `created_at`. El teléfono NUNCA se almacenará dentro del documento `app_state` compartido ni en `localStorage`.

#### Scenario: Un contacto por usuario
- **WHEN** se guarda el teléfono de un usuario que ya tiene `contact`
- **THEN** se actualiza el registro existente (upsert), sin duplicar

#### Scenario: Aislamiento del dato
- **WHEN** se sincroniza o se consulta el documento de estado compartido
- **THEN** ningún teléfono ni `chat_id` aparece en él

### Requirement: Captura del número de teléfono

La app DEBERÁ (SHALL) pedir al usuario su número de teléfono cuando no tenga `contact` registrado, mediante un prompt no bloqueante con input de tipo `tel` y textos en español. El número se guardará vía `PUT /api/contacts` autenticado con el token de sesión (Bearer).

#### Scenario: Guardado exitoso
- **WHEN** el usuario ingresa un número válido y confirma
- **THEN** el servidor persiste el `contact` asociado a su usuario y el prompt desaparece

#### Scenario: Usuario sin autenticar
- **WHEN** se llama a `PUT /api/contacts` sin token válido
- **THEN** responde 401 y no persiste nada

### Requirement: Vinculación de Telegram sobre `contact`

El modelo `contact` DEBERÁ (SHALL) almacenar el `telegram_chat_id` cuando el usuario se vincule con el bot, para que el cron pueda resolver a qué chat enviar cada recordatorio.

#### Scenario: Chat vinculado
- **WHEN** el webhook recibe `/start <userId>` válido
- **THEN** actualiza `telegram_chat_id` en el `contact` del usuario (creándolo si no existe)

### Requirement: Desvinculación y borrado del contact

El usuario DEBERÁ (SHALL) poder desvincular Telegram (quita `telegram_chat_id` conservando el teléfono) y borrar el `contact` completo desde la sección "Recordatorios".

#### Scenario: Desvincular conserva el teléfono
- **WHEN** el usuario toca "Desvincular"
- **THEN** `telegram_chat_id` queda en `null` y el `phone` se conserva

#### Scenario: Borrar elimina el registro
- **WHEN** el usuario toca "Borrar"
- **THEN** el `contact` completo se elimina (`DELETE /api/contacts`)
