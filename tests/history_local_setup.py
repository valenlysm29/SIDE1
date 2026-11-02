"""Apply additive history dependencies to an existing local-only test stack."""
from pathlib import Path
import subprocess,hashlib,json
root=Path(__file__).resolve().parents[1]
out=root/'tests/output/history';out.mkdir(parents=True,exist_ok=True)
container='supabase_db_sidep01http'
backup=out/'local-before.dump'
if not backup.exists():
 with backup.open('wb') as f:subprocess.run(['docker','exec',container,'pg_dump','-U','postgres','-Fc','postgres'],stdout=f,check=True)
subprocess.run(['docker','exec','-i',container,'pg_restore','--list'],input=backup.read_bytes(),check=True,stdout=subprocess.DEVNULL)
(out/'backup.json').write_text(json.dumps({'container':container,'bytes':backup.stat().st_size,'sha256':hashlib.sha256(backup.read_bytes()).hexdigest()}))
files=['20261027_resultados_en_vivo.sql','supabase_teacher_history.sql','20261031025358_desafios_autoritativos_v1.sql','20261031030035_consulta_privada_desafios.sql','20261031041921_presentaciones_excel_v2.sql','20261031043153_programacion_desafios_autoritativa.sql','20261102015806_side_eventos_historicos_contexto.sql','20261102022758_impedir_avance_sin_cierre.sql','20261102024042_cierre_automatico_secuencial.sql','20261102025853_bloquear_eventos_costos_no_verificados.sql','20261102034926_versionar_worker_cierres.sql','20261102040000_gracia_cierre_secuencial.sql','20261102044053_historical_continuity.sql','20261102044938_atomic_purchase_presentations.sql','20261102051739_closure_processing_status.sql']
for name in files:
 if name=='20261102015806_side_eventos_historicos_contexto.sql':
  exists=subprocess.check_output(['docker','exec',container,'psql','-U','postgres','-Atc',"select to_regprocedure('public.side_legacy_event_context_v1(uuid,bigint,integer)') is not null"],encoding='utf8').strip()
  if exists=='t':continue
 run=subprocess.run(['docker','exec','-i',container,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],input=(root/'supabase/migrations'/name).read_bytes(),capture_output=True)
 print(name,run.returncode,flush=True)
 if run.returncode:raise RuntimeError(run.stderr.decode('utf8',errors='replace'))
subprocess.run(['docker','exec',container,'psql','-U','postgres','-c',"notify pgrst, 'reload schema'"],check=True)
