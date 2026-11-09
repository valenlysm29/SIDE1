import pg from 'pg';
import {attachDatabasePool} from '@neon/functions';
import {parseTriggerDelivery} from '@neon/functions/triggers';
import {closeDue} from './close-cycle.js';
const url=new URL(process.env.LITE_DATABASE_URL);
if(url.protocol!=='postgresql:'||url.hostname!==process.env.LITE_DATABASE_HOST||!url.hostname.endsWith('.neon.tech'))throw Error('Base Neon no autorizada');
url.searchParams.set('sslmode','verify-full');
const pool=new pg.Pool({connectionString:url.toString(),max:2});
pool.on('error',()=>console.error('Conexión interrumpida'));
attachDatabasePool(pool);
export default {async fetch(request){
 if(request.method!=='POST')return new Response('No autorizado',{status:401});
 const result=await parseTriggerDelivery(request);
 if(!result.ok||result.invocation.type!=='schedule'||result.invocation.trigger.name!=='side-lite-close-dev')return new Response('No autorizado',{status:401});
 try{const closed=await closeDue(pool);return Response.json({closed})}catch{console.error('Error de cierre');return new Response('Error de cierre',{status:500})}
}};
