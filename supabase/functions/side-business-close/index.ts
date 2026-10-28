import { runOnce, remoteRpc } from './runtime.mjs';

// Supabase provides these credentials inside the function; never sent to clients.
const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!url || !serviceKey) return new Response('Server configuration unavailable', { status: 503 });
  const token = request.headers.get('x-side-cron-token');
  if (!token || token.length > 256) return new Response('Unauthorized', { status: 401 });
  const rpc = remoteRpc(url, serviceKey);
  try {
    // Token is dedicated to this job, generated and retained inside Vault.
    const auth = await rpc('side_validar_token_cierre', { p_token: token });
    if (auth.error) return new Response('Authorization unavailable', { status: 503 });
    if (auth.data !== true) return new Response('Unauthorized', { status: 401 });
    const results = await runOnce(rpc, { deadline: Date.now() + 45000 });
    console.log(JSON.stringify({ job: 'side-business-close', results }));
    return Response.json({ success: results.every((r: { success: boolean }) => r.success), results });
  } catch (error) {
    console.error('side-business-close:', error instanceof Error ? error.message : 'Unknown error');
    return new Response('Closure processing failed; scheduled retry will follow', { status: 503 });
  }
});
