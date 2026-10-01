'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
function runtime(){
  const elements=new Map(),listeners=[],storage={decisions:{CANALES:{optionIds:['miraflores']}},cycle:1};
  function element(hidden=false){const classes=new Set(hidden?['hidden']:[]);return {textContent:'',open:false,title:'',attributes:{},handlers:{},classList:{contains:c=>classes.has(c),add:c=>classes.add(c),remove:c=>classes.delete(c),toggle(c,on){on?classes.add(c):classes.delete(c)}},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,v){this.handlers[k]=v}};}
  for(const id of ['decisionMenu','exitDecisions','decisionReturnLabel','companyReviewDialog','modalRoot'])elements.set(id,element(id==='modalRoot'));
  let blurs=0,returns=0,reports=0,modalCloses=0;
  const context=vm.createContext({window:{__SIDE_RETURN_TO_3D:true,SIDE3D:{returnFromDecisions(){returns++;elements.get('decisionMenu').classList.add('hidden')}}},document:{activeElement:{blur(){blurs++}},addEventListener(type,fn){listeners.push(fn)}},$:id=>elements.get(id),playerIsDeciding:true,syncStudentReportPreview(){reports++},closeCompanyReview(){elements.get('companyReviewDialog').open=false},closeModal(){modalCloses++;elements.get('modalRoot').classList.add('hidden')},showScreen(id){elements.get('decisionMenu').classList.toggle('hidden',id!=='decisionMenu')},storage});
  vm.runInContext(source.slice(source.indexOf('function updateDecisionReturnButton(){'),source.indexOf("$('restartDecisionMenu')?")),context);
  const escapeHandler=source.match(/document\.addEventListener\('keydown',e=>\{[\s\S]*?\n\}\);/)[0];vm.runInContext(escapeHandler,context);
  return {context,elements,listeners,stats:()=>({blurs,returns,reports,modalCloses}),run:code=>vm.runInContext(code,context),escape(){const e={key:'Escape',preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}};listeners[0](e);return e;}};
}
test('twenty tablet exits blur the editor and return once without modifying decisions or the cycle',()=>{
  const r=runtime(),before=JSON.stringify(r.context.storage);
  for(let i=0;i<20;i++){
    r.elements.get('decisionMenu').classList.remove('hidden');r.context.window.__SIDE_RETURN_TO_3D=true;r.context.playerIsDeciding=true;
    if(i%2)assert.equal(r.escape().stopped,true);else r.elements.get('exitDecisions').handlers.click();
    assert.equal(r.context.playerIsDeciding,false);assert.equal(r.context.window.__SIDE_RETURN_TO_3D,false);
    assert.equal(r.run('closeDecisionMenu()'),false,'a repeated exit does not return twice');
  }
  assert.deepEqual(r.stats(),{blurs:20,returns:20,reports:20,modalCloses:0});assert.equal(JSON.stringify(r.context.storage),before);assert.equal(r.listeners.length,1);
});
test('Escape respects review and login dialogs and ignores a hidden tablet',()=>{
  const r=runtime();r.elements.get('companyReviewDialog').open=true;assert.equal(r.escape().stopped,undefined);assert.equal(r.stats().returns,0);
  r.elements.get('companyReviewDialog').open=false;r.elements.get('modalRoot').classList.remove('hidden');r.escape();assert.equal(r.stats().modalCloses,1);assert.equal(r.stats().returns,0);
  r.elements.get('decisionMenu').classList.add('hidden');r.escape();assert.equal(r.stats().returns,0);
});
test('return label distinguishes the world from the lobby and lobby exit keeps its destination',()=>{
  const r=runtime();r.run('updateDecisionReturnButton()');assert.equal(r.elements.get('decisionReturnLabel').textContent,'Volver al mundo');assert.equal(r.elements.get('exitDecisions').attributes['aria-label'],'Volver al mundo');
  r.context.window.__SIDE_RETURN_TO_3D=false;r.run('updateDecisionReturnButton()');assert.equal(r.elements.get('decisionReturnLabel').textContent,'Volver a la sala');r.escape();assert.equal(r.stats().returns,0);assert.equal(r.elements.get('decisionMenu').classList.contains('hidden'),true);
});
