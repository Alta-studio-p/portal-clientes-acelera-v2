'use client';

export default function Error({ reset }: { reset: () => void }) {
  return <div role="alert" className="py-12 text-center">
    <p className="text-sm text-foreground">No pudimos cargar las llamadas.</p>
    <button onClick={reset} className="mt-4 rounded-md bg-accent px-4 py-2 text-sm text-white">Reintentar</button>
  </div>;
}
