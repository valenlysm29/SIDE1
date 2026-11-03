"""Generate an empty-database CLI installation from preserved SIDE sources.

Only prepares local files. Existing databases and historical migrations remain
untouched. Run Supabase start separately in the printed dedicated workspace.
"""
from pathlib import Path
import json,hashlib,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
PROJECT=ROOT.parents[1] if ROOT.parent.name=='.codex-work' else ROOT
WORK=PROJECT/'.codex-work/side-clean-install'
assert WORK.is_relative_to(PROJECT)
assert not (WORK/'supabase/config.toml').exists() or '--refresh' in sys.argv,'Preserve existing workspace'
folder=WORK/'supabase';folder.mkdir(parents=True,exist_ok=True)
if not (folder/'config.toml').exists():(folder/'config.toml').write_text('project_id = "sidecleanfinal"\n[api]\nport = 33621\n[db]\nport = 33622\nshadow_port = 33620\nmajor_version = 17\n[studio]\nport = 33623\n[inbucket]\nport = 33624\n[analytics]\nport = 33627\n[auth]\nenable_anonymous_sign_ins = true\n',encoding='utf8')
files=json.loads((ROOT/'supabase/bootstrap/manifest.json').read_text(encoding='utf8'))['sources']
assert all((ROOT/f).is_file() for f in files),'Missing baseline source'
cli=ROOT/'node_modules/.bin'/('supabase.cmd' if sys.platform=='win32' else 'supabase')
if '--refresh' not in sys.argv:
 r=subprocess.run([str(cli),'migration','new','side_release_baseline','--workdir',str(WORK)],capture_output=True,text=True)
 assert r.returncode==0,r.stderr
file=next((folder/'migrations').glob('*_side_release_baseline.sql'))
parts=["-- Empty database only.\ndo $$ begin if to_regclass('public.partidas') is not null or to_regclass('public.empresas') is not null then raise exception 'SIDE baseline requires an empty database'; end if; end $$;\n"]
evidence=[]
for name in files:
 raw=(ROOT/name).read_bytes();evidence.append({'path':name,'sha256':hashlib.sha256(raw).hexdigest()})
 text=raw.decode('utf-8-sig').replace('https://plfuwfdpsagzrlveqkvl.supabase.co/functions/v1/side-business-close','http://kong:8000/functions/v1/side-business-close')
 parts.append('\n-- SOURCE '+name+'\n'+text+'\n')
parts.append("select cron.unschedule(jobid) from cron.job where jobname='side-business-close';\nnotify pgrst,'reload schema';\n")
file.write_text(''.join(parts),encoding='utf8')
out=ROOT/'tests/output/finalizacion-integral/clean-install-manifest.json'
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps({'workspace':str(WORK),'migration':file.name,'sources':evidence,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'cronDisabled':True,'productionUrlRewritten':True},indent=2),encoding='utf8')
print('Prepared',len(files),'ordered sources in',WORK)
