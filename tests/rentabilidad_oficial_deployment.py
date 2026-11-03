import urllib.request,json,hashlib,concurrent.futures
from rentabilidad_oficial_setup import ROOT,OUT
BASE='https://valenlysm29.github.io/SIDE1/'
def check(name):
 with urllib.request.urlopen(BASE+name+'?qa=8cd602a',timeout=30) as r:raw=r.read().decode('utf8').replace('\r\n','\n');status=r.status
 expected=(ROOT/name).read_text(encoding='utf8').replace('\r\n','\n')
 return {'path':name,'httpStatus':status,'matchesMain':raw==expected,'sha256':hashlib.sha256(raw.encode()).hexdigest()}
if __name__=='__main__':
 files=['index.html','docente.html','services/finance_config.js','js/engine/cierre.js','services/official_history.js','js/app.js','js/docente.js','js/laboratorio.js']
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=list(pool.map(check,files))
 (OUT/'deployment.json').write_text(json.dumps({'url':BASE,'commit':'8cd602a','files':rows},indent=2))
 print(json.dumps(rows));assert all(x['matchesMain'] for x in rows)
