"""Explicit connected QA: two NEW games, 12 independent companies each, real RPCs only."""
import os,sys,json,uuid,time,subprocess,concurrent.futures
from pathlib import Path
from rentabilidad_oficial_setup import ROOT,PROJECT,req,rpc
OUT=ROOT/'tests/output/progresiva';OUT.mkdir(parents=True,exist_ok=True)
NAMES={'molde_1':'B','molde_2':'E','molde_3':'P','combinado':'MIX'}
def manifest(cycles):return OUT/('partida-'+str(cycles)+'.json')
def load(cycles):return json.loads(manifest(cycles).read_text())
def save(m):manifest(m['cycles']).write_text(json.dumps(m,indent=2))
def session(cycles,strategy=None):
 path=OUT/(str(cycles)+'-'+(strategy or 'docente')+'-session.local.json')
 current=json.loads(path.read_text())
 if current.get('expires_at',0)<time.time()+120:
  current=req('/auth/v1/token?grant_type=refresh_token',{'refresh_token':current['refresh_token']})
  path.write_text(json.dumps(current))
 return current
def teacher_token(cycles):return session(cycles)['access_token']
def create(cycles):
 credentials=next(x for x in json.loads((OUT/'docentes.local.json').read_text()) if x['cycles']==cycles)
 t=req('/auth/v1/token?grant_type=password',{'email':credentials['email'],'password':credentials['password']})
 (OUT/(str(cycles)+'-docente-session.local.json')).write_text(json.dumps(t))
 m=load(cycles) if manifest(cycles).exists() else None
 if not m:
  cfg={'lifecycleVersion':2,'cycles':cycles,'cycleCloseMode':'manual','roundHours':0,'roundMinutes':1,'integrationDurationMinutes':60,'enabledEvents':[],'eventSelectionMode':'manual','capitalMode':'fixed','capital':1000000,'capitalMin':1000000,'capitalMax':1000000,'interest':20,'planSyncGraceSeconds':0,'loanPolicy':{'version':'french-v1'}}
  g=rpc('crear_sala_docente',{'p_config':cfg,'p_nombre':'QA Progresiva '+str(cycles)+'C 20261103','p_curso':'Producción y continuidad','p_segmento':'Estandar','p_request_id':str(uuid.uuid4()),'p_reemplazar_id':None},t['access_token'])
  assert g.get('id') and g['configuracion']['economicRulesVersion']=='utility-v1',g
  m={'cycles':cycles,'game':g,'companies':[]};save(m)
 for kind in NAMES:
  for strategy in ['eficiente','intermedia','ineficiente']:
   key=kind+'-'+strategy
   if any(x['key']==key for x in m['companies']):continue
   path=OUT/(str(cycles)+'-'+key+'-session.local.json')
   s=json.loads(path.read_text()) if path.exists() else req('/auth/v1/signup',{'data':{'qaPurpose':'SIDE progresiva 20261103'}})
   path.write_text(json.dumps(s))
   name='QA'+str(cycles)+' '+NAMES[kind]+' '+strategy
   admission=rpc('side_ingresar_empresa_segura',{'p_codigo':m['game']['codigo'],'p_nombre_legal':name+' SAC','p_nombre_comercial':name,'p_clave':None},s['access_token'])
   assert admission.get('success') and admission.get('empresa_id'),admission
   m['companies'].append({'key':key,'kind':kind,'strategy':strategy,'name':name,'id':admission['empresa_id']});save(m)
   print('JOIN',cycles,key,admission['empresa_id'],flush=True)
 print('CREATED',cycles,m['game']['codigo'],m['game']['id'],flush=True)
def history(m):
 def one(company):return rpc('side_historial_oficial',{'p_partida_id':m['game']['id'],'p_empresa_id':company['id']},teacher_token(m['cycles']))
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:parts=list(pool.map(one,m['companies']))
 return {'version':'official-history-v1','partida_id':m['game']['id'],'companies':sorted([c for h in parts for c in h['companies']],key=lambda c:c['id']),'cycles':sorted([r for h in parts for r in h['cycles']],key=lambda r:(r['ciclo'],r['empresa_id']))}
def collect(cycles,round):
 m=load(cycles);h=history(m);rows=[r for r in h['cycles'] if r['ciclo']==round and r['status']=='confirmed']
 print('CONFIRMED',cycles,round,len(rows),flush=True)
 if len(rows)!=12:return False
 (OUT/(str(cycles)+'-historia-'+str(round)+'.json')).write_text(json.dumps(h))
 for row in rows:
  f=row['result']['financial'];e=f['estadoResultados'];b=f['balanceGeneral'];c=f['balanceCaja']
  assert abs(b['activos']-b['pasivoPatrimonio'])<.021
  assert abs(c['cajaInicial']+c['entradas']-c['salidas']-c['cajaFinal'])<.021
  assert abs(e['ingresos']+e['ingresosFinancieros']-e['costoVentas']-e['gastosOperacion']-e['gastosFinancieros']-e['impuestoRenta']-e['utilidadNeta'])<.021
  assert row['result']['receipt']['financialPolicy']['economicRulesVersion']=='utility-v1'
 print('SEALED',cycles,round,'profits',sum(r['result']['financial']['estadoResultados']['utilidadNeta']>0 for r in rows),flush=True);return True
def generate(m,round):
 if round>1:
  cached=OUT/(str(m['cycles'])+'-historia-'+str(round-1)+'.json')
  if not cached.exists():assert collect(m['cycles'],round-1),'Previous cycle unsealed'
 args=['node',str(ROOT/'tests/progresiva_oficial_plans.cjs'),str(m['cycles']),str(round)]
 subprocess.run(args,cwd=ROOT,check=True)
 return json.loads((OUT/(str(m['cycles'])+'-planes-'+str(round)+'.json')).read_text())
def submit(cycles,round):
 m=load(cycles);t=teacher_token(cycles)
 if (OUT/(str(cycles)+'-submitted-'+str(round)+'.json')).exists():print('ALREADY SUBMITTED',cycles,round);return
 plans=generate(m,round)
 if round>1:
  result=rpc('controlar_partida',{'p_partida_id':m['game']['id'],'p_accion':'avanzar','p_config':None,'p_expected_round':round-1},t)
  assert result['configuracion']['runtime']['round']==round,result
 else:
  result=rpc('controlar_partida',{'p_partida_id':m['game']['id'],'p_accion':'sincronizar','p_config':None,'p_expected_round':1},t)
 assert result['configuracion']['runtime']['phase']=='decisions',result
 for company in m['companies']:
  s=session(cycles,company['key']);args={'p_codigo':m['game']['codigo'],'p_nombre_legal':company['name']+' SAC','p_nombre_comercial':company['name']}
  current=rpc('obtener_estado_estudiante',args,s['access_token']);snapshot=current.get('snapshot') or {}
  assert not snapshot.get('decision_state',{}).get('__cycleSettlements',{}).get(str(round)),'Do not overwrite sealed cycle'
  snapshot['round']=round;snapshot['decisions_submitted']=True
  ds=snapshot.get('decision_state') or {};plan=plans[str(company['id'])];ds.update(plan);ds['__cyclePlans']={**ds.get('__cyclePlans',{}),str(round):{'state':plan}}
  snapshot['decision_state']=ds
  r=rpc('guardar_estado_estudiante',{**args,'p_snapshot':snapshot,'p_expected_revision':current['snapshot_revision']},s['access_token'])
  assert r.get('success') is not False,r
 result=rpc('controlar_partida',{'p_partida_id':m['game']['id'],'p_accion':'cerrar','p_config':None,'p_expected_round':round},t)
 assert result['configuracion']['runtime']['phase']=='results',result
 (OUT/(str(cycles)+'-submitted-'+str(round)+'.json')).write_text(json.dumps({'cycle':round,'game':m['game']['id']}))
 print('SUBMITTED',cycles,round,m['game']['codigo'],flush=True)
def events(cycles):
 m=load(cycles);token=teacher_token(cycles)
 scheduled=[(3,'molde_2-eficiente','PE69',20)] if cycles==3 else [(3,'molde_1-eficiente','PE30',25),(4,'molde_3-eficiente','PE71',15),(5,'combinado-intermedia','PE75',6),(6,'combinado-ineficiente','PE68',1)]
 evidence=[]
 for round,key,event,intensity in scheduled:
  company=next(c for c in m['companies'] if c['key']==key)
  evidence.append(rpc('side_assign_event_v1',{'p_partida_id':m['game']['id'],'p_empresa_id':company['id'],'p_ciclo':round,'p_event_id':event,'p_intensity':intensity},token))
 (OUT/(str(cycles)+'-eventos.json')).write_text(json.dumps(evidence,indent=2))
 print('EVENTS ASSIGNED',cycles,len(evidence),flush=True)
if __name__=='__main__':
 stage=sys.argv[1]
 if stage in ('create','submit','events') and os.environ.get('SIDE_RUN_CONNECTED_QA')!='1':raise RuntimeError('Explicit opt-in required')
 for cycles in [3,6]:
  if stage=='create':create(cycles)
  elif stage=='events':events(cycles)
  elif stage=='submit':
   round=int(sys.argv[2])
   if round<=cycles:submit(cycles,round)
  elif stage=='collect':
   round=int(sys.argv[2])
   if round<=cycles and not collect(cycles,round):raise SystemExit(2)
