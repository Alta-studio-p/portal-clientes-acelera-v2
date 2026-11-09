import { ForgotPasswordForm } from './forgot-password-form';
import { AuthFrame } from '@/components/auth-frame';

export default function ForgotPasswordPage() {
  return (
    <AuthFrame title="Recuperar contraseña" description="Ingresa tu usuario o correo y te enviaremos un enlace." footer="¿Problemas para entrar? Escribe a admin@joinaceleratalent.com">
          <ForgotPasswordForm />
    </AuthFrame>
  );
}
