# consumption-tracker Specification

## Purpose
Estima cuándo se agotará cada producto del place a partir del historial de compras, y genera sugerencias y recordatorios de recompra ordenados por consumo.

## Requirements

### Requirement: Cálculo del plazo de consumo al finalizar una compra
Cuando una lista pasa a `listo` (o el usuario registra una actualización manual de stock), el sistema DEBERÁ calcular el nuevo plazo del producto como una **proporción respecto a lo que ya tenía** — combinando las unidades compradas y el historial de plazos — y actualizar la cantidad y el tiempo restante del producto en ese place, según la configuración de variables del place.

#### Scenario: Compra finalizada actualiza el plazo
- **WHEN** una lista que contiene un producto pasa a `listo`
- **THEN** el sistema registra el intervalo desde la compra/actualización anterior, recalcula el plazo estimado del producto como proporción del valor previo e historial, y actualiza su stock en el place

#### Scenario: Ajuste manual de stock
- **WHEN** el usuario actualiza manualmente las unidades restantes de un producto
- **THEN** la estimación de tiempo restante se recalcula con el plazo vigente del producto

### Requirement: Historial de plazos limitado a 3 entradas
El historial de plazos de cada producto DEBERÁ persistirse en localStorage con un máximo de **3 intervalos** (ej. el tiempo entre la última y la penúltima compra o actualización). Al registrar un cuarto intervalo se descartará el más antiguo, para estimar rápido y no saturar el navegador con datos.

#### Scenario: Rotación del historial
- **WHEN** un producto ya tiene 3 plazos registrados y se completa una nueva compra
- **THEN** se agrega el nuevo intervalo y se elimina el más antiguo, manteniendo 3 entradas

#### Scenario: Estimación con historial incompleto
- **WHEN** un producto tiene menos de 3 plazos registrados
- **THEN** la estimación se calcula con los intervalos disponibles (o el atributo de refresco si no hay historial)

### Requirement: Sugerencias ordenadas por consumo
El sistema DEBERÁ generar un listado de "items a considerar para comprar" ordenado por consumo decreciente: a medida que pasa el tiempo y las raciones se consumen, el producto gana prioridad en la lista.

#### Scenario: Orden por urgencia de consumo
- **WHEN** el usuario ve la sección de items sugeridos tras iniciar sesión
- **THEN** los productos aparecen ordenados de mayor a menor necesidad estimada de recompra

### Requirement: Recordatorio de recompra
Cuando la estimación indique que un producto está por agotarse, el sistema DEBERÁ mostrar un recordatorio indicando al usuario que es posible que tenga que comprar más unidades de ese producto.

#### Scenario: Aviso de recompra
- **WHEN** el tiempo estimado restante de un producto llega a su umbral
- **THEN** se muestra un aviso en español indicando que probablemente deba comprar más unidades del producto "X"
