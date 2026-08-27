# Portal Clientes Acelera v2

Portal privado de coaching. Arquitectura: Fathom + Google Calendar + Google Drive → Supabase → este portal.
No usa Notion.

Proyecto Supabase: `portal-clientes-acelera-v2` (`lbxwephfuitsvlbetvlb`).

## Setup local

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Copia `.env.example` a `.env.local` y llena las variables con las credenciales del proyecto
   Supabase nuevo (cópialas del `.env.local` del proyecto viejo si aplica, o desde el dashboard de
   Supabase). Nunca subas `.env.local` a git.

3. Aplica las políticas de RLS (una sola vez, o cuando cambien): abre el SQL editor de Supabase y
   ejecuta [`supabase-rls.sql`](./supabase-rls.sql). Este script:
   - crea funciones helper (`is_admin`, `current_coach_id`, `current_client_id`)
   - habilita RLS en todas las tablas
   - agrega políticas de **solo lectura** para `authenticated`, según rol

   La escritura (import de Fathom, cambios administrativos) se hace siempre con
   `SUPABASE_SERVICE_ROLE_KEY` desde scripts de servidor — nunca desde el navegador.

4. Levanta la app:

   ```bash
   npm run dev
   ```

   Abre http://localhost:3000 — te redirige a `/login`.

## Login e invitaciones

El login usa Supabase Auth (email + password) vía `supabase.auth.signInWithPassword`. Después de
autenticar, la app lee `profiles.role` y redirige:

- `admin` → `/admin`
- `coach` → `/coach`
- `client` → `/portal`

Si el usuario autenticado no tiene fila en `profiles`, se muestra un mensaje y no se le deja
entrar (`/login?error=no_profile`).

### Cómo invitar usuarios (coaches/clientes) sin UI de invitación todavía

Por ahora no hay flujo de invitación en la UI. Para dar acceso a alguien:

1. En el dashboard de Supabase → Authentication → Users → **Invite user** (o crea el usuario con
   password temporal).
2. Asegúrate de que exista una fila en `public.profiles` con ese `id` (mismo UUID del usuario de
   auth), `email` y `role` correctos.
3. Si es coach, vincula `coaches.profile_id` a ese mismo `id`.
4. Si es cliente, vincula `clients.profile_id` a ese mismo `id`.

### Redirect URLs (Supabase Auth)

En Supabase → Authentication → URL Configuration, agrega:

- Site URL: `http://localhost:3000` en desarrollo (cámbialo a la URL de producción cuando se
  despliegue).
- Redirect URLs: agrega también la URL de producción cuando exista, para que los links de invitación
  y recuperación de contraseña funcionen.

Este proyecto no implementa todavía "reset password" ni "magic link" en la UI — el login es solo
email + password. Si un usuario necesita reenviar invitación, se hace desde el dashboard de
Supabase (Authentication → Users → selecciona el usuario → **Send password recovery**).

## Importador de Fathom

`scripts/import-fathom-v2.mjs` (copiado del proyecto viejo, sin dependencias externas — usa
`fetch` nativo y lee `.env.local`).

```bash
npm run import:fathom:v2          # dry-run
npm run import:fathom:v2:apply    # aplica cambios
```

No lo ejecutes salvo que sea necesario; siempre corre primero el dry-run.

## Títulos de llamada con LLM (OpenRouter + gpt-4o-mini)

Fathom a veces deja el título crudo del calendario ("Impromptu Google Meet Meeting") en vez de un
título útil. La UI ya tiene un fallback determinístico (extrae el "Meeting Purpose" /
"Propósito de la reunión" del resumen — ver `lib/call-title.ts`), pero para un título más limpio y
consistente hay un script que usa OpenRouter:

1. Ejecuta [`supabase-add-display-title.sql`](./supabase-add-display-title.sql) en el SQL editor
   de Supabase (agrega `calls.display_title` y `calls.display_title_generated_at`; no toca
   `calls.title`, que sigue siendo el original de Fathom).
2. Agrega `OPENROUTER_API_KEY` a tu `.env.local` (opcionalmente `OPENROUTER_MODEL`, por defecto
   `openai/gpt-4o-mini`).
3. Corre:

   ```bash
   npm run enrich:call-titles          # dry-run: muestra los títulos generados, no escribe nada
   npm run enrich:call-titles:apply    # aplica: guarda en calls.display_title
   ```

Solo procesa llamadas con `summary` y sin `display_title` todavía, así que es seguro correrlo
varias veces (idempotente) — nuevas llamadas importadas se recogen automáticamente la siguiente
vez que corras el script. La UI prioriza `display_title` sobre el título de Fathom cuando existe.

Nota: esto envía el resumen de cada llamada (no el transcript completo) a OpenRouter/OpenAI para
generar el título — ten esto en cuenta por privacidad de datos de clientes.

## Nombres de cliente con LLM

Fathom a veces guarda el email como "name" del participante, así que `clients.full_name` termina
siendo igual al email. `scripts/enrich-client-names.mjs` usa OpenRouter para leer los títulos y
resúmenes de las llamadas de cada cliente y extraer su nombre real (nunca inventa uno: si no está
claro, deja el cliente sin tocar).

```bash
npm run enrich:client-names          # dry-run
npm run enrich:client-names:apply    # aplica
```

Para excluir correos específicos de una corrida (ver sección de cuentas fantasma abajo), pasa
`ENRICH_SKIP_EMAILS="correo1@x.com,correo2@x.com"` antes del comando.

### ⚠️ Cuentas "fantasma" detectadas en el import de Fathom

Al correr el script encontramos que **al menos 5 registros de `clients` no son clientes reales**:

- `mari.aceleratalent@gmail.com`
- `rlconsultalent@gmail.com`
- `rosa.aceleratalent@gmail.com`
- `alex.vega@cmglobalconsulting.com`
- `jonathan.aceleratalent@gmail.com`

Los primeros cuatro son correos genéricos/de agenda (probablemente usados por los coaches para
programar reuniones) que Fathom marcó con `role_hint: "client"` en la misma llamada donde también
participaba el cliente real. El importador viejo (`import-fathom-v2.mjs`) los creó como clientes
separados, y en varias llamadas les asignó `calls.client_id` a ellos en vez de al cliente real —
por ejemplo, `mari.aceleratalent@gmail.com` tiene asignadas llamadas que en realidad son de
"Sergio Cobos" (`sergioandressacr@gmail.com`), y `rlconsultalent@gmail.com` mezcla llamadas de al
menos 3 clientes distintos (Mariano García, Diana Palacio, Caro Cortés).

`jonathan.aceleratalent@gmail.com` es distinto: parecen ser reuniones de prueba internas de Jota
consigo mismo (todas tituladas "Impromptu Google Meet Meeting", un solo participante — él mismo),
no representan a ningún cliente real.

**Esto significa que las estadísticas de esos clientes reales pueden estar incompletas** (parte de
sus llamadas está "escondida" bajo la cuenta fantasma). Antes de corregirlo hay que decidir, caso
por caso en Supabase, si el registro fantasma se borra y sus llamadas se reasignan (`calls.client_id`)
al cliente real correspondiente, o si alguno sí es un cliente legítimo que solo coincide con este
patrón por casualidad. No lo corregí automáticamente porque implica reasignar datos entre
clientes — mejor que se revise con contexto humano primero.

## Formato de nombres de cliente

Algunos nombres venían tal cual los puso Fathom/Calendar: mayúsculas sostenidas, formato
"Apellido, Nombre", tags como `{PEP}`. `scripts/normalize-client-names.mjs` normaliza esto de forma
determinística (sin LLM): Título Case, reordena "Apellido, Nombre" → "Nombre Apellido", quita tags
entre `{}`/`[]`. Es idempotente y seguro de correr después de cada import.

```bash
npm run normalize:client-names          # dry-run
npm run normalize:client-names:apply    # aplica
```

## Seguridad

- RLS activo en todas las tablas (ver `supabase-rls.sql`).
- El frontend nunca importa `SUPABASE_SERVICE_ROLE_KEY` (solo se usa en `lib/supabase/server.ts →
  createAdminClient()` y en scripts de servidor).
- Variables `NEXT_PUBLIC_*` son las únicas expuestas al navegador.
- Los queries de coach/cliente confían en RLS, no solo en filtros del frontend.

## Despliegue en Vercel

Stack estándar de Next.js App Router — sin configuración especial, Vercel lo detecta automáticamente
(build command `next build`, output managed por el framework preset "Next.js").

1. **Sube el repo a GitHub** (sin `.env.local` — ya está en `.gitignore`, revisa `git status` antes
   de hacer push para confirmar que no se cuela ningún secreto).
2. En Vercel: **Add New → Project → Import** el repo de GitHub.
3. Framework Preset: `Next.js` (detectado automático). No hace falta tocar build/output/install
   commands.
4. **Environment Variables**: copia cada variable de [`.env.example`](./.env.example) con sus
   valores reales del proyecto Supabase (`lbxwephfuitsvlbetvlb`). Como mínimo para que la app
   funcione en producción:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, según cuál uses)
   - `SUPABASE_SERVICE_ROLE_KEY` (solo si vas a correr los scripts de import/enrich desde CI/local
     apuntando a producción; el runtime de la app en sí no la necesita para servir el portal)

   Las variables `FATHOM_*` y `OPENROUTER_*` no son necesarias en Vercel — los scripts de
   `scripts/` se corren localmente o desde CI, no como parte del build/runtime de la app.
5. Deploy. Vercel construye con `npm run build` (o el lockfile que detecte) y sirve la app.
6. En Supabase → Authentication → URL Configuration, agrega la URL de producción de Vercel
   (`https://<tu-proyecto>.vercel.app` o el dominio custom) a **Site URL** y **Redirect URLs**,
   igual que se hizo con `localhost:3000` en desarrollo.

No hay `vercel.json` ni configuración de hosting propietaria (no Vinext, no `.openai/hosting.json`)
— es un despliegue "zero-config" de Next.js.

## Estado / TODOs

- Cambiar el estado de un cliente (`active` / `inactive` / `extension`) desde la UI del coach o
  admin no está implementado todavía — es de solo lectura. TODO: agregar acción server-side con
  validación de rol antes de habilitar edición.
- Integración de Google Calendar / Drive: el esquema y las vistas (`calendar_events`,
  `client_files`) ya están listos para mostrarlos, pero el sync todavía no corre — hoy dependen de
  que la tabla tenga datos.
- El proyecto contiene datos privados de clientes — antes de compartir la URL de producción o dar
  acceso a Vercel a más personas, confirma quién debe tener visibilidad del deployment/proyecto.
