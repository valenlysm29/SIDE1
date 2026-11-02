"""Rebuild the SIDE acceptance stack, never production. Run from SIDE root.

Uses the reviewed bootstrap manifests, with real Supabase Auth and extensions.
No production data is loaded into the API/Edge acceptance database.
"""
from pathlib import Path
import ast, hashlib, json, os, shutil, subprocess, sys, re

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = 'supabase_db_fase01local'
WORK = Path(os.environ['SIDE_FASE01_WORK']).resolve()
assert WORK.is_relative_to(ROOT if ROOT.parent.name != '.codex-work' else ROOT.parents[1])
assert WORK.name == 'fase01-local'
if '--prepare' in sys.argv:
    folder=WORK/'supabase';folder.mkdir(parents=True,exist_ok=True)
    config=folder/'config.toml'
    assert not config.exists(),'Preserve existing local configuration'
    config.write_text('project_id = "fase01local"\n[api]\nport = 33421\n[db]\nport = 33422\nshadow_port = 33420\nmajor_version = 17\n[studio]\nport = 33423\n[inbucket]\nport = 33424\n[analytics]\nport = 33427\n[auth]\nenable_anonymous_sign_ins = true\n',encoding='utf8')
    print('Prepared local-only configuration. Start Supabase here, then run without --prepare.')
    raise SystemExit(0)

def sql(source):
    result = subprocess.run(['docker','exec','-i',CONTAINER,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'], input=source, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode('utf8',errors='replace')[-2500:])

def manifest(file):
    tree = ast.parse((ROOT/'tests'/file).read_text(encoding='utf8'))
    return next(ast.literal_eval(node.value) for node in tree.body if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='files' for t in node.targets))

applied=[]
for file in manifest('p01_http_local_setup.py') + ['supabase/migrations/'+name for name in manifest('history_local_setup.py')] + ['supabase/migrations/20261102054323_fase01_security_paths.sql']:
    source=(ROOT/file).read_bytes()
    if '--scheduler-only' not in sys.argv:
        sql(source)
    applied.append({'path':file,'sha256':hashlib.sha256(source).hexdigest()})
    print('SOURCE' if '--scheduler-only' in sys.argv else 'PASS',file,flush=True)

# Same Vault-backed validator as production. The local scheduler must never
# point to the production URL embedded in the historical scheduling migration.
source=(ROOT/'supabase/migrations/20261028_programar_cierre_edge.sql').read_text(encoding='utf-8-sig')
source=source.replace('https://plfuwfdpsagzrlveqkvl.supabase.co/functions/v1/side-business-close','http://kong:8000/functions/v1/side-business-close')
sql(source.encode())
sql(b"select vault.update_secret(id,'fase01-local-only',name,description) from vault.secrets where name='side_business_cron_token'; select cron.unschedule(jobid) from cron.job where jobname='side-business-close'; notify pgrst,'reload schema';")
tracking_file='supabase/migrations/20261102174348_ejecucion_cierres_verificable.sql'
tracking=(ROOT/tracking_file).read_text(encoding='utf8').replace('https://plfuwfdpsagzrlveqkvl.supabase.co/functions/v1/side-business-close','http://kong:8000/functions/v1/side-business-close')
exists=subprocess.check_output(['docker','exec',CONTAINER,'psql','-U','postgres','-Atc',"select to_regclass('public.side_closure_execution_requests') is not null"],encoding='utf8').strip()
if exists=='t':
    wrapper=re.search(r'create or replace function public.side_invocar_cierre_programado\(\).*?end \$\$;',tracking,re.S)
    assert wrapper,'Missing tracked scheduler wrapper'
    sql(wrapper.group(0).encode())
else:sql(tracking.encode())
applied.append({'path':tracking_file,'sha256':hashlib.sha256((ROOT/tracking_file).read_bytes()).hexdigest()})
functions=WORK/'supabase/functions/side-business-close'
functions.mkdir(parents=True,exist_ok=True)
for file in (ROOT/'supabase/functions/side-business-close').iterdir():
    if file.is_file():shutil.copy2(file,functions/file.name)
config=WORK/'supabase/config.toml'
text=config.read_text(encoding='utf-8-sig')
if '[functions.side-business-close]' not in text:
    config.write_text(text+'\n[functions.side-business-close]\nverify_jwt = false\n',encoding='utf8')
out=ROOT/'tests/output/fase01';out.mkdir(parents=True,exist_ok=True)
(out/'local-manifest.json').write_text(json.dumps(applied,indent=2),encoding='utf8')
print('PASS isolated bootstrap; local Vault configured; cron disabled until explicit test')
