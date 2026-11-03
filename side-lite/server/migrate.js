import pg from 'pg';
import {readFile} from 'node:fs/promises';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL es obligatoria y debe apuntar a una base SIDE Lite independiente');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try { await pool.query(await readFile(new URL('../supabase/migrations/202611030001_lite_local.sql',import.meta.url),'utf8')); console.log('Migración SIDE Lite aplicada.'); } finally { await pool.end(); }
