# Masterclases

1. Apply `supabase-masterclasses.sql` to the portal's Supabase database before releasing the application. The table has no direct access for Data API clients; pages and actions check the profile role on the server.
2. In **Administración → Masterclases**, create a draft, set a date and time in Colombia, and add a Google Meet or Zoom link before marking it as scheduled. Edit the same entry when it moves. Clients see the new date and the immediately previous date. Cancellation removes the join button. The portal does not send external notices.
3. For past classes, add each video's Drive file link and mark it as a published recording. Verify playback from a client account first, including in a browser that blocks third-party cookies. The player opens on demand with an external Drive fallback. The portal controls access to its catalog, while Drive controls access to each file.

Drive access is independent of the portal. Prefer restricted sharing with a verified clients-only group when possible. The current Acelera recordings folder uses approved link sharing as Viewer for playback without a Google account. Never apply that permission to folders containing individual client files.

Run `node --test scripts/test-masterclasses.mjs` to verify date and link validation.

## Categorías y biblioteca

Las masterclases se agrupan en **Inteligencia artificial**, **Executive Lab** y **Guías** (`masterclasses.category`: `ai`, `executive_lab`, `guides`). Antes de desplegar este cambio corre `node --env-file=.env.local scripts/setup-masterclass-categories.mjs` (dry-run, muestra cuántas filas cambian) y luego con `--apply`. La migración (`supabase-masterclass-categories.sql`) pasa las clases existentes, incluidas las antiguas "Clases de Caro", a Inteligencia artificial y agrega `published_at`, `cover_url` y `resources`.

- Las guías pueden publicarse sin fecha en vivo ni duración; se muestra la fecha de publicación (`published_at`, que se fija la primera vez que una clase pasa a publicada). Solo pueden estar en borrador o publicadas, y se pueden publicar con solo materiales.
- Cada clase tiene página de detalle en `/admin/masterclasses/[id]`, `/portal/masterclasses/[id]` y `/preview/clients/[id]/masterclasses/[classId]`.
- Las clases detectadas por IA desde llamadas de Caro se crean como borrador en Inteligencia artificial: elige la categoría correcta al revisarlas.
