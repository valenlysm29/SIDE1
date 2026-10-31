"""Serve the experimental game against the isolated local Supabase instance."""
import json
import os
import subprocess
import sys
from functools import partial
from urllib.parse import urlsplit
from servidor_local import ROOT, SIDEHandler, SIDEServer

WORKDIR = '.codex-work/aceptacion-modos'
PORT = 8099

def main():
    try:
        command = ['npx.cmd', '--no-install', 'supabase']
        try:
            raw = subprocess.check_output(command + ['status', '--workdir', WORKDIR, '-o', 'json'], cwd=ROOT, stderr=subprocess.DEVNULL, text=True)
        except subprocess.CalledProcessError:
            print('Iniciando Supabase experimental local...', flush=True)
            subprocess.check_output(command + ['start', '--workdir', WORKDIR, '--exclude', 'realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor'], cwd=ROOT, stderr=subprocess.DEVNULL, text=True)
            raw = subprocess.check_output(command + ['status', '--workdir', WORKDIR, '-o', 'json'], cwd=ROOT, stderr=subprocess.DEVNULL, text=True)
        status = json.loads(raw)
        if status['API_URL'] != 'http://127.0.0.1:59321':
            raise ValueError('La instancia no es la instancia experimental local.')
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as exc:
        print(f'Inicia primero Supabase local experimental: {exc}', file=sys.stderr)
        return 1

    config = json.dumps({'SUPABASE_URL': status['API_URL'], 'SUPABASE_PUBLISHABLE_KEY': status['ANON_KEY'], 'LOCAL_EXPERIMENTAL_EVENTS': True})
    class Handler(SIDEHandler):
        def do_GET(self):
            if urlsplit(self.path).path == '/js/config.js':
                body = ('window.SIDE_CONFIG = ' + config + ';').encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/javascript; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                super().do_GET()

    try:
        server = SIDEServer(('127.0.0.1', PORT), partial(Handler, directory=str(ROOT)))
    except OSError as exc:
        print(f'No se pudo abrir el puerto experimental: {exc}', file=sys.stderr)
        return 1
    env = os.environ.copy()
    env.update(SUPABASE_URL=status['API_URL'], SUPABASE_SERVICE_ROLE_KEY=status['SERVICE_ROLE_KEY'])
    worker = subprocess.Popen(['node', 'services/business_worker.cjs'], cwd=ROOT, env=env)
    print(f'SIDE experimental: http://localhost:{PORT}/index.html (Ctrl+C para terminar)', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        worker.terminate()
        worker.wait(timeout=10)
        server.server_close()
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
