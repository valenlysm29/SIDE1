"""Read and reconcile the actual sealed closure, never calculate replacement results."""
import json
from rentabilidad_oficial_setup import OUT,rpc
def read():
 m=json.loads((OUT/'manifest.json').read_text());teacher=json.loads((OUT/'teacher-session.local.json').read_text())
 h=rpc('side_historial_oficial',{'p_partida_id':m['game']['id'],'p_empresa_id':None},teacher['access_token'])
 rows=[x for x in h['cycles'] if x['ciclo']==1 and x['status']=='confirmed']
 print('Official confirmed companies:',len(rows),flush=True)
 if len(rows)!=3:return None
 summary=[]
 for company in m['companies']:
  row=next(x for x in rows if str(x['empresa_id'])==str(company['companyId']));r=row['result'];e=r['financial']['estadoResultados'];b=r['financial']['balanceGeneral'];c=r['financial']['balanceCaja'];receipt=r['receipt']
  assert e['utilidadNeta']>0,(company,e)
  assert abs(e['ingresos']-sum(x['sold']*x['price'] for x in receipt['sales']))<.011
  assert abs(e['ingresos']+e['ingresosFinancieros']-e['costoVentas']-e['gastosOperacion']-e['gastosFinancieros']-e['impuestoRenta']-e['utilidadNeta'])<.011
  assert abs(b['activos']-b['pasivoPatrimonio'])<.011
  assert abs(c['cajaInicial']+c['entradas']-c['salidas']-c['cajaFinal'])<.011
  assert receipt['financialPolicy']['economicRulesVersion']=='utility-v1'
  summary.append({'company':company['name'],'id':company['companyId'],'strategy':company['strategy'],'produced':receipt['produced'],'sold':receipt['sold'],'chosenPrice':next(x['chosenPrice'] for x in receipt['sales'] if x['sold']),'effectivePrice':next(x['price'] for x in receipt['sales'] if x['sold']),'revenue':e['ingresos'],'cogs':e['costoVentas'],'operatingExpenses':e['gastosOperacion'],'financialExpenses':e['gastosFinancieros'],'tax':e['impuestoRenta'],'netProfit':e['utilidadNeta'],'cash':c['cajaFinal'],'assets':b['activos'],'liabilitiesEquity':b['pasivoPatrimonio'],'closedAt':row.get('closed_at')})
 (OUT/'official-history.json').write_text(json.dumps(h,indent=2))
 (OUT/'official-summary.json').write_text(json.dumps({'game':m['game']['id'],'code':m['game']['codigo'],'cycle':1,'companies':summary},indent=2))
 print(json.dumps(summary,ensure_ascii=False),flush=True)
 return summary
if __name__=='__main__':
 if read() is None:raise SystemExit(2)
