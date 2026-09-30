/* Durable outbox for student snapshots and their normalized decisions/reports. */
(function(global){
  'use strict';
  const copy=value=>JSON.parse(JSON.stringify(value));
  const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])):value;
  function snapshotSignature(value){
    const defaults={decision_state:{},cash_ledger:{},financial_sections:{},section_submissions:{},decisions_submitted:false,selected_character:null};
    return JSON.stringify(ordered(Object.fromEntries(Object.entries(defaults).map(([key,fallback])=>[key,value?.[key]??fallback]))));
  }
  function createQueue(options){
    const {storage,context,saveSnapshot,saveOperation,readSnapshot,onRevision=()=>{},onConflict=()=>{},onRejected=()=>{},onStatus=()=>{}}=options;
    const storageKey='SIDE_STUDENT_SYNC_OUTBOX';
    let jobs=[];
    try{const stored=JSON.parse(storage.getItem(storageKey)||'[]');if(Array.isArray(stored))jobs=stored.filter(j=>j?.identityKey&&j.snapshot&&Array.isArray(j.operations));}catch{}
    let task=null,activeJob=null;
    function persist(){
      try{storage.setItem(storageKey,JSON.stringify(jobs));return true;}
      catch(error){onStatus('storage-error',error);return false;}
    }
    const pending=(key=context().identityKey)=>jobs.some(j=>j.identityKey===key);
    function discard(key,backup=false){
      if(backup){
        try{storage.setItem('SIDE_STUDENT_SYNC_CONFLICT_'+key,JSON.stringify(jobs.filter(j=>j.identityKey===key)));}catch(error){onStatus('storage-error',error);}
      }
      jobs=jobs.filter(j=>j.identityKey!==key);persist();
    }
    function enqueue(snapshot,operation){
      const c=context();if(!c.connected||!c.identityKey)return Promise.resolve(false);
      const round=Math.max(1,Number(snapshot.round)||1);
      let job=jobs.find(j=>j!==activeJob&&j.identityKey===c.identityKey&&j.round===round);
      if(!job){job={identityKey:c.identityKey,identity:copy(c.identity),round,expectedRevision:c.revision,snapshot:copy(snapshot),operations:[],snapshotSaved:false};jobs.push(job);}
      job.snapshot=copy(snapshot);job.snapshotSaved=false;
      if(operation){job.operations=job.operations.filter(op=>op.key!==operation.key);job.operations.push(copy(operation));}
      persist();onStatus('saving');return flush();
    }
    function mergeNewer(job){
      const newer=jobs.find(j=>j!==job&&j.identityKey===job.identityKey&&j.round===job.round);
      if(!newer)return;
      newer.expectedRevision=job.expectedRevision;
      const currentKeys=new Set(newer.operations.map(op=>op.key));
      newer.operations=[...job.operations.filter(op=>!currentKeys.has(op.key)),...newer.operations];
      jobs=jobs.filter(j=>j!==job);persist();
    }
    function flush(){
      if(task)return task;
      const c=context();
      if(!c.connected||!pending(c.identityKey))return Promise.resolve(!pending(c.identityKey));
      const active=()=>{const next=context();return next.connected&&next.identityKey===c.identityKey&&next.epoch===c.epoch;};
      task=Promise.resolve().then(async()=>{
        while(active()){
          const job=jobs.find(j=>j.identityKey===c.identityKey);if(!job)return true;
          activeJob=job;onStatus('saving');
          let result;
          try{
            if(!job.snapshotSaved){
              result=await saveSnapshot(copy(job.identity),copy(job.snapshot),job.expectedRevision);
              if(!active())return false;
              if(!result?.success)throw result||{error:'Respuesta de guardado vacía.'};
              const revision=Number(result.data?.snapshot_revision??result.data?.snapshotRevision??result.data?.revision);
              if(!Number.isSafeInteger(revision)||revision<=job.expectedRevision)throw {error:'Revisión de guardado inválida.'};
              job.expectedRevision=revision;job.snapshotSaved=true;
              for(const next of jobs)if(next.identityKey===job.identityKey)next.expectedRevision=revision;
              persist();onRevision(revision);
            }
            while(job.operations.length){
              result=await saveOperation(copy(job.identity),job.round,copy(job.operations[0]),job.expectedRevision);
              if(!active())return false;
              if(!result?.success)throw result||{error:'Respuesta de operación vacía.'};
              job.operations.shift();persist();
            }
            jobs=jobs.filter(j=>j!==job);persist();activeJob=null;
          }catch(error){
            if(!active())return false;
            if(error?.code==='ESTADO_DESACTUALIZADO'){
              // A server commit can succeed while its response is lost. A read
              // may acknowledge that exact snapshot; never adopt unrelated edits.
              if(!job.snapshotSaved&&readSnapshot){
                let remote;
                try{remote=await readSnapshot(copy(job.identity));}catch(readError){remote={success:false,error:readError};}
                if(!active())return false;
                if(!remote?.success){mergeNewer(job);onStatus('pending',remote);return false;}
                const revision=Number(remote.data?.snapshot_revision);
                if(revision===job.expectedRevision+1&&remote.data?.snapshot&&snapshotSignature(remote.data.snapshot)===snapshotSignature(job.snapshot)){
                  job.snapshotSaved=true;job.expectedRevision=revision;
                  for(const next of jobs)if(next.identityKey===job.identityKey)next.expectedRevision=revision;
                  persist();onRevision(revision);continue;
                }
              }
              discard(c.identityKey,true);onStatus('conflict',error);await onConflict();
            }else if(error?.code==='CREDENCIALES_INVALIDAS'&&!error.technical){
              discard(c.identityKey,true);onStatus('rejected',error);onRejected();
            }else{mergeNewer(job);onStatus('pending',error);}
            return false;
          }
        }
        return false;
      }).then(result=>{if(result&&active())onStatus('synced');return result;}).finally(()=>{activeJob=null;task=null;});
      return task;
    }
    return {enqueue,flush,pending,discard};
  }
  const api={createQueue};
  global.SIDE=global.SIDE||{};global.SIDE.StudentSync=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
