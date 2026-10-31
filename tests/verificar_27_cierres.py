"""Read-only reconciliation of the six locally created test games."""
import json
import os
import re
import subprocess
import uuid
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
NAME=os.environ.get('SIDE_E2E_PROJECT','cierres-e2e2')
if not re.fullmatch(r'cierres-e2e[a-z0-9-]{0,12}',NAME):raise SystemExit('Proyecto no permitido')
CONTAINER='supabase_db_'+NAME

def sql(text):
    return subprocess.check_output(['docker','exec',CONTAINER,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At','-c',text],cwd=ROOT,text=True,encoding='utf8').strip()

def main():
    ids=[]
    manual3=ROOT/'tests/output/cierre_manual_3_local.json'
    first=json.loads(manual3.read_text(encoding='utf8'))[0]['game'] if manual3.exists() else sql("select id from partidas where nombre='Tres ciclos E2E' order by created_at limit 1")
    ids.append(str(uuid.UUID(first)))
    for mode,cycles in [('manual',6),('random',3),('random',6),('balanced',3),('balanced',6)]:
        rows=json.loads((ROOT/f'tests/output/cierre_{mode}_{cycles}_local.json').read_text(encoding='utf8'))
        assert len(rows)==cycles
        ids.append(str(uuid.UUID(rows[0]['game'])))
    args=','.join("'"+x+"'::uuid" for x in ids)
    order_counts=json.loads(sql(f"select jsonb_build_object('orders',count(*),'two_receipts',count(*) filter(where n=2),'fully_received',count(*) filter(where abs(total-quantity)<0.000001)) from (select o.quantity,count(r.receipt_id) n,coalesce(sum(r.quantity),0) total from side_material_orders_v1 o left join side_material_receipts_v1 r on r.order_id=o.order_id where o.partida_id in ({args}) group by o.order_id,o.quantity) x"))
    assert order_counts=={'orders':243,'two_receipts':243,'fully_received':243},order_counts
    q=f"select coalesce(jsonb_agg(jsonb_build_object('game',p.id,'cycle',c.ciclo,'company',t.empresa_id,'result',c.cierre#>array['resultadosPorEmpresa',t.empresa_id::text],'student',s.snapshot->'decision_state') order by p.id,c.ciclo,t.empresa_id),'[]') from partidas p join side_business_closures c on c.partida_id=p.id join participantes t on t.partida_id=p.id join side_student_state s on s.empresa_id=t.empresa_id where p.id in ({args}) and p.configuracion#>>'{{runtime,phase}}'='finished'"
    rows=json.loads(sql(q)); assert len(rows)==81, f'Se esperaban 81 cierres empresariales: {len(rows)}'
    lab_code="let b='';process.stdin.on('data',x=>b+=x);process.stdin.on('end',()=>{const m=require('./js/laboratorio_model.js');process.stdout.write(JSON.stringify(JSON.parse(b).map(x=>m.read(x.result))))})"
    labs=json.loads(subprocess.check_output(['node','-e',lab_code],cwd=ROOT,input=json.dumps(rows),text=True,encoding='utf8'))
    previous={}
    for row,lab in zip(rows,labs):
        result=row['result'];receipt=result['receipt']; finance=result['financial']; cycle=str(row['cycle']); student=row['student']
        assert student['__cycleSettlements'][cycle]==receipt
        for section in ('estadoResultados','balanceCaja','balanceGeneral'):assert student['__financialSnapshots'][cycle][section]==finance[section]
        assert abs(lab['revenue']-receipt['revenue'])<.03 and abs(lab['profit']-finance['estadoResultados']['utilidad'])<.03 and abs(lab['cash']-finance['balanceCaja']['cajaFinal'])<.03
        assert receipt['sold']<=receipt['produced']+sum(float(x.get('opening',0)) for x in receipt['sales'])
        assert receipt['produced']<=receipt['production']['target']
        assert receipt['produced']<=min(stage['cycleCapacity'] for stage in receipt['production']['processes'])
        for stage in receipt['production']['processes']:assert stage['pairs']<=stage['machines'] and stage['pairs']<=stage['staff']
        assert receipt['produced']==sum(receipt['production']['temporal']['produced'].values())
        assert abs(sum(sale['revenue'] for sale in receipt['sales'])-receipt['revenue'])<.03
        assert abs(finance['balanceGeneral']['activos']-finance['balanceGeneral']['pasivoPatrimonio'])<.03
        key=(row['game'],row['company'])
        if key in previous:assert abs(finance['balanceCaja']['cajaInicial']-previous[key]['balanceCaja']['cajaFinal'])<.03
        previous[key]=finance
        for sale in receipt['sales']:assert sale['sold']<=sale['available']
        opening=receipt['openingInventory']; received=receipt['materialReceiptFacts']['receivedBySku']; consumed=receipt['production']['temporal']['consumedBySku']; closing=receipt['inventory']
        orders=receipt['materialReceiptFacts']['ordersBySku']
        for sku,quantity,cost in [('cuero_sint',5,125),('acc_eco',20,80),('hilo_std',270,2)]:
            assert abs(orders[sku]['quantity']-quantity)<1e-6
            assert abs(orders[sku]['quantity']*orders[sku]['unitCost']-cost)<.03
            assert abs(received[sku]-quantity)<1e-6
        for sku in set(opening)|set(received)|set(consumed)|set(closing):
            assert abs(float(opening.get(sku,0))+float(received.get(sku,0))-float(consumed.get(sku,0))-float(closing.get(sku,0)))<1e-6, (row['game'],cycle,sku)
    print('APROBADO: 27 cierres, 81 resultados, 243 pedidos y 486 recepciones; vistas, caja, balance, capacidad por etapa e inventario por SKU.')
    print('NO EJECUTADO: Kardex visible por navegador y capacidad calculada por un oráculo independiente.')

if __name__=='__main__':main()
