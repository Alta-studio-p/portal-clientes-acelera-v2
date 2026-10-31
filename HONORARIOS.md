# Honorarios de coaches

Ruta: `/admin/fees`. Disponible desde la navegación admin y desde cada coach.

Los administradores pueden consultar y guardar honorarios de cualquier coach.
Los coaches pueden consultar y exportar solo sus honorarios en `/coach/fees`;
no pueden editar valores ni pagos. La identidad se resuelve con
`coaches.profile_id = usuario autenticado`, nunca con el coach de la URL.
La capa de datos comprueba rol y pertenencia; el guardado sigue siendo solo admin.

## Base de datos

Los honorarios se guardan en **Neon**, la base operativa actual. Supabase sigue
autenticando a los usuarios. Ejecutar una vez por entorno, antes de desplegar:

```sh
npm run setup:coach-fees
npm run setup:coach-fees -- --apply
```

El script carga `.env.local`. Usa `DATABASE_URL` (o `POSTGRES_URL`) del entorno que
se quiere preparar. Crea `coach_fees` sin modificar llamadas, clientes ni sus
resúmenes. El SQL también está en `neon-add-coach-fees.sql`.

## Comportamiento

- Cada llamada con coach y fecha aparece automáticamente, una sola vez por su ID.
- Cada llamada parte de las horas que marca su duración en Fathom, a COP 100.000 por hora: hasta 35 min = 0,5 h; hasta 80 min = 1 h; hasta 105 min = 1,5 h; más = 2 h. **El máximo que se paga es 2 horas (COP 200.000)**; el editor no deja guardar más. Se conservan los valores editados.
- Al cambiar las horas de una llamada en el editor, se recalcula su valor a esa tarifa.
- Los trabajos sin llamada se pueden registrar como actividades manuales.
- La fecha de pago marca una actividad como pagada; exige valor y tipo de pago.
- Los estados son Por valorar, Pendiente y Pagado. Los totales responden a los filtros.
- La columna Grabación usa solo `calls.share_url`, el link público de compartir de Fathom
  (se abre sin iniciar sesión). Nunca `recording_url`, que es el link interno y exige login.
  Sin `share_url` se muestra "Grabación no disponible". Lógica compartida: `lib/recording-link.ts`.
- **La llamada es del coach que la hizo**, no del coach asignado al cliente: horas y honorarios se
  suman a quien la grabó en Fathom (`recorded_by.email` contra `coaches.email` / `alternate_emails`).
  Si no se puede determinar, se conserva el coach actual (o el del cliente en llamadas nuevas) y la
  fila muestra "Coach por confirmar". El lápiz permite corregirlo; eso mueve también el honorario.
  Si el cliente es de otro coach, se muestra "Cliente de [coach]" bajo el nombre.
- Vínculo llamada → cliente (`lib/client-matching.mjs`): email principal, email alterno
  (`clients.alternate_emails`), nombre (nombre + primer apellido o nombre completo, sin tildes);
  si es ambiguo o no hay coincidencia queda "Sin cliente vinculado". El método se guarda en
  `calls.client_match_method` y se ve como tooltip sobre el cliente. Un vínculo por nombre guarda el
  email nuevo del invitado como alterno. Las filas sin cliente se vinculan a mano desde el lápiz.
- El soporte no se muestra ni se edita; los datos históricos de soporte se conservan.
- Exportar CSV descarga las filas filtradas; neutraliza fórmulas en texto.
- El sync Supabase → Neon no incluye `coach_fees`, por lo que conserva las ediciones.

No se han importado honorarios históricos de la hoja de Google Sheets: la imagen
es la referencia de estructura y no acredita horas, valores ni pagos.

## Migración y backfill de atribución

```sh
npm run setup:call-attribution -- --apply     # columnas nuevas (solo agrega)
npm run backfill:call-attribution -- --month=2026-10            # dry-run: diagnóstico y resumen
npm run backfill:call-attribution -- --month=2026-10 --apply    # aplica (share_url, clientes, coach)
npm run test:attribution
```

El backfill nunca borra llamadas ni cambia valores, estados o fechas de pago; solo actualiza
`share_url`, `client_id`, `coach_id` y los campos de atribución. Lista las llamadas cuyo honorario
ya estaba pagado y cambian de coach.
