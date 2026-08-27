# Portal Clientes Acelera v2 — contexto del proyecto

## Qué es esto

Portal privado para Acelera Talent (coaching de carrera). Reemplaza un portal viejo que dependía
de Notion. **No usa Notion para nada.**

Arquitectura de datos: **Fathom + Google Calendar + Google Drive → Supabase → este portal.**

- Fathom (grabador de llamadas) ya fue importado una vez a Supabase.
- Google Calendar y Google Drive están en el esquema (tablas `calendar_events`, `client_files`)
  pero el sync todavía **no está implementado** — las vistas ya están listas para mostrarlos en
  cuanto haya datos.

El proyecto viejo (Notion + vinext/Cloudflare) vive en una carpeta hermana:
`/Users/josefonseca/Desktop/Acelera/Acelera/portal-clientes-acelera`. No se debe tocar ni
reutilizar salvo para referencia visual puntual. Este proyecto (`portal-clientes-acelera-v2`) es
standalone, construido desde cero con Next.js, en:
`/Users/josefonseca/Desktop/Acelera/Acelera/portal-clientes-acelera-v2`.

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript, Tailwind v4.
- `@supabase/ssr` + `@supabase/supabase-js` para auth y datos. Sin ORM.
- Sin librería de UI (no shadcn, no componentes de terceros) — todo es Tailwind a mano, ver
  `components/ui.tsx` para los primitivos (`Card`, `PageHeader`, `StatCard`, `EmptyState`,
  `SectionLabel`).
- `middleware.ts` fue renombrado a `proxy.ts` (Next 16 deprecó el nombre `middleware`).

## Supabase

- Proyecto: `portal-clientes-acelera-v2`, ref `lbxwephfuitsvlbetvlb`, URL
  `https://lbxwephfuitsvlbetvlb.supabase.co`.
- Tablas: `profiles`, `coaches`, `clients`, `coach_client_assignments`, `calls`,
  `call_participants`, `calendar_events`, `client_files`, `sync_runs`.
- Roles en `profiles.role`: `client` | `coach` | `admin`. Estados en `clients.status`: `active` |
  `inactive` | `extension`.
- Admins: `jose.fonseca2002@outlook.com`, `admin@joinaceleratalent.com`. Coaches: Alex, Jota, Mari,
  Ross (`{nombre}@joinaceleratalent.com`).
- **RLS está activo** (`supabase-rls.sql`, ya ejecutado). Políticas de solo lectura por rol, con
  funciones helper `is_admin()`, `current_coach_id()`, `current_client_id()`. Toda escritura pasa
  por `SUPABASE_SERVICE_ROLE_KEY` desde scripts de servidor — nunca desde el navegador.
- El cliente admin (`lib/supabase/server.ts → createAdminClient()`) es server-only y bypassa RLS;
  cualquier código que lo use debe aplicar sus propios checks de autorización.

### Columnas agregadas sobre el esquema original (ya ejecutadas en Supabase)

- `calls.display_title` + `calls.display_title_generated_at` (`supabase-add-display-title.sql`) —
  título limpio generado por LLM, no pisa `calls.title` (el original de Fathom).
- `clients.desired_salary_range` + `clients.desired_salary_range_generated_at`
  (`supabase-add-salary-range.sql`) — rango salarial extraído por LLM de los resúmenes de llamada.

## Auth y roles

Login con Supabase Auth (email/password) en `/login` (`app/login/`). Después de autenticar se lee
`profiles.role` y se redirige: `admin` → `/admin`, `coach` → `/coach`, `client` → `/portal`
(`lib/auth.ts → roleHome()`). `proxy.ts` protege todas las rutas salvo `/login`.

No hay flujo de invitación en la UI todavía. Para dar acceso a alguien: crear el usuario en
Supabase Auth (dashboard o API admin), y asegurarse de que exista fila en `profiles` con el mismo
`id`, más `coaches.profile_id` o `clients.profile_id` según el caso. Ver README para más detalle.

## Estructura de rutas

- `app/admin/` — dashboard admin: resumen con conteos, `/admin/clients` (tabla filtrable),
  `/admin/clients/[id]` (detalle), `/admin/coaches` (coach → sus clientes).
- `app/coach/` — dashboard coach: solo sus clientes asignados (via `coach_client_assignments`),
  `/coach/clients/[id]` reusa el mismo detalle con permisos verificados server-side.
- `app/portal/` — vista cliente: su propio `clients` row vía `clients.profile_id`. Si no está
  vinculado, muestra estado vacío amable ("Contacta a Acelera").
- `components/client-detail-view.tsx` es el componente compartido de detalle de cliente
  (admin/coach/portal), respetando permisos ya resueltos en cada página server-side antes de
  renderizarlo.

## Capas de datos

`lib/data/admin.ts`, `lib/data/coach.ts`, `lib/data/client-detail.ts` — todas usan el cliente
Supabase server-side (respeta RLS con la sesión del usuario logueado, no el service role).

**Ojo con embeds ambiguos de PostgREST**: `clients` tiene tres relaciones distintas con `calls`
(`client_id`, `first_call_id`, `context_source_call_id`). Cualquier `.select()` que haga embed de
`calls` desde `clients` DEBE especificar la FK exacta: `calls!calls_client_id_fkey(...)` — si no,
PostgREST devuelve error 300 (ambiguous embed) y la query falla. Ya está así en
`lib/data/admin.ts` y `lib/data/coach.ts`; mantenerlo si se tocan esas queries.

## Componentes clave

- `components/markdown-lite.tsx` — renderer de markdown a mano (sin dependencia externa) para los
  resúmenes de Fathom, que siempre usan el mismo subset: `##`/`###` headings, `**bold**`,
  `[texto](url)` links, bullets `-`. Los links de Fathom (uno por línea, a momentos del video) se
  renderizan como **texto plano, no como link** — decisión explícita del usuario para no llenar el
  resumen de links repetidos; el único link a la grabación es el botón "Ver grabación" en el header
  de la llamada. `##` y `###` tienen estilos distintos (jerarquía visual).
- `lib/call-title.ts → displayCallTitle()` — prioridad de título mostrado: `display_title` (LLM) >
  `title` de Fathom si no es genérico > extraído del "Meeting Purpose" del summary > "Llamada sin
  título".
- `lib/context-summary.ts → stripContextIntro()` — quita la frase redundante "Contexto general
  creado desde la primera llamada registrada (...)" del inicio de `context_summary` (esa fecha se
  muestra aparte, derivada de `context_source_call_id`, no parseada del texto).
- `components/app-shell.tsx` — sidebar + nav compartido entre los 3 roles.
- `components/status-badge.tsx` — badge de `clients.status` con 3 colores (activo/inactivo/extensión).

## Scripts (todos en `scripts/`, patrón dry-run por defecto + `--apply`)

Todos leen `.env.local` a mano (sin dotenv), usan `fetch` nativo contra la REST API de Supabase con
el service role key. Correr siempre primero sin `--apply` y revisar el output antes de aplicar.

| Script | Qué hace |
|---|---|
| `import-fathom-v2.mjs` | Importador original (copiado del proyecto viejo). Lee Fathom por coach, crea clientes/llamadas/participantes/asignaciones y el contexto único por cliente. **No correrlo de nuevo salvo necesidad real** — ya se corrió una vez. |
| `enrich-call-titles.mjs` | OpenRouter (gpt-4o-mini) genera `calls.display_title` a partir del resumen. Idempotente (solo procesa `summary IS NOT NULL AND display_title IS NULL`). Ya corrido sobre las 220 llamadas con resumen. |
| `enrich-client-names.mjs` | OpenRouter extrae el nombre real del cliente desde títulos/resúmenes de sus llamadas cuando `clients.full_name` es igual al email (Fathom a veces guarda el email como nombre). Nunca inventa: responde `DESCONOCIDO` si no hay certeza. Soporta `ENRICH_SKIP_EMAILS="a@x.com,b@x.com"` para excluir cuentas problemáticas. |
| `normalize-client-names.mjs` | Determinístico (sin LLM). Título Case, reordena "Apellido, Nombre" → "Nombre Apellido", quita tags `{...}`/`[...]`. |
| `enrich-salary-range.mjs` | OpenRouter extrae el rango/expectativa salarial mencionado en las llamadas del cliente → `clients.desired_salary_range`. Responde `DESCONOCIDO` si no se menciona. Requiere haber corrido `supabase-add-salary-range.sql` primero. |

Variables de entorno para OpenRouter: los scripts aceptan `OPENROUTER_API_KEY` **o** `LLM_API_KEY`
(el usuario usa nombres del proyecto viejo: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` — todos
soportados como fallback). Modelo por defecto: `openai/gpt-4o-mini`.

## ⚠️ Problema de datos conocido: cuentas "fantasma"

El import de Fathom creó **al menos 5 registros de `clients` que no son clientes reales**:
`mari.aceleratalent@gmail.com`, `rlconsultalent@gmail.com`, `rosa.aceleratalent@gmail.com`,
`alex.vega@cmglobalconsulting.com`, `jonathan.aceleratalent@gmail.com`.

Los primeros 4 son correos genéricos/de agenda que Fathom marcó con `role_hint: "client"` en la
misma llamada donde también participaba el cliente real — el importador los creó como clientes
separados y en varias llamadas asignó `calls.client_id` a la cuenta fantasma en vez de al cliente
real (ej. `mari.aceleratalent@gmail.com` tiene llamadas que son en realidad de "Sergio Cobos";
`rlconsultalent@gmail.com` mezcla llamadas de al menos 3 clientes distintos). El quinto
(`jonathan.aceleratalent@gmail.com`) son reuniones de prueba internas de Jota consigo mismo.

**No corregido todavía** — implica reasignar `calls.client_id` entre registros y posiblemente
borrar los clientes fantasma, lo cual requiere revisión humana caso por caso antes de tocar datos
reales de coaching. Detalle completo en el README, sección "Cuentas fantasma detectadas".
Excluir estos emails (`ENRICH_SKIP_EMAILS=...`) al correr los scripts de enrichment hasta que se
resuelva.

## Diseño

Tokens de color en `app/globals.css` (`--accent`, `--surface`, `--border`, `--status-*`, etc.),
consumidos vía Tailwind arbitrary values (`bg-[--status-active-bg]`) y `@theme inline`. Paleta:
azul acento + neutrales, sin colores chillones, sin dark mode implementado todavía (solo light).
Sidebar + contenido, sin landing page — la primera pantalla siempre es producto real.

## Pendiente / TODO

- **Cambiar `clients.status` desde la UI** no está implementado (solo lectura). Si se agrega, debe
  ser una server action con verificación de rol (admin o coach asignado), nunca un update directo
  desde el cliente.
- **Google Calendar / Drive**: esquema y UI listos (`calendar_events`, `client_files`), falta el
  script de sync.
- **Cuentas fantasma** (ver arriba) — pendiente de decisión humana.
- **No desplegado a producción** — contiene datos privados de clientes reales, pedir confirmación
  explícita antes de cualquier deploy.
- Flujo de invitación de usuarios: documentado como manual en el README, no hay UI.

## Convenciones de trabajo con el usuario

- Antes de correr cualquier script `--apply` que escriba en Supabase (o cualquier cosa que llame a
  un LLM externo con datos de clientes), correr primero el dry-run, mostrar una muestra al usuario,
  y esperar confirmación explícita antes de aplicar.
- Si un cambio de código requiere una migración SQL nueva, avisar ANTES de que el usuario recargue
  la app (la query rota con 400 si la columna no existe todavía) y esperar confirmación de que ya
  la corrió antes de asumir que existe.
- No imprimir secretos (keys, passwords) en ningún momento, ni en terminal ni en archivos commiteados.
- El usuario prefiere que se investiguen datos sospechosos (nombres/asignaciones que no cuadran)
  antes de aplicar un enrichment automático — ver el caso de las cuentas fantasma como ejemplo de
  este patrón.
