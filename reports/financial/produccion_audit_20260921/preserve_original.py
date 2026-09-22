"""Restore untouched source sheets and their exact styles after artifact export.

This only repairs preservation limitations in the export. All new spreadsheet
content and formulas are authored by artifact-tool and checked in native Excel.
"""
import copy,zipfile
from lxml import etree as E
from pathlib import Path
src=Path(r'C:/Users/Asus/Downloads/DECISIONES SIDE (14).xlsx')
dst=Path('DECISIONES_SIDE_corregido.xlsx')
n='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
q=lambda s:'{'+n+'}'+s
with zipfile.ZipFile(src)as z: original={x:z.read(x)for x in z.namelist()}
with zipfile.ZipFile(dst)as z: final={x:z.read(x)for x in z.namelist()}
os=E.fromstring(original['xl/styles.xml']); ds=E.fromstring(final['xl/styles.xml'])
def ensure(tag):
 e=ds.find(q(tag))
 if e is None:
  e=E.SubElement(ds,q(tag))
 return e
maps={}
for tag in ['fonts','fills','borders','cellStyleXfs','cellXfs','dxfs']:
 target=ensure(tag); source=os.find(q(tag)); offset=len(target)
 maps[tag]={i:offset+i for i in range(len(source)if source is not None else 0)}
 if source is not None:
  for child in source:target.append(copy.deepcopy(child))
 target.set('count',str(len(target)))
fmtMap={}
source=os.find(q('numFmts'));target=ensure('numFmts')
nextId=max([163]+[int(x.get('numFmtId'))for x in target])+1
if source is not None:
 for child in source:
  old=int(child.get('numFmtId')); fmtMap[old]=nextId;new=copy.deepcopy(child);new.set('numFmtId',str(nextId));target.append(new);nextId+=1
target.set('count',str(len(target)))
for tag in ['cellStyleXfs','cellXfs']:
 table=ds.find(q(tag))
 for newId in maps[tag].values():
  xf=table[newId]
  for key,resource in [('fontId','fonts'),('fillId','fills'),('borderId','borders'),('xfId','cellStyleXfs')]:
   if key in xf.attrib:xf.set(key,str(maps[resource][int(xf.get(key))]))
  if 'numFmtId'in xf.attrib:xf.set('numFmtId',str(fmtMap.get(int(xf.get('numFmtId')),int(xf.get('numFmtId')))))
final['xl/styles.xml']=E.tostring(ds,encoding='utf-8',xml_declaration=True)
strings=list(E.fromstring(original['xl/sharedStrings.xml']))if 'xl/sharedStrings.xml'in original else []
for i in [1,2,3,4,5,7,8,9,10]:
 name=f'xl/worksheets/sheet{i}.xml';root=E.fromstring(original[name])
 for cell in root.iter(q('c')):
  if 's'in cell.attrib:cell.set('s',str(maps['cellXfs'][int(cell.get('s'))]))
  if cell.get('t')=='s':
   v=cell.find(q('v'));item=strings[int(v.text)];cell.remove(v);cell.set('t','inlineStr');inline=E.SubElement(cell,q('is'))
   for child in item:inline.append(copy.deepcopy(child))
 for row in root.iter(q('row')):
  if 's'in row.attrib:row.set('s',str(maps['cellXfs'][int(row.get('s'))]))
 for col in root.iter(q('col')):
  if 'style'in col.attrib:col.set('style',str(maps['cellXfs'][int(col.get('style'))]))
 for rule in root.iter(q('cfRule')):
  if 'dxfId'in rule.attrib:rule.set('dxfId',str(maps['dxfs'][int(rule.get('dxfId'))]))
 final[name]=E.tostring(root,encoding='utf-8',xml_declaration=True)
 rel=f'xl/worksheets/_rels/sheet{i}.xml.rels'
 if rel in original:final[rel]=original[rel]
for name,data in original.items():
 if name.startswith(('xl/theme/','xl/comments/','xl/drawings/')):final[name]=data
# Drop any obsolete calculation order cache; Excel rebuilds from formulas.
if 'xl/calcChain.xml'in final:
 del final['xl/calcChain.xml']
 relns='http://schemas.openxmlformats.org/package/2006/relationships'
 relroot=E.fromstring(final['xl/_rels/workbook.xml.rels'])
 for el in list(relroot):
  if el.get('Type','').endswith('/calcChain'):relroot.remove(el)
 final['xl/_rels/workbook.xml.rels']=E.tostring(relroot,encoding='utf-8',xml_declaration=True)
 ct=E.fromstring(final['[Content_Types].xml'])
 for el in list(ct):
  if el.get('PartName')=='/xl/calcChain.xml':ct.remove(el)
 final['[Content_Types].xml']=E.tostring(ct,encoding='utf-8',xml_declaration=True)
with zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED)as z:
 for name,data in final.items():z.writestr(name,data)
print('Restored nine unrelated sheets, formulas, styles and source theme.')
