# Alta desde onboarding

El importador diario revisa hasta 14 dias de grabaciones importadas desde la activacion del alta automatica (6 de noviembre de 2026, hora Colombia). La auditoria de solo lectura y los imports de una sola fuente no crean fichas.

- Solo una llamada titulada Onboarding con nombre, un unico correo externo, nombre coincidente en la invitacion, resumen de ingreso al programa y un interlocutor externo confirmado puede generar un alta automatica.
- Se comparan los nombres y correos con las fichas existentes, incluidos los correos alternos, y se agrupan grabaciones por correo. Supabase vuelve a comprobar duplicados y ejecuta la creacion, el vinculo de llamadas y la asignacion segura en una transaccion.
- La fecha de inicio es el dia del onboarding en Colombia. Si solo un coach operativo tiene una atribucion confirmada, queda como principal; no se asigna como principal a la coach que solo facilita el onboarding.
- El correo detectado sirve para identificar llamadas y solicitar acceso desde /register. La sincronizacion no envia correos ni crea cuentas. El cliente solicita un enlace, verifica su correo y solo entonces queda vinculada la cuenta a su ficha. La invitacion administrativa sigue disponible como respaldo.
- Los casos dudosos quedan sin alta. Pueden consultarse con `node --env-file=.env.local scripts/audit-onboarding-clients.mjs --days=14`.

Antes de activar el importador actualizado, aplicar `supabase-onboarding-intake.sql` en Supabase.
