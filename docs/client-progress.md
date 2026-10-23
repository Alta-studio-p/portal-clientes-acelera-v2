# Progreso y estados internos

- Administradores: `/admin/progress`, todos los clientes.
- Coaches: `/coach/progress`, exclusivamente sus clientes asignados.
- Vista previa de coach: pestaña Progreso, solo lectura y solo administradores.
- Clientes: no tienen acceso a estas vistas ni a los estados internos nuevos.

El porcentaje es `round(sesiones / 12 * 100)`, limitado a 100. Se cuentan las
sesiones deduplicadas de `public.client_sessions`, incluyendo las de otros coaches
del mismo cliente. Cero sesiones es 0%; 6 es 50%; 12 es 100%. Más de 12 mantiene
100%, colorea barra y nombre en rojo y muestra el exceso. No se eliminan sesiones
ni se cambia el estado operativo del cliente automáticamente.

Inicio se edita desde la fila, por administrador o coach asignado, con validación
de fecha y autorización en el servidor. Solo cambia `clients.start_date`; la fecha
final existente no cambia. El importador diario solo completa fechas vacías, por
lo que conserva un inicio editado manualmente.

Los estados de seguimiento son etiquetas múltiples, independientes de
active/extension/inactive. La celda también muestra el estado operativo real,
por ejemplo Activo junto a Pendiente de pago; no se modifica automáticamente.
Administradores y coaches asignados pueden marcar varias etiquetas y crear una
nueva desde el desplegable de cualquier cliente autorizado. El guardado afecta
solo a la etiqueta seleccionada, sin reemplazar las demás. Los nombres duplicados
se reutilizan sin distinciones de mayúsculas ni espacios repetidos.
Solo administradores pueden renombrar, retirar y restaurar categorías, mediante
el menú de tres puntos junto a cada opción. No hay una sección de administración
separada. Para restaurar una categoría retirada, el administrador puede buscarla.
Retirar una categoría impide nuevas asignaciones pero conserva las ya existentes;
puede filtrarse y restaurarse. No se borran categorías ni historiales de clientes.

## Instalación y pruebas

Aplicar `scripts/sql/client-progress.sql` con la conexión privada de PostgreSQL.
Después aplicar `scripts/sql/client-progress-labels.sql` para selección múltiple.
Esta migración copia las asignaciones existentes a una relación por etiqueta y
mantiene compatibilidad con pestañas antiguas de selección simple durante el despliegue.
La migración es aditiva e idempotente; no asigna estados a clientes existentes.
Las tablas tienen RLS y no conceden acceso a anon/authenticated. Solo el servidor
privado opera con ellas después de verificar sesión y asignaciones.

`node --env-file=.env.local scripts/test-client-progress.cjs` prueba contra tablas
temporales de PostgreSQL y revierte todo: fechas inválidas, límites de sesiones,
aislamiento de coaches, rechazo de clientes, estados retirados y restauración.
