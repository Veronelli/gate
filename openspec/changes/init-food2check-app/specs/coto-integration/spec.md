## Purpose

Provee búsqueda de productos y precios de referencia consultando la API de autocomplete de Coto, usada únicamente como catálogo externo — la app no realiza compras en Coto.

## ADDED Requirements

### Requirement: Búsqueda de productos vía API de Coto
El sistema DEBERÁ consultar el endpoint `https://ac.cnstrc.com/autocomplete/{termino}?key={clave}` con el término ingresado por el usuario y una clave con formato `key_*` generada de forma aleatoria (solución temporal). Los resultados DEBERÁN listarse con imagen, nombre, marca y precio.

#### Scenario: Búsqueda con resultados
- **WHEN** el usuario escribe un término y la API responde con productos
- **THEN** se muestra el listado de productos con imagen, nombre, marca y precio sugerido

#### Scenario: Clave generada aleatoriamente
- **WHEN** se realiza una consulta a la API
- **THEN** la request usa una clave `key_` + cadena aleatoria generada en el cliente

### Requirement: Precio sugerido de referencia
El precio obtenido de la API DEBERÁ exhibirse como "precio sugerido" acompañado de una aclaración visible de que es una referencia basada en precios de Coto y no representa el precio del comercio donde el usuario compra.

#### Scenario: Aclaración visible del precio
- **WHEN** se muestra un precio proveniente de la API en cualquier vista
- **THEN** junto al precio aparece la leyenda indicando que es un precio sugerido de referencia

### Requirement: Manejo de errores de la API
Si la API falla, demora o no devuelve resultados, el sistema DEBERÁ informarlo con un mensaje en español y permitir reintentar la búsqueda.

#### Scenario: API no disponible
- **WHEN** la consulta a `ac.cnstrc.com` falla o excede el tiempo de espera
- **THEN** se muestra un mensaje de error en español y el usuario puede reintentar

#### Scenario: Sin resultados
- **WHEN** la API responde correctamente pero sin coincidencias
- **THEN** se muestra un mensaje de "sin resultados" para el término buscado
