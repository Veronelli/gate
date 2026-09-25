## Purpose

Permite a los miembros de un place crear listas de productos a comprar, recorrer el ciclo de compra (listando → a comprar → comprando → listo) y compartir cada lista con otros usuarios con permisos de lectura o edición.

## ADDED Requirements

### Requirement: Creación de lista dentro de un place
Un miembro con permiso de escritura DEBERÁ poder crear listas dentro del place activo, con un nombre y una descripción opcional. El creador de la lista será su administrador.

#### Scenario: Crear lista con descripción opcional
- **WHEN** un miembro con escritura crea una lista indicando nombre y opcionalmente descripción
- **THEN** la lista queda asociada al place en estado inicial `listando`

#### Scenario: Invitado de solo lectura no puede crear
- **WHEN** un miembro con permiso de lectura intenta crear una lista
- **THEN** el sistema rechaza la acción

### Requirement: Ciclo de estados de la lista
Cada lista DEBERÁ tener un estado dentro de `listando`, `a comprar`, `comprando`, `listo`, visible en la interfaz, y DEBERÁ permitir avanzar de estado. Al llegar a `listo` la compra se considera finalizada.

#### Scenario: Avance de estados
- **WHEN** el administrador (o miembro con edición) cambia el estado de la lista
- **THEN** el estado se actualiza y queda reflejado para todos los miembros del place

#### Scenario: Finalizar compra
- **WHEN** una lista pasa a `listo`
- **THEN** el sistema actualiza la cantidad y el tiempo de los productos de ese place y registra el evento para el cálculo de consumo

### Requirement: Productos en la lista como snapshot
Al agregar un producto a una lista, el sistema DEBERÁ guardar un snapshot del producto (id, imagen, nombre, marca, precio sugerido y cantidad/unidades) tal como estaba al momento de agregarlo. Un producto PUEDE aparecer en muchas listas.

#### Scenario: Snapshot inmutable ante cambios del catálogo
- **WHEN** el precio sugerido del producto cambia después de haberlo agregado
- **THEN** el item de la lista conserva los datos del momento en que se agregó

### Requirement: Compartir lista e invitados
El administrador de la lista DEBERÁ poder invitar a otros usuarios (cuentas existentes en el navegador, miembros del place) desde la sección de invitados de la lista. Por defecto el invitado tendrá permiso de **solo lectura** y el administrador PUEDE otorgarle edición.

#### Scenario: Invitado con solo lectura
- **WHEN** el administrador agrega un invitado a la lista
- **THEN** el invitado puede ver la lista pero no modificarla

#### Scenario: Otorgar edición a un invitado
- **WHEN** el administrador cambia el permiso del invitado a edición desde la sección de invitados
- **THEN** el invitado puede agregar, quitar y marcar items de la lista
