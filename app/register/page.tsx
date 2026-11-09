import { RegistrationForm } from './registration-form';
import { AuthFrame } from '@/components/auth-frame';

export const metadata = { title: 'Crear cuenta | Acelera Talent', robots: { index: false, follow: false } };

export default function RegisterPage() {
  return <AuthFrame title="Crea tu cuenta" description="Usa el correo registrado en Acelera o el que usaste en tu onboarding." footer="¿Tu correo cambió? Contacta a admin@joinaceleratalent.com">
    <RegistrationForm />
  </AuthFrame>;
}
