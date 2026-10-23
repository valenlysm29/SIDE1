"""Independent Excel COM oracle. Only ignored output copies are mutated.

Run from SIDE1: python tests/dop_excel_actual_oracle_20261022.py
No JavaScript arithmetic supplies expected values; all values come from Excel.
"""
import hashlib
from datetime import datetime, timezone
import json
import math
import subprocess
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/output/dop-20261022/independent'
ORACLE = ROOT / 'tests/oracle'
SOURCE = ROOT / '.codex-work/DECISIONES_SIDE_16.xlsx'
SHA = '3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1'

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def recalc(name, plan, model):
    plan_path = OUT / (name + '.plan.json')
    result_path = OUT / (name + '.json')
    workbook_path = OUT / (name + '.xlsx')
    write(plan_path, plan)
    subprocess.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass',
                    '-File', str(ORACLE / 'recalcular_com.ps1'), '-Plan', str(plan_path),
                    '-Modelo', str(model), '-LibroSalida', str(workbook_path),
                    '-JsonSalida', str(result_path)], cwd=ROOT, check=True, timeout=180)
    result = read(result_path)
    assert result['metadatos']['version'] == '16.0', result['metadatos']
    assert result['metadatos']['estadoCalculo'] == 0, result['metadatos']
    book = openpyxl.load_workbook(workbook_path, data_only=True)
    errors = [{'sheet': sh.title, 'cell': cell.coordinate, 'error': cell.value}
              for sh in book for row in sh for cell in row if cell.data_type == 'e']
    # COM returns HRESULT integers for errors. Preserve the original COM output,
    # and add Excel's cached error strings instead of interpreting them as numbers.
    cached = {key: book[sh][addr].value for key, (sh, addr) in plan['salidas'].items()}
    book.close()
    write(OUT / (name + '.cached.json'), {'values': cached, 'errors': errors})
    return result, cached, errors

def equal(a, b):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9)
    return a == b

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SHA
    cases = read(ROOT / 'reports/dop_excel_casos_2026-10-22.json')['cases']
    direct = []
    # Baseline and each case use the untouched exact original workbook.
    sample = cases[0]
    fields = [sample['expected_total'], *sample['requirements'], sample['capacity_fixed_example'], *sample['allocations_literal']]
    outputs = {field['cell']: [field['sheet'], field['cell']] for field in fields}
    baseline, _, baseline_errors = recalc('original', {'nombre': 'original_intacto', 'entradas': {}, 'salidas': outputs}, SOURCE)
    for case in cases:
        inputs = {}
        for item in case['inputs']:
            inputs.setdefault(item['sheet'], {})[item['cell']] = item['set_to']
        plan = {'nombre': case['name'], 'entradas': inputs, 'salidas': outputs}
        result, cached, errors = recalc('direct_' + case['name'], plan, SOURCE)
        direct.append({'name': case['name'], 'inputs': case['inputs'], 'values': cached,
                       'metadata': result['metadatos'], 'errors': errors})
    historical = []
    for name in ['base', 'sim2', 'sim2_premium', 'sim1_pipeline', 'sim2_pipeline', 'sim3_pipeline', 'banca_pipeline', 'bancamezcla_pipeline']:
        plan = read(ORACLE / ('escenario_' + name + '.json'))
        model = ORACLE / plan.get('modelo', 'ORACULO_SIDE.xlsx')
        result, cached, errors = recalc('historical_' + name, plan, model)
        expected = read(ORACLE / ('esperado_' + name + '.json'))['valores']
        differences = [{'key': key, 'committed': val, 'recalculated': result['valores'].get(key)}
                       for key, val in expected.items() if not equal(val, result['valores'].get(key))]
        historical.append({'name': name, 'model': str(model.relative_to(ROOT)), 'count': len(expected),
                           'metadata': result['metadatos'], 'differences': differences, 'errors': errors})
    summary = {'source_sha256': SHA, 'original_metadata': baseline['metadatos'],
               'original_errors': baseline_errors, 'direct': direct, 'historical': historical,
               'historical_total': sum(row['count'] for row in historical),
               'historical_differences': sum(len(row['differences']) for row in historical)}
    write(OUT / 'summary.json', summary)
    fixture_path = ORACLE / 'dop_cantidad_20261022.json'
    # This is a separate compact, versionable fixture, never an overwrite of
    # historical expected files. Preserve any older fixture before refreshing.
    if fixture_path.exists():
        (OUT / ('dop_fixture_backup_' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.json')).write_bytes(fixture_path.read_bytes())
    fixture = {'provenance': {'generated_at': datetime.now(timezone.utc).isoformat(),
               'source': str(SOURCE.relative_to(ROOT)), 'source_sha256': SHA,
               'engine': 'Microsoft Excel COM', 'version': '16.0', 'calculation_state': 0,
               'runner': str(Path(__file__).relative_to(ROOT)),
               'direct_cells': outputs,
               'note': 'Actual CalculateFullRebuild results; historical workbooks contain documented oracle extensions.'},
               'summary': summary,
               'records': {'historical_' + row['name'] + '.json': {'valores': read(OUT / ('historical_' + row['name'] + '.json'))['valores']}
                           for row in historical}}
    write(fixture_path, fixture)
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SHA
    print(json.dumps({'direct': len(direct), 'historical': len(historical),
                      'historical_total': summary['historical_total'],
                      'historical_differences': summary['historical_differences']}, indent=2), flush=True)
    assert summary['historical_total'] == 3104
    assert summary['historical_differences'] == 0

if __name__ == '__main__':
    main()
