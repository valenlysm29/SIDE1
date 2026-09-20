/**
 * decisiones_service.js
 * ---------------------------------------------------------------------------
 * Servicio de decisiones (elecciones del estudiante por ciclo).
 *
 * Responsabilidad ÚNICA: persistir y leer `empresas_decisiones`.
 * No toca empresas, partidas ni UI.
 *
 * Funciones:
 *   - guardar(empresaId, ciclo, decisiones) → RPC guardar_decisiones
 *   - obtenerReporte(empresaId, ciclo?)     → RPC obtener_reporte_empresa
 *
 * Formato de cada decisión en el array:
 *   { decision_id: 'MOLDE', opcion_id: 'molde_2', cantidad: 1, costo_total: 1200 }
 *
 * Todas retornan { success: boolean, data?: any, error?: string }.
 * Si Supabase no está disponible retornan { success: false, offline: true }.
 *
 * @module services/decisiones_service
 */
(function initDecisionesService(global) {
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
   * Guarda (inserta o actualiza) las decisiones de una empresa en un ciclo.
   * @param {number} empresaId ID de la empresa.
   * @param {number} ciclo Número de ciclo (1..N).
   * @param {Array<object>} decisiones Array de decisiones (ver formato arriba).
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   *   data = { success: true, guardadas: number }.
   */
  async function guardar(empresaId, ciclo, decisiones) {
    const sb = client();
    if (!sb) return offline();
    if (!empresaId) return { success: false, error: 'Falta empresaId.' };
    if (!ciclo) return { success: false, error: 'Falta ciclo.' };
    if (!Array.isArray(decisiones) || decisiones.length === 0) {
      return { success: false, error: 'No hay decisiones para guardar.' };
    }
    try {
      const { data, error } = await sb.rpc('guardar_decisiones', {
        p_empresa_id: empresaId,
        p_ciclo: ciclo,
        p_decisiones: decisiones
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  /**
   * Obtiene el reporte completo de una empresa (para el panel docente).
   * @param {number} empresaId ID de la empresa.
   * @param {number|null} ciclo Ciclo específico o null para todos.
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   *   data = { empresa, reportes, decisiones }.
   */
  async function obtenerReporte(empresaId, ciclo) {
    const sb = client();
    if (!sb) return offline();
    if (!empresaId) return { success: false, error: 'Falta empresaId.' };
    try {
      const { data, error } = await sb.rpc('obtener_reporte_empresa', {
        p_empresa_id: empresaId,
        p_ciclo: ciclo || null
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  global.SIDE = global.SIDE || {};
  global.SIDE.DecisionesService = { guardar, obtenerReporte };
})(window);
