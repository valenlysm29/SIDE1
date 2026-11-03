import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {assertLocalDatabase} from './database-url.js';
const pool=new pg.Pool({connectionString:assertLocalDatabase(process.env.DATABASE_URL)});
try { await pool.query(await readFile(new URL('../supabase/migrations/202611030001_lite_local.sql',import.meta.url),'utf8')); console.log('Migración SIDE Lite aplicada.'); } finally { await pool.end(); }
