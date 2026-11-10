import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { ClientProgressDashboard } from '@/components/client-progress-dashboard';
import { ClientDetailView } from '@/components/client-detail-view';
import { MasterclassesView } from '@/components/masterclasses-view';
import type { ClientDetail } from '@/lib/data/client-detail';
import type { ProgressClient } from '@/lib/client-progress';
import type { Masterclass } from '@/lib/data/masterclasses';
import { CoachingInsightsPanel } from '@/components/coaching-insights-panel';
import { ClientHeader } from '@/components/client-detail/client-header';
import { TOPICS } from '@/lib/coaching-topics.mjs';
import type { CoachingBundle } from '@/lib/coaching-insight-types';

export const metadata = { title: 'Vista local de diseño | Acelera', robots: { index: false, follow: false } };
const base = '/login/ui-preview';

export default async function UiPreview({ params, searchParams }: {
  params: Promise<{view?: string[]}>; searchParams: Promise<{call?: string}>;
}) {
  if (process.env.NODE_ENV !== 'development' || process.env.UI_LOCAL_PREVIEW !== '1') notFound();
  const path = (await params).view ?? [];
  const view = path[0] ?? 'progress';
  const names = ['Ana Sofía Martínez', 'Mateo Rodríguez', 'Valentina Ríos', 'Santiago Hernández', 'María José Fernández de Córdoba', 'Daniel Álvarez'];
  const clients: ProgressClient[] = names.map((name, index) => ({
    id: `demo-${index}`, name, email: `cliente${index + 1}@example.com`, calls: [8, 13, 3, 12, 6, 0][index],
    startDate: '2026-10-01', endDate: '2027-01-01', lastCall: index === 5 ? null : '2026-11-06',
    coaches: ['Alex'], coachIds: ['demo-coach'], primaryCoach: 'Alex', primaryCoachId: 'demo-coach',
    alsoCoachIds: [], alsoCoaches: [], categoryIds: index === 1 ? ['paid', 'work'] : index === 0 ? ['pending'] : [],
    operationalStatus: 'active', entryOrder: index,
  }));
  const chosen = clients.find(item => item.id === path[1]) ?? clients[0];
  const client: ClientDetail = {
    id: chosen.id, profile_id: null, full_name: chosen.name, email: chosen.email, status: 'active',
    drive_folder_url: null, drive_folder_id: null, first_call_id: null, context_source_call_id: null,
    context_generated_at: null, notes: null, desired_salary_range: null, start_date: '2026-10-01', end_date: '2027-01-01',
    context_summary: 'Profesional de marketing con experiencia en liderazgo de equipos. Su objetivo es fortalecer su narrativa profesional y preparar sus próximas entrevistas.',
    coaches: [{id: 'demo-coach', full_name: 'Alex', email: 'coach@example.com', is_primary: true}],
    files: [], calendarEvents: [],
    calls: ['Preparación para entrevistas y narrativa profesional', 'Estrategia de networking y marca personal', 'Revisión de hoja de vida', 'Onboarding y objetivos del programa'].map((title, index) => ({
      id: `call-${index}`, client_id: 'demo-0', coach_id: 'demo-coach', source: 'demo', fathom_call_id: null,
      title, display_title: title, started_at: `2026-11-0${6-index}T15:00:00Z`, duration_seconds: 3000,
      summary: '## Propósito\nPreparar una narrativa clara para las próximas entrevistas y comunicar los logros con ejemplos concretos.\n\n## Temas\n### Experiencia y fortalezas\nSe revisaron los proyectos recientes y la forma de presentar resultados medibles. La sesión se centró en conectar la experiencia profesional con los retos de la posición.\n\n### Preparación de la entrevista\nPracticar respuestas breves, estructuradas y naturales, utilizando ejemplos de liderazgo y colaboración.\n\n## Puntos clave\n- Presentar resultados con contexto y métricas.\n- Mantener una narrativa coherente con la hoja de vida.\n\n## Próximos pasos\n- Preparar tres ejemplos de logros profesionales.\n- Revisar las vacantes seleccionadas antes de la siguiente sesión.',
      next_steps: 'Preparar tres ejemplos de logros profesionales.\nRevisar las vacantes seleccionadas.',
      recording_url: null, share_url: null, calendar_event_id: null, raw_metadata: null, participants: [],
    })),
  };
  const classes: Masterclass[] = ['Contenido para LinkedIn con IA', 'Agentes de inteligencia artificial'].map((title, index) => ({
    id: `class-${index}`, title, description: 'Masterclase de prueba para revisar el diseño de la biblioteca.',
    starts_at: `2026-10-0${3-index}T15:00:00Z`, previous_starts_at: null, duration_minutes: 60,
    status: 'recording', live_url: null, drive_url: null,
  }));
  const coaching:CoachingBundle={available:true,sourceHash:'demo',summaryCount:4,totalCalls:4,topics:[],recommendations:[],versions:[{
    id:'demo-insight',source_hash:'demo',model:'google/gemini-2.5-flash-lite',created_at:'2026-11-10T15:00:00Z',truncated:false,cost_usd:null,
    source_call_ids:['call-3','call-2','call-1','call-0'],analysis:{
      objective:{text:'Fortalecer la narrativa profesional para acceder a una posición de liderazgo en marketing.',sources:['S1']},
      overview:{text:'Se han trabajado la hoja de vida y la marca profesional. Las últimas sesiones se enfocaron en networking y preparación de entrevistas. Se acordó preparar ejemplos concretos de liderazgo para la próxima sesión.',sources:['S2','S3','S4']},
      advances:[{text:'Se revisó la estructura de la hoja de vida.',sources:['S2']}],blockers:[],pending:[{text:'Revisar los ejemplos de liderazgo acordados.',sources:['S4']}],
      topics:TOPICS.map(([key])=>({key,state:key==='cv'?'trabajado':key==='entrevistas'?'en_trabajo':'pendiente',reason:key==='cv'?'Se revisó la hoja de vida en una sesión.':key==='entrevistas'?'Se practicó la narrativa y se acordó preparar ejemplos.':'Sin trabajo explícito documentado.',sources:key==='cv'?['S2']:key==='entrevistas'?['S4']:[]})),
      recommendations:[{key:'abcdef0123456789abcdef01',topic:'entrevistas',action:'Practicar dos ejemplos de liderazgo con resultados medibles.',reason:'La última sesión dejó este ejercicio como preparación para la próxima entrevista.',sources:['S4']}],
      evolution:['Definición de objetivos del programa.','Revisión de la hoja de vida.','Trabajo de networking y marca personal.','Práctica de narrativa para entrevistas.'].map((change,index)=>({source:`S${index+1}`,change,pending:index===3?['Preparar ejemplos de liderazgo.']:[]})),
    },
  }]};
  return <AppShell roleLabel="Vista local" userName="Administrador de prueba" userEmail="demo@example.com" navItems={[
    {href: `${base}/progress`, label: 'Progreso'}, {href: `${base}/journey`, label: 'Mapa del proceso'}, {href: `${base}/client`, label: 'Mi progreso'}, {href: `${base}/masterclasses`, label: 'Masterclases'},
  ]}>
    <p className="mb-6 text-xs text-muted">Vista de diseño con datos ficticios. <Link href="/login" className="text-accent underline">Ir al acceso real</Link></p>
    {view==='journey'?<><ClientHeader client={client}/><CoachingInsightsPanel clientId={client.id} bundle={coaching} calls={client.calls.map(call=>({id:call.id,title:call.title??'',date:call.started_at}))} basePath={`${base}/client`} readOnly/></>:view === 'client' || view === 'clients' ? <ClientDetailView client={client} callHrefBase={`${base}/${path.join('/')}`} selectedCallId={(await searchParams).call} showProgramStatus={false} /> : view === 'masterclasses' ? <MasterclassesView classes={classes} /> : <Suspense><ClientProgressDashboard clients={clients} categories={[{id:'paid',label:'Pagado',active:true},{id:'pending',label:'Pendiente de pago',active:true},{id:'work',label:'Consiguió trabajo',active:true}]} coaches={[{id:'demo-coach',name:'Alex',isSupport:false}]} isAdmin readOnly today="2026-11-08" basePath={base} /></Suspense>}
  </AppShell>;
}
