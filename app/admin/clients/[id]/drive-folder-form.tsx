import { Card, SectionLabel } from "@/components/ui";
import type { ClientDetail } from "@/lib/data/client-detail";
import { removeClientDriveFolder, saveClientDriveFolder } from "./actions";

const MESSAGES: Record<string, { text: string; className: string }> = {
  saved: {
    text: "Carpeta de Drive guardada.",
    className: "bg-[--status-active-bg] text-[--status-active]",
  },
  removed: {
    text: "Carpeta de Drive removida.",
    className: "bg-surface-muted text-muted",
  },
  invalid: {
    text: "Pega una URL o ID válido de una carpeta de Google Drive.",
    className: "bg-[--danger-bg] text-[--danger]",
  },
  error: {
    text: "No se pudo guardar el cambio. Intenta de nuevo.",
    className: "bg-[--danger-bg] text-[--danger]",
  },
};

export function DriveFolderForm({
  client,
  status,
}: {
  client: ClientDetail;
  status?: string;
}) {
  const message = status ? MESSAGES[status] : undefined;

  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionLabel>Carpeta de Drive</SectionLabel>
          <p className="text-sm text-muted">
            Asigna manualmente la carpeta correcta para este cliente.
          </p>
        </div>
        {client.drive_folder_url && (
          <a
            href={client.drive_folder_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Abrir carpeta
          </a>
        )}
      </div>

      <form action={saveClientDriveFolder} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input type="hidden" name="clientId" value={client.id} />
        <input
          type="text"
          name="driveFolder"
          defaultValue={client.drive_folder_url ?? client.drive_folder_id ?? ""}
          placeholder="https://drive.google.com/drive/folders/..."
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Guardar carpeta
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {client.drive_folder_id && (
          <p className="text-xs text-muted-2">
            ID actual: <span className="font-mono">{client.drive_folder_id}</span>
          </p>
        )}
        {client.drive_folder_id && (
          <form action={removeClientDriveFolder}>
            <input type="hidden" name="clientId" value={client.id} />
            <button
              type="submit"
              className="text-xs font-medium text-[--danger] hover:underline"
            >
              Quitar carpeta
            </button>
          </form>
        )}
      </div>

      {message && (
        <p className={`mt-4 rounded-md px-3 py-2 text-xs font-medium ${message.className}`}>
          {message.text}
        </p>
      )}
    </Card>
  );
}
