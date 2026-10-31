"""Inventario de fórmulas y cachés, sin modificar ni recalcular el libro fuente."""
import hashlib, sys
from pathlib import Path
import openpyxl
from openpyxl.worksheet.formula import ArrayFormula, DataTableFormula

source = Path(sys.argv[1])
expected = 'a07710cd97447d0a5f1b79f2e7e200b01565abbf4a8ee3ff02055fa2768189b3'
actual = hashlib.sha256(source.read_bytes()).hexdigest()
if actual != expected:
    raise SystemExit('SHA-256 de libro incorrecto: ' + actual)
formulas = openpyxl.load_workbook(source, data_only=False)
cache = openpyxl.load_workbook(source, data_only=True)
rows = ['# Inventario de fórmulas del Excel V2', '', 'SHA-256: `'+actual+'`.', '',
        'Inventario de fórmulas y valores almacenados; las cachés no constituyen recálculo ni validación de equivalencia.', '']
total = 0
for sheet in formulas:
    cells = [cell for row in sheet for cell in row if cell.data_type == 'f']
    total += len(cells)
    rows += [f'## {sheet.title} — {len(cells)} fórmulas', '', '| Celda | Fórmula | Caché |', '|---|---|---|']
    for cell in cells:
        if isinstance(cell.value, ArrayFormula):
            if not cell.value.text:
                raise ValueError(f'Fórmula matricial sin expresión: {sheet.title}!{cell.coordinate}')
            formula = f'{cell.value.text} [matricial: {cell.value.ref}]'
        elif isinstance(cell.value, DataTableFormula):
            raise ValueError(f'Tabla de datos no compatible: {sheet.title}!{cell.coordinate}')
        elif isinstance(cell.value, str):
            formula = cell.value
        else:
            raise TypeError(f'Tipo de fórmula desconocido: {sheet.title}!{cell.coordinate}: {type(cell.value).__name__}')
        formula = formula.replace('|','\\|').replace('\n',' ')
        value = repr(cache[sheet.title][cell.coordinate].value).replace('|','\\|')
        rows.append(f'| {cell.coordinate} | `{formula}` | {value} |')
    rows.append('')
if total != 586:
    raise SystemExit(f'Inventario inesperado: {total} fórmulas')
out = Path('docs/INVENTARIO_FORMULAS_EXCEL_V2.md')
out.write_text('\n'.join(rows)+'\n', encoding='utf-8')
print(f'{out}: {total} fórmulas inventariadas; no recalculadas')
