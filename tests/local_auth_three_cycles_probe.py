import runpy,json,subprocess,os
x=runpy.run_path('tests/local_auth_rls_cli_test.py');req=x['req'];sql=x['sql'];game=x['game'];code=x['code'];status=x['status'];a=x['a'];b=x['b'];t=x['t'];aid=x['ra']['empresa_id']
# Return ownership of company A to session A; session B keeps company B.
r=req('/rest/v1/rpc/side_liberar_empresa',{'p_partida_id':game,'p_empresa_id':aid},t['access_token'])[1];assert r.get('success'),r
r=x['join'](a,'TEST-A')[1];assert r.get('success'),r
cfg={'lifecycleVersion':1,'cycles':3,'cycleCloseMode':'manual','runtime':{'round':1,'phase':'decisions'}}
def setcycle(c,phase):
 cfg['runtime']={'round':c,'phase':phase};sql("update public.partidas set configuracion='"+json.dumps(cfg)+"'::jsonb where id='"+game+"'")
def plan(c):
 state={};counts={'MESA_CORTE':{'mesa':1},'ENSAMBLE':{'ens_basica':1},'ACABADOS':{'aca_basica':1},'PERS_CORTE':{'corte_basico':1},'PERS_ENSAMBLE':{'ens_personal_basico':1},'PERS_ACABADO':{'aca_personal_basico':1},'CUERO':{'cuero_sint':70},'ACCESORIOS':{'acc_eco':100},'HILO':{'hilo_std':1300}}
 for k,q in counts.items():
  state[k]={'round':c,'quantities':q,'optionIds':list(q)}
  if k in ('MESA_CORTE','ENSAMBLE','ACABADOS'):state[k].update(round=1,purchases={'1':q})
 state.update({'MOLDE':{'round':1,'optionIds':['molde_3']},'PRODUCCION_META':{'round':c,'moldTargets':{'molde_3':90}},'CANALES':{'round':c,'optionIds':['miraflores','web'],'quantities':{'miraflores':1},'transfers':{'premium':{'miraflores:1':60,'web':30}}}});return state
js="""const {remoteRpc}=require('./services/business_runtime.cjs');const rpc=remoteRpc(process.env.SIDE_TEST_URL,process.env.SIDE_TEST_KEY);const w={SIDE:{SupabaseClient:{get:()=>({rpc})}},SIDE_CYCLE_MODEL:require('./js/cycle_model'),SIDE_FINANCIAL_MODEL:require('./js/financial_model'),SIDE_FINANCE_CONFIG:require('./services/finance_config'),SIDE_DECISION_CATALOG:require('./js/decision_catalog')};require('./services/partida_service')(w);w.SIDE.PartidaService.cerrarNegocio(process.env.SIDE_TEST_GAME,Number(process.env.SIDE_TEST_ROUND)).then(r=>{if(!r.success){console.log(JSON.stringify(r));process.exitCode=1}else console.log(JSON.stringify({success:r.success,reused:!!r.reused}))})"""
env={**os.environ,'SIDE_TEST_URL':status['API_URL'],'SIDE_TEST_KEY':status['SERVICE_ROLE_KEY'],'SIDE_TEST_GAME':game}
for cycle in (1,2,3):
 setcycle(cycle,'decisions')
 for session,name in ((a,'TEST-A'),(b,'TEST-B')):
  ident={'p_codigo':code,'p_nombre_legal':name,'p_nombre_comercial':name};current=req('/rest/v1/rpc/obtener_estado_estudiante',ident,session['access_token'])[1];snap=current.get('snapshot') or {};ds=snap.get('decision_state') or {};p=plan(cycle);ds.update(p);ds.setdefault('__cyclePlans',{})[str(cycle)]={'state':p};snap.update(decision_state=ds,decisions_submitted=True)
  saved=req('/rest/v1/rpc/guardar_estado_estudiante',{**ident,'p_snapshot':snap,'p_expected_revision':current['snapshot_revision']},session['access_token'])[1];assert saved.get('success'),saved
 setcycle(cycle,'results');env['SIDE_TEST_ROUND']=str(cycle)
 for attempt in (1,2):
  run=subprocess.run(['node','-e',js],env=env,text=True,capture_output=True);assert run.returncode==0,(cycle,run.stdout,run.stderr);result=json.loads(run.stdout.strip().splitlines()[-1]);assert result['reused']==(attempt==2),result
 for session,name in ((a,'TEST-A'),(b,'TEST-B')):
  ident={'p_codigo':code,'p_nombre_legal':name,'p_nombre_comercial':name};state=req('/rest/v1/rpc/obtener_estado_estudiante',ident,session['access_token'])[1]['snapshot']['decision_state'];receipt=state['__cycleSettlements'][str(cycle)];assert receipt['sold']>0 and receipt['revenue']>0,(cycle,name,receipt);assert sum(x['sold']*x['price'] for x in receipt['sales'])==receipt['revenue'];assert sum(point['sold'] for line in receipt['sales'] for point in line['points'])==receipt['sold'];financial=state['__financialSnapshots'][str(cycle)]['estadoResultados'];assert (financial['impuestoRenta']==0 if cycle<3 else financial['impuestoRenta']>0),(cycle,financial);print('cycle',cycle,name,'sold',receipt['sold'],'revenue',receipt['revenue'],'goods',receipt['goods'])
print('PASS three cycles two Auth users via Data API and worker, repeat closure; isolated local experimental schema')
