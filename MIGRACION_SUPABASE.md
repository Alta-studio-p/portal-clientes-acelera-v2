# Consolidacion en Supabase

Fecha de verificacion: 2026-10-20.

## Estado

Los datos de las tablas de la aplicacion estan presentes en Supabase y fueron
comparados por identificador y contenido contra Neon. La plataforma desplegada
ya consulta y escribe en Supabase. Neon se conserva intacto como respaldo.

Los conteos de esta tabla corresponden al respaldo previo al cambio. Las nuevas
sincronizaciones pueden aumentar los totales operativos de Supabase.

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

## Publicacion Y Operacion

El commit inicial de la migracion es `88244e1`. Vercel lo marco Ready en
Production y el titular pudo iniciar sesion como administrador. Se verifico
el resumen general cargando los datos desde Supabase en el dominio habitual.

La primera prueba manual del importador leyo las seis fuentes de Fathom y
procesó cinco reuniones del ultimo dia. Dos llamadas nuevas quedaron disponibles
en el portal sin pasar por Neon. Al revisar los logs se detectaron y corrigieron
dos pasos opcionales que asumian que todos los clientes tenian correo.

La ruta de salud queda fuera de la redireccion de login y exige su propio
Bearer CRON_SECRET. Su comprobador rechaza redirecciones, respuestas HTML,
proveedores distintos de Supabase y conteos invalidos; un HTTP 200 por si solo
no se considera suficiente. Debe verificarse despues de cada despliegue.

No se ha detenido el importador ni eliminado Neon. No se cambiaron contrasenas
de usuarios ni las API keys. La contrasena PostgreSQL se restablecio por el titular.

## Auditoria Integral

Se actualizo Next.js a 16.4.2. La compilacion de produccion y las pruebas
focalizadas pasan; npm audit --omit=dev no reporta vulnerabilidades.
Persisten cinco alertas altas en dependencias de desarrollo del linter, sin
correccion compatible disponible. No se aplico una degradacion forzada.

El Git original fue reparado con una copia completa previa de sus metadatos.
Se retiro del Git activo la referencia invalida `refs/heads/main 2` y se
conservo en el respaldo. git fsck pasa y no se modifico .env.local.

El importador conserva clientes, coaches, resumenes, proximos pasos, estados y
fechas ya existentes. Solo asocia automaticamente por correo o nombre completo
inequivoco; nunca por un primer nombre aislado ni por menciones en el resumen.
Las asignaciones nuevas no sustituyen la seleccion manual de coach principal.
La revision de historial completo dispone de un modo sin escrituras y rechaza
una respuesta truncada por el limite de paginas. No se retranscribe audio.

La traduccion conserva por campo el texto ya escrito en espanol. Solo puede
refrescar un perfil generado si sigue siendo una copia exacta del resumen de
origen anterior a la traduccion; cualquier edicion manual impide reemplazarlo.
La ejecucion programada prueba estas invariantes y no admite dos importaciones
simultaneas dentro de su grupo de concurrencia.

## Historial Completo Verificado

La primera auditoria completa detecto 232 grabaciones historicas ausentes de
Caro. Se importaron con sus enlaces sin eliminar registros. La segunda auditoria
del 20 de octubre confirmo cero grabaciones faltantes en las seis cuentas.
Se excluyen las cinco demos de Fathom, que no son sesiones reales de clientes.

Supabase contiene 646 grabaciones y la vista de deduplicacion presenta 633
sesiones. No hay IDs de Fathom duplicados ni llamadas sin coach o sin enlace.
Se completaron 129 asociaciones de llamadas: 125 del historial de Caro, dos de
Ross con nombre completo en el titulo y dos de Jota revisadas manualmente con
identidad exacta. No se cambiaron asociaciones previas ni el coach principal.

| Coach | Grabaciones | Clientes vinculados |
| --- | ---: | ---: |
| Alex | 62 | 12 |
| Caro | 255 | 44 |
| Jota | 74 | 9 |
| Lorena | 29 | 4 |
| Mari | 62 | 11 |
| Ross | 164 | 24 |

Quedan 189 grabaciones sin cliente identificado, incluidas sesiones internas
y personas fuera de la lista maestra. Por indicacion expresa del titular se
conserva la lista actual de 66 clientes: no se crean fichas ni invitaciones para
las personas detectadas fuera de ella. No se asocian por primeros nombres.
Tres grabaciones carecen de resumen: se consulto tambien el endpoint directo
de resumen de Fathom y devolvio HTTP 200 sin texto en los tres casos.
No se invento contenido ni se retranscribio audio.

Dos perfiles nuevos que seguian en ingles se cotejaron con su resumen original
de Fathom. Solo tras confirmar la coincidencia exacta y ausencia de ediciones
manuales se actualizaron con el resumen traducido ya guardado en Supabase.

Las 66 fichas y consultas de administracion cargaron correctamente. Se probaron
los seis roles de coach y el perfil cliente con sesiones simuladas. Las once
tablas/vistas operativas rechazaron el acceso anonimo por la API (HTTP 401),
despues de validar que la clave publica utilizada era valida.

La sincronizacion diaria conserva su horario existente de 01:00 UTC
(20:00 de Colombia). Su ventana normal cubre 14 dias; el historial completo
puede revisarse manualmente con backfill_days=0 y audit_only=true.

Las seis claves de produccion en GitHub fueron verificadas. La clave de Jota
de la copia local sigue siendo antigua (HTTP 401); no se sustituyo ni se extrajo
la clave privada vigente desde GitHub. Esto no afecta al portal ni al trabajo
automatico. Hasta renovarla en privado, las importaciones manuales de las seis
fuentes deben lanzarse desde GitHub Actions, no desde .env.local.
