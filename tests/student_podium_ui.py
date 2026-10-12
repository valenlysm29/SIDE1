"""Render the actual student podium function in Chromium; visibility is server data."""
from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests/output/student-podium';OUT.mkdir(parents=True,exist_ok=True)
source=(ROOT/'js/app.js').read_text(encoding='utf-8')
function=source[source.index('function renderStudentPodium('):source.index('function remoteSnapshot(')]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH','C:/Program Files/Google/Chrome/Application/chrome.exe'))
 page=browser.new_page(viewport={'width':1280,'height':800})
 css=(ROOT/'css/design-system.css').read_text(encoding='utf-8')
 page.set_content('<style>'+css+'</style><main><section id="studentLobby"></section><section id="decisionMenu"></section></main>')
 page.evaluate("window.$=id=>document.getElementById(id)")
 page.add_script_tag(content=function)
 result=page.evaluate('''()=>{
   renderStudentPodium(null);if([...document.querySelectorAll('[data-student-podium]')].some(n=>!n.hidden))throw Error('null must hide');
   window.publication={podium:[{empresa:'Andina <script>bad()</script>',grade:19},{empresa:'Costa',grade:18}],reason:'<img src=x onerror="window.pwned=true"> Justificación docente'};
   renderStudentPodium(publication);
   const panels=[...document.querySelectorAll('[data-student-podium]')],rows=panels.map(n=>n.querySelector('li'));
   renderStudentPodium(publication);
   if(panels.some((n,i)=>n.hidden||n.querySelector('li')!==rows[i]))throw Error('same snapshot reconstructed DOM');
   if(document.querySelectorAll('img').length||window.pwned)throw Error('untrusted HTML executed');
   if(!panels.every(n=>n.textContent.includes(publication.reason)))throw Error('reason was not plain text');
   renderStudentPodium(null);if(panels.some(n=>!n.hidden||n.children.length))throw Error('expired/null leaked content');
   renderStudentPodium(publication);if(panels.some(n=>n.hidden||n.querySelectorAll('li').length!==2))throw Error('same snapshot after transient RPC failure stays empty');
   return {passed:true,panels:panels.length};
 }''')
 page.screenshot(path=str(OUT/'desktop.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(OUT/'mobile.png'),full_page=True)
 (OUT/'result.json').write_text(json.dumps(result))
 browser.close()
print('PASS student server visibility/null/expiry, safe text, stable DOM and retry recovery')
