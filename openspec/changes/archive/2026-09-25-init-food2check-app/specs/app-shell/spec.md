## Purpose

Define la estructura visual de la aplicación: pantalla de acceso con lateral de imágenes, alternancia entre login y registro, y el panel principal post-login con las listas y sugerencias del place activo. Toda la interfaz está en español.

## ADDED Requirements

### Requirement: Layout con lateral de imágenes
La pantalla inicial DEBERÁ mostrar un lateral con una sección destinada a imágenes junto al área principal de autenticación.

#### Scenario: Vista inicial
- **WHEN** un usuario sin sesión abre la aplicación
- **THEN** se muestra el lateral con la sección de imágenes y el formulario de acceso

### Requirement: Alternancia login / crear cuenta local
Debajo del formulario de login DEBERÁ existir una sección de "crear cuenta local". Al activarla, el formulario DEBERÁ transformarse en el de registro (username, password, repeat password) adaptándose a sus requerimientos, sin cambiar de página. Todos los textos DEBERÁN estar en español.

#### Scenario: Cambiar a registro
- **WHEN** el usuario activa la opción de crear cuenta local
- **THEN** el formulario de login se transforma en el de registro con los campos username, password y repeat password

#### Scenario: Volver a login
- **WHEN** el usuario cancela o vuelve desde el formulario de registro
- **THEN** el formulario retorna al modo login

### Requirement: Panel principal post-login
Tras iniciar sesión, el sistema DEBERÁ mostrar el listado de listas del place activo junto a los items sugeridos a comprar ordenados por consumo, y DEBERÁ permitir cambiar de place si el usuario pertenece a varios.

#### Scenario: Panel con place activo
- **WHEN** el usuario inicia sesión
- **THEN** se muestran las listas del place activo y la sección de items sugeridos ordenada por consumo decreciente

#### Scenario: Cambio de place
- **WHEN** un usuario con varios places selecciona otro place
- **THEN** el panel se actualiza con las listas, productos y sugerencias de ese place
