import json,openpyxl,copy
from pathlib import Path
a=openpyxl.load_workbook(r'C:/Users/Asus/Downloads/DECISIONES SIDE (14).xlsx')
b=openpyxl.load_workbook('DECISIONES_SIDE_corregido.xlsx')
v=openpyxl.load_workbook('DECISIONES_SIDE_corregido.xlsx',data_only=True)
def cv(c):
 if isinstance(c.value,openpyxl.worksheet.formula.ArrayFormula):return(c.value.text,c.value.ref)
 return c.value
def visual(c,attr):
 value=copy.copy(getattr(c,attr))
 if attr=='font':value.scheme=None
 if attr=='fill' and value.patternType=='solid':value.bgColor=value.fgColor
 return value
changes=[]; formats=[]
for s in a:
 if s.title=='CANTIDAD DE PRODUCCIÓN':continue
 t=b[s.title]
 for row in s:
  for c in row:
   d=t[c.coordinate]
   if cv(c)!=cv(d):changes.append((s.title,c.coordinate,str(cv(c)),str(cv(d))))
   if c.value is not None and any(visual(c,attr)!=visual(d,attr)for attr in ['font','fill','alignment','number_format']):formats.append((s.title,c.coordinate))
 print(s.title,'validations',len(s.data_validations.dataValidation),len(t.data_validations.dataValidation),'charts',len(s._charts),len(t._charts),'merges',list(s.merged_cells.ranges)==list(t.merged_cells.ranges),'hidden',s.sheet_state==t.sheet_state)
print('UNRELATED VALUES/FORMULAS CHANGES',changes[:10],len(changes))
print('STYLE DIFFERENCES',formats[:10],len(formats))
print('FINAL RESULTS',[(x,v['CANTIDAD DE PRODUCCIÓN'][x].value)for x in ['Q11','N5','G75','J128','J141','J154']])
print('INVENTORY',[(f'G{r}',v['CANTIDAD DE PRODUCCIÓN'][f'G{r}'].value) for r in range(63,72)])
assert not changes
assert not formats
assert v['CANTIDAD DE PRODUCCIÓN']['Q11'].value==397
errors=[(s.title,c.coordinate,c.value)for s in v for row in s for c in row if c.data_type=='e']
print('ERRORS',errors)
assert not any(x[0]=='CANTIDAD DE PRODUCCIÓN' for x in errors)
