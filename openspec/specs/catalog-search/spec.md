# catalog-search Specification

## Purpose
Provee búsqueda de productos y precios de referencia consultando una API de catálogo externa, usada únicamente como catálogo — la app no realiza compras en el comercio del catálogo.

## Requirements

### Requirement: Búsqueda de productos vía API de catálogo
El sistema DEBERÁ consultar el endpoint definido en la variable de entorno `CATALOG_API_URL` con el término ingresado por el usuario (sin clave). La URL soporta el placeholder `{q}` para el término; si no está presente, se agrega `?query={termino}`. Los resultados DEBERÁN listarse con imagen, nombre, marca y precio.

#### Scenario: Búsqueda con resultados
- **WHEN** el usuario escribe un término y la API responde con productos
- **THEN** se muestra el listado de productos con imagen, nombre, marca y precio sugerido

#### Scenario: Endpoint configurable por entorno
- **WHEN** se realiza una búsqueda
- **THEN** la request usa la URL configurada en `CATALOG_API_URL`; si la variable no está definida, el endpoint responde error de configuración

### Requirement: Precio sugerido de referencia
El precio obtenido de la API DEBERÁ exhibirse como "precio sugerido" acompañado de una aclaración visible de que es una referencia del catálogo y no representa el precio del comercio donde el usuario compra.

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
