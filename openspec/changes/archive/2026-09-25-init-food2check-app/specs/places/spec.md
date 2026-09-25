## Purpose

Agrupa a usuarios, listas y productos en un "lugar" o workspace (ej. un hogar), de modo que los miembros compartan el mismo contexto de compras con permisos de lectura o escritura.

## ADDED Requirements

### Requirement: Creación de place
Cualquier usuario autenticado DEBERÁ poder crear un place nuevo con un nombre. El creador quedará como administrador del place con permisos de escritura. Un usuario PUEDE pertenecer a varios places.

#### Scenario: Crear un place
- **WHEN** un usuario autenticado crea un place con un nombre válido
- **THEN** el place queda registrado, el creador es su administrador y el place aparece en su listado de places

### Requirement: Invitación de usuarios al place
El administrador de un place DEBERÁ poder invitar a otras cuentas existentes en el navegador asignándoles permiso de lectura o escritura. Los permisos DEBERÁN poder modificarse después (lectura ↔ escritura) y un invitado PUEDE ser removido.

#### Scenario: Invitar con permiso de lectura
- **WHEN** el administrador invita a otro usuario del dispositivo con permiso de lectura
- **THEN** el invitado ve el place, sus listas y productos, pero no puede crear ni editar contenido

#### Scenario: Elevar permiso a escritura
- **WHEN** el administrador cambia el permiso de un invitado de lectura a escritura
- **THEN** el invitado puede crear listas y agregar o actualizar productos del place

### Requirement: Datos y configuración por place
Los productos, las listas y la configuración de variables de consumo PERTENECEN al place donde fueron creados. Cada place DEBERÁ tener su propia configuración de variables (independiente de otros places) y sus miembros verán únicamente los datos del place que tengan seleccionado.

#### Scenario: Aislamiento entre places
- **WHEN** un usuario pertenece a dos places y cambia de place activo
- **THEN** solo se muestran las listas, productos y sugerencias del place seleccionado

#### Scenario: Configuración independiente de consumo
- **WHEN** el administrador ajusta las variables de consumo del place activo
- **THEN** el cambio solo afecta los cálculos de ese place y no los de otros places del usuario
