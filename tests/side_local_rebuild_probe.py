import subprocess,uuid,pathlib,sys
root=pathlib.Path.cwd(); exp=root/'.codex-work/supabase-prueba/supabase/migrations'
name='side_rebuild_'+uuid.uuid4().hex[:10]
def cmd(args, data=None): return subprocess.run(args,input=data,text=True,encoding='utf-8',capture_output=True)
create=cmd(['docker','exec','supabase_db_sideisolated','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c','CREATE DATABASE '+name]);print(create.stderr,create.stdout)
if create.returncode:sys.exit(1)
# Supabase-managed auth schemas must exist before application migrations.
for schema in ['auth','extensions']:
 dump=cmd(['docker','exec','supabase_db_sideisolated','pg_dump','-U','postgres','-d','postgres','--schema-only','--schema',schema,'--no-owner','--no-privileges'])
 if dump.returncode:print(dump.stderr);sys.exit(1)
 load=cmd(['docker','exec','-i','supabase_db_sideisolated','psql','-U','postgres','-d',name,'-v','ON_ERROR_STOP=1'], '\n'.join(line for line in dump.stdout.splitlines() if 'public.crear_perfil_profesor' not in line))
 if load.returncode:print(load.stderr[-2000:]);sys.exit(1)
files=[root/'supabase/local-baseline/01_tablas_preexistentes.sql',root/'supabase/migrations/supabase_migration.sql',root/'supabase/migrations/supabase_game_lifecycle.sql',root/'supabase/migrations/supabase_student_admission.sql',root/'supabase/migrations/20260930_preservar_opciones_decisiones.sql',root/'supabase/migrations/20261009_sala_espera_identidad_exacta.sql',root/'supabase/migrations/2026-10-11_logica_excel.sql',root/'supabase/migrations/2026-10-11_fix_crear_partida.sql',root/'supabase/migrations/2026-10-12_salas_codigo.sql',root/'supabase/migrations/2026-10-12_podio_programado.sql',root/'supabase/migrations/2026-10-21_expulsion_empresa.sql',root/'docs/sql/20261023_despliegue_cierre_v19.sql',root/'supabase/migrations/20261026_cierre_sin_expulsion_automatica.sql',root/'supabase/migrations/20261027_corregir_ventas_generales.sql',root/'supabase/migrations/20261028_cierre_servidor.sql',root/'supabase/migrations/20261028150647_cierre_sin_plan.sql',root/'supabase/migrations/2026-10-11_fix_crear_partida.sql',root/'supabase/migrations/2026-10-12_salas_codigo.sql',root/'supabase/migrations/2026-10-12_podio_programado.sql',root/'supabase/migrations/20261028151956_identidad_estudiante.sql',root/'supabase/migrations/20261028164509_revocar_truncate_publico.sql',root/'supabase/migrations/20261028165552_preservar_inventario_tiendas.sql']
ext=cmd(['docker','exec','supabase_db_sideisolated','psql','-U','postgres','-d',name,'-v','ON_ERROR_STOP=1','-c','CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions'])
if ext.returncode:print(ext.stderr);sys.exit(1)
for f in files:
 print('Applying',f.name,flush=True);r=cmd(['docker','exec','-i','supabase_db_sideisolated','psql','-U','postgres','-d',name,'-v','ON_ERROR_STOP=1'],f.read_text(encoding='utf-8-sig'))
 if r.returncode:print(r.stderr[-2000:]);sys.exit(1)
r=cmd(['docker','exec','-i','supabase_db_sideisolated','psql','-U','postgres','-d',name,'-v','ON_ERROR_STOP=1'],(root/'tests/local_expulsion_probe.sql').read_text(encoding='utf-8-sig'))
if r.returncode:print(r.stderr);sys.exit(1)
print(r.stderr.strip());print('PASS database',name)
