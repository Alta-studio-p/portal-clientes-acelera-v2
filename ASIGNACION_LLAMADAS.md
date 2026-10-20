# Asignacion Manual De Clientes

- Administradores: `/admin`, tarjetas de llamadas que requieren atencion.
- Coaches: `/coach/unassigned`, pestana Sin cliente.
- Los administradores pueden escoger cualquier cliente existente.
- Los coaches solo ven sus llamadas pendientes y los clientes ya asignados a su coach.
- Los clientes del portal no tienen acceso a esta operacion.

La autorizacion se verifica en el servidor usando la sesion y el propietario
de la llamada, nunca un coach_id enviado por el navegador. No se crean clientes,
cuentas ni invitaciones. No se permite reemplazar un cliente existente.

La operacion bloquea la fila de llamada y guarda cliente, auditoria y relacion
coach-cliente en una transaccion. Mantiene el coach principal existente y no
modifica importes ni pagos. Si hay honorarios con otro cliente, rechaza la
asignacion para que un administrador resuelva el conflicto. Si los honorarios
no tienen cliente, completa ese dato con el cliente de la llamada.

Se conserva en raw_metadata.client_assignment el usuario, rol, instante y
cliente anterior. El importador ya preserva los client_id existentes, por lo
que las sincronizaciones posteriores no reemplazan esta seleccion.

Prueba: `node --env-file=.env.local scripts/test-call-assignment.cjs`.
Ejecuta 18 comprobaciones con autenticacion simulada y PostgreSQL real en tablas
temporales; revierte todos los datos de prueba. Cubre permisos, clientes fuera
de alcance, repeticion idempotente, conflictos, coach principal y rollback.
