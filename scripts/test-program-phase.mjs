import assert from 'node:assert/strict';
import { programPhase, storedStatusFor } from '../lib/program-phase.mjs';
const today = '2026-10-31';
const at = (status, endDate) => programPhase({ status, endDate }, today);
// Los 6 del reporte: fin en mayo/junio → Finalizados
for (const end of ['2026-05-01', '2026-05-26', '2026-06-01', '2026-06-02']) assert.equal(at('active', end).phase, 'finalizado');
// Fin hace 5 días → sigue en Activos con "Finalizó hace 5 días"
assert.deepEqual([at('active', '2026-10-26').phase, at('active', '2026-10-26').tag.text], ['recien', 'Finalizó hace 5 días']);
assert.equal(at('active', '2026-10-30').tag.text, 'Finalizó hace 1 día');
assert.equal(at('active', '2026-10-31').tag.text, 'Finalizó hoy');
assert.equal(at('active', '2026-10-16').phase, 'recien'); // 15 días: todavía
assert.equal(at('active', '2026-10-15').phase, 'finalizado'); // 16 días: ya no
// Fin en 10 días → Activo con "Termina en 10 días"; en 16 no hay etiqueta
assert.deepEqual([at('active', '2026-11-10').phase, at('active', '2026-11-10').tag.text], ['activo', 'Termina en 10 días']);
assert.equal(at('active', '2026-11-01').tag.text, 'Termina en 1 día');
assert.equal(at('active', '2026-11-15').tag.text, 'Termina en 15 días');
assert.equal(at('active', '2026-11-16').tag, null);
// Marcado Finalizado a mano antes de su fin: se respeta; si el fin ya pasó hace poco, queda como recién finalizado
assert.deepEqual([at('inactive', '2026-12-01').phase, at('inactive', '2026-12-01').manual], ['finalizado', true]);
assert.equal(at('inactive', '2026-10-28').phase, 'recien');
// Sin fecha de fin: se deja como está
assert.equal(at('active', null).phase, 'activo'); assert.equal(at('inactive', null).phase, 'finalizado');
// Estado guardado sincronizado
assert.equal(storedStatusFor('active', 'finalizado'), 'inactive'); assert.equal(storedStatusFor('inactive', 'recien'), 'active'); assert.equal(storedStatusFor('extension', 'activo'), 'extension');
console.log('PASS: estado por fecha de fin (activo / recién finalizado / finalizado / manual / sin fecha)');
