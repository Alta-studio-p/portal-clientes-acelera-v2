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
- Cada llamada parte de una hora y COP 100.000 por hora; se conservan los valores editados.
- Al cambiar las horas de una llamada en el editor, se recalcula su valor a esa tarifa.
- Los trabajos sin llamada se pueden registrar como actividades manuales.
- La fecha de pago marca una actividad como pagada; exige valor y tipo de pago.
- Los estados son Por valorar, Pendiente y Pagado. Los totales responden a los filtros.
- La columna Grabación usa `calls.recording_url` o, como alternativa, `calls.share_url`.
- El soporte no se muestra ni se edita; los datos históricos de soporte se conservan.
- Exportar CSV descarga las filas filtradas; neutraliza fórmulas en texto.
- El sync Supabase → Neon no incluye `coach_fees`, por lo que conserva las ediciones.

No se han importado honorarios históricos de la hoja de Google Sheets: la imagen
es la referencia de estructura y no acredita horas, valores ni pagos.
