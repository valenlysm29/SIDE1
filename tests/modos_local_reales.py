"""Primer tramo de seis salas reales; requiere Supabase aislado modos-e2e.

Solo usa Auth y RPC HTTP. No modifica filas por SQL ni simula decisiones.
Los pasos no implementados se informan como pendientes, nunca como aprobados.
"""
import json
import subprocess
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKDIR = '.codex-work/modos-e2e'

def main():
    status = json.loads(subprocess.check_output(['npx.cmd', '--no-install', 'supabase', 'status', '--workdir', WORKDIR, '-o', 'json'], cwd=ROOT, stderr=subprocess.DEVNULL, text=True))
    base, key = status['API_URL'], status['ANON_KEY']
    if base != 'http://127.0.0.1:62321':
        raise RuntimeError('La prueba solo admite la instancia local modos-e2e')

    def request(path, payload, token=None):
        req = urllib.request.Request(base + path, data=json.dumps(payload).encode(), headers={'apikey': key, 'Authorization': 'Bearer ' + (token or key), 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f'{path}: HTTP {exc.code}: {exc.read().decode()}') from exc

    def rpc(name, payload, session):
        result = request('/rest/v1/rpc/' + name, payload, session['access_token'])
        if isinstance(result, dict) and result.get('error'):
            raise RuntimeError(f'{name}: {result}')
        return result

    def teacher():
        return request('/auth/v1/signup', {'email': uuid.uuid4().hex + '@example.test', 'password': 'Local-side-test-123456!', 'data': {'nombre': 'Docente', 'apellido': 'Prueba'}})

    results = []
    for mode in ('manual', 'random', 'balanced'):
        for cycles in (3, 6):
            row = {'mode': mode, 'cycles': cycles, 'companies': 0, 'completed_cycles': 0, 'steps': []}
            try:
                t = teacher()
                assert t.get('access_token'), 'Auth docente no devolvió sesión'
                row['steps'].append('auth_docente')
                cfg = {'lifecycleVersion': 2, 'cycleCloseMode': 'manual', 'cycles': cycles, 'roundHours': 0, 'roundMinutes': 10, 'integrationDurationMinutes': 1, 'enabledEvents': ['PE69', 'PE71', 'PE75'], 'eventRules': {}, 'eventSelectionMode': 'manual', 'randomEventCount': 3, 'economicEventsVersion': 'demand-share-v1', 'challengeModeV1': mode, 'capital': 1000000}
                args = {'p_config': cfg, 'p_nombre': 'Validación ' + mode, 'p_curso': 'Prueba local', 'p_segmento': 'Estandar', 'p_request_id': str(uuid.uuid4()), 'p_reemplazar_id': None}
                game = rpc('crear_sala_docente', args, t)
                assert game.get('id') and game.get('codigo'), game
                assert rpc('crear_sala_docente', args, t)['id'] == game['id']
                row.update(game=game['id'], code=game['codigo'])
                row['steps'].append('creacion_y_reintento')
                ids, sessions = [], []
                for i in range(3):
                    student = request('/auth/v1/signup', {})
                    assert student.get('access_token'), 'Auth estudiante no devolvió sesión'
                    name = f'Empresa {i + 1}'
                    joined = rpc('side_ingresar_empresa_segura', {'p_codigo': game['codigo'], 'p_nombre_legal': name, 'p_nombre_comercial': name, 'p_clave': None}, student)
                    assert joined.get('success'), joined
                    ids.append(joined['empresa_id']); sessions.append(student)
                    row['companies'] += 1
                row['steps'].append('ingreso_tres_empresas')
                save = rpc('controlar_partida', {'p_partida_id': game['id'], 'p_accion': 'guardar', 'p_config': cfg, 'p_expected_round': 1}, t)
                assert save['configuracion']['challengeModeV1'] == mode, save
                row['steps'].append('configuracion_persistida')
                if mode == 'manual':
                    out = rpc('side_assign_event_v1', {'p_partida_id': game['id'], 'p_empresa_id': ids[0], 'p_ciclo': 1, 'p_event_id': 'PE69', 'p_intensity': 2}, t)
                elif mode == 'random':
                    args = {'p_partida_id': game['id'], 'p_source_cycle': 1}
                    out = rpc('side_draw_all_events_v1', args, t)
                    assert rpc('side_draw_all_events_v1', args, t)['reused'] is True
                else:
                    args = {'p_partida_id': game['id'], 'p_ciclo': 1}
                    out = rpc('side_schedule_balanced_v1', args, t)
                    assert len(out['events']) == 3
                    assert rpc('side_schedule_balanced_v1', args, t)['reused'] is True
                row['steps'].append('programacion_modo')
                news = rpc('side_student_events_v1', {'p_partida_id': game['id'], 'p_empresa_id': ids[0]}, sessions[0])
                assert isinstance(news, list)
                row['steps'].append('noticias_estudiante')
                row['pending'] = 'Decisiones y compras por interfaz, recepciones, cierre Edge y avance no implementados en esta prueba.'
            except Exception as exc:
                row['error'] = str(exc)
            results.append(row)
            print(json.dumps(row, ensure_ascii=False), flush=True)
    target = ROOT / 'tests/output/modos_local_reales.json'
    target.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf8')
    return 1 if any('error' in row or row['completed_cycles'] != row['cycles'] for row in results) else 0

if __name__ == '__main__':
    raise SystemExit(main())
