# Seguimiento privado por correo

## Flujo

Fathom avisa cuando la transcripción está lista. La firma HMAC y la ventana de
cinco minutos se validan antes de procesar. Solo se aceptan grabaciones propias
del coach de la fuente; los webhooks compartidos no autorizan un envío.

El cliente debe coincidir por correo principal o alterno, sin ambigüedad. El coach
se resuelve con las reglas existentes y ambos deben hablar en la transcripción.
Si la llamada ya existe en el portal, sus vínculos y descarte tienen prioridad.
No se crean clientes, invitaciones, llamadas públicas ni nuevas asignaciones.

Claude recibe texto redactado, no credenciales ni destinatarios. Produce:

- Recapitulación con evidencia.
- Compromisos expresos con responsable y fecha solo si se dijo literalmente.
- Propuestas para preparar y enfocar la siguiente sesión.
- Retroalimentación privada, respaldada por intervenciones del coach.

La validación rechaza citas inventadas, acuerdos basados solo en el resumen,
fechas sin evidencia y críticas sustentadas en intervenciones del cliente.
Los no-shows, reuniones internas, clases y casos inciertos no se envían.

Se usa la rutina exclusiva de resúmenes, no la de evaluación. El seguimiento
tiene prioridad en la cola, pero comparte los límites existentes (20 activaciones
por 24 horas, tres simultáneas). Puede demorarse si Claude está sin cupo.

## Google Workspace

Remitente fijo: `admin@joinaceleratalent.com`.
Secreto de servidor en Production: `GOOGLE_WORKSPACE_APP_PASSWORD`.
Debe ser una contraseña de aplicación creada por el titular, no la normal.
Google requiere que la cuenta y las políticas de Workspace permitan este uso.
No se desactiva 2FA, no se omite TLS ni se abren permisos de Google.

SMTP: `smtp.gmail.com:465`, TLS con verificación de certificado. El destinatario
sale de `coaches.email`, nunca de texto generado por IA. Se revalida antes del envío.
No hay CC/BCC ni envíos directos a clientes. El correo incluye un archivo de texto
limpio, sin crítica privada, para revisar y compartir con el cliente.

## Activación

1. `scripts/setup-coach-followups.mjs --apply`: prepara tablas privadas, desactivado.
2. Desplegar código y ampliar la rutina para aceptar `coach_followup` según el
   esquema e instrucciones del endpoint existente.
3. `scripts/check-claude-routine.mjs --start --followup`: prueba ficticia sin correo.
4. Configurar el secreto de Workspace y ejecutar la prueba con
   `scripts/check-claude-routine.mjs --start --followup --test-mail`: verifica SMTP
   con un correo ficticio dirigido únicamente al remitente aprobado. El token de
   prueba se consume una sola vez; no permite enviar a un destinatario arbitrario.
5. `scripts/setup-coach-followups.mjs --apply --register`: crea un webhook por
   fuente. Solo grabaciones propias, sin CRM. Guarda secretos solo en esquema privado.
6. `scripts/setup-coach-followups.mjs --apply --enable`: habilita sesiones que
   comiencen desde ese instante; no envía retrospectivamente el historial.

Los scripts necesitan `SUPABASE_DATABASE_URL` y, para registrar webhooks,
`FATHOM_SOURCE_{COACH}_API_KEY`. Nunca imprimen credenciales.
Si una creación de webhook queda sin confirmar, el script bloquea su repetición:
revisar Fathom antes de resolver `registration_pending`. Una API inválida de un
coach no impide registrar las fuentes restantes.

## Entrega y recuperación

La recepción llama al despachador después de guardar la cola. El callback de
Claude entrega el correo después de persistir su resultado. El cron horario
recupera trabajos pendientes. Los resultados no se exponen en vistas de clientes.

El identificador de grabación es único; eventos repetidos no duplican trabajos.
La fila de entrega se reclama bajo bloqueo antes de llamar a SMTP. Una respuesta
ambigua después de DATA queda `uncertain`, sin reintento ciego, porque SMTP no
ofrece idempotencia garantizada. Las fallas conocidas antes de entregar admiten
hasta tres intentos. Los mensajes `blocked`, `uncertain` o con intentos agotados
requieren revisión administrativa en la base privada.

Tablas: `private.coach_followup_settings`, `private.fathom_followup_hooks`,
`private.coach_followups`, `private.claude_summary_jobs`. RLS sin políticas y sin
permisos para anon, authenticated o service_role; acceso solo desde servidor.

Pruebas: `node scripts/test-coach-followups.mjs`,
`node scripts/test-claude-summaries.mjs`.
