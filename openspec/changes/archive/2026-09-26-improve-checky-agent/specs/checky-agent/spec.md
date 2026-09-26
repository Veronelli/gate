# checky-agent Specification Delta

## ADDED Requirements

### Requirement: Búsqueda en catálogo externo de productos

El agente DEBERÁ (SHALL) disponer de una tool `search_catalog` que consulte el catálogo externo de productos configurado por `CATALOG_API_URL` (misma API que usa la app) y devuelva productos reales con nombre, marca, imagen y precio sugerido, con tope de resultados acotado para el modelo.

#### Scenario: Búsqueda de producto
- **WHEN** el usuario pide buscar un producto ("buscame yerbas")
- **THEN** el agente invoca `search_catalog` con el término y obtiene opciones reales del catálogo

#### Scenario: Catálogo no disponible
- **WHEN** `CATALOG_API_URL` no está configurada o la API falla
- **THEN** la tool devuelve un error textual al modelo y el turno no se rompe

### Requirement: Alta de producto con info completa y cantidad

Cuando el usuario agrega un producto a una lista, el agente DEBERÁ (SHALL) usar los datos reales del producto seleccionado del catálogo (nombre, marca, imagen, precio sugerido) en `create_product`/`update_list`, junto con la cantidad pedida por el usuario (1 si no aclaró). Si el usuario no nombró un producto puntual, el agente DEBERÁ (SHALL) ofrecer las opciones (nombre + marca + precio) para que elija.

#### Scenario: Agregar producto elegido del catálogo
- **WHEN** el usuario elige un producto del catálogo y pide N unidades
- **THEN** el agente crea/usa el producto con sus datos reales y lo agrega a la lista con N unidades

#### Scenario: Sin elección puntual
- **WHEN** el usuario pide agregar "yerba" sin elegir
- **THEN** el agente ofrece las opciones del catálogo para que elija antes de dar de alta

### Requirement: Honestidad operativa del agente

El agente NO DEBERÁ (SHALL NOT) afirmar que realizó una acción si la tool devolvió error o no fue invocada; DEBERÁ (SHALL) confirmar solo lo que las tools verificaron, reintentar con datos correctos ante errores recuperables y nunca inventar IDs.

#### Scenario: Tool con error
- **WHEN** una tool devuelve error (p. ej. ID inexistente)
- **THEN** el agente reintenta con los datos correctos o informa que no pudo realizar la acción, sin afirmar éxito

### Requirement: Trazabilidad de tool calls

Cada invocación de tool del agente DEBERÁ (SHALL) quedar registrada en logs del servidor con nombre, argumentos y resultado (ok/error), sin exponerse al usuario.

#### Scenario: Auditoría de acciones
- **WHEN** el agente ejecuta una tool
- **THEN** el log del servidor contiene el nombre de la tool, sus args y si terminó ok o con error
