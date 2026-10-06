import { ActivationForm } from './activation-form';

export default function ActivationPage() {
  return <main className="flex flex-1 items-center justify-center px-4 py-12">
    <div className="w-full max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">Activa tu acceso a Acelera</h1>
      <ActivationForm />
    </div>
  </main>;
}
