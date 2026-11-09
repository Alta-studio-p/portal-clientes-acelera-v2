import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Piezas visuales compartidas por todas las vistas del portal: encabezado de página,
// selector tipo pastilla, barra de periodo, tarjeta de métrica y tarjeta de tabla.
// Cambiar aquí cambia el estilo en todas las vistas. No contienen texto propio.

export const pillField = 'h-10 rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none transition-colors hover:border-muted-2 focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:opacity-50';
export const pillIconButton = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40';

/** Título grande y, debajo, subtítulo gris (solo si la vista ya lo tiene). `kicker` es el texto pequeño de acento que algunas vistas ya muestran encima. */
export function PageHeading({ title, subtitle, actions }: { title: string; subtitle?: string; kicker?: string; actions?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold leading-tight text-foreground">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>;
}

/**
 * Selector tipo pastilla: botones en una barra redondeada gris; la opción activa va en blanco con sombra suave.
 * Con más opciones que `collapseAfter` (6 por defecto) muestra un desplegable con el mismo estilo redondeado.
 * En pantallas angostas hace scroll horizontal. `hideLabel` deja la etiqueta solo para lectores de pantalla; `compact` achica la barra.
 */
export function SegmentedControl({ label, options, value, onChange, disabled = false, hideLabel = false, compact = false, collapseAfter = 6 }: {
  label: string; options: { value: string; label: string }[]; value: string; onChange: (value: string) => void; disabled?: boolean; hideLabel?: boolean; compact?: boolean; collapseAfter?: number;
}) {
  const labelClass = hideLabel ? 'sr-only' : 'mb-1.5 block text-xs font-medium text-muted';
  if (options.length > collapseAfter) {
    return <label className="block w-full sm:w-64"><span className={labelClass}>{label}</span>
      <select className={`${pillField} w-full`} value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
    </label>;
  }
  return <div className="min-w-0">
    <span className={labelClass}>{label}</span>
    <div role="radiogroup" aria-label={label} className="-mx-4 max-w-[100vw] overflow-x-auto px-4 sm:mx-0 sm:max-w-full sm:px-0">
      <div className={`inline-flex gap-1 rounded-lg bg-surface-muted ${compact ? 'p-0.5' : 'p-1'}`}>
        {options.map(o => <button key={o.value} type="button" role="radio" aria-checked={o.value === value} disabled={disabled} onClick={() => onChange(o.value)}
          className={`min-h-9 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60 ${compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm'} ${o.value === value ? 'bg-surface text-accent shadow-sm' : 'text-muted hover:bg-surface/60 hover:text-foreground'}`}>{o.label}</button>)}
      </div>
    </div>
  </div>;
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const shiftMonth = (month: string, step: number) => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + step, 1)).toISOString().slice(0, 7); };
/** "2026-10" → "Octubre 2026" */
export function monthLabelEs(month: string) { const [y, m] = month.split('-').map(Number); return `${MONTH_NAMES[m - 1]} ${y}`; }
/** Meses disponibles en el desplegable, el más reciente primero: desde enero de 2025 hasta 2 meses después del actual. */
export function monthOptions(selected: string, current: string, months?: string[]) {
  if (months) {
    const all = [...new Set([...months, ...(selected ? [selected] : [])])].sort().reverse();
    return all.map(m => ({ value: m, label: monthLabelEs(m) }));
  }
  const first = selected < '2025-01' ? selected : '2025-01';
  const lastWanted = shiftMonth(current, 2);
  const last = selected > lastWanted ? selected : lastWanted;
  const list: { value: string; label: string }[] = [];
  for (let m = last; m >= first; m = shiftMonth(m, -1)) list.push({ value: m, label: monthLabelEs(m) });
  return list;
}

/**
 * Tarjeta blanca de ancho completo: etiqueta del periodo, flecha anterior, mes (en español), flecha siguiente; a la derecha, las acciones.
 * Con `allLabel` la primera opción es "todos los meses" (valor ''). `months` limita las opciones a esos meses.
 */
export function PeriodBar({ label, month, currentMonth, onChange, previousTitle, nextTitle, disabled = false, actions, allLabel, months, compact = false }: {
  label: string; month: string; currentMonth: string; onChange: (month: string) => void; previousTitle: string; nextTitle: string; disabled?: boolean; actions?: ReactNode; allLabel?: string; months?: string[]; compact?: boolean;
}) {
  const list = monthOptions(month, currentMonth, months);
  const oldest = list.length ? list[list.length - 1].value : '';
  const newest = list.length ? list[0].value : '';
  const previous = months ? (month === '' ? newest : month > oldest ? shiftMonth(month, -1) : month) : shiftMonth(month || currentMonth, -1);
  const noPrevious = !!months && (list.length === 0 || (month !== '' && month <= oldest));
  const noNext = month === '' || (!!months && month >= newest);
  return <div className={`flex flex-wrap items-center justify-between gap-3 ${compact ? 'py-1' : 'border-y border-border py-3'}`}>
    <div className="flex flex-wrap items-center gap-2.5">
      <span className={`${compact ? 'sr-only sm:not-sr-only' : ''} text-sm text-muted`}>{label}</span>
      <button type="button" disabled={disabled || noPrevious} className={pillIconButton} onClick={() => onChange(previous)} title={previousTitle} aria-label={previousTitle}><ChevronLeft size={16} /></button>
      <select aria-label={label} value={month} disabled={disabled} onChange={e => onChange(e.target.value)} className={`${pillField} min-w-44 font-medium`}>
        {allLabel && <option value="">{allLabel}</option>}
        {list.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button type="button" disabled={disabled || noNext} className={pillIconButton} onClick={() => onChange(shiftMonth(month, 1))} title={nextTitle} aria-label={nextTitle}><ChevronRight size={16} /></button>
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>;
}

/** Tarjeta de métrica: número grande y etiqueta pequeña en gris. */
export function MetricCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return <div className="flex min-w-0 flex-col border-b border-border px-1 py-4">
    <p className="text-sm font-medium text-muted">{label}</p>
    <p className="mt-2 break-words text-3xl font-semibold tabular-nums text-foreground">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-muted-2">{hint}</p>}
  </div>;
}

/** Tarjeta blanca con esquinas redondeadas para una tabla; hace scroll horizontal en pantallas angostas. */
export function TableCard({ label, children }: { label: string; children: ReactNode }) {
  return <div className="data-table overflow-x-auto rounded-lg border border-border bg-surface" role="region" tabIndex={0} aria-label={label}>{children}</div>;
}

// Clases de tabla: encabezado en mayúsculas pequeñas grises con espacio entre letras, filas holgadas y fila de totales en el color de acento.
export const tableHead = 'bg-surface-muted/60 text-xs font-semibold text-muted';
export const tableHeadCell = 'whitespace-nowrap px-5 py-3';
export const tableBody = 'divide-y divide-border/70';
export const tableRow = 'transition-colors hover:bg-accent-soft/35';
export const tableCell = 'px-5 py-4';
export const tableFoot = 'border-t border-border bg-accent-soft/50 font-semibold text-accent';
