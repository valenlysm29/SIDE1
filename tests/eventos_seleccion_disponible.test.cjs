const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const catalog=require('../js/events_catalog.js');
const source=fs.readFileSync(require.resolve('../js/docente.js'),'utf8');
function allowed(state,event){const fn=source.slice(source.indexOf('function canSelectEvent('),source.indexOf('function renderEnabledEvents('));return vm.runInNewContext(fn+';canSelectEvent(event)',{state,event});}
test('nuevas selecciones coinciden con los eventos restringidos por el servidor',()=>{
 const sql=fs.readFileSync(require.resolve('../supabase/migrations/20261102025853_bloquear_eventos_costos_no_verificados.sql'),'utf8');
 const ids=sql.match(/forbidden text\[\]:=array\[([^\]]+)\]/)[1].match(/PE\d+/g);
 assert.deepEqual(catalog.filter(e=>!allowed({},e)).map(e=>e.id),ids);
});
test('conserva eventos históricos y respeta partidas con versión de eventos',()=>{
 const event=catalog.find(e=>e.id==='PE15');
 assert.equal(allowed({partidaId:'old',authoritative:{enabledEvents:['PE15'],sequentialCloseVersion:'1'}},event),true);
 assert.equal(allowed({partidaId:'old',authoritative:{enabledEvents:[],sequentialCloseVersion:'1'}},event),false);
 assert.equal(allowed({partidaId:'old',authoritative:{enabledEvents:[]}},event),true);
 assert.equal(allowed({partidaId:'versioned',authoritative:{economicEventsVersion:'demand-share-v1'}},event),true);
});
