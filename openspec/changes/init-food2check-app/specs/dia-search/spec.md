## Purpose

Provee búsqueda de productos y precios de referencia consultando la API de intelligent-search de Día, usada únicamente como catálogo externo — la app no realiza compras en Día.

## ADDED Requirements

### Requirement: Búsqueda de productos vía API de Día
El sistema DEBERÁ consultar el endpoint `https://diaonline.supermercadosdia.com.ar/api/intelligent-search/v1/product-search?query={termino}` con el término ingresado por el usuario (sin clave). Los resultados DEBERÁN listarse con imagen, nombre, marca y precio.

#### Scenario: Búsqueda con resultados
- **WHEN** el usuario escribe un término y la API responde con productos
- **THEN** se muestra el listado de productos con imagen, nombre, marca y precio sugerido

#### Scenario: Consulta al endpoint de Día
- **WHEN** se realiza una búsqueda
- **THEN** la request usa el endpoint `product-search?query={termino}` de `diaonline.supermercadosdia.com.ar`

### Requirement: Precio sugerido de referencia
El precio obtenido de la API DEBERÁ exhibirse como "precio sugerido" acompañado de una aclaración visible de que es una referencia basada en precios de Día y no representa el precio del comercio donde el usuario compra.

#### Scenario: Aclaración visible del precio
- **WHEN** se muestra un precio proveniente de la API en cualquier vista
- **THEN** junto al precio aparece la leyenda indicando que es un precio sugerido de referencia

### Requirement: Manejo de errores de la API
Si la API falla, demora o no devuelve resultados, el sistema DEBERÁ informarlo con un mensaje en español y permitir reintentar la búsqueda.

#### Scenario: API no disponible
- **WHEN** la consulta a la API falla o excede el tiempo de espera
- **THEN** se muestra un mensaje de error en español y el usuario puede reintentar

#### Scenario: Sin resultados
- **WHEN** la API responde correctamente pero sin coincidencias
- **THEN** se muestra un mensaje de "sin resultados" para el término buscado
