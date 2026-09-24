/**
 * partida_service.js
 * ---------------------------------------------------------------------------
 * Servicio de partidas (sesiones de juego del profesor).
 *
 * Responsabilidad ÚNICA: operaciones sobre la tabla `partidas` y sus RPCs.
 * No toca empresas, decisiones ni UI.
 *
 * Funciones:
 *   - buscarPorCodigo(codigo)        → RPC buscar_partida_por_codigo
 *   - crear(datos)                   → INSERT en partidas
 *   - avanzarCiclo(partidaId)        → RPC avanzar_ciclo
 *   - finalizar(partidaId)           → estado 'finalizada' (libera el cupo)
 *   - listarParticipantes(partidaId) → participantes + empresa de la partida
 *
 * Todas retornan { success: boolean, data?: any, error?: string }.
 * Si Supabase no está disponible retornan { success: false, offline: true }.
 *
 * @module services/partida_service
 */
(function initPartidaService(global) {
  'use strict';

  /** @returns {object|null} Cliente Supabase o null si offline. */
  function client() {
    const c = global.SIDE && global.SIDE.SupabaseClient
      ? global.SIDE.SupabaseClient.get()
      : null;
    return c;
  }

  /** Respuesta estándar cuando no hay conexión. */
  function offline() {
    return { success: false, offline: true, error: 'Supabase no disponible (modo local).' };
  }

  /**
   * Busca una partida en estado 'esperando' por su código (ej. SIDE-4821).
   * @param {string} codigo Código de partida.
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   *   data = { id, codigo, nombre, curso, estado, segmento } o null si no existe.
   */
  async function buscarPorCodigo(codigo) {
    const sb = client();
    if (!sb) return offline();
    const code = String(codigo || '').trim().toUpperCase();
    if (!code) return { success: false, error: 'Código vacío.' };
    try {
      const { data, error } = await sb.rpc('buscar_partida_por_codigo', { p_codigo: code });
      if (error) return { success: false, error: error.message };
      const found = Array.isArray(data) ? data[0] : data;
      return { success: true, data: found || null };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  /**
   * Crea una partida nueva para el profesor autenticado.
   * @param {object} datos { nombre, curso, segmento?, configuracion?, eventos_habilitados? }
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   *   data = fila creada (incluye id y codigo generado SIDE-XXXX).
   */
  async function crear(datos) {
    const sb = client();
    if (!sb) return offline();
    const d = datos || {};
    if (!d.nombre) return { success: false, error: 'Falta el nombre de la partida.' };
    try {
      const { data: userData, error: userError } = await sb.auth.getUser();
      if (userError || !userData || !userData.user) {
        return { success: false, error: 'Debes iniciar sesión como profesor.' };
      }
      if(d.configuracion?.lifecycleVersion===2){
        // Read-only readiness check: do not leave an unusable lobby in an old DB.
        const {error:readinessError}=await sb.rpc('controlar_partida',{p_partida_id:null,p_accion:'sincronizar'});
        if(readinessError)return {success:false,error:/PGRST202|42883/.test(readinessError.code||'')?'Aplica docs/supabase_game_lifecycle.sql en Supabase antes de crear partidas.':readinessError.message};
      }
      const payload = {
        profesor_id: userData.user.id,
        nombre: d.nombre,
        curso: d.curso || null,
        segmento: d.segmento || 'Estandar',
        configuracion: d.configuracion || {},
        eventos_habilitados: d.eventos_habilitados || []
      };
      const { data, error } = await sb.from('partidas').insert(payload).select().single();
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  /**
   * Avanza el ciclo de todas las empresas de una partida (solo el dueño).
   * @param {string} partidaId UUID de la partida.
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   *   data = { success: true, nuevo_ciclo: number }.
   */
  async function avanzarCiclo(partidaId) {
    const sb = client();
    if (!sb) return offline();
    if (!partidaId) return { success: false, error: 'Falta partidaId.' };
    try {
      const { data, error } = await sb.rpc('avanzar_ciclo', { p_partida_id: partidaId });
      if (error) return { success: false, error: error.message };
      if (data && data.error) return { success: false, error: data.error };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  /**
   * Lista los participantes de una partida con los datos de su empresa.
   * Requiere sesión de profesor dueño (RLS "profesor ve participantes").
   * @param {string} partidaId UUID de la partida.
   * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
   *   data = [{ id, nombre, empresa, empresa_id,
   *             empresas: { id, nombre_legal, nombre_comercial,
   *                         caja_actual, ciclo_actual, reputacion } }].
   */
  async function listarParticipantes(partidaId) {
    const sb = client();
    if (!sb) return offline();
    if (!partidaId) return { success: false, error: 'Falta partidaId.' };
    try {
      let { data, error } = await sb
        .from('participantes')
        .select('id, nombre, empresa, empresa_id, puntaje_docente, empresas(id, nombre_legal, nombre_comercial, caja_actual, ciclo_actual, reputacion)')
        .eq('partida_id', partidaId)
        .order('created_at', { ascending: true });
      if(error&&/puntaje_docente/.test(error.message||'')){
        ({data,error}=await sb.from('participantes').select('id, nombre, empresa, empresa_id, empresas(id, nombre_legal, nombre_comercial, caja_actual, ciclo_actual, reputacion)').eq('partida_id',partidaId).order('created_at',{ascending:true}));
      }
      if (error) return { success: false, error: error.message };
      return { success: true, data: data || [] };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  /**
   * Marca una partida como finalizada (libera el cupo de partida única).
   * Solo el profesor dueño puede (RLS "profesor actualiza sus partidas").
   * @param {string} partidaId UUID de la partida.
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function finalizar(partidaId) {
    const sb = client();
    if (!sb) return offline();
    if (!partidaId) return { success: false, error: 'Falta partidaId.' };
    try {
      const { error } = await sb.from('partidas').update({ estado: 'finalizada' }).eq('id', partidaId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  /**
   * Lee una partida por id (para validar si sigue activa).
   * Solo el profesor dueño puede (RLS "profesor ve sus partidas").
   * @param {string} partidaId UUID de la partida.
   * @returns {Promise<{success: boolean, data?: object|null, error?: string}>}
   *   data = { id, codigo, nombre, curso, estado } o null si no existe.
   */
  async function obtener(partidaId) {
    const sb = client();
    if (!sb) return offline();
    if (!partidaId) return { success: false, error: 'Falta partidaId.' };
    try {
      const { data, error } = await sb.from('partidas')
        .select('id, codigo, nombre, curso, estado, configuracion')
        .eq('id', partidaId).maybeSingle();
      if (error) return { success: false, error: error.message };
      return { success: true, data: data || null };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  async function actualizarConfiguracion(partidaId, configuracion) {
    if(configuracion.lifecycleVersion===2)return controlar(partidaId,'guardar',configuracion);
    const sb=client();if(!sb)return offline();
    try{
      const {error}=await sb.from('partidas').update({configuracion,eventos_habilitados:configuracion.enabledEvents||[]}).eq('id',partidaId);
      return error?{success:false,error:error.message}:{success:true};
    }catch(error){return {success:false,error:error.message};}
  }
  global.SIDE = global.SIDE || {};
  async function guardarPuntaje(partidaId,empresaId,puntaje){
    const sb=client();if(!sb)return offline();
    if(!Number.isFinite(puntaje)||puntaje<0||puntaje>20)return {success:false,error:'La nota debe estar entre 0 y 20.'};
    try{const {data,error}=await sb.rpc('guardar_puntaje_docente',{p_partida_id:partidaId,p_empresa_id:empresaId,p_puntaje:puntaje});return error||data?.error?{success:false,error:error?.message||data.error}:{success:true};}
    catch(error){return {success:false,error:error.message};}
  }
  async function controlar(partidaId,accion,config=null,expectedRound=null){
    const sb=client();if(!sb)return offline();
    try{
      const {data,error}=await sb.rpc('controlar_partida',{p_partida_id:partidaId,p_accion:accion,p_config:config,p_expected_round:expectedRound});
      return error||data?.error?{success:false,error:error?.message||data.error}:{success:true,data};
    }catch(error){return {success:false,error:error.message};}
  }
  global.SIDE.PartidaService = { buscarPorCodigo, crear, avanzarCiclo, finalizar, obtener, listarParticipantes, actualizarConfiguracion, guardarPuntaje, controlar };
})(window);
