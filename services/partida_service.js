/**
 * partida_service.js
 * ---------------------------------------------------------------------------
 * Servicio de partidas (sesiones de juego del profesor).
 *
 * Responsabilidad ÚNICA: operaciones sobre la tabla `partidas` y sus RPCs.
 * No toca empresas, decisiones ni UI.
 *
 * Funciones:
 *   - buscarPorCodigo(codigo) → RPC buscar_partida_por_codigo
 *   - crear(datos)            → INSERT en partidas
 *   - avanzarCiclo(partidaId) → RPC avanzar_ciclo
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

  global.SIDE = global.SIDE || {};
  global.SIDE.PartidaService = { buscarPorCodigo, crear, avanzarCiclo };
})(window);
