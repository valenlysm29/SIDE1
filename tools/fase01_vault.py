"""Protect/restore the dedicated cron token with Windows DPAPI, without logs.

python tools/fase01_vault.py backup|restore <backup-directory> [local-database]
DPAPI recovery needs this Windows account/machine. On another host the dedicated
token can instead be rotated after restore: the scheduler reads it from Vault.
"""
from pathlib import Path
import ctypes,hashlib,json,subprocess,sys
from ctypes import wintypes

ROOT=Path(__file__).resolve().parents[1]
PROJECT=ROOT.parents[1] if ROOT.parent.name=='.codex-work' else ROOT
mode=sys.argv[1];folder=Path(sys.argv[2]).resolve()
assert mode in ('backup','restore') and folder.is_relative_to(PROJECT)
folder.mkdir(parents=True,exist_ok=True)
class Blob(ctypes.Structure):
    _fields_=[('size',wintypes.DWORD),('data',ctypes.POINTER(ctypes.c_char))]
def dpapi(data,protect):
    buffer=ctypes.create_string_buffer(data)
    source=Blob(len(data),ctypes.cast(buffer,ctypes.POINTER(ctypes.c_char)));target=Blob()
    fn=ctypes.windll.crypt32.CryptProtectData if protect else ctypes.windll.crypt32.CryptUnprotectData
    if not fn(ctypes.byref(source),None,None,None,None,0,ctypes.byref(target)):
        raise ctypes.WinError()
    try:return ctypes.string_at(target.data,target.size)
    finally:ctypes.windll.kernel32.LocalFree(target.data)

protected=folder/'vault-token.dpapi'
if mode=='backup':
    assert not protected.exists(),'Preserve encrypted backups; use a new directory'
    query="select decrypted_secret as token from vault.decrypted_secrets where name='side_business_cron_token'"
    result=subprocess.run([str(PROJECT/'node_modules/.bin/supabase.cmd'),'db','query','--linked','--project-ref','plfuwfdpsagzrlveqkvl',query,'--output','json'],capture_output=True)
    assert result.returncode==0,'Vault export unavailable'
    rows=json.loads(result.stdout)['rows'];assert len(rows)==1 and rows[0]['token']
    token=rows[0]['token'].encode();protected.write_bytes(dpapi(token,True))
else:
    db=sys.argv[3] if len(sys.argv)>3 else 'fase01_restore2'
    assert db.startswith('fase01_restore') and db.replace('_','').isalnum()
    token=dpapi(protected.read_bytes(),False)
    escaped=token.decode().replace("'","''")
    query=f"begin; delete from vault.secrets where name='side_business_cron_token'; select vault.create_secret('{escaped}','side_business_cron_token','Restored dedicated scheduler token'); commit;"
    result=subprocess.run(['docker','exec','-i','supabase_db_fase01local','psql','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1','-q'],input=query.encode(),capture_output=True)
    assert result.returncode==0,'Local Vault restoration failed'
(folder/('vault-'+mode+'.json')).write_text(json.dumps({'mode':mode,'fingerprint':hashlib.md5(token).hexdigest(),'protection':'Windows DPAPI CurrentUser','portable':False},indent=2))
print('PASS Vault',mode,': token protected; no plaintext in logs')
