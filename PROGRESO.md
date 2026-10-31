# Progreso de clientes

Ruta: `/admin/progress` (admin) y `/coach/progress` (coach, solo sus clientes).

## Estado por fecha de fin
El estado se calcula con la fecha de **fin** y la fecha de hoy (Bogotá) cada vez que se carga la vista
(`lib/program-phase.mjs`):

| Fase | Regla | Dónde aparece |
|---|---|---|
| Activo | el fin es posterior a hoy (si faltan ≤ 15 días: etiqueta amarilla "Termina en X días") | Activos |
| Recién finalizado | el fin es hoy o pasó hace ≤ 15 días (etiqueta naranja "Finalizó hace X días" / "Finalizó hoy") | Activos |
| Finalizado | el fin pasó hace más de 15 días | Finalizados |
| Cerrado a mano | estado guardado `inactive` con fin futuro: se respeta | Finalizados |
| Sin fecha de fin | se deja el estado guardado | según el guardado |

Las etiquetas automáticas no son las del botón +. Pruebas: `npm run test:attribution`.

## Estado guardado (clients.status)
`supabase-program-status.sql` crea `client_program_status()` (misma regla), `sync_client_program_status()`
(la ejecuta la importación diaria) y un disparador: si cambia `end_date` (extensión), el estado se recalcula solo.

```sh
npm run setup:program-status -- --apply   # crea funciones y disparador (no cambia datos)
npm run sync:client-status                # dry-run: tabla de clientes cuyo estado cambiaría
npm run sync:client-status -- --apply     # respaldo en backups/ + sincroniza
```

Mientras la migración no esté aplicada, la vista ya muestra los estados correctos (los calcula ella misma);
la importación diaria solo avisa que no pudo sincronizar.

## Orden de entrada y coach principal
- `clients.entry_order` = posición en la hoja "Ingresos 2026"; los clientes nuevos reciben el siguiente número.
- Coach principal = `coach_client_assignments.is_primary` (uno por cliente). La coach de apoyo (`is_support_coach`)
  no puede ser principal si el cliente tiene coach de trabajo. Secundarios: coaches con llamadas, calculados.
- `npm run sync:sheet-order` (dry-run; `-- --apply` guarda con respaldo) lee `ingresos-2026.csv` (ignorado por Git).

## Filtros en la URL
`?coach=ross&estado=activos|finalizados|todos&mes=2026-10&vista=resumen&secundarios=1&q=…&sesiones=…&orden=end-near`
