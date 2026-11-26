import Link from "next/link";
import { BookOpen, BriefcaseBusiness, Pencil, Sparkles } from "lucide-react";
import type { Masterclass, MasterclassCategory } from "@/lib/data/masterclasses";
import {
  formatMasterclassDate,
  formatMasterclassRelative,
  isNewMasterclass,
  masterclassCategories,
  masterclassCategory,
  masterclassDisplayDate,
  masterclassHttpsUrl,
  masterclassStatuses,
} from "@/lib/masterclasses.mjs";

export const categoryStyles: Record<MasterclassCategory, { tag: string; cover: string; icon: typeof Sparkles }> = {
  ai: { tag: "bg-cat-ai-bg text-cat-ai", cover: "bg-cat-ai-bg text-cat-ai", icon: Sparkles },
  executive_lab: { tag: "bg-cat-exec-bg text-cat-exec", cover: "bg-cat-exec-bg text-cat-exec", icon: BriefcaseBusiness },
  guides: { tag: "bg-cat-guides-bg text-cat-guides", cover: "bg-cat-guides-bg text-cat-guides", icon: BookOpen },
};

export function CategoryTag({ category }: { category?: string | null }) {
  const key = masterclassCategory(category);
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${categoryStyles[key].tag}`}>
    {masterclassCategories[key]}
  </span>;
}

export function MasterclassCover({ item, large = false }: { item: Masterclass; large?: boolean }) {
  const key = masterclassCategory(item.category);
  const cover = masterclassHttpsUrl(item.cover_url ?? "");
  const Icon = categoryStyles[key].icon;
  if (cover) {
    // Portadas externas configuradas por admin; <img> evita tener que declarar cada host en next.config.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-video w-full bg-surface-muted object-cover" />;
  }
  return <div aria-hidden="true" className={`flex aspect-video w-full items-center justify-center ${categoryStyles[key].cover}`}>
    <Icon size={large ? 40 : 30} strokeWidth={1.5} className="opacity-70" />
  </div>;
}

/** Texto de fecha para tarjetas: relativa si está publicada, completa si está programada. */
export function MasterclassCardDate({ item }: { item: Masterclass }) {
  const date = masterclassDisplayDate(item);
  if (!date) return <span>Sin fecha</span>;
  const text = item.status === "recording" ? formatMasterclassRelative(date) : formatMasterclassDate(date);
  // Las fechas relativas dependen de la hora del navegador; el servidor puede diferir por segundos.
  return <time dateTime={date} suppressHydrationWarning>{text}</time>;
}

export function MasterclassCard({ item, href, editHref, large = false }: {
  item: Masterclass;
  href: string;
  editHref?: string;
  large?: boolean;
}) {
  const fresh = item.status === "recording" && isNewMasterclass(item.published_at);
  return <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-[box-shadow,transform] duration-150 hover:shadow-md focus-within:shadow-md motion-safe:hover:-translate-y-0.5">
    <MasterclassCover item={item} large={large} />
    <div className={`flex flex-1 flex-col gap-2 ${large ? "p-5" : "p-4"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <CategoryTag category={item.category} />
        {fresh && <span className="rounded bg-accent px-2 py-0.5 text-xs font-semibold text-white" suppressHydrationWarning>Nueva</span>}
        {item.status !== "recording" && <span className="rounded border border-border px-2 py-0.5 text-xs text-muted">{masterclassStatuses[item.status]}</span>}
        {item.source_call_id && item.status === "draft" && <span className="text-xs font-medium text-amber-800">Detectada por IA</span>}
      </div>
      <h3 className={`break-words font-semibold ${large ? "text-lg leading-7" : "leading-6"}`}>
        {/* Enlace "estirado": su ::after cubre toda la tarjeta, así cualquier punto de la tarjeta abre el detalle
            sin anidar enlaces. El botón de editar queda por encima (z-10) y navega por separado. */}
        <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-focus-within:underline">
          {item.title}
        </Link>
      </h3>
      <p className="mt-auto text-xs text-muted"><MasterclassCardDate item={item} />{item.duration_minutes ? ` · ${item.duration_minutes} min` : ""}</p>
    </div>
    {editHref && <Link href={editHref} aria-label={`Editar ${item.title}`} title="Editar clase"
      className="absolute right-2 top-2 z-10 inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface/95 text-muted shadow-sm hover:bg-surface hover:text-foreground">
      <Pencil size={14} aria-hidden="true" />
    </Link>}
  </article>;
}
