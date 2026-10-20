# Consolidacion en Supabase

Fecha de verificacion: 2026-10-20.

## Estado

Los datos de las tablas de la aplicacion estan presentes en Supabase y fueron
comparados por identificador y contenido contra Neon. La plataforma desplegada
todavia consulta Neon hasta publicar y verificar el cambio de conexion.

| Tabla | Neon | Supabase |
| --- | ---: | ---: |
| calls | 412 | 412 |
| call_participants | 917 | 917 |
| clients | 66 | 66 |
| coaches | 6 | 6 |
| profiles | 9 | 9 |
| coach_client_assignments | 69 | 69 |
| coach_fees | 0 | 0 |
| calendar_events | 0 | 0 |
| client_files | 0 | 0 |
| sync_runs | 0 | 0 |

Se conservo en Supabase la vinculacion de usuario de Fernando, validada contra
Supabase Auth. No se crearon cuentas ni se cambiaron credenciales de usuarios.
Las diferencias restantes corresponden a marcas tecnicas `updated_at`, no a
informacion de llamadas, asignaciones, perfiles o clientes.

Se aplico `supabase-consolidation.sql`: tabla de honorarios con RLS y vista de
sesiones unicas con `security_invoker`. Ambas aceptan acceso de servidor y
rechazan el acceso anonimo (HTTP 401 verificado).

## Respaldos

Los respaldos privados estan fuera del repositorio, en la carpeta
`migration-backups` del espacio de trabajo de esta conversacion de Codex.
Se guardaron instantaneas anteriores y posteriores, datos, columnas, restricciones,
vistas, indices, triggers, funciones y politicas de Neon.

`neon_auth` no contiene usuarios, cuentas, sesiones ni claves. Su unico registro
es configuracion propia del servicio de Neon; esta respaldado y no se copio a
las tablas publicas ni a Supabase Auth. La autenticacion del portal ya usa Supabase.

## Conexion Preparada Y Verificada

El titular restablecio la contrasena. `SUPABASE_DATABASE_URL` esta guardada
localmente y se probo con verificacion de certificado y hostname TLS.
El certificado publico se obtuvo del enlace oficial de Supabase.

El codigo local usa `pg` con el pooler de Supabase. No usa `DATABASE_URL` ni
`POSTGRES_URL` como fallback. Conserva parametros SQL y tipos de fecha esperados,
y crea cliente/asignacion en una sola transaccion. Se retiraron las escrituras
duplicadas de estado, fechas y carpeta de Drive.

Pruebas ejecutadas contra Supabase: 13 casos de sesiones unicas, parametros SQL,
arrays, JSON, fechas, commit, rollback y recuperacion de conexiones. Sin perfiles
huerfanos ni clientes vinculados a perfiles de otro rol. Las escrituras de prueba
solo crearon tablas temporales, no registros de la aplicacion.

Se genero otro respaldo y comparacion a las 18:19 UTC del 20 de octubre:
misma informacion en ambas bases, con diferencias solo en `updated_at` ya descritas.
La comparacion final se repitio a las 18:43 UTC con el mismo resultado.

La compilacion de produccion (webpack), TypeScript y ESLint focalizado pasaron
en una copia aislada con dependencias limpias. Se probaron las consultas reales
de las 66 fichas y de administracion/calendario, los seis coaches y el perfil
cliente existente. Las sesiones de estas pruebas de roles fueron simuladas;
no equivalen a iniciar sesion en el navegador con las contrasenas de usuarios.

La variable privada fue agregada por el titular en Vercel; se confirmo su
presencia en Production y Preview sin revelar su valor.

El cambio preparado sustituye la copia a Neon por una comprobacion protegida
`/api/internal/database-health`; la ruta antigua responde 410 a llamadas autorizadas.
El importador sigue escribiendo en Supabase con API keys, que no cambian al
restablecer la contrasena PostgreSQL. Supabase Auth conserva sus usuarios y claves.

## Pendiente Antes De Publicar

1. Publicar y verificar la ruta protegida de salud y el acceso en navegador.
2. Comprobar que el workflow diario pasa sin copiar datos a Neon.
3. Mantener Neon temporalmente como respaldo; no eliminarlo automaticamente.

No se ha detenido el importador ni se ha desconectado la plataforma actual.
No se ha desplegado aun ningun cambio de proveedor de base de datos.
