import copy,zipfile
from pathlib import Path
from lxml import etree as E
p=Path('DECISIONES_SIDE_corregido.xlsx');n='http://schemas.openxmlformats.org/spreadsheetml/2006/main';q=lambda x:'{'+n+'}'+x
with zipfile.ZipFile(p)as z:data={x:z.read(x)for x in z.namelist()}
root=E.fromstring(data['xl/worksheets/sheet5.xml']);styles=E.fromstring(data['xl/styles.xml']);xfs=styles.find(q('cellXfs'));done={}
for c in root.iter(q('c')):
 if c.get('r')not in ['A11','A15','A19','A23']:continue
 old=int(c.get('s','0'))
 if old not in done:
  xf=copy.deepcopy(xfs[old]);al=xf.find(q('alignment'))
  if al is None:al=E.SubElement(xf,q('alignment'))
  al.set('textRotation','90');done[old]=len(xfs);xfs.append(xf)
 c.set('s',str(done[old]))
xfs.set('count',str(len(xfs)))
data['xl/styles.xml']=E.tostring(styles,encoding='utf-8',xml_declaration=True)
data['xl/worksheets/sheet5.xml']=E.tostring(root,encoding='utf-8',xml_declaration=True)
with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED)as z:
 for name,content in data.items():z.writestr(name,content)
print('Preserved four original rotated labels; no values or formulas changed.')
