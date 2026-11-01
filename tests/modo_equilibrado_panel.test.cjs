'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/docente.js','utf8');
test('el panel muestra la acción del modo guardado y restaura la selección al cambiar de partida',()=>{
 const elements=Object.fromEntries(['challengeV1Panel','challengeV1Company','challengeV1Round','challengeV1Mode','challengeV1Assign','challengeV1Draw','challengeV1Balanced'].map(id=>[id,{dataset:{},value:'',hidden:false,disabled:false,replaceChildren(){},appendChild(){}}]));
 elements.challengeV1Mode.value='manual';const state={partidaId:'uno',authoritative:{economicEventsVersion:'demand-share-v1',cycles:6,challengeModeV1:'random'},reports:[1,2,3].map(i=>({fuente:'supabase',empresaId:i,empresa:'Empresa '+i}))};
 const ctx={state,$:id=>elements[id],document:{createElement:()=>({})},updateChallengeV1Preview(){}};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function renderTeacherChallengeControls(){'),source.indexOf('\nfunction updateChallengeV1Preview(){')),ctx);
 ctx.renderTeacherChallengeControls();assert.equal(elements.challengeV1Draw.hidden,false);assert.equal(elements.challengeV1Assign.hidden,true);assert.equal(elements.challengeV1Balanced.hidden,true);
 elements.challengeV1Mode.value='balanced';ctx.renderTeacherChallengeControls();assert.equal(elements.challengeV1Balanced.hidden,false);assert.equal(elements.challengeV1Balanced.disabled,false);
 state.partidaId='dos';state.authoritative.challengeModeV1='manual';ctx.renderTeacherChallengeControls();assert.equal(elements.challengeV1Mode.value,'manual');assert.equal(elements.challengeV1Assign.hidden,false);
});
