const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('cierre de partida nueva no omite cobros cuando falta RPC y no hay snapshots',async()=>{
 const source=fs.readFileSync(require.resolve('../js/docente.js'),'utf8'),start=source.indexOf('async function closeExcelRemoteRound('),end=source.indexOf('\nfunction renderWinnerSelect',start);
 for(const version of ['side-lotes-2026-10-20','excel-16']){
  const context={state:{partidaId:'test',authoritative:{motor_version:version},reports:[]},window:{SIDE_EXCEL_CONFIG:{MOTOR_ACTUAL:'side-lotes-2026-10-20'},SIDE:{PartidaService:{cerrarExcel:async()=>({success:false,migrationMissing:true})}}},$:()=>null,toast(){}};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  assert.equal(await context.closeExcelRemoteRound(1),version==='excel-16');
 }
});
