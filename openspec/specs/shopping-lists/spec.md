# shopping-lists Specification

## Purpose
Permite a los miembros de un place crear listas de productos a comprar, recorrer el ciclo de compra (listando → a comprar → comprando → listo) y compartir cada lista con otros usuarios con permisos de lectura o edición.

## Requirements

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

### Requirement: Edición por borrador con guardado único

El detalle de la lista DEBERÁ (SHALL) funcionar como un borrador local: los cambios en unidades, check de items, quitar/agregar productos, etiquetas, fecha programada e importancia NO DEBERÁN (SHALL NOT) persistirse por input individual. Un único botón **"Guardar cambios"** aplicará todo el contenido de una vez (PUT completo del estado), lo que produce una única sincronización y un único reporte de cambios por Telegram.

#### Scenario: Cambios pendientes
- **WHEN** el usuario edita campos sin tocar "Guardar cambios"
- **THEN** se muestra el aviso "Cambios sin guardar" y nada se persiste hasta confirmar

#### Scenario: Guardar aplica todo junto
- **WHEN** el usuario toca "Guardar cambios" tras varias ediciones
- **THEN** todos los cambios se aplican en una sola escritura del estado y los relacionados reciben un reporte consolidado

### Requirement: Eliminar lista

El usuario con permiso de edición DEBERÁ (SHALL) poder eliminar la lista desde el detalle, previa confirmación. Al eliminarse se borran también sus items e invitaciones asociadas.

#### Scenario: Eliminación confirmada
- **WHEN** el usuario confirma "Eliminar lista"
- **THEN** la lista, sus items e invitaciones se eliminan y se vuelve al listado del place

### Requirement: Visibilidad de acceso en el detalle

La sección de invitados del detalle DEBERÁ (SHALL) mostrar también a los administradores de la lista: el creador etiquetado como **"Propietario"** y los admins del place como **"Admin"**, antes que los invitados con su permiso. La sección forma parte de la tarjeta de configuración, separada por una división.

#### Scenario: Propietario identificado
- **WHEN** se abre el detalle de una lista
- **THEN** el creador aparece primero con etiqueta "Propietario" y los invitados debajo con su permiso

### Requirement: Vista de solo lectura sin huecos

Cuando el usuario no pueda editar la lista, la vista DEBERÁ (SHALL) adaptarse: las etiquetas y fecha programada se muestran en una tarjeta informativa, y si no hay contenido para la columna lateral la lista de productos ocupa todo el ancho.

#### Scenario: Lista sin panel lateral
- **WHEN** un lector abre una lista sin etiquetas, fecha ni invitados
- **THEN** los productos ocupan todo el ancho sin columna vacía

### Requirement: Filtros del listado por prioridad y etiqueta

El listado de listas del place DEBERÁ (SHALL) ofrecer filtros combinables: por **importancia** (alta|media|baja) y por **etiqueta** — las opciones de etiqueta se derivan de los tags presentes en las listas del entorno actual. Con filtros activos DEBERÁ (SHALL) ofrecerse "Limpiar filtros", y si ninguna lista coincide DEBERÁ (SHALL) mostrarse un estado vacío informativo.

#### Scenario: Filtrar por prioridad
- **WHEN** el usuario elige "Prioridad alta"
- **THEN** solo se listan las listas con importancia alta

#### Scenario: Filtrar por etiqueta del entorno
- **WHEN** el usuario elige una etiqueta existente en las listas del place
- **THEN** solo se listan las listas que contienen esa etiqueta
