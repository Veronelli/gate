## Purpose

Mantiene el catálogo de productos de cada place (identidad única por id, datos visibles y variables de consumo) para poblar listas y alimentar las estimaciones de recompra.

## ADDED Requirements

### Requirement: Identidad y pertenencia del producto
Cada producto DEBERÁ ser único por su `id` dentro del sistema y DEBERÁ estar asociado a un place. Si el mismo producto (mismo `id`) ya existe en el place, NO se creará un duplicado.

#### Scenario: Agregar producto ya existente
- **WHEN** se intenta registrar en un place un producto cuyo `id` ya existe en ese place
- **THEN** el sistema reutiliza el producto existente en lugar de duplicarlo

### Requirement: Datos visibles del producto
El producto DEBERÁ mostrar imagen, nombre, marca y precio sugerido. El precio DEBERÁ presentarse siempre con la aclaración visible de que es un **precio sugerido de referencia** (basado en los precios de Día), no el precio del lugar donde el usuario compra.

#### Scenario: Ficha de producto
- **WHEN** el usuario ve un producto en el catálogo o en una lista
- **THEN** se muestran imagen, nombre, marca y el precio con su leyenda de "precio sugerido"

### Requirement: Variables de consumo del producto
Cada producto DEBERÁ tener un atributo de actualización/refresco que indique cada cuánto tiempo se estima que se repone, y el usuario DEBERÁ poder indicar cuántas raciones o unidades quedan actualmente.

#### Scenario: El usuario ajusta raciones restantes
- **WHEN** el usuario indica que quedan N raciones de un producto
- **THEN** el sistema recalcula el tiempo estimado hasta la próxima compra de ese producto

### Requirement: Alta de producto desde búsqueda
El usuario DEBERÁ poder agregar un producto al place a partir de un resultado de búsqueda, heredando sus datos (imagen, nombre, marca, precio sugerido).

#### Scenario: Agregar desde resultado de búsqueda
- **WHEN** el usuario elige un resultado de la búsqueda de productos
- **THEN** el producto queda registrado en el place con los datos del resultado
