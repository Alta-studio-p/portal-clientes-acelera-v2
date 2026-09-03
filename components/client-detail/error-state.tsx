"use client";

export function ClientDetailError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
      <p className="text-sm font-medium text-foreground">No se pudo cargar la información del cliente.</p>
      <p className="mt-1 max-w-sm text-sm text-muted">
        Ocurrió un error inesperado. Intenta de nuevo en unos segundos.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
      >
        Reintentar
      </button>
    </div>
  );
}
