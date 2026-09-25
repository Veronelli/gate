## 1. Infraestructura D1 + Drizzle

- [x] 1.1 Binding `d1_databases` en `wrangler.json` + deps `drizzle-orm`, `drizzle-kit`, `tsx`, `better-sqlite3` + scripts `db:generate`/`db:apply:local` — verificar `npm run cf-typegen`
- [x] 1.2 `drizzle.config.ts` + `src/db/schema` (users, sessions, app_state) + `src/db/getDb.ts` — verificar `npm run db:generate` y `db:apply:local`

## 2. Auth y sesiones server-side

- [x] 2.1 `src/lib/server/passwords.ts` (PBKDF2-SHA-256, salt, 100k iteraciones, safeEqual) + `session.ts` (bearer token → usuario)
- [x] 2.2 Routes `/api/auth/register`, `/login`, `/logout` — verificar con curl: registro 201, duplicado 409, login mal 401

## 3. Documento de dominio + sync

- [x] 3.1 Route `/api/state` (GET hidrata, PUT persiste sanitizando hash/salt)
- [x] 3.2 `src/lib/sync.ts`: hook de escritura en storage → push debounced 400ms; hydrate al montar; 401 → limpiar sesión
- [x] 3.3 Reescribir `auth.ts` cliente (register/login/logout contra la API, `Session.token`, `User` sin secretos) — verificar `tsc --noEmit` + `npm run lint`

## 4. Verificación

- [x] 4.1 E2E curl: register → PUT doc → GET doc sin secretos → logout — OK en D1 local
- [ ] 4.2 Verificación manual: registrarse, crear lugar/lista, cerrar sesión, reingresar desde otro navegador y comprobar que los datos están compartidos
