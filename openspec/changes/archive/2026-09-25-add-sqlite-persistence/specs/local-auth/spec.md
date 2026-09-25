## Purpose

Modifica la spec existente `local-auth`: el registro/login pasa a ocurrir en el servidor (SQLite) en vez del navegador.

## MODIFIED Requirements

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
