"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Search, X } from "lucide-react";

export type ProgressClient = {
  id: string;
  name: string;
  coachNames: string[];
  startDate: string | null;
  endDate: string | null;
  callCount: number;
  lastCallAt: string | null;
  calls: {
    id: string;
    started_at: string | null;
    title: string | null;
    display_title: string | null;
    summary: string | null;
    share_url: string | null;
    recording_url: string | null;
  }[];
  nextSession: { starts_at: string; title: string | null } | null;
  category: "attention" | "ending" | "in-progress" | "completed";
  reason: string;
  daysRemaining: number | null;
  daysSinceLastCall: number | null;
};

type Coach = { id: string; name: string; clientIds: string[] };
type Filter = "active" | "attention" | "ending" | "in-progress" | "completed";
type View = "follow-up" | "table";
type Sort = "name" | "coach" | "sessions" | "last" | "next" | "remaining" | "status";

const categoryLabel: Record<ProgressClient["category"], string> = {
  attention: "Requiere atención",
  ending: "Termina pronto",
  "in-progress": "En curso",
  completed: "Completado",
};

function shortDate(value: string | null) {
  if (!value) return "Sin datos";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function sessionDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function remainingLabel(days: number | null, category: ProgressClient["category"]) {
  if (category === "completed") return "Finalizado";
  if (days === null) return "Sin fechas";
  if (days === 0) return "Finaliza hoy";
  return `Faltan ${days} día${days === 1 ? "" : "s"}`;
}

function categoryStyle(category: ProgressClient["category"]) {
  if (category === "attention") return "border-[--alert-warning]/30 bg-[--alert-warning-bg] text-[--alert-warning]";
  if (category === "ending") return "border-[--alert-warning]/30 bg-[--alert-warning-bg] text-[--alert-warning]";
  if (category === "completed") return "border-[--border] bg-surface-muted text-muted";
  return "border-[--status-active]/20 bg-[--status-active-bg] text-[--status-active]";
}

function SessionDots({ client }: { client: ProgressClient }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (!client.calls.length) return <p className="mt-1 text-sm text-muted">Sin sesiones registradas</p>;

  const selected = client.calls.find((call) => call.id === openId);
  return (
    <div className="relative mt-1.5" onClick={(event) => event.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1" aria-label={`${client.callCount} sesiones realizadas`}>
        {client.calls.map((call, index) => (
          <button
            key={call.id}
            type="button"
            aria-label={`Ver sesión ${index + 1}`}
            aria-expanded={openId === call.id}
            onClick={() => setOpenId(openId === call.id ? null : call.id)}
            className="h-2.5 w-2.5 rounded-full bg-accent transition hover:scale-125 hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          />
        ))}
      </div>
      {selected && (
        <div className="absolute z-20 mt-2 w-72 rounded-xl border border-border bg-surface p-3 text-left shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Sesión {client.calls.findIndex((call) => call.id === selected.id) + 1}</p>
              <p className="mt-0.5 text-xs text-muted">{selected.started_at ? sessionDate(selected.started_at) : "Sin fecha"}</p>
            </div>
            <button type="button" onClick={() => setOpenId(null)} className="rounded p-1 text-muted hover:bg-surface-muted" aria-label="Cerrar detalle de sesión"><X size={14} /></button>
          </div>
          {selected.display_title || selected.title ? <p className="mt-2 text-sm text-muted">{selected.display_title || selected.title}</p> : null}
          {selected.summary ? <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted">{selected.summary}</p> : null}
          <a href={`/admin/clients/${client.id}?call=${selected.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover">Ver detalle <ExternalLink size={12} /></a>
        </div>
      )}
    </div>
  );
}

function StatusPill({ client }: { client: ProgressClient }) {
  return <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${categoryStyle(client.category)}`}>{categoryLabel[client.category]}</span>;
}

function ClientRow({ client }: { client: ProgressClient }) {
  const router = useRouter();
  const openClient = () => router.push(`/admin/clients/${client.id}`);
  const coach = client.coachNames.length ? client.coachNames.join(", ") : "Sin coach";

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={openClient}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openClient(); } }}
      className="group cursor-pointer border-b border-border px-1 py-5 outline-none transition hover:bg-surface-muted/45 focus-visible:bg-surface-muted/60"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(220px,1.1fr)_minmax(220px,1.3fr)_minmax(210px,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-foreground group-hover:text-accent">{client.name}</h3>
          <p className="mt-1 text-sm text-muted">{coach} <span className="mx-1 text-muted-2">·</span> Inicio {shortDate(client.startDate)}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{client.callCount} {client.callCount === 1 ? "sesión realizada" : "sesiones realizadas"}</p>
          <SessionDots client={client} />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm lg:block">
          <p className="text-muted"><span className="font-medium text-foreground">Última:</span> {client.lastCallAt ? shortDate(client.lastCallAt) : "Sin sesiones"}{client.category === "attention" && client.daysSinceLastCall !== null ? ` · hace ${client.daysSinceLastCall} días` : ""}</p>
          <p className="mt-0 lg:mt-1 text-muted"><span className="font-medium text-foreground">Próxima:</span> {client.nextSession ? sessionDate(client.nextSession.starts_at) : "Sin agendar"}</p>
        </div>
        <div className="flex items-center gap-3 lg:flex-col lg:items-end lg:gap-1">
          <StatusPill client={client} />
          <span className="text-sm font-medium text-muted">{client.reason || remainingLabel(client.daysRemaining, client.category)}</span>
        </div>
      </div>
    </article>
  );
}

function SortButton({ label, value, active, onClick }: { label: string; value: Sort; active: Sort; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`whitespace-nowrap text-left text-xs font-medium transition hover:text-accent ${active === value ? "text-accent" : "text-muted"}`}>{label}{active === value ? " ↓" : ""}</button>;
}

function ClientTable({ clients }: { clients: ProgressClient[] }) {
  const router = useRouter();
  const [sort, setSort] = useState<Sort>("remaining");
  const sorted = useMemo(() => [...clients].sort((a, b) => {
    const categoryOrder = { attention: 0, ending: 1, "in-progress": 2, completed: 3 };
    if (sort === "status") return categoryOrder[a.category] - categoryOrder[b.category] || a.name.localeCompare(b.name);
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "coach") return (a.coachNames[0] || "").localeCompare(b.coachNames[0] || "");
    if (sort === "sessions") return b.callCount - a.callCount;
    if (sort === "last") return (b.lastCallAt || "").localeCompare(a.lastCallAt || "");
    if (sort === "next") return (a.nextSession?.starts_at || "9999").localeCompare(b.nextSession?.starts_at || "9999");
    return (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999);
  }), [clients, sort]);
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[870px] text-left text-sm">
        <thead className="border-b border-border bg-surface-muted/60"><tr>
          <th className="px-4 py-3"><SortButton label="Cliente" value="name" active={sort} onClick={() => setSort("name")} /></th>
          <th className="px-4 py-3"><SortButton label="Coach" value="coach" active={sort} onClick={() => setSort("coach")} /></th>
          <th className="px-4 py-3 text-right"><SortButton label="Sesiones" value="sessions" active={sort} onClick={() => setSort("sessions")} /></th>
          <th className="px-4 py-3"><SortButton label="Última sesión" value="last" active={sort} onClick={() => setSort("last")} /></th>
          <th className="px-4 py-3"><SortButton label="Próxima sesión" value="next" active={sort} onClick={() => setSort("next")} /></th>
          <th className="px-4 py-3"><SortButton label="Tiempo restante" value="remaining" active={sort} onClick={() => setSort("remaining")} /></th>
          <th className="px-4 py-3"><SortButton label="Estado" value="status" active={sort} onClick={() => setSort("status")} /></th>
        </tr></thead>
        <tbody className="divide-y divide-border">
          {sorted.map((client) => <tr key={client.id} onClick={() => router.push(`/admin/clients/${client.id}`)} className="cursor-pointer transition hover:bg-surface-muted/50">
            <td className="px-4 py-3 font-semibold text-foreground">{client.name}</td>
            <td className="px-4 py-3 text-muted">{client.coachNames.join(", ") || "Sin coach"}</td>
            <td className="px-4 py-3 text-right tabular-nums text-muted">{client.callCount}</td>
            <td className="px-4 py-3 text-muted">{client.lastCallAt ? shortDate(client.lastCallAt) : "Sin sesiones"}</td>
            <td className="px-4 py-3 text-muted">{client.nextSession ? sessionDate(client.nextSession.starts_at) : "Sin agendar"}</td>
            <td className="px-4 py-3 font-medium text-foreground">{remainingLabel(client.daysRemaining, client.category)}</td>
            <td className="px-4 py-3"><StatusPill client={client} /></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  );
}

export function ProgressBoard({ clients, coaches }: { clients: ProgressClient[]; coaches: Coach[] }) {
  const [filter, setFilter] = useState<Filter>("active");
  const [coachId, setCoachId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("follow-up");
  const counts = useMemo(() => ({
    active: clients.filter((c) => c.category !== "completed").length,
    attention: clients.filter((c) => c.category === "attention").length,
    ending: clients.filter((c) => c.category === "ending").length,
    completed: clients.filter((c) => c.category === "completed").length,
  }), [clients]);
  const filtered = useMemo(() => clients.filter((client) => {
    const statusMatches = filter === "active" ? client.category !== "completed" : client.category === filter.replace("in-progress", "in-progress");
    const coachMatches = !coachId || coaches.find((coach) => coach.id === coachId)?.clientIds.includes(client.id);
    const searchMatches = !query.trim() || `${client.name} ${client.coachNames.join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    return statusMatches && coachMatches && searchMatches;
  }), [clients, coachId, coaches, filter, query]);
  const grouped = useMemo(() => (["attention", "ending", "in-progress"] as const).map((category) => ({ category, clients: filtered.filter((client) => client.category === category) })), [filtered]);
  const hasFilters = filter !== "active" || coachId !== null || query.trim().length > 0;
  const clear = () => { setFilter("active"); setCoachId(null); setQuery(""); };
  const filterCards: { id: Filter; label: string; count: number; color: string }[] = [
    { id: "active", label: "Activos", count: counts.active, color: "text-accent" },
    { id: "attention", label: "Requieren atención", count: counts.attention, color: "text-[--alert-warning]" },
    { id: "ending", label: "Terminan pronto", count: counts.ending, color: "text-[--alert-warning]" },
    { id: "completed", label: "Completados", count: counts.completed, color: "text-[--status-active]" },
  ];

  return <>
    <div className="mb-6 grid gap-2 sm:grid-cols-4">
      {filterCards.map((card) => <button key={card.id} type="button" onClick={() => setFilter(card.id)} className={`rounded-xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-accent ${filter === card.id ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-accent/50 hover:bg-surface-muted/40"}`}>
        <span className="block text-xs font-medium text-muted">{card.label}</span><span className={`mt-1 block text-2xl font-semibold tabular-nums ${card.color}`}>{card.count}</span>
      </button>)}
    </div>
    <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="relative w-full xl:max-w-sm"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente" className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-2 focus:border-accent focus:ring-2 focus:ring-accent/15" /></div>
      <div className="inline-flex w-fit rounded-lg border border-border bg-surface p-1"><button type="button" onClick={() => setView("follow-up")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${view === "follow-up" ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}>Seguimiento</button><button type="button" onClick={() => setView("table")} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${view === "table" ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}>Tabla</button></div>
    </div>
    <nav aria-label="Filtrar progreso por coach" className="mb-4 flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => setCoachId(null)} className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition ${!coachId ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted hover:border-accent hover:text-accent"}`}>Todos</button>{coaches.map((coach) => <button key={coach.id} type="button" onClick={() => setCoachId(coach.id)} className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition ${coachId === coach.id ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted hover:border-accent hover:text-accent"}`}>{coach.name}</button>)}</nav>
    {hasFilters && <div className="mb-5 flex flex-wrap items-center gap-2 text-sm"><span className="text-muted">Filtros:</span>{filter !== "active" && <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent">{filterCards.find((card) => card.id === filter)?.label}</span>}{coachId && <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent">{coaches.find((coach) => coach.id === coachId)?.name}</span>}{query.trim() && <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent">“{query.trim()}”</span>}<button type="button" onClick={clear} className="ml-1 font-semibold text-accent hover:text-accent-hover">Limpiar filtros</button></div>}
    {filtered.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-surface px-5 py-12 text-center text-sm text-muted">No encontramos clientes con estos filtros.</div> : view === "table" ? <ClientTable clients={filtered} /> : filter === "completed" ? <section><div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Completados · {filtered.length}</h2></div><div className="rounded-xl border border-border bg-surface px-4"><>{filtered.map((client) => <ClientRow key={client.id} client={client} />)}</></div></section> : <div className="space-y-7">{grouped.map((group) => group.clients.length ? <section key={group.category}><div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{categoryLabel[group.category]} · {group.clients.length}</h2>{group.category === "attention" ? <span className="text-xs font-medium text-[--alert-warning]">Prioridad hoy</span> : null}</div><div className="rounded-xl border border-border bg-surface px-4">{group.clients.map((client) => <ClientRow key={client.id} client={client} />)}</div></section> : null)}</div>}
  </>;
}
