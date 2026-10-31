'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const semantics=require('../js/event_semantics_v2.js');
test('la clasificación cubre cada ID del catálogo y distingue los eventos implementados',()=>{
 const box={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../js/events_catalog.js'),'utf8'),box);
 const events=box.window.SIDE_EVENT_CATALOG;
 assert.equal(events.length,92);assert.equal(new Set(events.map(e=>e.id)).size,92);
 assert.deepEqual(Object.keys(semantics).sort(),Array.from(events,e=>e.id).sort());
 assert.deepEqual(Object.entries(semantics).filter(([,v])=>v.implemented).map(([id])=>id).sort(),['PE01','PE02','PE03','PE04','PE23','PE30','PE68','PE69','PE71','PE74','PE75','PE77']);
 for(const [id,primary] of Object.entries({PE30:'capacidad_produccion',PE43:'recepcion_materiales',PE48:'adquisicion_materiales',PE69:'atractivo_competitivo',PE80:'demanda_potencial',PE83:'inventario_calidad'}))assert.equal(semantics[id].primary,primary);
});
