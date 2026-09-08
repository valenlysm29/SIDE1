"""Validate local serving and the busy-port guard without opening a browser."""
import sys
import unittest
from pathlib import Path
from threading import Thread
from urllib.request import urlopen
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from servidor_local import create_server

class LocalServerTest(unittest.TestCase):
    def setUp(self):
        self.server=create_server(0)
        self.thread=Thread(target=self.server.serve_forever,daemon=True)
        self.thread.start()
        self.base=f'http://127.0.0.1:{self.server.server_port}'
    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
    def test_entry_and_versioned_resources(self):
        for path,needle in [('index.html?v=20260908-2','class="lobby-actions"'),('app.js?v=20260908-2','function renderChannelChoices'),('styles.css?v=20260908-2','#studentLobby .lobby-actions'),('production_model.js?v=20260908-2','MOLD_REQUIREMENTS'),('responsive.css?v=20260908-2','CAPA RESPONSIVE GLOBAL')]:
            with urlopen(self.base+'/'+path,timeout=5) as response:
                self.assertEqual(response.status,200)
                self.assertEqual(response.headers['Cache-Control'],'no-store')
                self.assertEqual(response.headers['X-SIDE-Build'],'2026.09.08.2')
                self.assertIn(needle,response.read().decode())
    def test_busy_port_does_not_bind_another_server(self):
        with self.assertRaises(OSError):
            create_server(self.server.server_port)

if __name__=='__main__': unittest.main(verbosity=2)
