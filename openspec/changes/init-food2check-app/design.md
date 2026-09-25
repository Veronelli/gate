## Context

Greenfield sobre un template Next.js 15 + React 19 + Tailwind 4 que se despliega con OpenNext/Cloudflare (Webflow Cloud). El starter solo tiene `src/app/{layout,page}.tsx` + estilos. Toda la persistencia es local-first en el navegador (localStorage) — el usuario lo definió explícitamente: cuentas, places, listas, productos e historiales viven en el dispositivo. La única dependencia externa es la API de intelligent-search de Día (`diaonline.supermercadosdia.com.ar`), usada como catálogo de referencia.

## Goals / Non-Goals

**Goals:**
- Arquitectura local-first simple y testeable: una capa de storage aislada del resto de la app.
- Modelo de datos que respete las relaciones pedidas: usuario↔place (N:M con permiso), place→listas (1:N), producto↔listas (N:M vía items con snapshot), productos únicos por `id` por place.
- Motor de consumo con historial acotado a 3 plazos por producto.
- UI en español con el layout pedido (lateral de imágenes, login/registro, panel por place).

**Non-Goals:**
- Backend, sincronización multi-dispositivo ni auth real (cuentas son locales del navegador).
- Compra/checkout real — la API de Día es solo catálogo de referencia.
- IndexedDB/service worker/PWA offline — localStorage alcanza para el MVP (ver riesgos).

## Decisions

### 1. Persistencia: capa de storage sobre localStorage
Un módulo `storage` (ej. `src/lib/storage.ts`) con keys namespaced `f2c:*` y un documento raíz con `schemaVersion` para futuras migraciones. Se persisten colecciones por entidad: `users`, `places`, `memberships`, `lists`, `items`, `products`, `sessions`.

- **Por qué localStorage y no IndexedDB**: los datos son chicos (historial capado a 3, snapshots livianos), el acceso es síncrono y simple, y el usuario lo pidió explícitamente ("se deben almacenar en el localstorage").
- **Alternativa considerada**: IndexedDB → más capacidad y async, pero complejidad innecesaria ahora; la capa de storage queda detrás de una interfaz para poder migrar después sin tocar el dominio.

### 2. Modelo de datos (localStorage, JSON)

```
User        { id, username, passwordHash, salt, createdAt }
Place       { id, name, createdBy, createdAt,
              consumptionConfig: { defaultRefreshDays, reminderThresholdDays } }
Membership  { placeId, userId, role: 'admin' | 'write' | 'read' }
Product     { id, placeId, name, brand, imageUrl, suggestedPrice,
              refreshDays,            // atributo de actualización/refresco
              unitsRemaining,         // raciones/unidades que el usuario indica
              plazos: number[],       // máx. 3 intervalos (días) entre compras
              lastPurchaseAt }
ShoppingList{ id, placeId, name, description?, createdBy,
              state: 'listando' | 'a_comprar' | 'comprando' | 'listo' }
ListItem    { id, listId, productId, units, checked,
              snapshot: { name, brand, imageUrl, suggestedPrice, capturedAt } }
ListInvite  { listId, userId, permission: 'read' | 'edit' }
Session     { userId, placeId, startedAt }
```

- Productos únicos por `id` **dentro del place** (clave compuesta lógica `placeId + id`); agregar un id existente reutiliza el registro.
- El snapshot en `ListItem` congela los datos del producto al agregarlo (requisito de snapshot inmutable).

### 3. Auth local
- Registro: `username` único, `password === repeatPassword`; hash SHA-256 + salt aleatorio con Web Crypto (`crypto.subtle`). Nunca texto plano.
- Sesión: `f2c:session` con `userId` y `placeId` activo; cambiar a otra cuenta del navegador exige su contraseña.
- **Aclaración honesta**: esto no es seguridad real (todo vive en el cliente); es la barrera pedida para cuentas locales. Documentado como limitación aceptada.

### 4. Permisos efectivos
- `Membership.role` en el place: `admin` (creador), `write`, `read`.
- `ListInvite.permission` en la lista: `read` (default del invitado) o `edit` (otorgable por el admin de la lista desde "invitados").
- Regla efectiva para editar una lista: ser admin del place, ser creador de la lista, tener `write` en el place, o tener invite `edit`. Lectura: cualquier miembro del place o invitado a la lista.
- Compartir lista solo ofrece usuarios que existen en el navegador (localStorage) — el "share" es entre cuentas locales del mismo dispositivo.

### 5. Motor de consumo
Al pasar una lista a `listo` (o ante actualización manual de stock), por cada producto comprado:

1. `intervalo = hoy - lastPurchaseAt` (días); si hay `lastPurchaseAt`, se pushea a `plazos` manteniendo **máx. 3** (drop del más antiguo).
2. **Plazo estimado = proporción sobre lo que ya tenía**: `plazoEstimado = promedioPonderado(plazos)` con mayor peso al más reciente (pesos 3/2/1); sin historial se usa `refreshDays` del producto (o `defaultRefreshDays` del place).
3. Tiempo restante: `diasRestantes = plazoEstimado * (unitsRemaining / unitsReferencia)`, donde `unitsReferencia` es la cantidad comprada la última vez (default = unidades compradas actuales).
4. Actualizar `lastPurchaseAt`, `unitsRemaining += unidadesCompradas`.
5. Score de prioridad para sugerencias: `1 - diasRestantes/plazoEstimado` → orden decreciente; cuando `diasRestantes <= reminderThresholdDays` se emite el recordatorio "es posible que tengas que comprar más unidades del producto X".

La configuración de variables es **por place** (`consumptionConfig`): permite ajustar umbrales/pesos sin afectar otros places.

### 6. Integración Día (solo catálogo)
- Helper `searchCatalog(term)` llama a `GET /api/productos?q={term}` — route handler de Next que proxy-ea `https://diaonline.supermercadosdia.com.ar/api/intelligent-search/v1/product-search?query={term}` (API pública de VTEX, sin clave). El proxy es necesario porque la API de Día no habilita CORS para el navegador.
- Debounce ~300ms, `AbortController` para cancelar requests viejas, timeout con mensaje de error en español y opción de reintentar.
- Se parsea `products[]`: `productId` → id, `productName` → nombre, `brand`, `items[0].images[0].imageUrl`, `sellers[0].commertialOffer.Price` → `suggestedPrice`. En toda la UI el precio lleva leyenda "precio sugerido (referencia Día)".

### 7. Estructura de app
- `src/app/page.tsx`: shell de auth (lateral de imágenes + login/registro toggle). Si hay sesión, renderiza el panel.
- `src/app/panel` o vista condicional: sidebar de places, listado de listas con estado, sección "items a considerar" ordenada por consumo, detalle de lista con invitados, buscador de productos.
- Componentes client-side (`'use client'`) porque localStorage es solo del navegador; estado vía React context (`AppStateProvider`) sobre la capa de storage.
- i18n: textos hardcodeados en español (no hace falta framework de i18n para MVP).

## Risks / Trade-offs

- **localStorage (~5MB, solo mismo navegador/dispositivo)** → historial capado a 3 plazos, snapshots sin duplicar binarios (solo URLs), capa de storage intercambiable si crece.
- **La API de Día puede cambiar o bloquear requests** → manejo de error con reintento; no bloquea el resto de la app.
- **Auth local no es seguridad real** (hash reversible por acceso al dispositivo) → se documenta; es un MVP de cuentas locales, no un sistema de auth.
- **"Compartir" solo funciona entre cuentas del mismo navegador** → limitación inherente al modelo local-first pedido; el modelo de datos ya separa place/list/invite para permitir backend futuro.
- **SSR + localStorage** → toda la UI de datos es client-side; evitar hidratación leyendo storage en `useEffect`/provider montado.

## Migration Plan

Sin migración (proyecto nuevo). El documento raíz de storage incluye `schemaVersion: 1` para migraciones futuras.

## Open Questions

- ¿Imágenes del lateral: assets fijos en `public/lateral/` servidos por el carrusel? (asumido: el usuario las coloca ahí)
