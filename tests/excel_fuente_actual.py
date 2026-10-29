"""Recalcula la fuente suministrada en una copia; jamás escribe el original."""
import hashlib, json, os, subprocess
from pathlib import Path
import openpyxl

root = Path(__file__).resolve().parents[1]
source = Path(os.environ.get('SIDE_EXCEL_SOURCE', str(Path.home() / 'Downloads' / 'SIDE_prueba_cantidad_produccion.xlsx')))
out = root / 'tests' / 'output' / 'excel_fuente_actual'
out.mkdir(parents=True, exist_ok=True)
data = source.read_bytes()
digest = hashlib.sha256(data).hexdigest()
source_copy = out / 'fuente_inmutable.xlsx'
source_copy.write_bytes(data)
wb = openpyxl.load_workbook(source_copy, read_only=True, data_only=False)
name = next(sheet for sheet in wb.sheetnames if sheet.startswith('Costos De'))
wb.close()
cells = ['M5','N5','I8','I14','I20','L10','D46','D47','D48','E46','E47','E48','H49','I49','J49','L49','M49','N49']
plan = {'nombre':'fuente_actual_original','entradas':{},'salidas':{c:[name,c] for c in cells}}
plan_path=out/'escenario.json'
plan_path.write_text(json.dumps(plan,ensure_ascii=False),encoding='utf-8')
subprocess.run(['powershell','-NoProfile','-ExecutionPolicy','Bypass','-File',str(root/'tests/oracle/recalcular_com.ps1'),'-Plan',str(plan_path),'-Modelo',str(source_copy),'-LibroSalida',str(out/'original_recalculado.xlsx'),'-JsonSalida',str(out/'original_recalculado.json')],cwd=root,check=True)
result=json.loads((out/'original_recalculado.json').read_text(encoding='utf-8-sig'))
print(json.dumps({'sha256':digest,'sheet':name,'values':result['valores'],'calculationState':result['metadatos']['estadoCalculo']},ensure_ascii=False))
if hashlib.sha256(source.read_bytes()).hexdigest()!=digest:
    raise RuntimeError('La fuente cambió durante la prueba; no se puede asegurar equivalencia.')
