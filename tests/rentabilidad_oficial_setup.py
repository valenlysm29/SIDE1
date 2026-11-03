"""Opt-in connected QA. Writes only a newly owned game and its three companies.
Credentials stay in ignored tests/output, never in evidence or Git.
"""
import json,urllib.request,uuid,re,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PROJECT=ROOT.parents[1] if ROOT.parent.name=='.codex-work' else ROOT
OUT=ROOT/'tests/output/rentabilidad-oficial';OUT.mkdir(parents=True,exist_ok=True)
auth_file=PROJECT/'tests/output/rentabilidad-oficial/qa-auth.local.json'
config=(ROOT/'js/config.js').read_text(encoding='utf8')
BASE=re.search(r'SUPABASE_URL:\s*"([^"]+)"',config)[1]
KEY=re.search(r'SUPABASE_PUBLISHABLE_KEY:\s*"([^"]+)"',config)[1]
def req(path,payload,token=None):
 headers={'apikey':KEY,'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 request=urllib.request.Request(BASE+path,data=json.dumps(payload).encode(),headers=headers)
 with urllib.request.urlopen(request,timeout=30) as response:return json.load(response)
def rpc(name,args,token):
 result=req('/rest/v1/rpc/'+name,args,token)
 if isinstance(result,dict) and result.get('error'):raise RuntimeError(result)
 return result
if __name__=='__main__':
 if os.environ.get('SIDE_RUN_CONNECTED_QA')!='1':raise RuntimeError('Set SIDE_RUN_CONNECTED_QA=1 explicitly to create test data in production.')
 qa=json.loads(auth_file.read_text())
 manifest_file=OUT/'manifest.json'
 existing=json.loads(manifest_file.read_text()) if manifest_file.exists() else None
 teacher=req('/auth/v1/token?grant_type=password',{'email':qa['email'],'password':qa['password']})
 (OUT/'teacher-session.local.json').write_text(json.dumps(teacher))
 cfg={'lifecycleVersion':2,'cycles':3,'cycleCloseMode':'manual','roundHours':0,'roundMinutes':1,
  'integrationDurationMinutes':60,'enabledEvents':[],'capitalMode':'fixed','capital':50000,
  'capitalMin':50000,'capitalMax':50000,'interest':20,'eventSelectionMode':'manual',
  'planSyncGraceSeconds':0}
 game=existing['game'] if existing else rpc('crear_sala_docente',{'p_config':cfg,'p_nombre':'QA Rentabilidad Oficial 8cd602a',
  'p_curso':'Validación final tres estrategias','p_segmento':'Estandar','p_request_id':str(uuid.uuid4()),'p_reemplazar_id':None},teacher['access_token'])
 assert game.get('id') and game.get('configuracion',{}).get('economicRulesVersion')=='utility-v1',game
 manifest=existing or {'game':game,'companies':[],'sourceCommit':'8cd602a890eab73877c4d201a43c264318404ca1'}
 manifest_file.write_text(json.dumps(manifest,indent=2))
 for strategy in ['basico','estandar','premium']:
  if any(x['strategy']==strategy for x in manifest['companies']):continue
  session_file=OUT/(strategy+'-session.local.json')
  session=json.loads(session_file.read_text()) if session_file.exists() else req('/auth/v1/signup',{'data':{'qaPurpose':'SIDE rentabilidad oficial 20261103'}})
  session_file.write_text(json.dumps(session))
  name={'basico':'QA Básico Eficiente','estandar':'QA Estándar Eficiente','premium':'QA Prémium Eficiente'}[strategy]
  company=rpc('side_ingresar_empresa_segura',{'p_codigo':game['codigo'],'p_nombre_legal':name+' SAC','p_nombre_comercial':name,'p_clave':None},session['access_token'])
  assert company.get('success') and company.get('empresa_id'),company
  manifest['companies'].append({'strategy':strategy,'name':name,'companyId':company['empresa_id'],'admission':company})
  manifest_file.write_text(json.dumps(manifest,indent=2))
 print(json.dumps({'game':game['id'],'code':game['codigo'],'rules':game['configuracion']['economicRulesVersion'],'companies':[(x['strategy'],x['companyId']) for x in manifest['companies']]}))
