'use strict';
// Read-only checks: never create games, companies, decisions or sessions.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/config.js'), 'utf8'), context);
const config = context.window.SIDE_CONFIG;
const routes = [
  ['auth_health', '/auth/v1/health'],
  ['admission_features', '/rest/v1/rpc/side_admission_features'],
  ['excel_features', '/rest/v1/rpc/side_excel_features'],
  ['catalog', '/rest/v1/decisiones_catalogo?select=id,decision_id&activo=eq.true'],
  ['options', '/rest/v1/decisiones_opciones?select=id,decision_id,opcion_id&activo=eq.true'],
  ['roster_schema', '/rest/v1/participantes?select=id,empresa_id,puntaje_docente,last_seen_at&limit=0'],
  ['room_schema', '/rest/v1/partidas?select=id,codigo,estado,configuracion&limit=0'],
  ['invalid_room_status', '/rest/v1/rpc/side_estado_codigo_sala?p_codigo=SIDE-AUDIT-NONEXISTENT-20261013'],
  ['podium_invalid_identity', '/rest/v1/rpc/side_podio_estudiante?p_codigo=SIDE-AUDIT-NONEXISTENT-20261013&p_nombre_legal=&p_nombre_comercial='],
  ['teacher_anonymous_denial', '/rest/v1/rpc/obtener_sala_docente']
];
(async () => {
  const checks = await Promise.all(routes.map(async ([name, route]) => {
    const start = Date.now();
    try {
      const response = await fetch(config.SUPABASE_URL + route, {
        headers: { apikey: config.SUPABASE_PUBLISHABLE_KEY, Origin: 'http://127.0.0.1:8000' },
        signal: AbortSignal.timeout(20000)
      });
      const raw = await response.text();
      let body; try { body = JSON.parse(raw); } catch { body = raw.slice(0, 250); }
      return { name, status: response.status, ms: Date.now() - start, cors: response.headers.get('access-control-allow-origin'), body };
    } catch (error) { return { name, ms: Date.now() - start, error: error.message, cause: error.cause?.message }; }
  }));
  const result = { checkedAt: new Date().toISOString(), project: config.SUPABASE_URL, checks };
  fs.writeFileSync(path.join(root, 'tests/output/supabase-live-2026-10-13.json'), JSON.stringify(result, null, 2));
  for (const check of checks) console.log(check.name, check.status || check.error, check.ms + 'ms', Array.isArray(check.body) ? check.body.length + ' rows' : JSON.stringify(check.body));
})().catch(error => { console.error(error); process.exitCode = 1; });
