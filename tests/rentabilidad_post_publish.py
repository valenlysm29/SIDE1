"""Read-only checks of published frontend and protected closure endpoint."""
import hashlib,json,urllib.request,urllib.error
from pathlib import Path
root=Path(__file__).resolve().parents[1]
base='https://valenlysm29.github.io/SIDE1/'
files=['index.html','docente.html','js/app.js','js/company_summary.js','js/profit_projection.js','js/financial_model.js','css/production.css']
def normalized(s):return s.replace('\r\n','\n').strip()
results=[]
for file in files:
 with urllib.request.urlopen(base+file+'?validacion=606afd9',timeout=30) as response:remote=response.read().decode('utf-8-sig')
 local=(root/file).read_text(encoding='utf-8-sig');assert normalized(remote)==normalized(local),file+' differs from validated candidate'
 results.append({'file':file,'matches':True,'sha256':hashlib.sha256(normalized(remote).encode()).hexdigest()})
endpoint='https://plfuwfdpsagzrlveqkvl.supabase.co/functions/v1/side-business-close'
checks={}
for method,expected in [('GET',405),('POST',401)]:
 try:
  with urllib.request.urlopen(urllib.request.Request(endpoint,method=method),timeout=30) as response:code=response.status
 except urllib.error.HTTPError as error:code=error.code
 assert code==expected,(method,code);checks[method]=code
result={'frontend':base,'files':results,'edgeAuthorization':checks,'financialWrites':False}
(root/'tests/output/rentabilidad_final/publicacion_verificada.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
