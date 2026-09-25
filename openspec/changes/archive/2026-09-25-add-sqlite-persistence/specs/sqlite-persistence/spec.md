## Purpose

Persistir los datos de la app en la base SQLite (D1) de Webflow Cloud y mover la verificación de contraseñas al servidor, eliminando el material de contraseñas del navegador.

## ADDED Requirements

### Requirement: Base de datos SQLite con Drizzle
El sistema DEBERÁ usar una base D1 declarada en `wrangler.json` (binding `DB`, `migrations_dir: drizzle`), con schema en `src/db/schema` (users, sessions, app_state), helper `getDb` vía `getCloudflareContext` y scripts `db:generate`/`db:apply:local`.

#### Scenario: Migraciones versionadas
- **WHEN** se modifica el schema en `src/db/schema`
- **THEN** `npm run db:generate` produce una migración y `npm run db:apply:local` la aplica a la D1 local

### Requirement: Contraseñas seguras en el servidor
El registro y login DEBERÁN ejecutarse en API routes (`/api/auth/register`, `/api/auth/login`) que hashean con PBKDF2-SHA-256 (salt aleatorio, ~100k iteraciones) y comparan en tiempo constante. El cliente NUNCA DEBERÁ almacenar ni computar hashes de contraseña.

#### Scenario: Registro exitoso
- **WHEN** se envía username único + password + repeatPassword coincidentes
- **THEN** se crea el usuario con hash PBKDF2 en `users_table`, se emite un token de sesión y se devuelve `{token, user}` con 201

#### Scenario: Username duplicado
- **WHEN** el username ya existe (comparación case-insensitive)
- **THEN** se responde 409 con "El usuario ya existe."

#### Scenario: Credenciales inválidas
- **WHEN** login con usuario inexistente o contraseña incorrecta
- **THEN** se responde 401 con el mensaje genérico "Usuario o contraseña incorrectos."

### Requirement: Sesiones por token bearer
Cada login/registro DEBERÁ crear una sesión (token aleatorio en `sessions_table`). Las requests autenticadas DEBERÁN enviar `Authorization: Bearer <token>`; `logout` DEBERÁ eliminar la sesión del servidor.

#### Scenario: Request sin token válido
- **WHEN** se llama a un endpoint autenticado sin `Authorization` válido
- **THEN** se responde 401 y el cliente descarta la sesión local

### Requirement: Documento de dominio persistido
El estado de dominio (places, memberships, lists, items, products, invites, usuarios display-only) DEBERÁ persistirse como documento JSON en `app_state`, accesible solo con sesión válida. El servidor DEBERÁ sanitizar el documento eliminando `passwordHash`/`salt` antes de guardarlo.

#### Scenario: Hidratación al iniciar sesión
- **WHEN** el usuario inicia sesión o abre la app con sesión válida
- **THEN** `GET /api/state` devuelve el documento y reemplaza las colecciones locales

#### Scenario: Sincronización de escrituras
- **WHEN** se modifica una colección local
- **THEN** se encola un `PUT /api/state` debounced con el documento completo sanitizado

#### Scenario: Sin material de contraseña en el doc
- **WHEN** el cliente envía un documento que contiene `passwordHash`/`salt` en `users`
- **THEN** el servidor lo persiste sin esos campos


