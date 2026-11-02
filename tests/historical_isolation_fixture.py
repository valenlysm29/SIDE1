"""Create ONE invalid legacy fixture in local QA to test real Edge isolation."""
from pathlib import Path
import json,subprocess,urllib.request,uuid
ROOT=Path(__file__).resolve().parents[1];PROJECT=ROOT.parents[1] if ROOT.parent.name=='.codex-work' else ROOT
status=json.loads(subprocess.check_output([str(PROJECT/'node_modules/.bin/supabase.cmd'),'status','--workdir',str(PROJECT/'.codex-work/fase01-local'),'-o','json'],stderr=subprocess.DEVNULL))
assert status['API_URL']=='http://127.0.0.1:33421'
def req(path,payload,token=None):
 request=urllib.request.Request(status['API_URL']+path,data=json.dumps(payload).encode(),headers={'apikey':status['ANON_KEY'],'Authorization':'Bearer '+(token or status['ANON_KEY']),'Content-Type':'application/json'})
 with urllib.request.urlopen(request) as response:return json.load(response)
def sql(source):
 r=subprocess.run(['docker','exec','-i','supabase_db_fase01local','psql','-U','postgres','-v','ON_ERROR_STOP=1','-Atq'],input=source.encode(),capture_output=True)
 if r.returncode:raise RuntimeError('Local QA setup failed')
 return r.stdout.decode().strip()
teacher=req('/auth/v1/signup',{});student=req('/auth/v1/signup',{});gid=str(uuid.uuid4())
config={'lifecycleVersion':2,'cycles':3,'roundHours':0,'roundMinutes':10,'integrationDurationMinutes':5,'cycleCloseMode':'manual','enabledEvents':[],'capital':200000}
game=json.loads(sql(f"insert into partidas(id,profesor_id,nombre,configuracion) values('{gid}','{teacher['user']['id']}','QA Aislamiento legado','{json.dumps(config)}') returning row_to_json(partidas)"))
joined=req('/rest/v1/rpc/side_ingresar_empresa_segura',{'p_codigo':game['codigo'],'p_nombre_legal':'QA Legado','p_nombre_comercial':'QA Legado','p_clave':None},student['access_token']);assert joined['success']
plan=json.loads(subprocess.check_output(['node','-e',"process.stdout.write(JSON.stringify(require('./tests/economic_v19_fixture.cjs').state(1)))"]))
plan['PRESTAMO']={'round':1,'amount':999999999,'principal':999999999}
snapshot={'round':1,'decisions_submitted':True,'decision_state':{'__cyclePlans':{'1':{'state':plan}}}}
sql(f"insert into side_student_state(empresa_id,snapshot) values({joined['empresa_id']},'{json.dumps(snapshot)}') on conflict(empresa_id) do update set snapshot=excluded.snapshot; update partidas set estado='activa',configuracion=(configuracion-'sequentialCloseVersion')||jsonb_build_object('runtime',jsonb_build_object('round',1,'phase','results','running',false,'duration',600)) where id='{gid}'")
out=ROOT/'tests/output/fase01/finalizacion/historical-fixture.json';out.write_text(json.dumps({'game':gid,'version':'0','expected':'DECISION_INVALIDA'},indent=2))
print('PASS created isolated invalid legacy fixture; no production access')
