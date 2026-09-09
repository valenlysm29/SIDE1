/* SIDE: shared, dependency-free rules for calendars and physical stores. */
(function (root, factory) {
  const rules = factory();
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else root.SIDE_RULES = rules;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STORE_IDS = Object.freeze(['los_olivos', 'miraflores', 'sjl']);
  const COMMITMENT_CYCLES = 12;
  function positiveInteger(value, fallback = 1) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= 1 ? n : fallback;
  }
  function localDate(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function cycleSchedule(config) {
    const count = Number(config.cycles), hours = Number(config.roundHours), minutes = Number(config.roundMinutes);
    if (!Number.isInteger(count) || count < 1 || count > 20) return {error: 'El n\u00famero de ciclos debe ser un entero entre 1 y 20.', cycles: []};
    if (!Number.isSafeInteger(hours) || hours < 0 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59 || hours*60+minutes < 1) {
      return {error: 'Indica una duraci\u00f3n de al menos 1 minuto; los minutos deben estar entre 0 y 59.', cycles: []};
    }
    const start = config.scheduledStart ? new Date(config.scheduledStart).getTime() : NaN;
    if (!Number.isFinite(start)) return {error: 'Selecciona la fecha y hora de inicio para ver el calendario por ciclos.', cycles: []};
    const duration = (hours*3600+minutes*60)*1000, end = start+count*duration;
    if (!Number.isFinite(new Date(end).getTime())) return {error: 'La duraci\u00f3n indicada supera el rango del calendario.', cycles: []};
    return {start, end, duration, total: count*duration, cycles: Array.from({length:count}, (_,i)=>({round:i+1,start:start+i*duration,end:start+(i+1)*duration}))};
  }
  function schedulePosition(schedule, now = Date.now()) {
    if (!schedule || schedule.error || !schedule.cycles.length) return null;
    if (now < schedule.start) return {status:'scheduled',round:1,remaining:schedule.duration/1000,startedAt:schedule.start};
    if (now >= schedule.end) return {status:'simulation-finished',round:schedule.cycles.length,remaining:0,startedAt:schedule.cycles.at(-1).start};
    const index = Math.floor((now-schedule.start)/schedule.duration), cycle=schedule.cycles[index];
    return {status:'running',round:index+1,remaining:Math.max(0,Math.ceil((cycle.end-now)/1000)),startedAt:cycle.start};
  }
  /* Old decisions only contain optionIds: a selected district means one store. */
  function storeQuantity(entry, id) {
    if (!STORE_IDS.includes(id) || !(entry?.optionIds || []).includes(id)) return 0;
    return positiveInteger(entry?.quantities?.[id], 1);
  }
  function storeCount(entry) { return STORE_IDS.reduce((sum,id)=>sum+storeQuantity(entry,id),0); }
  function storeBatches(entry, id, round = 1) {
    const quantity = storeQuantity(entry,id);
    if (!quantity) return [];
    const batches = entry?.storeContracts?.[id];
    if (Array.isArray(batches) && batches.length) {
      const valid = batches.filter(b=>Number.isInteger(b.round)&&b.round>=1&&Number.isSafeInteger(b.quantity)&&b.quantity>0);
      if (valid.reduce((s,b)=>s+b.quantity,0) === quantity) return valid.map(b=>({...b}));
    }
    return [{round:positiveInteger(entry?.optionRounds?.[id]??entry?.round,round),quantity}];
  }
  function committedQuantity(entry, id, round, term = COMMITMENT_CYCLES) {
    return storeBatches(entry,id,round).reduce((sum,b)=>sum+(b.round<round && round-b.round<term ? b.quantity : 0),0);
  }
  function remainingCommitment(entry, id, round, term = COMMITMENT_CYCLES) {
    return Math.max(0,...storeBatches(entry,id,round).filter(b=>b.round<round).map(b=>term-(round-b.round)));
  }
  /* Drafts saved again in the same cycle replace that cycle's openings. */
  function nextStoreBatches(previous, id, quantity, round, term = COMMITMENT_CYCLES) {
    const wanted = quantity === 0 ? 0 : positiveInteger(quantity,0);
    const floor = committedQuantity(previous,id,round,term);
    if (wanted < floor) throw new RangeError('No se pueden cerrar tiendas con contrato vigente.');
    let batches = storeBatches(previous,id,round).filter(b=>b.round<round);
    let remove = Math.max(0,batches.reduce((s,b)=>s+b.quantity,0)-wanted);
    batches = batches.map(b=>{
      if (round-b.round<term || !remove) return b;
      const cut=Math.min(remove,b.quantity);remove-=cut;
      return {...b,quantity:b.quantity-cut};
    }).filter(b=>b.quantity>0);
    const add=wanted-batches.reduce((s,b)=>s+b.quantity,0);
    if (add>0) batches.push({round,quantity:add});
    return batches;
  }
  return Object.freeze({STORE_IDS,COMMITMENT_CYCLES,positiveInteger,localDate,cycleSchedule,schedulePosition,storeQuantity,storeCount,storeBatches,committedQuantity,remainingCommitment,nextStoreBatches});
});
