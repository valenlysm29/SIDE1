"""Verify remote dump closure fingerprints using only a temporary local table."""
import json,re,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
backup=root.parents[1]/'output/respaldo_rentabilidad_20261102' if root.parent.name=='.codex-work' else root/'output/respaldo_rentabilidad_20261102'
dump=Path(sys.argv[1]).resolve(); assert dump.is_relative_to(backup.resolve())
text=dump.read_text(encoding='utf-8')
block=re.search(r'INSERT INTO "public"\."side_business_closures" [^\n]+\n[\s\S]*?;\n\n',text)
assert block,'Missing complete closure INSERT block'
copy=block.group().replace('INSERT INTO "public"."side_business_closures" ','INSERT INTO pg_temp.audit_dump_closures ',1)
query='create temp table audit_dump_closures as select * from public.side_business_closures with no data;\n'+copy+"select jsonb_agg(jsonb_build_object('partida_id',partida_id,'ciclo',ciclo,'hash',md5(cierre::text)) order by partida_id,ciclo)::text from pg_temp.audit_dump_closures;"
result=subprocess.check_output(['docker','exec','-i','supabase_db_sideprofitfinal','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],input=query,encoding='utf-8')
actual=json.loads(result.strip()); expected=json.loads((backup/'hashes_pre_deploy.json').read_text()); lookup={(x['partida_id'],x['ciclo']):x['hash'] for x in actual}
assert all(lookup.get((x['partida_id'],x['ciclo']))==x['hash'] for x in expected),'Historical closure changed or missing'
out={'method':'remote read-only dump, temporary local table, PostgreSQL md5(cierre::text)','baseline':len(expected),'current':len(actual),'unchanged':len(expected),'added':len(actual)-len(expected),'changed':0}
(root/'tests/output/rentabilidad_final/integridad_posterior.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
