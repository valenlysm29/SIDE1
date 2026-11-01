"""Exercise a new manual game on the dedicated local instance via Auth/RPC/Edge.

Requires preparar_modos_e2e.py and `supabase functions serve` for cierres-e2e.
Only local test identities are used; sessions and the Vault token stay in memory.
"""
import json
import os
import re
import argparse
from concurrent.futures import ThreadPoolExecutor
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path.cwd()
NAME='side-validacion-limpia'
PORT='3242'
if NAME!='side-validacion-limpia' or PORT!='3242':raise SystemExit('Proyecto o puerto no permitido')
WORK = ROOT / '.codex-work' / NAME

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--mode',choices=('manual','random','balanced'),default='manual');parser.add_argument('--cycles',type=int,choices=(3,6),default=3);options=parser.parse_args()
    status = json.loads(subprocess.check_output(['npx.cmd','--no-install','supabase','status','--workdir',str(WORK),'-o','json'],cwd=ROOT,stderr=subprocess.DEVNULL,text=True))
    base,key = status['API_URL'],status['ANON_KEY']
    if base != 'http://127.0.0.1:'+PORT+'1': raise RuntimeError('Instancia no aislada')
    def request(path, payload, token=None, extra=None):
        headers={'apikey':key,'Authorization':'Bearer '+(token or key),'Content-Type':'application/json'}
        headers.update(extra or {})
        req=urllib.request.Request(base+path,data=json.dumps(payload).encode(),headers=headers)
        try:
            with urllib.request.urlopen(req,timeout=65) as res:return json.load(res)
        except urllib.error.HTTPError as exc:raise RuntimeError(f'{path}: HTTP {exc.code}: {exc.read().decode()}') from exc
    def rpc(name,args,session):
        out=request('/rest/v1/rpc/'+name,args,session['access_token'])
        if isinstance(out,dict) and (out.get('error') or out.get('success') is False):raise RuntimeError(f'{name}: {out}')
        return out
    teacher=request('/auth/v1/signup',{'email':uuid.uuid4().hex+'@example.test','password':'Local-side-test-123456!','data':{'nombre':'Docente','apellido':'Prueba'}})
    cfg={'lifecycleVersion':2,'cycleCloseMode':'manual','cycles':options.cycles,'roundHours':0,'roundMinutes':10,'integrationDurationMinutes':1,'enabledEvents':['PE69','PE71','PE75'],'eventRules':{},'eventSelectionMode':'manual','randomEventCount':3,'economicEventsVersion':'demand-share-v1','challengeModeV1':options.mode,'capital':1000000,'materialRulesVersion':'receipts-v1','materialPurchaseVersion':'excel-v2-packs-v1','materialPaymentMode':'cash','deliveryPolicy':'explicit_provider_event_v1','materialLeadTimeDays':0}
    game=rpc('crear_sala_docente',{'p_config':cfg,'p_nombre':f'E2E {options.mode} {options.cycles}','p_curso':'Prueba local','p_segmento':'Estandar','p_request_id':str(uuid.uuid4()),'p_reemplazar_id':None},teacher)
    gid,code=game['id'],game['codigo']; students=[]
    for i in range(3):
        s=request('/auth/v1/signup',{}); name=f'Empresa {i+1}'
        joined=rpc('side_ingresar_empresa_segura',{'p_codigo':code,'p_nombre_legal':name,'p_nombre_comercial':name,'p_clave':None},s)
        students.append((s,name,joined['empresa_id']))
    for cycle in range(1,options.cycles+1):
        if options.mode=='manual':rpc('side_assign_event_v1',{'p_partida_id':gid,'p_empresa_id':students[0][2],'p_ciclo':cycle,'p_event_id':'PE69','p_intensity':2},teacher)
        elif options.mode=='balanced':rpc('side_schedule_balanced_v1',{'p_partida_id':gid,'p_ciclo':cycle},teacher)
        else:rpc('side_draw_all_events_v1',{'p_partida_id':gid,'p_source_cycle':cycle},teacher)
    print('Sala creada; esperando el minuto real de integración.',flush=True)
    deadline=time.monotonic()+85
    while time.monotonic()<deadline:
        g=rpc('controlar_partida',{'p_partida_id':gid,'p_accion':'sincronizar','p_expected_round':1},teacher)
        if g['configuracion']['runtime']['phase']=='decisions':break
        time.sleep(2)
    else:raise RuntimeError('No terminó la integración')
    secret=subprocess.check_output(['docker','exec','supabase_db_'+NAME,'psql','-U','postgres','-d','postgres','-At','-c',"select decrypted_secret from vault.decrypted_secrets where name='side_business_cron_token'"],cwd=ROOT,text=True).strip()
    rows=[]
    target=ROOT/f'tests/output/validacion_limpia_rechazo.json'
    for cycle in range(1,options.cycles+1):
        for session,name,company in students:
            identity={'p_codigo':code,'p_nombre_legal':name,'p_nombre_comercial':name}
            current=rpc('obtener_estado_estudiante',identity,session)
            state={}
            quantities={'MESA_CORTE':{'mesa':1},'ENSAMBLE':{'ens_basica':1},'ACABADOS':{'aca_basica':1},'PERS_CORTE':{'corte_basico':1},'PERS_ENSAMBLE':{'ens_personal_basico':1},'PERS_ACABADO':{'aca_personal_basico':1},'CUERO':{'cuero_sint':5},'ACCESORIOS':{'acc_eco':20},'HILO':{'hilo_std':1}}
            for item,values in quantities.items():
                state[item]={'round':cycle,'quantities':values,'optionIds':list(values)}
                if item in ('MESA_CORTE','ENSAMBLE','ACABADOS'):state[item]['purchases']={'1':values}
            state.update({'MOLDE':{'round':1,'optionIds':['molde_1']},'PRODUCCION_META':{'round':cycle,'moldTargets':{'molde_1':10}},'CANALES':{'round':cycle,'optionIds':['web']}})
            snapshot=current.get('snapshot') or {}; ds=snapshot.get('decision_state') or {}; ds.update(state); ds.setdefault('__cyclePlans',{})[str(cycle)]={'state':state}; snapshot.update(decision_state=ds,decisions_submitted=True)
            rpc('guardar_estado_estudiante',{**identity,'p_snapshot':snapshot,'p_expected_revision':current['snapshot_revision']},session)
            book=rpc('side_material_preview_v1',{'p_partida_id':gid,'p_empresa_id':company,'p_ciclo':cycle},teacher)
            orders=[v for v in book['events'].values() if v['type']=='order' and v['orderId'].split(':')[-2]==str(cycle)]
            if len(orders)!=3:raise RuntimeError(f'Ciclo {cycle}: se esperaban tres pedidos, recibidos {len(orders)}')
            for order in orders:
                qty=float(order['quantity']); first=qty/2
                for part in (first,qty-first):
                    rid=str(uuid.uuid4()); args={'p_partida_id':gid,'p_order_id':order['orderId'],'p_receipt_id':rid,'p_quantity':part}
                    rpc('side_registrar_entrega_proveedor_v1',args,teacher)
                    if not rpc('side_registrar_entrega_proveedor_v1',args,teacher).get('reused'):raise RuntimeError('Recepción repetida no es idempotente')
        rpc('controlar_partida',{'p_partida_id':gid,'p_accion':'cerrar','p_expected_round':cycle},teacher)
        def close():return request('/functions/v1/side-business-close',{},extra={'x-side-cron-token':secret})
        if cycle==1:
            def sql(q):return subprocess.check_output(['docker','exec','supabase_db_'+NAME,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At','-c',q],cwd=ROOT,text=True).strip()
            orderid=orders[0]['orderId']
            original=sql("select unit_cost from side_material_orders_v1 where order_id='"+orderid+"'")
            sql("update side_material_orders_v1 set unit_cost=unit_cost+1 where order_id='"+orderid+"'")
            audit="select md5(coalesce((select string_agg(row_to_json(s)::text,',' order by s.empresa_id) from side_student_state s join participantes p on p.empresa_id=s.empresa_id where p.partida_id='"+gid+"'),'')||coalesce((select string_agg(row_to_json(c)::text,',' order by c.ciclo) from side_business_closures c where c.partida_id='"+gid+"'),'')||coalesce((select string_agg(row_to_json(r)::text,',' order by r.receipt_id) from side_material_receipts_v1 r join side_material_orders_v1 o on o.order_id=r.order_id where o.partida_id='"+gid+"'),''))"
            before=sql(audit);rejected=close(); retried=close(); after=sql(audit)
            retry_match=[x for x in retried.get('results',[]) if str(x.get('game'))==str(gid) and int(x.get('cycle',0))==1]
            if len(retry_match)!=1 or retry_match[0].get('success'):raise RuntimeError('El reintento inválido no se rechazó')
            match=[x for x in rejected.get('results',[]) if str(x.get('game'))==str(gid) and int(x.get('cycle',0))==1]
            if len(match)!=1 or match[0].get('success') or 'incompatible' not in match[0].get('error','').lower():raise RuntimeError('El cierre incoherente no se rechazó como se esperaba: '+str(match))
            if before!=after:raise RuntimeError('El rechazo modificó cierres, recibos o snapshots')
            print('APROBADO rechazo Edge y PostgreSQL sin escrituras parciales por costo SKU contradictorio',flush=True)
            sql("update side_material_orders_v1 set unit_cost="+original+" where order_id='"+orderid+"'")
        if cycle==1:
            with ThreadPoolExecutor(max_workers=2) as pool: responses=list(pool.map(lambda _:close(),range(2)))
        else:responses=[close()]
        if not all(any(str(r.get('game'))==str(gid) and int(r.get('cycle',0))==cycle and r.get('success') for r in response.get('results',[])) for response in responses):raise RuntimeError('Edge no confirmó el cierre de la sala de prueba')
        closure=rpc('side_consultar_cierre_negocio',{'p_partida_id':gid,'p_ciclo':cycle},teacher).get('cierre')
        if not closure or len(closure.get('resultadosPorEmpresa',{}))!=3:raise RuntimeError('Cierre sin tres resultados')
        count=subprocess.check_output(['docker','exec','supabase_db_'+NAME,'psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1','-c',f"select count(*) from public.side_business_closures where partida_id='{gid}' and ciclo={cycle}"],cwd=ROOT,text=True).strip()
        if count!='1':raise RuntimeError(f'Cierres duplicados: {count}')
        for session,name,company in students:
            result=closure['resultadosPorEmpresa'][str(company)]
            bg=result['financial']['balanceGeneral']
            if abs(float(bg['activos'])-float(bg['pasivoPatrimonio']))>.02:raise RuntimeError('Balance no concilia')
            student=rpc('obtener_estado_estudiante',{'p_codigo':code,'p_nombre_legal':name,'p_nombre_comercial':name},session)
            decisions=student['snapshot']['decision_state']
            if decisions['__cycleSettlements'][str(cycle)]!=result['receipt']:raise RuntimeError('Estudiante y docente muestran cierres distintos')
            snapshot_finance=decisions['__financialSnapshots'][str(cycle)]
            for section in ('estadoResultados','balanceCaja','balanceGeneral'):
                if snapshot_finance[section]!=result['financial'][section]:raise RuntimeError(f'Estudiante y docente difieren en {section}')
        rows.append({'mode':options.mode,'cycle':cycle,'companies':3,'edge':True})
        target.write_text(json.dumps(rows,indent=2),encoding='utf8')
        print(json.dumps(rows[-1]),flush=True)
        advanced=rpc('controlar_partida',{'p_partida_id':gid,'p_accion':'avanzar','p_expected_round':cycle},teacher)
        if cycle==options.cycles and advanced['configuracion']['runtime']['phase']!='finished':raise RuntimeError('La partida no finalizó')
    print(f'{len(rows)} cierres completados por Edge; aún falta comprobar interfaz y laboratorio.')

if __name__=='__main__':main()
