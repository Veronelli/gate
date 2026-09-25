# local-auth Specification (delta)

## ADDED Requirements

### Requirement: Redirección post-login (`redirect_path`)

El flujo de login y registro DEBERÁ (SHALL) aceptar un parámetro `redirect_path` en la URL. Tras una autenticación exitosa, si `redirect_path` es una **ruta interna válida** (empieza con `/`, sin esquema ni `//`), la app DEBERÁ (SHALL) navegar a esa ruta en lugar del destino por defecto. Valores externos o malformados DEBERÁN (SHALL) ignorarse (anti open-redirect).

#### Scenario: Login con destino válido
- **WHEN** el usuario se loguea desde `/login?redirect_path=/listas/abc123`
- **THEN** tras el login exitoso la app navega a `/listas/abc123`

#### Scenario: Registro con destino válido
- **WHEN** un usuario nuevo se registra llegando con `redirect_path=/listas/abc123`
- **THEN** tras el registro exitoso termina en esa ruta

#### Scenario: Destino externo rechazado
- **WHEN** `redirect_path` es `https://sitio-externo.com` o `//sitio.com`
- **THEN** se ignora y se navega al destino por defecto
