"""Submit inputs through real student RPCs and close only the new QA game."""
import json,os
from rentabilidad_oficial_setup import OUT,rpc
if __name__=='__main__':
 if os.environ.get('SIDE_RUN_CONNECTED_QA')!='1':raise RuntimeError('Set SIDE_RUN_CONNECTED_QA=1 explicitly to submit the new QA game.')
 m=json.loads((OUT/'manifest.json').read_text());plans=json.loads((OUT/'planes.json').read_text())
 teacher=json.loads((OUT/'teacher-session.local.json').read_text())
 sync=rpc('controlar_partida',{'p_partida_id':m['game']['id'],'p_accion':'sincronizar','p_config':None,'p_expected_round':1},teacher['access_token'])
 assert sync['configuracion']['runtime']['phase']=='decisions',sync
 for company in m['companies']:
  strategy=company['strategy'];session=json.loads((OUT/(strategy+'-session.local.json')).read_text())
  args={'p_codigo':m['game']['codigo'],'p_nombre_legal':company['name']+' SAC','p_nombre_comercial':company['name']}
  current=rpc('obtener_estado_estudiante',args,session['access_token']);snapshot=current.get('snapshot') or {}
  snapshot['round']=1;snapshot['decisions_submitted']=True
  plan=plans[strategy];ds=snapshot.get('decision_state') or {};ds.update(plan);ds['__cyclePlans']={'1':{'state':plan}}
  snapshot['decision_state']=ds
  result=rpc('guardar_estado_estudiante',{**args,'p_snapshot':snapshot,'p_expected_revision':current['snapshot_revision']},session['access_token'])
  assert result.get('success') is not False,result
  print('Submitted',strategy,company['companyId'])
 result=rpc('controlar_partida',{'p_partida_id':m['game']['id'],'p_accion':'cerrar','p_config':None,'p_expected_round':1},teacher['access_token'])
 assert result['configuracion']['runtime']['phase']=='results',result
 (OUT/'submitted.json').write_text(json.dumps({'game':m['game']['id'],'cycle':1,'phase':'results','companies':[x['companyId'] for x in m['companies']]},indent=2))
 print('Cycle 1 ready for real scheduled Edge closure',m['game']['codigo'])
