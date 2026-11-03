"""Real HTTP partial receipt -> authoritative Edge -> official seal, local QA only."""
from pathlib import Path
# Reuse transport definitions only; do not execute the separate access scenario.
exec(Path(__file__).with_name('access_matrix_http.py').read_text(encoding='utf-8-sig').split('t,other,a,b=')[0])
sql("update partidas set configuracion=configuracion||'{\"runtime\":{\"phase\":\"cancelled\"}}'::jsonb where nombre='QA Partial real HTTP'")
teacher,student=session(),session();gid=str(uuid.uuid4())
config={'lifecycleVersion':2,'cycles':1,'roundHours':0,'roundMinutes':1,'cycleCloseMode':'manual','integrationDurationMinutes':5,'materialRulesVersion':'receipts-v1','materialPurchaseVersion':'excel-v2-packs-v1','materialLeadTimeDays':0,'materialPaymentMode':'credit','supplierCreditTermCycles':2,'deliveryPolicy':'explicit_provider_event_v1','enabledEvents':[],'capital':1000000}
sql(f"insert into profesores(id,nombre,apellido) values('{teacher['user']['id']}','QA','Partial') on conflict do nothing")
game=json.loads(sql(f"insert into partidas(id,profesor_id,nombre,configuracion) values('{gid}','{teacher['user']['id']}','QA Partial real HTTP','{json.dumps(config)}') returning row_to_json(partidas)"))
_,joined=rpc('side_ingresar_empresa_segura',{'p_codigo':game['codigo'],'p_nombre_legal':'Partial QA','p_nombre_comercial':'Partial QA','p_clave':None},student);assert joined['success'],joined
ident={'p_codigo':game['codigo'],'p_nombre_legal':'Partial QA','p_nombre_comercial':'Partial QA'}
sql(f"update partidas set configuracion=jsonb_set(configuracion,'{{gameStartAt}}',to_jsonb(clock_timestamp()-interval '1 second')) where id='{gid}'")
control=rpc('controlar_partida',{'p_partida_id':gid,'p_accion':'iniciar','p_expected_round':1},teacher);assert control[0]==200 and not control[1].get('error'),control
source="""const f=require('./tests/economic_v19_fixture.cjs'),s=f.state(1);for(const [id,opt] of [['MESA_CORTE','mesa'],['ENSAMBLE','ens_basica'],['ACABADOS','aca_basica'],['PERS_CORTE','corte_basico'],['PERS_ENSAMBLE','ens_personal_basico'],['PERS_ACABADO','aca_personal_basico']])s[id]={round:1,quantities:{[opt]:10},optionIds:[opt],...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(id)?{purchases:{1:{[opt]:10}}}:{})};s.MOLDE={round:1,optionIds:['molde_1']};s.PRODUCCION_META={round:1,moldTargets:{molde_1:1000}};s.CUERO={round:1,quantities:{cuero_std:1000}};s.ACCESORIOS={round:1,quantities:{acc_eco:2000}};s.HILO={round:1,quantities:{hilo_std:10}};process.stdout.write(JSON.stringify(s));"""
plan=json.loads(subprocess.check_output(['node','-e',source]))
_,current=rpc('obtener_estado_estudiante',ident,student)
_,saved=rpc('guardar_estado_estudiante',{**ident,'p_snapshot':{'round':1,'decisions_submitted':True,'decision_state':{**plan,'__cyclePlans':{'1':{'state':plan}}}},'p_expected_revision':current['snapshot_revision']},student);assert saved['success'],saved
code_,book=rpc('side_material_preview_v1',{'p_partida_id':gid,'p_empresa_id':joined['empresa_id'],'p_ciclo':1},student);assert code_==200,book
orders=[o for o in book['events'].values() if o['type']=='order'];assert len(orders)==3,orders
for o in orders:
 quantity=1500 if o['sku']=='hilo_std' else o['quantity'];assert quantity<=o['quantity']
 args={'p_partida_id':gid,'p_order_id':o['orderId'],'p_receipt_id':'qa-'+uuid.uuid4().hex,'p_quantity':quantity}
 code_,receipt=rpc('side_registrar_entrega_proveedor_v1',args,teacher);assert code_==200 and receipt.get('receiptId')==args['p_receipt_id'],receipt
 code_,retry=rpc('side_registrar_entrega_proveedor_v1',args,teacher);assert code_==200 and retry.get('reused'),retry
control=rpc('controlar_partida',{'p_partida_id':gid,'p_accion':'cerrar','p_expected_round':1},teacher);assert control[0]==200 and not control[1].get('error'),control
run=str(uuid.uuid4());sql(f"insert into side_closure_execution_requests(run_id,request_id) values('{run}',-1)")
r=urllib.request.Request(BASE+'/functions/v1/side-business-close',data=json.dumps({'run_id':run}).encode(),headers={'Content-Type':'application/json','x-side-cron-token':'fase01-local-only'})
try:
 with urllib.request.urlopen(r) as response:out=json.load(response)
except urllib.error.HTTPError as e:
 assert e.code==503;out=json.load(e)
assert any(x['game']==gid and x['success'] and not x.get('pending') for x in out['results']),out
_,history=rpc('side_historial_oficial',{'p_partida_id':gid,'p_empresa_id':None},teacher)
rows=[x for x in history['cycles'] if x['status']=='confirmed'];assert len(rows)==1,history
result=rows[0]['result'];receipt=result['receipt'];f=result['financial'];assert receipt['production']['target']==1000 and 0<receipt['produced']<=250,receipt
assert f['balanceGeneral']['activos']==f['balanceGeneral']['pasivoPatrimonio']
assert receipt['materialReceiptFacts']['receivedBySku']['hilo_std']==1500
assert receipt['inventory']['hilo_std']>=0
control=rpc('controlar_partida',{'p_partida_id':gid,'p_accion':'avanzar','p_expected_round':1},teacher);assert control[0]==200 and not control[1].get('error'),control
(ROOT/'tests/output/finalizacion-integral/partial-receipt.json').write_text(json.dumps({'game':gid,'target':1000,'produced':receipt['produced'],'receivedThread':1500,'retryIdempotent':True,'balanceExact':True,'result':result},indent=2),encoding='utf8')
print('PASS real Auth/teacher partial receipt, idempotent receipt retry, Edge closure; target 1000 preserved, produced',receipt['produced'])
