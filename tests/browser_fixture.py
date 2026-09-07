"""Isolated DOM fixture: no navigation, network, real accounts or persistent storage.
Load the delivered HTML/CSS/JS in memory, embed existing assets, and provide a
Web Storage-compatible test double. This does not validate Supabase or 3D CDN.
"""
from pathlib import Path
import base64
import json
import mimetypes
import re
from functools import lru_cache
ROOT=Path(__file__).resolve().parents[1]
@lru_cache(maxsize=None)
def asset_uri(relative):
    path=(ROOT/relative).resolve()
    if not path.is_relative_to(ROOT) or not path.is_file():
        return relative
    mime=mimetypes.guess_type(str(path))[0] or 'application/octet-stream'
    return 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode('ascii')
def embed_assets(text):
    return re.sub(r'''(['"])(assets/[^'"\s]+\.(?:png|gif|svg|jpg|webp))\1''',lambda m:m[1]+asset_uri(m[2])+m[1],text)
def document(name, storage=None):
    text=(ROOT/name).read_text()
    text=re.sub(r'<link[^>]*href="https://[^>]+>', '',text)
    text=re.sub(r'<link[^>]*href="([^"\s]+\.css)"[^>]*>',lambda m:'<style>'+embed_assets((ROOT/m[1]).read_text())+'</style>',text)
    def script(m):
        src=m[1]
        if src.startswith('https://'):return ''
        code=embed_assets((ROOT/src).read_text()).replace('</script','<\\/script')
        return '<script>'+code+'</script>'
    text=re.sub(r'<script src="([^"]+)"></script>',script,text)
    text=embed_assets(text)
    seed=json.dumps(storage or {})
    setup='''<script>
    const fixtureData=SEED;
    Object.defineProperty(window,'localStorage',{value:{
      getItem(key){return Object.prototype.hasOwnProperty.call(fixtureData,String(key))?fixtureData[String(key)]:null},
      setItem(key,value){fixtureData[String(key)]=String(value)},
      removeItem(key){delete fixtureData[String(key)]},clear(){for(const key of Object.keys(fixtureData))delete fixtureData[key]},
      key(index){return Object.keys(fixtureData)[index]??null},get length(){return Object.keys(fixtureData).length}
    },configurable:true});
    </script>'''.replace('SEED',seed)
    return text.replace('<head>','<head>'+setup,1)
def load(page,name,storage=None):
    page.set_content(document(name,storage),wait_until='load')
