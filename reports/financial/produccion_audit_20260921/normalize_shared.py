import json,zipfile,xml.etree.ElementTree as ET
from pathlib import Path
source=Path(r'C:/Users/Asus/Downloads/DECISIONES SIDE (14).xlsx')
cells=json.loads(Path('source.json').read_text(encoding='utf8'))['cells']
ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
ET.register_namespace('',ns)
with zipfile.ZipFile(source) as zin,zipfile.ZipFile('normalized_source.xlsx','w',zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data=zin.read(item.filename)
        if item.filename=='xl/worksheets/sheet6.xml':
            root=ET.fromstring(data); count=0
            for cell in root.iter('{'+ns+'}c'):
                address=cell.get('r'); spec=cells.get(address)
                if spec and spec['type']=='f':
                    f=cell.find('{'+ns+'}f')
                    if f is None: f=ET.SubElement(cell,'{'+ns+'}f')
                    if f.get('t')=='shared': count+=1
                    f.attrib.clear(); f.text=spec['value'][1:]
            data=ET.tostring(root,encoding='utf-8',xml_declaration=True)
            print('Expanded shared formula records:',count)
        zout.writestr(item,data)
