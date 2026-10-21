# Acceso de clientes

En una ficha admin, Invitar cliente envía acceso al correo guardado en esa ficha.
La acción verifica rol admin, conflictos de identidad y vínculos existentes.
El cliente crea su contraseña en `/auth/activate` y entra en `/portal`.
Reenviar acceso usa recuperación de contraseña para una cuenta existente de cliente;
no crea una cuenta duplicada ni cambia roles del equipo.

## Configuración por entorno

- `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_SECRET_KEY`: solo en el servidor.
- `APP_URL`: URL pública HTTPS del portal. También admite `NEXT_PUBLIC_SITE_URL`
  o `VERCEL_PROJECT_PRODUCTION_URL` configurado por Vercel.
- En desarrollo, el envío usa el origen localhost actual.
- En Supabase Auth, permitir la URL de retorno exacta: `https://TU-PORTAL/auth/activate`.
  Para pruebas en este equipo: `http://localhost:3002/auth/activate`.
- Configurar SMTP para enviar a clientes externos y revisar los límites de envío.
  El servicio de correo predeterminado puede restringir los destinatarios.

La plantilla estándar de Supabase con ConfirmationURL está soportada.
Si se personaliza para token_hash, usar en Invite User:
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
y en recuperación `type=recovery` (o una URL absoluta a `/auth/confirm`).

La vinculación y el perfil se guardan en Supabase. El sync conserva `clients.profile_id`
cuando ya está vinculado localmente. No altera llamadas ni archivos.
Si el correo se envía pero falla la vinculación, el admin recibe un error y debe
reintentar desde la misma ficha; la cuenta no recibe datos sin estar vinculada.

## Enlaces para entrega personal

En Acceso al portal, Generar enlace usa `auth.admin.generateLink` sin enviar correo.
Copiar enlace permite entregarlo personalmente al cliente por WhatsApp. Requiere
rol admin y un correo válido en la ficha; verifica las mismas restricciones de
identidad que la invitación por correo. Nunca genera acceso de coaches o admins.
Para cuentas existentes validadas como cliente genera un enlace de recuperación,
sin duplicar la cuenta ni cambiar su contraseña hasta que el cliente lo use.

Los enlaces manuales siempre apuntan a HTTPS público, incluso desde localhost.
Si no hay URL configurada, usan `https://portal-clientes-acelera-v2.vercel.app`.
El enlace manual dura 48 horas exactas desde su emisión. Usa un secreto aleatorio
de 256 bits, del que solo se guarda SHA-256 en `client_access_invitations` con RLS
y sin acceso de anon/authenticated. No se modifica el vencimiento global de Auth.
El secreto viaja en el fragmento y se borra de la barra al abrir la página.
La persona debe pulsar Continuar para canjearlo; las vistas previas no lo consumen.
El servidor valida vigencia, uso único, ficha, correo y rol antes de emitir/verificar
un token corto de Supabase y permitir crear la contraseña. Regenerarlo invalida el
enlace manual anterior. Ejecutar `supabase-client-invitations.sql` antes de desplegar.
No publiques estos enlaces ni los envíes a grupos; entrégalos solo a su titular.

No se deben compartir contraseñas ni claves privadas.
Para verificar: invitar una cuenta de prueba consentida, abrir el correo en un
navegador sin sesión admin, crear contraseña y comprobar solo su propia ficha.
