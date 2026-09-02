import type { ClientDetail } from "@/lib/data/client-detail";
import type { ClientStatus } from "@/lib/supabase/types";
import { removeClientDriveFolder, saveClientDriveFolder, updateClientStatus } from "./actions";
import { ClientDatesForm } from "@/components/client-dates-form";

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: "active", label: "Activo" },
  { value: "inactive", label: "Finalizado" },
  { value: "extension", label: "Extensión" },
];

const STATUS_MESSAGES: Record<string, string> = {
  saved: "Estado actualizado.",
  invalid: "Selecciona un estado válido.",
  error: "No se pudo actualizar el estado.",
};

const DRIVE_MESSAGES: Record<string, string> = {
  saved: "Carpeta actualizada.",
  removed: "Carpeta removida.",
  invalid: "Pega una URL o ID válido de Google Drive.",
  error: "No se pudo actualizar la carpeta.",
};

export function AdminClientSettings({
  client,
  driveStatus,
  clientStatus,
}: {
  client: ClientDetail;
  driveStatus?: string;
  clientStatus?: string;
}) {
  const driveMessage = driveStatus ? DRIVE_MESSAGES[driveStatus] : undefined;
  const statusMessage = clientStatus ? STATUS_MESSAGES[clientStatus] : undefined;

  return (
    <details className="group relative">
      <summary
        aria-label="Configuración del cliente"
        className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-border text-lg font-semibold text-muted transition hover:bg-surface-muted hover:text-foreground [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden="true">...</span>
      </summary>

      <div className="absolute right-0 z-20 mt-2 w-[min(380px,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-4 text-left shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Configuración</p>
            <p className="mt-0.5 text-xs text-muted-2">Solo visible para administradores</p>
          </div>
        </div>

        <form action={updateClientStatus} className="mt-4">
          <input type="hidden" name="clientId" value={client.id} />
          <label htmlFor="client-status" className="text-xs font-medium text-muted-2">
            Estado del cliente
          </label>
          <div className="mt-1.5 flex gap-2">
            <select
              id="client-status"
              name="clientStatus"
              defaultValue={client.status}
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Guardar
            </button>
          </div>
        </form>

        <div className="mt-4 border-t border-border pt-4">
          <ClientDatesForm clientId={client.id} startDate={client.start_date} endDate={client.end_date} />
        </div>

        <form action={saveClientDriveFolder} className="mt-4">
          <input type="hidden" name="clientId" value={client.id} />
          <label htmlFor="drive-folder" className="text-xs font-medium text-muted-2">
            Carpeta de Drive
          </label>
          <input
            id="drive-folder"
            type="text"
            name="driveFolder"
            defaultValue={client.drive_folder_url ?? client.drive_folder_id ?? ""}
            placeholder="https://drive.google.com/drive/folders/..."
            className="mt-1.5 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {client.drive_folder_url ? (
              <a
                href={client.drive_folder_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-accent hover:underline"
              >
                Abrir carpeta
              </a>
            ) : (
              <span className="text-xs text-muted-2">Sin carpeta asignada</span>
            )}
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
            >
              Guardar carpeta
            </button>
          </div>
        </form>

        {client.drive_folder_id && (
          <form action={removeClientDriveFolder} className="mt-2">
            <input type="hidden" name="clientId" value={client.id} />
            <button type="submit" className="text-xs font-medium text-[--danger] hover:underline">
              Quitar carpeta
            </button>
          </form>
        )}

        {(driveMessage || statusMessage) && (
          <div className="mt-4 space-y-1 rounded-md bg-surface-muted px-3 py-2 text-xs text-muted">
            {driveMessage && <p>{driveMessage}</p>}
            {statusMessage && <p>{statusMessage}</p>}
          </div>
        )}
      </div>
    </details>
  );
}
