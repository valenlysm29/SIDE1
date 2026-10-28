import runpy,json,subprocess,os
x=runpy.run_path('tests/local_auth_rls_cli_test.py')
req=x['req'];sql=x['sql'];token=x['b']['access_token'];code=x['code'];game=x['game'];status=x['status']
ident={'p_codigo':code,'p_nombre_legal':'TEST-A','p_nombre_comercial':'TEST-A'}
_,cur=req('/rest/v1/rpc/obtener_estado_estudiante',ident,token)
state={}
counts={'MESA_CORTE':{'mesa':1},'ENSAMBLE':{'ens_basica':1},'ACABADOS':{'aca_basica':1},'PERS_CORTE':{'corte_basico':1},'PERS_ENSAMBLE':{'ens_personal_basico':1},'PERS_ACABADO':{'aca_personal_basico':1},'CUERO':{'cuero_sint':70},'ACCESORIOS':{'acc_eco':100},'HILO':{'hilo_std':1300}}
for k,q in counts.items():
 state[k]={'round':1,'quantities':q,'optionIds':list(q)}
 if k in ('MESA_CORTE','ENSAMBLE','ACABADOS'):state[k]['purchases']={'1':q}
state.update({'MOLDE':{'round':1,'optionIds':['molde_3']},'PRODUCCION_META':{'round':1,'moldTargets':{'molde_3':90}},'CANALES':{'round':1,'optionIds':['miraflores','web'],'quantities':{'miraflores':1},'transfers':{'premium':{'miraflores:1':60,'web':30}}}})
snap={'decision_state':{**state,'__cyclePlans':{'1':{'state':state}}},'cash_ledger':{},'financial_sections':{},'decisions_submitted':True}
_,saved=req('/rest/v1/rpc/guardar_estado_estudiante',{**ident,'p_snapshot':snap,'p_expected_revision':cur['snapshot_revision']},token);assert saved.get('success'),saved
cfg={'lifecycleVersion':1,'cycles':1,'cycleCloseMode':'manual','runtime':{'round':1,'phase':'results'}}
sql("update public.partidas set configuracion='"+json.dumps(cfg)+"'::jsonb where id='"+game+"'")
env={**os.environ,'SIDE_TEST_URL':status['API_URL'],'SIDE_TEST_KEY':status['SERVICE_ROLE_KEY'],'SIDE_TEST_GAME':game}
js="""const {remoteRpc}=require('./services/business_runtime.cjs');const rpc=remoteRpc(process.env.SIDE_TEST_URL,process.env.SIDE_TEST_KEY);const w={SIDE:{SupabaseClient:{get:()=>({rpc})}},SIDE_CYCLE_MODEL:require('./js/cycle_model'),SIDE_FINANCIAL_MODEL:require('./js/financial_model'),SIDE_FINANCE_CONFIG:require('./services/finance_config'),SIDE_DECISION_CATALOG:require('./js/decision_catalog')};require('./services/partida_service')(w);w.SIDE.PartidaService.cerrarNegocio(process.env.SIDE_TEST_GAME,1).then(r=>{if(!r.success){console.log(JSON.stringify(r));process.exitCode=1}else console.log('CLOSE_OK')})"""
run=subprocess.run(['node','-e',js],env=env,text=True,capture_output=True);print('worker',run.returncode,run.stdout.strip());assert run.returncode==0
_,after=req('/rest/v1/rpc/obtener_estado_estudiante',ident,token); receipt=after.get('snapshot',{}).get('decision_state',{}).get('__cycleSettlements',{}).get('1',{}); assert receipt.get('sold')==90 and receipt.get('revenue')==22500,receipt; points=next(s for s in receipt['sales'] if s['id']=='premium')['points']; assert sum(p['sold'] for p in points)==90 and sum(p['revenue'] for p in points)==22500,points; print('PASS Student Auth decision -> worker -> recovered receipt:',[(p['id'],p['sold'],p['revenue']) for p in points])
