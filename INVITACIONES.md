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

La vinculación y el perfil se guardan en Neon. El sync conserva `clients.profile_id`
cuando ya está vinculado localmente. No altera llamadas ni archivos.
Si el correo se envía pero falla la vinculación, el admin recibe un error y debe
reintentar desde la misma ficha; la cuenta no recibe datos sin estar vinculada.

No se deben compartir contraseñas, claves privadas ni links de recuperación.
Para verificar: invitar una cuenta de prueba consentida, abrir el correo en un
navegador sin sesión admin, crear contraseña y comprobar solo su propia ficha.
