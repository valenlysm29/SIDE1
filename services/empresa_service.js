/**
 * empresa_service.js
 * ---------------------------------------------------------------------------
 * Servicio de empresas (compañías de los estudiantes).
 *
 * Responsabilidad ÚNICA: operaciones sobre `empresas` y `participantes`.
 * No toca decisiones, reportes ni UI.
 *
 * Funciones:
 *   - crear(partidaId, datos)  → RPC crear_empresa (empresa + participante)
 *   - obtenerEstado(empresaId) → RPC obtener_estado_juego
 *
 * Todas retornan { success: boolean, data?: any, error?: string }.
 * Si Supabase no está disponible retornan { success: false, offline: true }.
 *
 * @module services/empresa_service
 */
(function initEmpresaService(global) {
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
   * Crea la empresa del estudiante y su vínculo como participante.
   * @param {string} partidaId UUID de la partida.
   * @param {object} datos { nombreEstudiante, nombreLegal, nombreComercial, capital? }
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   *   data = { empresa_id, participante_id, caja_inicial }.
   */
  async function crear(partidaId, datos) {
    const sb = client();
    if (!sb) return offline();
    const d = datos || {};
    if (!partidaId) return { success: false, error: 'Falta partidaId.' };
    if (!d.nombreComercial) return { success: false, error: 'Falta el nombre comercial.' };
    try {
      const { data, error } = await sb.rpc('crear_empresa', {
        p_partida_id: partidaId,
        p_nombre_estudiante: d.nombreEstudiante || 'Jugador',
        p_nombre_legal: d.nombreLegal || d.nombreComercial,
        p_nombre_comercial: d.nombreComercial,
        p_capital: Number(d.capital) || 100000
      });
      if (error) return { success: false, error: error.message };
      if (data && data.error) return { success: false, error: data.error };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  /**
   * Obtiene el estado completo del juego para un estudiante.
   * @param {number} empresaId ID de la empresa.
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   *   data = { empresa, partida, ciclo_partida, decisiones_ciclo }.
   */
  async function obtenerEstado(empresaId) {
    const sb = client();
    if (!sb) return offline();
    if (!empresaId) return { success: false, error: 'Falta empresaId.' };
    try {
      const { data, error } = await sb.rpc('obtener_estado_juego', { p_empresa_id: empresaId });
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  global.SIDE = global.SIDE || {};
  global.SIDE.EmpresaService = { crear, obtenerEstado };
})(window);
