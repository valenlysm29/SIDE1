"""Independent decimal reconciliation of the two completed HTTP scenarios."""
from pathlib import Path
import json,subprocess
from decimal import Decimal,ROUND_HALF_UP
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'tests/output/finalizacion-integral'
all_cases=json.loads((OUT/'connected/integration.json').read_text(encoding='utf8'))
D=lambda n:Decimal(str(n or 0));money=lambda n:n.quantize(Decimal('.01'),rounding=ROUND_HALF_UP)
checks=[]
for count in [3,6]:
 scenario=[s for s in all_cases if s['cycles']==count][-1]
 query="select jsonb_agg(jsonb_build_object('cycle',c.ciclo,'company',e.key,'result',e.value) order by c.ciclo,e.key) from side_business_closures c cross join lateral jsonb_each(c.cierre->'resultadosPorEmpresa') e where partida_id='"+scenario['game']+"'"
 data=json.loads(subprocess.check_output(['docker','exec','supabase_db_fase01local','psql','-U','postgres','-Atq','-c',query]),parse_float=Decimal)
 assert len(data)==count*3;prior={};pretax={}
 for row in data:
  company=row['company'];cycle=row['cycle'];r=row['result'];f=r['financial'];er=f['estadoResultados'];bg=f['balanceGeneral'];fc=f['flujoCaja'];rec=r['receipt']
  assert D(er['ventasTotales'])-D(er['costoVentas'])==D(er['utilidadBruta'])
  assert D(er['utilidadBruta'])-D(er['gastosOperacion'])+D(er['ingresosFinancieros'])-D(er['gastosFinancieros'])-D(er['impuestoRenta'])==D(er['utilidadNeta'])
  assert D(bg['activos'])==D(bg['pasivoPatrimonio'])
  assert D(fc['cajaInicial'])+D(fc['flujoNeto'])==D(fc['cajaFinal'])==D(bg['efectivo'])
  pretax[company]=pretax.get(company,D(0))+D(er['utilidadAntesImpuestos'])
  base=max(D(0),pretax[company]);tax=money(min(base,D(82500))*D('.10')+max(D(0),base-D(82500))*D('.295')) if er['regimenTributario']=='MYPE' else money(base*D('.295'))
  assert D(er['impuestoRenta'])==(tax if cycle==count else D(0))
  if company in prior:
   before=prior[company];assert D(fc['cajaInicial'])==D(before['balanceGeneral']['efectivo'])
   assert D(bg['resultadosAcumulados'])==D(before['balanceGeneral']['resultadosAcumulados'])+D(er['utilidadNeta'])
   opening=D(before['balanceGeneral']['inventarioPT'])
  else:opening=D(0)
  assert opening+D(er['costosProduccion'])-D(er['costoVentas'])==D(bg['inventarioPT'])
  assert not any(k.startswith('molde_') for k in f.get('depreciationValues',{}))
  for material in rec['production']['materials']:assert D(material['consumption'])<=D(material['available']) and D(material['remaining'])>=0
  prior[company]=f;checks.append({'scenario':count,'cycle':cycle,'company':company,'tax':str(er['impuestoRenta']),'exact':True})
(OUT/'decimal-reconciliation.json').write_text(json.dumps(checks,indent=2),encoding='utf8')
print('PASS 27 official results: decimal identities, accumulated tax at final cycle, cash/equity/PT carry and material bounds')
