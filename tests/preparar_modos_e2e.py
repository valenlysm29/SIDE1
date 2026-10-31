"""Prepare a fresh isolated Supabase project, never resetting an existing one."""
import ast
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAME = os.environ.get('SIDE_E2E_PROJECT', 'cierres-e2e')
PORT_PREFIX = os.environ.get('SIDE_E2E_PORT_PREFIX', '6432')
if not re.fullmatch(r'cierres-e2e[a-z0-9-]{0,12}', NAME) or not re.fullmatch(r'6[0-9]{3}', PORT_PREFIX):
    raise SystemExit('Proyecto o puerto no permitido')
WORK = ROOT / '.codex-work' / NAME
CONTAINER = 'supabase_db_' + NAME

def run(args, **kwargs):
    return subprocess.run(args, cwd=ROOT, check=True, text=True, encoding='utf8', **kwargs)

def main():
    if WORK.exists():
        raise SystemExit(f'El directorio {WORK} ya existe; se conserva sin cambios.')
    existing = subprocess.check_output(['docker','ps','-a','--filter','name=^/'+CONTAINER+'$','--format','{{.Names}}'], cwd=ROOT, text=True, encoding='utf8').strip()
    if existing:
        raise SystemExit(f'El contenedor {CONTAINER} ya existe; se conserva sin cambios.')
    WORK.mkdir(parents=True)
    run(['npx.cmd', '--no-install', 'supabase', 'init', '--workdir', str(WORK)])
    config = WORK / 'supabase' / 'config.toml'
    text = config.read_text(encoding='utf8').replace('5432', PORT_PREFIX).replace('enable_anonymous_sign_ins = false', 'enable_anonymous_sign_ins = true').replace('inspector_port = 8083', 'inspector_port = 8189')
    config.write_text(text, encoding='utf8')
    dest = WORK / 'supabase' / 'functions'
    dest.mkdir()
    shutil.copytree(ROOT / 'supabase/functions/side-business-close', dest / 'side-business-close')
    run(['npx.cmd', '--no-install', 'supabase', 'start', '--workdir', str(WORK), '--exclude', 'realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor'], stdout=subprocess.DEVNULL)
    status = json.loads(subprocess.check_output(['npx.cmd', '--no-install', 'supabase', 'status', '--workdir', str(WORK), '-o', 'json'], cwd=ROOT, stderr=subprocess.DEVNULL, text=True))
    if status['API_URL'] != 'http://127.0.0.1:' + PORT_PREFIX + '1':
        raise RuntimeError('Puerto local inesperado; no se aplicaron migraciones')
    tree = ast.parse((ROOT / 'tests/p01_http_local_setup.py').read_text(encoding='utf8'))
    files = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'files' for t in n.targets))
    extra = ['20261031025358_desafios_autoritativos_v1','20261031030035_consulta_privada_desafios','20261031041921_presentaciones_excel_v2','20261031043153_programacion_desafios_autoritativa','20261031050037_eventos_grupales_mercado_v1','20261031055001_mercado_global_escenarios_v2','20261031055442_eventos_productivos_v2','20261031060031_eventos_atractivo_duracion_v2','20261031060810_proteger_programacion_desafios','20261031144757_programacion_equilibrada_v2','20261031150049_modo_desafios_v1','20261031150305_ampliar_rotacion_empresas','20261031161309_presentaciones_confirmacion_atomica']
    files += [f'supabase/migrations/{name}.sql' for name in extra]
    for file in files:
        print('Aplicando', file, flush=True)
        run(['docker','exec','-i',CONTAINER,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-q'], input=(ROOT / file).read_text(encoding='utf-8-sig'), stdout=subprocess.DEVNULL)
    source = (ROOT / 'supabase/migrations/20261028_programar_cierre_edge.sql').read_text(encoding='utf8')
    source = source[:source.index('create or replace function public.side_invocar_cierre_programado()')] + '\ncommit;'
    run(['docker','exec','-i',CONTAINER,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-q'], input=source, stdout=subprocess.DEVNULL)
    print('Instancia aislada preparada; no se han creado partidas.', flush=True)

if __name__ == '__main__':
    main()
