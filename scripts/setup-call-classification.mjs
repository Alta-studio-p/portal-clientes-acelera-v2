import {readFile} from 'node:fs/promises';
import {createSqlClient} from '../lib/postgres.mjs';
if(!process.argv.includes('--apply'))throw Error('Usa --apply para agregar la clasificación privada y las categorías.');
const sql=createSqlClient();
try{await sql.transaction(async tx=>{await tx.query(await readFile(new URL('../supabase-call-classification.sql',import.meta.url),'utf8'));});}
finally{await sql.end();}
console.log('Clasificación preparada. Ninguna llamada fue descartada ni publicada.');
