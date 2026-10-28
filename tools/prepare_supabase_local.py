"""Prepare an isolated local Supabase CLI project; never use against a linked project.
The manifest intentionally mirrors the experimental SQL probe; it is not the complete historical migration set.
"""
from pathlib import Path
import argparse,re
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--name',default='side-cli-verificacion');p.add_argument('--port',type=int,default=55320);args=p.parse_args()
if not re.fullmatch(r'[a-z][a-z0-9-]{0,35}',args.name):raise SystemExit('Use a simple local project name.')
if not 1024<=args.port<=65520:raise SystemExit('Invalid base port')
work=root/'.codex-work'/args.name;folder=work/'supabase'; migrations=folder/'migrations'
migrations.mkdir(parents=True,exist_ok=False)
source=(root/'tests/side_local_rebuild_probe.py').read_text(encoding='utf8')
match=re.search(r'^files=\[(.*)\]$',source,re.M)
if not match:raise SystemExit('Missing verified experimental manifest')
files=re.findall(r"root/'([^']+)'",match.group(1))
if len(files)!=22:raise SystemExit('Unexpected manifest length; review before proceeding')
folder.joinpath('config.toml').write_text(f'''project_id = "{args.name.replace('-', '')}"\n[api]\nport = {args.port+1}\n[db]\nport = {args.port+2}\nshadow_port = {args.port}\nmajor_version = 17\n[studio]\nport = {args.port+3}\n[inbucket]\nport = {args.port+4}\n[analytics]\nport = {args.port+7}\n[auth]\nenable_anonymous_sign_ins = true\n''',encoding='utf8')
migrations.joinpath('20260101000000_extensions.sql').write_text('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;\n',encoding='utf8')
for i,path in enumerate(files,1):
 source_path=(root/path).resolve()
 if not source_path.is_relative_to(root):raise SystemExit('Invalid source path')
 migrations.joinpath(f'20260101{i:06}_local.sql').write_text('-- Local source: '+path+'\n'+source_path.read_text(encoding='utf-8-sig'),encoding='utf8')
work.joinpath('manifest.txt').write_text('\n'.join(files)+'\n',encoding='utf8')
print(f'Created experimental local workspace {work}. Run supabase start --workdir {work}.')
