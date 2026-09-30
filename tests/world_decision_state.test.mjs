import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveWorldDecisionState, WORLD_ZONES} from '../services/world_decision_state.mjs';

test('all five decision categories have a destination on the agreed city map', () => {
  assert.deepEqual(new Set(WORLD_ZONES.map(z=>z.category).filter(Boolean)),new Set(['B','C','D','E','F']));
  assert.deepEqual(WORLD_ZONES.find(z=>z.id==='bank'),{id:'bank',label:'Banco',category:'E',x:76,z:19});
  assert.equal(WORLD_ZONES.find(z=>z.id==='news').label,'Buzón de noticias');
});

test('missions follow the current cycle and stock urgency without modifying decisions', () => {
  const decisions={PRODUCCION_META:{round:2,value:10},CUERO:{round:1,quantities:{cuero_std:12}},CANALES:{round:2,optionIds:['web']}};
  const before=JSON.stringify(decisions);
  const base={round:2,decisions,visual:{plannedUnits:10,displayStock:4,reserveStock:0}};
  assert.deepEqual(deriveWorldDecisionState(base).objective,{id:'inventory',zoneId:'warehouse',title:'Revisa tu inventario'});
  assert.equal(deriveWorldDecisionState({...base,decisions:{...decisions,CUERO:{round:2,quantities:{cuero_std:12}}}}).objective.id,'finance');
  assert.equal(deriveWorldDecisionState({...base,cycleClosed:true}).objective.id,'cycle-summary');
  assert.equal(deriveWorldDecisionState({...base,visual:{...base.visual,displayStock:0,reserveStock:5}}).objective.id,'restock');
  assert.equal(JSON.stringify(decisions),before);
});

test('visible stock, delivery, machinery and clients use only authoritative inputs', () => {
  const state=deriveWorldDecisionState({round:1,decisions:{CANALES:{round:1,optionIds:['web','miraflores']},INV_MARKETING:{round:1,optionIds:['mkt_alta']}},
    visual:{displayStock:6,reserveStock:20,storeFill:.4,warehouseFill:1.8,pendingUnits:12,productionActive:true,machines:{assembly:3},workers:{cutting:2},cash:8000},
    events:[{id:'PE02',title:'Día de la Madre',category:'Comerciales y festividades',effect:{revenuePct:15}}]});
  assert.equal(state.cues.storeFill,.4);
  assert.equal(state.cues.warehouseFill,1);
  assert.equal(state.cues.deliveryVisible,true);
  assert.equal(state.cues.machines.assembly,3);
  assert.equal(state.cues.workers.cutting,2);
  assert.equal(state.cues.physicalStore,true);
  assert.ok(state.cues.clientLevel>1);
  assert.equal(state.events[0].kind,'festival');
});

test('festival events are unique and changing visuals never generate cash or inventory', () => {
  const event={id:'PE04',title:'Campaña navideña',category:'Comerciales y festividades',effect:{revenuePct:30}};
  const input={round:3,visual:{cash:9000,displayStock:4,reserveStock:7,producedUnits:5},events:[event,event],previous:{round:2,cash:10000,displayStock:2,reserveStock:9,producedUnits:4}};
  const original=JSON.stringify(input),state=deriveWorldDecisionState(input);
  assert.equal(state.events.length,1);
  assert.deepEqual(state.consequences.map(c=>c.delta),[-1000,2,-2,1]);
  assert.equal(state.consequences[0].zoneId,'office');
  assert.equal(JSON.stringify(input),original);
  assert.equal(deriveWorldDecisionState({...input,previous:{...input.previous,round:1}}).consequences.length,0);
});

test('unknown production and financial values stay unknown', () => {
  const state=deriveWorldDecisionState({round:1,visual:{displayStock:0,reserveStock:0},previous:{round:0,cash:10,producedUnits:100}});
  assert.equal(state.cues.cash,null);
  assert.equal(state.cues.producedUnits,null);
  assert.equal(state.consequences.length,0);
});
