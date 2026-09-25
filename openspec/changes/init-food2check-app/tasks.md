## 1. Base de datos local y dominio

- [x] 1.1 Crear `src/lib/storage.ts` (keys `f2c:*`, documento raíz con `schemaVersion: 1`, helpers get/set) y verificar que persiste/lee JSON en localStorage
- [x] 1.2 Definir tipos de dominio (`User`, `Place`, `Membership`, `Product`, `ShoppingList`, `ListItem`, `ListInvite`, `Session`) en `src/lib/types.ts` y verificar que `npx tsc --noEmit` pasa

## 2. Autenticación local

- [x] 2.1 Implementar registro (username único, password/repeatPassword iguales, hash SHA-256+salt con `crypto.subtle`) y verificar que registrar crea el usuario hasheado en localStorage
- [x] 2.2 Implementar login y sesión (`f2c:session` con `userId`/`placeId`) y verificar que credenciales válidas inician sesión e inválidas muestran error genérico en español
- [x] 2.3 Implementar cambio de cuenta (listar usuarios del navegador, exigir contraseña) y cerrar sesión, verificando que la sesión activa cambia/termina

## 3. Places y membresías

- [ ] 3.1 Implementar creación de place (creador queda `admin`) y listado de places del usuario, verificando que el place aparece tras crearlo
- [ ] 3.2 Implementar invitación de cuentas del navegador con rol `read`/`write` y cambio de rol posterior, verificando que un invitado `read` no puede crear contenido y `write` sí
- [ ] 3.3 Implementar `consumptionConfig` por place (`defaultRefreshDays`, `reminderThresholdDays`) y verificar que es independiente entre places

## 4. Listas de compras e invitados

- [ ] 4.1 Implementar creación de listas (nombre + descripción opcional, estado inicial `listando`) solo para miembros con escritura, verificando el rechazo para `read`
- [ ] 4.2 Implementar máquina de estados `listando → a_comprar → comprando → listo` y verificar que el cambio de estado persiste y se muestra
- [ ] 4.3 Implementar items con snapshot (id, nombre, marca, imagen, precio sugerido, unidades al momento de agregar) y verificar que el snapshot no cambia si el producto se actualiza
- [ ] 4.4 Implementar sección de invitados de la lista (agregar cuenta del navegador como `read`, otorgar `edit`) y verificar que `read` no edita y `edit` sí

## 5. Catálogo e integración Coto

- [ ] 5.1 Implementar `searchCoto(term)` (key `key_`+random por request, debounce, AbortController, timeout con error en español + reintento) y verificar búsqueda real contra `ac.cnstrc.com`
- [ ] 5.2 Implementar alta de producto desde resultado (único por `id` dentro del place, hereda imagen/nombre/marca/precio) y verificar que repetir el id no duplica
- [ ] 5.3 Mostrar precio con leyenda "precio sugerido (referencia Coto)" en catálogo, búsqueda y lista — verificar la leyenda visible en las tres vistas
- [ ] 5.4 Implementar `refreshDays` y `unitsRemaining` editables por producto y verificar que editarlos persiste y dispara recálculo

## 6. Motor de consumo

- [ ] 6.1 Implementar cálculo al pasar lista a `listo`: intervalo `hoy - lastPurchaseAt`, push a `plazos` con cap de 3 (drop del más antiguo) — verificar con un caso de 4 compras que quedan 3 plazos
- [ ] 6.2 Implementar `plazoEstimado` como proporción ponderada del historial (pesos 3/2/1, fallback a `refreshDays`/`defaultRefreshDays`) y `diasRestantes` según `unitsRemaining` — verificar con producto con historial y sin historial
- [ ] 6.3 Generar sugerencias ordenadas por score decreciente y recordatorio "es posible que tengas que comprar más unidades del producto X" cuando `diasRestantes <= reminderThresholdDays` — verificar orden y aparición del aviso

## 7. App shell y vistas

- [ ] 7.1 Reemplazar `page.tsx` por shell con lateral de imágenes + login, y sección "crear cuenta local" que transforma el form a registro (username/password/repeat) sin cambiar de página — verificar ambos modos en la UI
- [ ] 7.2 Implementar panel post-login: selector de place, listado de listas con estado, sección de items sugeridos ordenados por consumo — verificar que cambiar de place actualiza todo el panel
- [ ] 7.3 Implementar detalle de lista: agregar productos vía buscador Coto, marcar items, avanzar estado, sección invitados — verificar el flujo completo crear→listo
- [ ] 7.4 Asegurar que toda la UI de datos sea client-side sin errores de hidratación (leer storage tras mount) — verificar `npm run dev` sin warnings de hydration

## 8. Verificación final

- [ ] 8.1 `npm run lint` y `npm run build` sin errores
- [ ] 8.2 Recorrido manual E2E: registrar 2 usuarios → crear place → invitar → crear lista → agregar producto Coto → completar compra → verificar sugerencia y recordatorio
