"""Opt-in rerun of the omitted 750-per-mold plan in a separate QA game."""
import os,sys,json,uuid,subprocess
from progresiva_oficial import OUT,ROOT,load,teacher_token
from rentabilidad_oficial_setup import req,rpc
path=OUT/'repeticion2250.json'
stage=sys.argv[1]
if stage in ('create','submit') and os.environ.get('SIDE_RUN_CONNECTED_QA')!='1':raise RuntimeError('Explicit connected QA opt-in required')
token=teacher_token(3)
if stage=='create':
 if not path.exists():
  # Complete the already fully verified three-cycle QA via its normal control;
  # never replace or cancel a game to obtain another room.
  old=load(3)
  done=rpc('controlar_partida',{'p_partida_id':old['game']['id'],'p_accion':'avanzar','p_config':None,'p_expected_round':3},token)
  assert done.get('estado')=='finalizada',done
  cfg={'lifecycleVersion':2,'cycles':3,'cycleCloseMode':'manual','roundHours':1,'roundMinutes':0,'integrationDurationMinutes':60,'enabledEvents':[],'eventSelectionMode':'manual','economicEventsVersion':'demand-share-v1','capitalMode':'fixed','capital':1000000,'capitalMin':1000000,'capitalMax':1000000,'interest':20,'loanPolicy':{'version':'french-v1'}}
  game=rpc('crear_sala_docente',{'p_config':cfg,'p_nombre':'QA Repetición 750 por molde','p_curso':'Repetición de plan no confirmado','p_segmento':'Estandar','p_request_id':str(uuid.uuid4()),'p_reemplazar_id':None},token)
  assert game.get('id'),game
  student=req('/auth/v1/signup',{'data':{'qaPurpose':'repeat2250'}})
  (OUT/'repeticion2250-session.local.json').write_text(json.dumps(student))
  name='QA Repetición MIX ineficiente'
  admission=rpc('side_ingresar_empresa_segura',{'p_codigo':game['codigo'],'p_nombre_legal':name+' SAC','p_nombre_comercial':name,'p_clave':None},student['access_token'])
  assert admission.get('success'),admission
  path.write_text(json.dumps({'game':game,'company':{'id':admission['empresa_id'],'name':name}},indent=2))
 m=json.loads(path.read_text());print('CREATED',m['game']['codigo'],m['game']['id'],m['company']['id'])
elif stage=='submit':
 m=json.loads(path.read_text());student=json.loads((OUT/'repeticion2250-session.local.json').read_text())
 rpc('controlar_partida',{'p_partida_id':m['game']['id'],'p_accion':'sincronizar','p_config':None,'p_expected_round':1},token)
 subprocess.run(['node','tests/progresiva_repeticion_2250.cjs','plan'],cwd=ROOT,check=True)
 plan=json.loads((OUT/'repeticion2250-plan.json').read_text())
 args={'p_codigo':m['game']['codigo'],'p_nombre_legal':m['company']['name']+' SAC','p_nombre_comercial':m['company']['name']}
 current=rpc('obtener_estado_estudiante',args,student['access_token']);snapshot=current.get('snapshot') or {}
 assert not snapshot.get('decision_state',{}).get('__cycleSettlements',{}),'Never overwrite a seal'
 snapshot.update({'round':1,'decisions_submitted':True,'decision_state':{**(snapshot.get('decision_state') or {}),**plan,'__cyclePlans':{'1':{'state':plan}}}})
 rpc('guardar_estado_estudiante',{**args,'p_snapshot':snapshot,'p_expected_revision':current['snapshot_revision']},student['access_token'])
 closed=rpc('controlar_partida',{'p_partida_id':m['game']['id'],'p_accion':'cerrar','p_config':None,'p_expected_round':1},token)
 assert closed['configuracion']['runtime']['phase']=='results';print('SUBMITTED',m['game']['codigo'])
elif stage=='collect':
 m=json.loads(path.read_text());history=rpc('side_historial_oficial',{'p_partida_id':m['game']['id'],'p_empresa_id':m['company']['id']},token)
 assert history['cycles'][0]['status']=='confirmed',history['cycles'][0]['status']
 (OUT/'repeticion2250-oficial.json').write_text(json.dumps(history));print('CONFIRMED',m['game']['codigo'])
