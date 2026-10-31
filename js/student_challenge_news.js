/* Private challenge news is display-only: the server owns economic effects. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_STUDENT_CHALLENGES=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function create({context,read,onChange=()=>{}}){
  let sequence=0,snapshot=null,status='idle',statusKey=null;
  const key=c=>JSON.stringify([c.gameId,String(c.companyId),c.epoch,c.version,c.connected]);
  function visible(){const c=context();return snapshot&&snapshot.key===key(c)&&c.connected&&c.version==='demand-share-v1'?snapshot.rows:[];}
  async function refresh(){
   const c=context(),token=++sequence,k=key(c);snapshot=null;status='idle';statusKey=k;onChange();
   if(!c.connected||!c.gameId||!c.companyId||c.version!=='demand-share-v1')return false;
   status='loading';onChange();
   let result;try{result=await read(c.gameId,c.companyId);}catch{if(token===sequence&&key(context())===k){status='error';onChange();}return false;}
   if(token!==sequence||key(context())!==k)return false;
   if(!result?.success||!Array.isArray(result.data)){snapshot=null;status='error';onChange();return false;}
   const rows=result.data;
   if(rows.some(e=>!e||!['PE01','PE02','PE03','PE04','PE17','PE18','PE23','PE26','PE30','PE38','PE39','PE44','PE68','PE69','PE71','PE74','PE75','PE77'].includes(e.eventId)||!Number.isInteger(e.round)||e.round<1||e.round>6||!['programado','activo','aplicado','no_aplicado'].includes(e.status)||typeof e.title!=='string'||typeof e.description!=='string')){snapshot=null;status='error';onChange();return false;}
   snapshot={key:k,rows:rows.map(e=>({...e}))};status='ready';onChange();return true;
  }
  function clear(){sequence++;snapshot=null;status='idle';statusKey=null;onChange();}
  function state(){return statusKey===key(context())?status:'idle';}
  return Object.freeze({refresh,visible,clear,state});
 }
 return Object.freeze({create});
});
