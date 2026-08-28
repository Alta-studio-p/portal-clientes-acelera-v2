"use client";

import { useMemo, useState } from "react";
import type { ClientFile } from "@/lib/supabase/types";
import { Card, SectionLabel } from "@/components/ui";

function extractGoogleId(value: string | null | undefined): string | null {
  if (!value) return null;

  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }

  return /^[a-zA-Z0-9_-]{20,}$/.test(value) ? value : null;
}

function filePreviewUrl(file: ClientFile): string | null {
  const id = file.google_file_id ?? extractGoogleId(file.url);
  if (!id) return null;

  if (file.mime_type === "application/vnd.google-apps.document") {
    return `https://docs.google.com/document/d/${id}/preview`;
  }

  if (file.mime_type === "application/vnd.google-apps.spreadsheet") {
    return `https://docs.google.com/spreadsheets/d/${id}/preview`;
  }

  if (file.mime_type === "application/vnd.google-apps.presentation") {
    return `https://docs.google.com/presentation/d/${id}/preview`;
  }

  return `https://drive.google.com/file/d/${id}/preview`;
}

function folderPreviewUrl(folderId: string | null): string | null {
  if (!folderId) return null;
  return `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`;
}

function fileKind(file: ClientFile): string {
  if (file.mime_type?.includes("document")) return "Documento";
  if (file.mime_type?.includes("spreadsheet")) return "Hoja";
  if (file.mime_type?.includes("presentation")) return "Presentacion";
  if (file.mime_type?.includes("pdf")) return "PDF";
  if (file.mime_type?.includes("folder")) return "Carpeta";
  return "Archivo";
}

function fileInitial(file: ClientFile): string {
  const kind = fileKind(file);
  if (kind === "Hoja") return "H";
  if (kind === "Presentacion") return "P";
  if (kind === "PDF") return "PDF";
  if (kind === "Carpeta") return "C";
  return "D";
}

export function DriveDocuments({
  files,
  folderId,
  folderUrl,
}: {
  files: ClientFile[];
  folderId: string | null;
  folderUrl: string | null;
}) {
  const embeddableFiles = useMemo(
    () => files.filter((file) => filePreviewUrl(file)),
    [files]
  );
  const [selectedFileId, setSelectedFileId] = useState<string | null>(
    embeddableFiles[0]?.id ?? null
  );

  const selectedFile = embeddableFiles.find((file) => file.id === selectedFileId) ?? embeddableFiles[0];
  const selectedPreviewUrl = selectedFile ? filePreviewUrl(selectedFile) : null;
  const folderEmbedUrl = folderPreviewUrl(folderId);
  const previewUrl = selectedPreviewUrl ?? folderEmbedUrl;
  const previewTitle = selectedFile?.name ?? "Carpeta de Drive";

  if (!folderUrl && files.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionLabel>Documentos de Drive</SectionLabel>
          <p className="text-sm text-muted">
            Materiales, hojas de trabajo y documentos compartidos con este cliente.
          </p>
        </div>
        {folderUrl && (
          <a
            href={folderUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Abrir en Drive
          </a>
        )}
      </div>

      {files.length > 0 && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {files.map((file) => {
            const active = selectedFile?.id === file.id;
            const preview = filePreviewUrl(file);

            return (
              <button
                key={file.id}
                type="button"
                disabled={!preview}
                onClick={() => preview && setSelectedFileId(file.id)}
                className={`min-h-20 rounded-lg border px-3 py-3 text-left transition ${
                  active
                    ? "border-accent bg-accent-soft"
                    : "border-border bg-surface hover:bg-surface-muted"
                } ${!preview ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-xs font-semibold text-accent">
                    {fileInitial(file)}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm font-medium text-foreground">
                      {file.name || "Archivo"}
                    </span>
                    <span className="mt-1 block text-xs text-muted-2">{fileKind(file)}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {previewUrl ? (
        <div className="overflow-hidden rounded-lg border border-border bg-surface-muted">
          <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">{previewTitle}</p>
            {selectedFile?.url && (
              <a
                href={selectedFile.url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-xs font-medium text-accent hover:underline"
              >
                Abrir archivo
              </a>
            )}
          </div>
          <iframe
            src={previewUrl}
            title={previewTitle}
            className="h-[520px] w-full bg-white"
            loading="lazy"
          />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm text-muted">
          Asigna una carpeta de Drive para mostrar sus documentos dentro del portal.
        </p>
      )}

      <p className="mt-3 text-xs text-muted-2">
        Si Google pide acceso dentro del visor, revisa que la carpeta o el archivo este compartido con el correo del usuario.
      </p>
    </Card>
  );
}
