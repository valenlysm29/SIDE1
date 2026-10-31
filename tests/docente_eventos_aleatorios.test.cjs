'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/docente.js'),'utf8');
test('la selección aleatoria parte de los eventos visibles incluso si no hay ninguno habilitado',()=>{
 const start=source.indexOf('function randomizeEventSelection(){');
 const fn=source.slice(start,source.indexOf('\nfunction renderEventBank()',start));
 const candidates=Array.from({length:20},(_,i)=>({id:'E'+i})),notices=[],state={enabledEvents:new Set(),eventSelectionMode:'manual'};
 const elements={eventRandomCount:{value:'15'}};let saved=0,rendered=0;
 const ctx={state,filteredEvents:()=>candidates,$:id=>elements[id],document:{querySelector:()=>null},saveConfig:()=>saved++,updateEventModeUI:()=>rendered++,toast:message=>notices.push(message),Math};
 vm.createContext(ctx);vm.runInContext(fn,ctx);ctx.randomizeEventSelection();
 assert.equal(state.enabledEvents.size,15);assert.equal(state.eventSelectionMode,'random');assert.equal(saved,1);assert.equal(rendered,1);
 assert.ok([...state.enabledEvents].every(id=>candidates.some(e=>e.id===id)));
});

test('la selección respeta exclusiones explícitas y la desactivación total',()=>{
 const start=source.indexOf('function randomizeEventSelection(){'),fn=source.slice(start,source.indexOf('\nfunction renderEventBank()',start));
 const candidates=Array.from({length:5},(_,i)=>({id:'E'+i})),state={enabledEvents:new Set(['E1','E2']),eventSelectionMode:'manual'};
 const ctx={state,filteredEvents:()=>candidates,$:()=>({value:'4'}),document:{querySelector:()=>null},saveConfig:()=>{},updateEventModeUI:()=>{},toast:()=>{},Math};
 vm.createContext(ctx);vm.runInContext(fn,ctx);ctx.randomizeEventSelection();assert.deepEqual([...state.enabledEvents].sort(),['E1','E2']);
 state.enabledEvents.clear();state.eventsExplicitlyCleared=true;ctx.randomizeEventSelection();assert.equal(state.enabledEvents.size,0);
});
