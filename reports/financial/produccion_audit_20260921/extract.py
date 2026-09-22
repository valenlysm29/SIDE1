import json,openpyxl,datetime
from pathlib import Path
p=Path(r'C:/Users/Asus/Downloads/DECISIONES SIDE (14).xlsx')
w=openpyxl.load_workbook(p); v=openpyxl.load_workbook(p,data_only=True)
s=w['CANTIDAD DE PRODUCCIÓN']; z=v[s.title]
def scalar(x):
    if isinstance(x,datetime.datetime): return x.isoformat()
    if isinstance(x,openpyxl.worksheet.formula.ArrayFormula): return {'text':x.text,'ref':x.ref}
    return x
out={'cells':{c.coordinate:{'value':scalar(c.value),'cached':scalar(z[c.coordinate].value),'type':c.data_type,'format':c.number_format} for row in s for c in row if c.value is not None},'sheet':s.title}
Path('source.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
print('Extracted',len(out['cells']),'populated cells;',sum(c['type']=='f' for c in out['cells'].values()),'formulas')
