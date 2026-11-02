import assert from 'node:assert/strict';
import { matchClient, matchClientBySpeakers, emailToLearn } from '../lib/client-matching.mjs';
import { resolveCallCoach } from '../lib/coach-attribution.mjs';
import { nonCoachSpeakerNames, summarizeSpeakers, isInternalCall } from '../lib/call-speakers.mjs';

const clients = [
  { id: 'a', full_name: 'Elkin Ospina', email: 'elkin@x.com', alternate_emails: ['elkin.work@y.com'] },
  { id: 'b', full_name: 'David Gómez Pérez', email: 'david@x.com', alternate_emails: [] },
  { id: 'c', full_name: 'Juan Pérez', email: 'juanp@x.com', alternate_emails: [] },
  { id: 'd', full_name: 'Juan Pérez Mora', email: 'juanm@x.com', alternate_emails: [] },
  { id: 'f', full_name: 'Carlos Herreño', email: null, alternate_emails: [] },
  { id: 'e', full_name: 'Beto', email: 'beto@x.com', alternate_emails: [] },
];
const check = (meeting, id, method) => {
  const r = matchClient(meeting, clients);
  assert.equal(r.client?.id ?? null, id, JSON.stringify(meeting));
  assert.equal(r.method, method, JSON.stringify(meeting));
  return r;
};

check({ invitees: [{ email: 'ELKIN@x.com' }] }, 'a', 'email');
check({ invitees: [{ email: 'elkin.work@y.com', name: 'Otro' }] }, 'a', 'alt_email');
// Email principal gana sobre el nombre; alterno gana sobre el nombre.
check({ title: 'Sesión David Gomez', invitees: [{ email: 'elkin@x.com' }] }, 'a', 'email');
// Nombre: sin tildes, mayúsculas ni espacios dobles; nombre + primer apellido.
const byName = check({ title: 'Mentoría   DAVID gomez', invitees: [{ email: 'nuevo@gmail.com', name: 'x' }] }, 'b', 'name');
assert.equal(byName.learnEmail, 'nuevo@gmail.com');
check({ invitees: [{ email: 'nuevo@gmail.com', name: 'Elkin Ospina' }] }, 'a', 'name');
check({ invitees: [{ email: 'c@h.com', name: 'Carlos Alberto Herreño Vargas' }] }, 'f', 'name');
check({ title: 'Testimonio Leo Cardenas' }, null, null);
// Ambiguo o sin coincidencia: nunca se adivina.
check({ title: 'Juan Pérez' }, null, null); // "Juan Pérez" también es prefijo de "Juan Pérez Mora"
check({ title: 'Reunión con Beto' }, null, null); // un solo nombre no alcanza
check({ title: 'Elkin Ospina y David Gómez' }, null, null);
check({ invitees: [{ email: 'elkin@x.com' }, { email: 'david@x.com' }] }, null, null);
check({ title: 'No es Elkin Ospinazo' }, null, null);
// Correos internos, de agenda y de Fathom nunca identifican ni se aprenden.
check({ invitees: [{ email: 'alex@joinaceleratalent.com', name: 'Elkin Ospina' }] }, null, null);
assert.equal(emailToLearn([{ email: 'mari.aceleratalent@gmail.com' }, { email: 'nuevo@gmail.com' }], clients), 'nuevo@gmail.com');
assert.equal(emailToLearn([{ email: 'a@z.com' }, { email: 'b@z.com' }], clients), null); // dos nuevos: no se sabe cuál
assert.equal(emailToLearn([{ email: 'elkin@x.com' }], clients), null); // ya pertenece a un cliente

// Exercise the transcript-based matching used by the current importer too.
assert.equal(matchClientBySpeakers(['DAVID Gomez Perez'], clients).client?.id, 'b');
assert.equal(matchClientBySpeakers(['Carlos Alberto Herreño Vargas'], clients).client?.id, 'f');
assert.equal(matchClientBySpeakers(['David'], clients).client, null);
assert.equal(matchClientBySpeakers(['Elkin Ospina', 'David Gomez Perez'], clients).reason, 'ambiguous_speakers');
assert.equal(matchClientBySpeakers(['Juan Pérez', 'Juan Pérez Mora'], clients).reason, 'ambiguous_speakers');
assert.equal(matchClientBySpeakers([], clients).reason, 'no_speaker_match');
const speakers = {
  'Ross a (Joinaceleratalent)': { turns: 5, chars: 100 },
  'David Gomez Perez': { turns: 4, chars: 100 },
  'Fathom Notetaker': { turns: 5, chars: 100 },
  'Guest': { turns: 1, chars: 5 },
};
assert.deepEqual(nonCoachSpeakerNames(speakers), ['David Gomez Perez']);
assert.equal(matchClientBySpeakers(nonCoachSpeakerNames(speakers), clients).client?.id, 'b');
assert.equal(isInternalCall(summarizeSpeakers(speakers)), false);
assert.equal(isInternalCall(summarizeSpeakers({ 'Ross a': { turns: 5, chars: 100 } })), true);

const coaches = [{ id: 'mari', email: 'mari@joinaceleratalent.com', alternate_emails: ['mari.aceleratalent@gmail.com'] }, { id: 'alex', email: 'alex@joinaceleratalent.com' }];
// Mari grabó la llamada de un cliente de Alex: la llamada es de Mari.
assert.deepEqual(resolveCallCoach({ recordedByEmail: 'Mari@joinaceleratalent.com', coaches, assignedCoachId: 'alex', sourceCoachId: 'alex' }), { coachId: 'mari', resolution: 'recorded_by', needsConfirmation: false });
assert.equal(resolveCallCoach({ recordedByEmail: 'mari.aceleratalent@gmail.com', coaches }).coachId, 'mari');
// Sin dato fiable: respaldo y aviso. Una llamada existente conserva su coach.
assert.deepEqual(resolveCallCoach({ recordedByEmail: 'otro@x.com', coaches, assignedCoachId: 'alex' }), { coachId: 'alex', resolution: 'fallback', needsConfirmation: true });
assert.equal(resolveCallCoach({ coaches, keepCoachId: 'mari', assignedCoachId: 'alex' }).coachId, 'mari');
// Caro (no cobra por llamada) graba y habla un solo coach: es de ese coach; si el coach ya la grabó, la copia de Caro no se atribuye.
const team = [...coaches, { id: 'caro', email: 'coach@joinaceleratalent.com', bills_by_call: false }];
assert.deepEqual(resolveCallCoach({ recordedByEmail: 'coach@joinaceleratalent.com', speakerEmails: ['coach@joinaceleratalent.com', 'mari@joinaceleratalent.com'], coaches: team }), { coachId: 'mari', resolution: 'participant', needsConfirmation: false });
assert.equal(resolveCallCoach({ recordedByEmail: 'coach@joinaceleratalent.com', speakerEmails: ['coach@joinaceleratalent.com', 'mari@joinaceleratalent.com'], coaches: team, hasOwnRecording: true }).coachId, 'caro');
assert.equal(resolveCallCoach({ recordedByEmail: 'coach@joinaceleratalent.com', speakerEmails: ['alex@joinaceleratalent.com', 'mari@joinaceleratalent.com'], coaches: team }).coachId, 'caro'); // dos coaches: no se adivina
assert.equal(resolveCallCoach({ recordedByEmail: 'coach@joinaceleratalent.com', speakerEmails: ['coach@joinaceleratalent.com'], coaches: team }).coachId, 'caro');
console.log('PASS: email, alternate email, name and transcript matching; ambiguous matches rejected; internal calls and coach attribution');
