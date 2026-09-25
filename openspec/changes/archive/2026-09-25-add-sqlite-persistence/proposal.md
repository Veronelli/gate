# Persistencia en SQLite (D1) y contraseñas seguras

## Why

Hoy food2check guarda todo en `localStorage`: los datos solo existen en el navegador que los creó (no se puede compartir entre dispositivos) y las contraseñas se hashean y verifican en el cliente, donde cualquiera puede leer el hash. Siguiendo la guía de Webflow Cloud (`/webflow-cloud/add-sqlite`), la app pasa a persistir en la base SQLite (D1) del servidor.

## What Changes

- **Infra**: binding `d1_databases` en `wrangler.json`, Drizzle ORM + drizzle-kit, schema en `src/db/schema`, helper `getDb` con `getCloudflareContext`, scripts `db:generate`/`db:apply:local`.
- **Auth server-side**: `POST /api/auth/register` y `/login` con **PBKDF2-SHA-256 + salt + 100k iteraciones** y comparación en tiempo constante; las sesiones son tokens bearer en tabla `sessions` — el cliente ya no hashea ni guarda material de contraseña.
- **Estado de dominio**: tabla `app_state` con el documento JSON (places, memberships, lists, items, products, invites + lista de usuarios display-only). `GET /api/state` hidrata el cliente; cada escritura local encola un `PUT /api/state` debounced (400ms) sanitizado (sin hash/salt).
- El cliente conserva la API síncrona de `lib/*` sobre localStorage como **caché de lectura** — la UI no cambia.
- **Nuevo**: compartir lugares/listas ahora funciona entre dispositivos, porque el documento y los usuarios viven en el servidor.

## Impact

- Affected specs: `sqlite-persistence` (nueva capacidad); modifica `local-auth` (auth pasa a ser server-side).
- Affected code: `wrangler.json`, `drizzle.config.ts`, `src/db/**`, `src/lib/server/**`, `src/app/api/auth/**`, `src/app/api/state/**`, `src/lib/{auth,storage,sync,types}.ts`, `src/app/page.tsx`.
- **Breaking**: las cuentas locales previas no migran (los hashes estaban en el navegador) — hay que volver a registrarse.
