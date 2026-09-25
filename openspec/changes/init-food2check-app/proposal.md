## Why

Las personas necesitan una forma simple de organizar sus compras en general (supermercado, almacén, etc.) y anticipar cuándo volverán a necesitar cada producto. No existe hoy una app local que combine listas de compras compartidas por "hogar" (place) con recordatorios basados en el consumo histórico. **food2check** nace para cubrir eso: una app local-first donde cada usuario tiene sus listas, las comparte con su hogar y recibe avisos de "probablemente necesites comprar más unidades de X". La API de Coto se usa únicamente como fuente de datos de catálogo (imagen, nombre, marca, precio sugerido) — las compras no están atadas a Coto.

## What Changes

- Inicializar la aplicación **food2check** sobre el template Next.js + React + Tailwind existente (reemplaza la UI del starter).
- **Autenticación local**: registro e inicio de sesión 100% en el navegador (localStorage). Registro con `username`, `password` y `repeat password`; toda la UI en español.
- **Places (workspaces)**: cada usuario puede pertenecer a uno o varios places. Cualquiera puede crear un place e invitar a otros usuarios con permisos de lectura o escritura.
- **Listas de compras**: un place tiene muchas listas; una lista tiene productos (snapshot), descripción opcional y estados (`listando`, `a comprar`, `comprando`, `listo`). El creador administra invitados y sus permisos desde la sección de invitados de la lista.
- **Catálogo de productos**: búsqueda contra la API de autocomplete de Coto (`https://ac.cnstrc.com/autocomplete/{producto}?key={key}` con clave `key_*` generada de forma aleatoria por ahora) usada **solo como catálogo de referencia**. Cada producto muestra imagen, nombre, marca y **precio sugerido basado en precios de Coto** (con la aclaración visible de que es un precio sugerido de referencia, no el precio donde el usuario compra). Productos únicos por `id`, asociados a un place.
- **Seguimiento de consumo**: cada place tiene su propia configuración de variables de consumo. Al pasar una lista a `listo` (o al registrar una actualización manual), el sistema calcula el nuevo plazo del producto como una **proporción respecto a lo que ya tenía** (unidades + historial) y actualiza el stock/tiempo restante del place. El historial de plazos por producto se persiste en localStorage **limitado a 3 entradas** (ej. intervalo entre la última y la penúltima compra) para que la estimación sea rápida y no sature el navegador. La app sugiere qué comprar ordenado por consumo decreciente y muestra recordatorios tipo "es posible que tengas que comprar más unidades del producto X".
- **App shell**: layout con lateral izquierdo para imágenes; login con sección "crear cuenta local" debajo, que transforma el formulario de login en el de registro. Tras iniciar sesión: listado de listas del place + items sugeridos a comprar ordenados por consumo.

## Capabilities

### New Capabilities

- `local-auth`: Registro, inicio de sesión y sesión de usuarios almacenados localmente en el navegador.
- `places`: Workspaces ("hogares") con membresía muchos-a-muchos usuario↔place y permisos lectura/escritura.
- `shopping-lists`: Listas de compras por place, estados del ciclo de compra, snapshot de productos, descripción opcional, invitados y permisos por lista.
- `product-catalog`: Productos únicos por id asociados a un place (imagen, nombre, marca, precio sugerido, atributo de refresco/consumo y unidades/raciones restantes).
- `coto-integration`: Integración con la API de autocomplete de Coto exclusivamente para búsqueda de productos y precio sugerido de referencia (sin checkout ni compra en Coto).
- `consumption-tracker`: Cálculo del plazo de consumo como proporción sobre el historial (máx. 3 plazos por producto en localStorage), actualización de stock/tiempo al finalizar una compra y recordatorios de recompra ordenados por consumo.
- `app-shell`: Layout de la app (lateral de imágenes, alternancia login/registro, vista post-login).

### Modified Capabilities

<!-- Sin specs previas: es la inicialización del proyecto. -->

## Impact

- **Código**: se reemplaza el starter (`src/app/page.tsx`, `layout.tsx`, `globals.css`) por la app food2check; nuevos módulos de dominio (auth, places, lists, products, consumption), componentes y persistencia local.
- **Datos**: persistencia local-first en el navegador (localStorage/IndexedDB); sin backend ni base de datos en esta iteración. La convivencia multi-usuario ocurre dentro del mismo navegador/dispositivo.
- **APIs externas**: llamadas salientes a `ac.cnstrc.com` (autocomplete de productos de Coto) usadas solo como catálogo de referencia. Clave `key_*` generada aleatoriamente por sesión/request — decisión temporal a revisar.
- **Dependencias**: stack existente (Next.js 15, React 19, Tailwind 4, OpenNext/Cloudflare). Sin nuevas dependencias planeadas; hashing de passwords con Web Crypto API.
- **Despliegue**: sin cambios en Webflow Cloud / Cloudflare.
