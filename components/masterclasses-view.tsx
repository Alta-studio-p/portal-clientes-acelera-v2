'use client';

import {useState} from 'react';
import Link from 'next/link';
import {Plus, Search} from 'lucide-react';
import type {Masterclass} from '@/lib/data/masterclasses';
import {masterclassCategories, masterclassCategory, masterclassSortDate} from '@/lib/masterclasses.mjs';
import {MasterclassCard} from '@/components/masterclass-card';
import {MasterclassCalendar} from '@/components/masterclass-calendar';

type Filter = 'all' | keyof typeof masterclassCategories;
/** Orden de las pestañas: Executive Lab, Inteligencia artificial, Guías y al final Todas. */
const filters: {id: Filter; label: string}[] = [
  ...(['executive_lab', 'ai', 'guides'] as const).map(id => ({id: id as Filter, label: masterclassCategories[id]})),
  {id: 'all', label: 'Todas'},
];

const normalize = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const newestFirst = (a: Masterclass, b: Masterclass) =>
  (masterclassSortDate(b) ?? '').localeCompare(masterclassSortDate(a) ?? '');

/**
 * Biblioteca de masterclases compartida por Admin, portal del cliente y vista previa.
 * `basePath` es la ruta de la lista; el detalle vive en `${basePath}/${id}`.
 * `admin` muestra todos los estados, el botón "Nueva clase" y el lápiz de editar en cada tarjeta.
 */
export function MasterclassesView({classes, basePath, admin = false, notice}: {
  classes: Masterclass[];
  basePath: string;
  admin?: boolean;
  notice?: string;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const published = classes.filter(c => c.status === 'recording').toSorted(newestFirst);
  const library = (admin ? classes : published).toSorted(newestFirst);
  const latest = published.slice(0, 3);
  const inFilter = (c: Masterclass, id: Filter) => id === 'all' || masterclassCategory(c.category) === id;
  const q = normalize(query.trim());
  const visible = library.filter(c => inFilter(c, filter) && normalize(c.title).includes(q));
  const hrefFor = (c: Masterclass) => `${basePath}/${c.id}`;
  const editFor = admin ? (c: Masterclass) => `${basePath}?edit=${c.id}` : () => undefined;
  const activeLabel = filters.find(f => f.id === filter)!.label;

  return <div className="mx-auto max-w-6xl">
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold leading-tight">Masterclases</h1>
        <p className="mt-1 text-sm text-muted">{published.length} {published.length === 1 ? 'clase publicada' : 'clases publicadas'}</p>
      </div>
      {admin && <Link href={`${basePath}?edit=new`} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">
        <Plus size={16} aria-hidden="true"/>Nueva clase
      </Link>}
    </header>
    {notice && <p role="status" className="-mt-4 mb-6 text-sm text-accent">{notice}</p>}

    <MasterclassCalendar classes={classes} hrefFor={hrefFor}/>

    {latest.length > 0 && <section aria-labelledby="latest-title" className="mb-12">
      <h2 id="latest-title" className="mb-4 text-lg font-semibold">Últimas publicadas</h2>
      <ul className="grid gap-5 md:grid-cols-3">
        {latest.map(item => <li key={item.id} className="min-w-0"><MasterclassCard item={item} href={hrefFor(item)} editHref={editFor(item)} large/></li>)}
      </ul>
    </section>}

    <section aria-labelledby="library-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 id="library-title" className="text-lg font-semibold">Biblioteca</h2>
        <label className="relative w-full sm:w-80">
          <span className="sr-only">Buscar por título</span>
          <Search size={16} aria-hidden="true" className="absolute left-3 top-3.5 text-muted"/>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por título"
            className="min-h-11 w-full rounded-md border border-border bg-surface pl-10 pr-3 text-base focus-visible:outline-2 focus-visible:outline-accent sm:text-sm"/>
        </label>
      </div>
      <div role="group" aria-label="Filtrar por categoría" className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {filters.map(item => {
          const count = library.filter(c => inFilter(c, item.id)).length;
          const active = filter === item.id;
          return <button key={item.id} type="button" aria-pressed={active} onClick={() => setFilter(item.id)}
            className={'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent ' +
              (active ? 'bg-accent text-white' : 'border border-border bg-surface text-muted hover:text-foreground')}>
            {item.label}<span className={'rounded-full px-1.5 text-xs tabular-nums ' + (active ? 'bg-white/20' : 'bg-surface-muted')}>{count}</span>
          </button>;
        })}
      </div>
      {visible.length
        ? <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map(item => <li key={item.id} className="min-w-0"><MasterclassCard item={item} href={hrefFor(item)} editHref={editFor(item)}/></li>)}
        </ul>
        : <p role="status" className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted">
          {q ? `No hay clases cuyo título coincida con "${query.trim()}".`
            : filter === 'all' ? 'Todavía no hay clases publicadas.'
            : `Pronto vas a encontrar contenido de ${activeLabel} acá.`}
        </p>}
    </section>
  </div>;
}
