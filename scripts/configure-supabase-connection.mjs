import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { readFile, writeFile, chmod, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

if (!process.stdin.isTTY) {
  console.error('Ejecuta este asistente en tu Terminal; no acepta contrasenas en argumentos.');
  process.exit(1);
}

const envPath = fileURLToPath(new URL('../.env.local', import.meta.url));
const stat = await lstat(envPath);
if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('El archivo local de configuracion no es un archivo regular.');

// Password input is local, hidden, and never passed through shell arguments.
const silent = new Writable({ write(_chunk, _encoding, done) { done(); } });
const prompt = createInterface({ input: process.stdin, output: silent, terminal: true, historySize: 0 });
let password;
try {
  process.stdout.write('Contrasena de la base de datos Supabase (no se mostrara): ');
  password = await prompt.question('');
} finally {
  prompt.close();
  process.stdout.write('\n');
}
if (!password || /[\r\n\0]/.test(password)) throw new Error('No se guardo una contrasena vacia o no valida.');

const connection = new URL('postgresql://postgres.lbxwephfuitsvlbetvlb@aws-0-us-west-2.pooler.supabase.com:6543/postgres');
connection.password = password;
const value = `SUPABASE_DATABASE_URL=${connection.toString()}`;
const current = await readFile(envPath, 'utf8');
const pattern = /^SUPABASE_DATABASE_URL=.*$/m;
const updated = pattern.test(current) ? current.replace(pattern, () => value) : `${current.trimEnd()}\n${value}\n`;
await writeFile(envPath, updated, { mode: 0o600 });
await chmod(envPath, 0o600);
console.log('Conexion guardada de forma privada. La web no ha cambiado de base de datos todavia.');
