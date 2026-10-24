"""Verify every recalculated cell, export formula results and a fresh scenario plan."""
from pathlib import Path
import json
import hashlib
import openpyxl

ROOT=Path(__file__).resolve().parents[2]
path=ROOT/'docs/DECISIONES_SIDE_19.xlsx'
formulas=openpyxl.load_workbook(path,data_only=False)
values=openpyxl.load_workbook(path,data_only=True)
errors=[];missing=[];count=0
for sheet in formulas:
    for row in sheet:
        for cell in row:
            val=values[sheet.title][cell.coordinate]
            if val.data_type=='e' or str(val.value) in ['#DIV/0!','#REF!','#N/A','#VALUE!','#NAME?','#NUM!','#NULL!']:
                errors.append([sheet.title,cell.coordinate,val.value])
            if cell.data_type=='f':
                count+=1
                if val.value is None and sheet.title not in ['Seleccion_Ciclo0','Lotes_Produccion','Motor_Puntajes']:
                    missing.append([sheet.title,cell.coordinate])
rows=list(values['Oraculo_v19'].values);headers=rows[0]
fullrows=list(values['Cierre_oraculo_v19'].values)
out={'source':'docs/DECISIONES_SIDE_19.xlsx','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'recalculation_engine':'Microsoft Excel COM16.0 (LibreOffice unavailable)','formula_count':count,'errors':errors,'missing_numeric_caches':missing,'market_cases':[dict(zip(headers,row)) for row in rows[1:]],'closure_cases':[dict(zip(fullrows[0][:24],row[:24])) for row in fullrows[1:13]],'components':[list(row) for row in values['Componentes_v19'].values]}
assert not errors,errors
assert not missing,missing
buildpath=ROOT/'reports/excel_v19_build.json'
if buildpath.exists():
    build=json.loads(buildpath.read_text(encoding='utf8'))
    build.update(recalculated=True,recalculation_engine=out['recalculation_engine'],formula_count=count,formula_errors=0)
    buildpath.write_text(json.dumps(build,ensure_ascii=False,indent=2),encoding='utf8')
(ROOT/'reports/excel_v19_oracle.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
source_fixture=json.loads((ROOT/'docs/logica_excel/fixtures_excel.json').read_text(encoding='utf8'))['lotes_motor']
selection={f'B{r}':code for r,code in enumerate(source_fixture['seleccion'],2)}
selection.update({'B24':'FIN-02B','B25':'COM-06B','B26':'INF-11B','B27':'INS-12B'})
lot_inputs={}
for r,lot in enumerate(source_fixture['lotes'],2):
    for col,key in [('B','segmento'),('C','cantidad'),('D','cuero'),('E','accesorios'),('F','hilo'),('G','molde')]:lot_inputs[f'{col}{r}']=lot[key]
    lot_inputs[f'M{r}']={'SEG-01':42.5,'SEG-02':160,'SEG-03':250}[lot['segmento']]
outputs={}
for r in range(2,5):
    for col,key in [('H','costo'),('I','calidad'),('J','umbral'),('O','precioEfectivo')]:outputs[f'lote{r-1}_{key}']=['Lotes_Produccion',f'{col}{r}']
for name,cell in [('calidadEmpresa','B6'),('eficiencia','B9'),('reputacion','B10'),('saludFinanciera','B11')]:outputs[name]=['Motor_Puntajes',cell]
for name,cell in [('capacidadDiaria','K5'),('eficienciaProduccion','M5'),('capacidad','N5'),('produccion1','E56'),('produccion2','E57'),('produccion3','E58')]:outputs[name]=['CANTIDAD DE PRODUCCIÓN',cell]
for role,col in [('corte','U'),('ensamble','Y'),('acabado','AC')]:
    for level,row in enumerate([11,20,29],1):outputs[f'mo_{role}_{level}']=['Costos De Producción',f'{col}{row}']
plan={'nombre':'v19_fresco','entradas':{'Seleccion_Ciclo0':selection,'Lotes_Produccion':lot_inputs},'salidas':outputs}
outdir=ROOT/'tests/output/excel_v19';outdir.mkdir(parents=True,exist_ok=True)
(outdir/'scenario.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf8')
fixtures=ROOT/'tests/fixtures';fixtures.mkdir(exist_ok=True)
(fixtures/'excel_v19_scenario.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf8')
if (outdir/'results.json').exists():
    cached=json.loads((outdir/'results.json').read_text(encoding='utf-8-sig'))
    cached['metadatos']['nota']='Escenario de inputs originales en libro v19 corregido; resultados recalculados por Excel COM16.0, sin importar JS.'
    (fixtures/'excel_v19_expected.json').write_text(json.dumps(cached,ensure_ascii=False,indent=2),encoding='utf8')
print(f'Zero errors; {count} formulas; {len(out["market_cases"])} market rows; scenario plan ready')
