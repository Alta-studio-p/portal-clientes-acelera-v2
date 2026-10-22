# Registro de clientes

URL permanente: `/register`. No depende de que una invitación antigua siga vigente.

1. El cliente introduce el correo de su ficha, sin distinciones de mayúsculas.
2. El servidor exige una única ficha y descarta cuentas de coaches/administradores,
   correos duplicados y cuentas vinculadas a otra persona.
3. Se reutiliza la identidad de Auth o se crea una identidad sin verificar.
4. La ficha se vincula exclusivamente con un perfil `client`.
5. Supabase envía un enlace de verificación/recuperación para elegir contraseña.
6. El cliente entra en `/portal`, con los permisos existentes de su propia ficha.

No se crean fichas de clientes desde el formulario ni se aceptan roles o IDs enviados
por el navegador. No se envían correos masivos al publicar. Las invitaciones previas
siguen funcionando hasta su vencimiento habitual.

## Configuración requerida

- Aplicar `scripts/sql/client-registration.sql` con la conexión privada del servidor.
- Authentication > Sign In / Providers: **Allow new users to sign up OFF**,
  **Confirm email ON**, proveedor **Email ENABLED**. La creación privilegiada del
  servidor sigue disponible; el endpoint público de signup queda cerrado.
- URL de producción y `/auth/activate` autorizadas en Supabase.
- SMTP configurado para los clientes reales, y clave privada solo en el servidor.
- Vercel Production: URL/clave pública, clave privada y `SUPABASE_DATABASE_URL`.

Los límites persistentes son 3 solicitudes por correo/hora y 15 por IP/hora.
Los contadores usan HMAC; no guardan correos ni direcciones IP en claro.
La respuesta no revela si un correo pertenece a un cliente.

Pruebas sin correos reales: `node scripts/test-client-registration.mjs`.
Además comprobar compilación, página móvil y rechazo del signup público de Auth.
