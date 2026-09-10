"""Run SIDE from this folder without accidentally opening an older server.
Only Python's standard library is required. Local access only, not production.
"""
from __future__ import annotations
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import sys
import webbrowser

ROOT = Path(__file__).resolve().parent
BUILD = '20260910-2'

class SIDEHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        path = urlsplit(self.path).path
        if path.endswith(('.html', '.js', '.css')) or path.endswith('/'):
            self.send_header('Cache-Control', 'no-store')
        self.send_header('X-SIDE-Build', '2026.09.10.2')
        super().end_headers()

def create_server(port: int = 8000) -> ThreadingHTTPServer:
    if not 0 <= port <= 65535:
        raise ValueError('El puerto debe estar entre 0 y 65535.')
    return ThreadingHTTPServer(('127.0.0.1', port), partial(SIDEHandler, directory=str(ROOT)))

def main() -> int:
    parser = argparse.ArgumentParser(description='Iniciar SIDE desde esta carpeta.')
    parser.add_argument('--port', type=int, default=8000, help='Puerto local (por defecto: 8000).')
    parser.add_argument('--no-browser', action='store_true', help='No abrir el navegador automaticamente.')
    args = parser.parse_args()
    try:
        server = create_server(args.port)
    except (OSError, ValueError) as exc:
        print(f'No se pudo iniciar SIDE en el puerto {args.port}: {exc}', file=sys.stderr)
        print('Cierra el servidor anterior (Ctrl+C) y vuelve a ejecutar INICIAR_JUEGO.bat.', file=sys.stderr)
        print('No se ha abierto una pagina de otra carpeta ni se han borrado datos.', file=sys.stderr)
        return 1
    # Binding succeeds BEFORE opening the page; a busy port can never open the old project.
    url = f'http://localhost:{server.server_port}/index.html?v={BUILD}'
    print(f'SIDE v2026.09.10.2\nCarpeta: {ROOT}\nAbrir: {url}\nCtrl+C para detener.')
    if not args.no_browser:
        try:
            webbrowser.open(url)
        except webbrowser.Error as exc:
            print(f'Abre la direccion anterior manualmente: {exc}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServidor detenido.')
    finally:
        server.server_close()
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
