# local-auth Specification

## Purpose
Permite que cada persona tenga una cuenta local en el navegador (registro, inicio de sesión y sesión activa) sin depender de un servidor, de modo que cada usuario administre sus propios places y listas en el mismo dispositivo.

## Requirements

### Requirement: Registro de cuenta local
El sistema DEBERÁ permitir crear una cuenta con `username`, `password` y `repeat password`, validando que ambas contraseñas coincidan y que el `username` no exista ya (comparación case-insensitive). La cuenta se crea **en el servidor** (SQLite, hash PBKDF2-SHA-256 con salt) y devuelve un token de sesión. La contraseña NUNCA se almacena ni hashea en el navegador. Todos los textos del formulario DEBERÁN estar en español.

#### Scenario: Registro exitoso
- **WHEN** el usuario envía un `username` nuevo y dos contraseñas idénticas válidas
- **THEN** el servidor crea la cuenta con hash PBKDF2, emite un token de sesión y el cliente queda logueado

#### Scenario: Contraseñas no coinciden
- **WHEN** `password` y `repeat password` difieren
- **THEN** el sistema muestra un error en español y no crea la cuenta

#### Scenario: Username ya existe
- **WHEN** el `username` ingresado ya está registrado (en cualquier dispositivo)
- **THEN** el servidor responde 409 indicando que el usuario ya existe

### Requirement: Inicio de sesión
El sistema DEBERÁ autenticar con `username` y `password` contra las cuentas locales almacenadas y, si son válidas, establecer una sesión activa asociada a ese usuario.

#### Scenario: Login correcto
- **WHEN** el usuario ingresa credenciales válidas de una cuenta existente
- **THEN** el sistema inicia sesión y muestra el panel del usuario (listas e items sugeridos)

#### Scenario: Credenciales inválidas
- **WHEN** el `username` no existe o la contraseña es incorrecta
- **THEN** el sistema muestra un error genérico en español sin revelar cuál dato falló

### Requirement: Sesión y cambio de usuario del dispositivo
El sistema DEBERÁ persistir la sesión activa en localStorage y, si existen otras cuentas registradas en el navegador, permitir seleccionarlas para cambiar de usuario. El cambio de cuenta DEBERÁ requerir la contraseña del usuario seleccionado.

#### Scenario: Seleccionar otro usuario existente
- **WHEN** en localStorage existe más de una cuenta y el usuario selecciona otra e ingresa su contraseña
- **THEN** la sesión activa pasa a ese usuario y su contexto (places, listas) se actualiza

#### Scenario: Cerrar sesión
- **WHEN** el usuario cierra sesión
- **THEN** se elimina la sesión activa y se vuelve a la pantalla de login
