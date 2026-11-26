'use client';

import {useMemo, useState} from 'react';
import Link from 'next/link';
import {CalendarDays, ChevronLeft, ChevronRight, Video} from 'lucide-react';
import type {Masterclass} from '@/lib/data/masterclasses';
import {
  formatMasterclassDate,
  formatMasterclassTime,
  masterclassDayKey,
  masterclassLiveUrl,
  masterclassMonthGrid,
} from '@/lib/masterclasses.mjs';
import {CategoryTag} from '@/components/masterclass-card';

const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const monthName = new Intl.DateTimeFormat('es-CO', {timeZone: 'UTC', month: 'long', year: 'numeric'});
const longDay = new Intl.DateTimeFormat('es-CO', {timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long'});
const shortWeekday = new Intl.DateTimeFormat('es-CO', {timeZone: 'UTC', weekday: 'short'});
const keyDate = (key: string) => new Date(`${key}T00:00:00Z`);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Live = Masterclass & {starts_at: string};

/**
 * Calendario mensual de clases en vivo (programadas y canceladas), en hora de Colombia.
 * Cada día con clases es clicable para filtrar la lista; la lista muestra el botón "Unirme en vivo".
 */
export function MasterclassCalendar({classes, hrefFor}: {
  classes: Masterclass[];
  hrefFor: (item: Masterclass) => string;
}) {
  const live = useMemo(() => classes
    .filter((c): c is Live => ['scheduled', 'cancelled'].includes(c.status) && !!c.starts_at)
    .toSorted((a, b) => a.starts_at.localeCompare(b.starts_at)), [classes]);
  const byDay = useMemo(() => {
    const map = new Map<string, Live[]>();
    for (const item of live) {
      const key = masterclassDayKey(item.starts_at);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [live]);

  // "Ahora" se fija al montar. Arranca en el mes de la próxima clase (o el mes actual si no hay).
  const [now] = useState(() => Date.now());
  const today = masterclassDayKey(now);
  const nextId = live.find(c => c.status === 'scheduled' && new Date(c.starts_at).getTime() >= now)?.id;
  const [month, setMonth] = useState(() => {
    const next = live.find(c => c.id === nextId);
    const [y, m] = masterclassDayKey(next?.starts_at ?? now).split('-').map(Number);
    return {y, m};
  });
  const [selected, setSelected] = useState<string | null>(null);

  const prefix = `${month.y}-${String(month.m).padStart(2, '0')}-`;
  const cells = masterclassMonthGrid(month.y, month.m);
  const inMonth = live.filter(c => masterclassDayKey(c.starts_at).startsWith(prefix));
  const shown = selected ? (byDay.get(selected) ?? []) : inMonth;
  const label = capitalize(monthName.format(Date.UTC(month.y, month.m - 1, 1)));
  const go = (delta: number) => {
    const d = new Date(Date.UTC(month.y, month.m - 1 + delta, 1));
    setMonth({y: d.getUTCFullYear(), m: d.getUTCMonth() + 1});
    setSelected(null);
  };
  const navButton = 'inline-flex size-10 items-center justify-center rounded-md border border-border bg-surface text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent';

  return <section aria-labelledby="calendar-title" className="mb-12 rounded-lg border border-border bg-surface p-4 sm:p-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 id="calendar-title" className="flex items-center gap-2 text-lg font-semibold"><CalendarDays size={20} aria-hidden="true"/>Clases en vivo</h2>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => go(-1)} aria-label="Mes anterior" className={navButton}><ChevronLeft size={18} aria-hidden="true"/></button>
        <p aria-live="polite" className="min-w-36 text-center text-sm font-semibold">{label}</p>
        <button type="button" onClick={() => go(1)} aria-label="Mes siguiente" className={navButton}><ChevronRight size={18} aria-hidden="true"/></button>
      </div>
    </div>

    <div className="grid grid-cols-7 gap-1 text-center" aria-label={`Calendario de ${label}`}>
      {weekdays.map(day => <div key={day} className="pb-1 text-xs font-medium text-muted">{day}</div>)}
      {cells.map((key, index) => {
        if (!key) return <div key={`empty-${index}`} aria-hidden="true"/>;
        const items = byDay.get(key) ?? [];
        const day = Number(key.slice(8));
        const isToday = key === today;
        const isSelected = key === selected;
        const base = 'relative flex h-11 flex-col items-center justify-center rounded-md text-sm tabular-nums sm:h-12';
        if (!items.length) {
          return <div key={key} className={`${base} ${isToday ? 'font-semibold text-accent ring-1 ring-accent' : 'text-muted'}`}>{day}</div>;
        }
        const active = items.some(i => i.status === 'scheduled');
        return <button key={key} type="button" aria-pressed={isSelected}
          aria-label={`${capitalize(longDay.format(keyDate(key)))}: ${items.length} ${items.length === 1 ? 'clase' : 'clases'}`}
          onClick={() => setSelected(isSelected ? null : key)}
          className={`${base} font-semibold focus-visible:outline-2 focus-visible:outline-accent ${isSelected ? 'bg-accent text-white' : active ? 'bg-accent-soft text-accent hover:bg-accent/15' : 'bg-surface-muted text-muted hover:bg-border/60'} ${isToday && !isSelected ? 'ring-1 ring-accent' : ''}`}>
          {day}
          <span aria-hidden="true" className="mt-0.5 flex gap-0.5">{items.slice(0, 3).map(i => <span key={i.id} className={`size-1.5 rounded-full ${isSelected ? 'bg-white' : i.status === 'cancelled' ? 'bg-muted-2' : 'bg-accent'}`}/>)}</span>
        </button>;
      })}
    </div>

    <div className="mt-6 border-t border-border pt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{selected ? capitalize(longDay.format(keyDate(selected))) : `Clases de ${label.toLowerCase()}`}</h3>
        {selected && <button type="button" onClick={() => setSelected(null)} className="min-h-9 text-sm text-accent underline">Ver todo el mes</button>}
      </div>
      {!shown.length
        ? <p role="status" className="py-4 text-sm text-muted">{selected ? 'No hay clases este día.' : 'No hay clases en vivo programadas este mes.'}</p>
        : <ul className="divide-y divide-border">{shown.map(item => {
          const key = masterclassDayKey(item.starts_at);
          const url = item.status === 'scheduled' ? masterclassLiveUrl(item.live_url ?? '') : null;
          const status = item.status === 'cancelled' ? 'Cancelada' : item.id === nextId ? 'Próxima clase' : null;
          return <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3">
            <div aria-hidden="true" className="flex w-12 shrink-0 flex-col items-center rounded-md bg-surface-muted py-1.5 leading-tight">
              <span className="text-xs uppercase text-muted">{shortWeekday.format(keyDate(key)).replace('.', '')}</span>
              <span className="text-lg font-semibold tabular-nums">{Number(key.slice(8))}</span>
            </div>
            <div className="min-w-0 flex-1 basis-56">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <CategoryTag category={item.category}/>
                {status && <span className={`text-xs font-medium ${item.status === 'cancelled' ? 'text-muted' : 'text-accent'}`}>{status}{item.previous_starts_at ? ' · Reprogramada' : ''}</span>}
                {!status && item.previous_starts_at && <span className="text-xs font-medium text-accent">Reprogramada</span>}
              </div>
              <h4 className={`break-words font-semibold ${item.status === 'cancelled' ? 'text-muted line-through' : ''}`}><Link href={hrefFor(item)} className="hover:underline">{item.title}</Link></h4>
              <p className="mt-0.5 text-sm text-muted">
                <time dateTime={item.starts_at}>{formatMasterclassTime(item.starts_at)} · hora de Colombia</time>
                {item.duration_minutes ? ` · ${item.duration_minutes} min` : ''}
              </p>
              {item.previous_starts_at && <p className="mt-0.5 text-xs text-muted">Antes: {formatMasterclassDate(item.previous_starts_at)}</p>}
            </div>
            {url && <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent">
              <Video size={16} aria-hidden="true"/>Unirme en vivo
            </a>}
          </li>;
        })}</ul>}
    </div>
  </section>;
}
