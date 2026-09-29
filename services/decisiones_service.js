/**
 * decisiones_service.js
 * ---------------------------------------------------------------------------
 * Servicio de decisiones (elecciones del estudiante por ciclo).
 *
 * Responsabilidad ÚNICA: persistir y leer `empresas_decisiones`.
 * No toca empresas, partidas ni UI.
 *
 * Funciones:
 *   - guardar(identidad, ciclo, decisiones, revision) → RPC guardar_decisiones_estudiante
 *   - obtenerReporte(empresaId, ciclo?)     → RPC obtener_reporte_empresa
 *   - obtenerCatalogo()                     → catálogo para mapear IDs a etiquetas
 *   - guardarReporte(identidad, ciclo, reporte, revision) → RPC guardar_reporte_estudiante
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

  function identityParams(identidad) {
    const clean = value => String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ');
    const d = identidad || {};
    return {
      p_codigo: clean(d.codigo).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(),
      p_nombre_legal: clean(d.nombreLegal),
      p_nombre_comercial: clean(d.nombreComercial)
    };
  }

  function validIdentity(params) {
    return Boolean(params.p_codigo && params.p_nombre_legal && params.p_nombre_comercial);
  }

  /**
   * Guarda (inserta o actualiza) las decisiones de una empresa en un ciclo.
   * @param {object} identidad { codigo, nombreLegal, nombreComercial }.
   * @param {number} ciclo Número de ciclo (1..N).
   * @param {Array<object>} decisiones Array de decisiones (ver formato arriba).
   * @param {number} expectedRevision Revisión confirmada por el CAS de snapshot.
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   *   data = { success: true, guardadas: number }.
   */
  async function guardar(identidad, ciclo, decisiones, expectedRevision) {
    const sb = client();
    if (!sb) return offline();
    const identidadRpc = identityParams(identidad);
    const revision = Number(expectedRevision);
    if (!validIdentity(identidadRpc)) return { success: false, code: 'CREDENCIALES_INVALIDAS', error: 'No se pudo validar el ingreso.' };
    if (!ciclo) return { success: false, error: 'Falta ciclo.' };
    if (!Number.isSafeInteger(revision) || revision < 0) return { success: false, code: 'ESTADO_DESACTUALIZADO', error: 'No se pudo validar la revisión del estado.' };
    if (!Array.isArray(decisiones) || decisiones.length === 0) {
      return { success: false, error: 'No hay decisiones para guardar.' };
    }
    try {
      const { data, error } = await sb.rpc('guardar_decisiones_estudiante', {
        ...identidadRpc,
        p_ciclo: ciclo,
        p_decisiones: decisiones,
        p_expected_revision: revision
      });
      if (error) return { success: false, error: error.message };
      if (data && (data.success === false || data.error)) return { success: false, code: data.code, error: data.error };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  /**
   * Obtiene el reporte completo de una empresa (para el panel docente).
   * @param {number} empresaId ID de la empresa (flujo autenticado del docente).
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

  /**
   * Obtiene el catálogo de decisiones y opciones para mapear IDs a etiquetas.
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   *   data = { decisions: [{id, decision_id, decision_nombre, categoria,
   *            tipo, es_obligatoria, es_recurrente}],
   *            options: [{id, decision_id, opcion_id, etiqueta}] }.
   */
  async function obtenerCatalogo() {
    const sb = client();
    if (!sb) return offline();
    try {
      const [dec, ops] = await Promise.all([
        sb.from('decisiones_catalogo').select('id, decision_id, decision_nombre, categoria, tipo, es_obligatoria, es_recurrente').eq('activo', true),
        sb.from('decisiones_opciones').select('id, decision_id, opcion_id, etiqueta').eq('activo', true)
      ]);
      if (dec.error) return { success: false, error: dec.error.message };
      if (ops.error) return { success: false, error: ops.error.message };
      return { success: true, data: { decisions: dec.data || [], options: ops.data || [] } };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  /**
   * Guarda (inserta o actualiza) el reporte financiero de una empresa en un ciclo.
   * @param {object} identidad { codigo, nombreLegal, nombreComercial }.
   * @param {number} ciclo Número de ciclo (1..N).
   * @param {object} reporte { capital, ingresos, costos, utilidad, caja_final,
   *   balance_caja, flujo_caja, estado_resultados, decisiones, eventos,
   *   score, progreso }.
   * @param {number} expectedRevision Revisión confirmada por el CAS de snapshot.
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async function guardarReporte(identidad, ciclo, reporte, expectedRevision) {
    const sb = client();
    if (!sb) return offline();
    const identidadRpc = identityParams(identidad);
    const revision = Number(expectedRevision);
    if (!validIdentity(identidadRpc)) return { success: false, code: 'CREDENCIALES_INVALIDAS', error: 'No se pudo validar el ingreso.' };
    if (!ciclo) return { success: false, error: 'Falta ciclo.' };
    if (!Number.isSafeInteger(revision) || revision < 0) return { success: false, code: 'ESTADO_DESACTUALIZADO', error: 'No se pudo validar la revisión del estado.' };
    if (!reporte || typeof reporte !== 'object') {
      return { success: false, error: 'Reporte vacío.' };
    }
    try {
      const { data, error } = await sb.rpc('guardar_reporte_estudiante', {
        ...identidadRpc,
        p_ciclo: ciclo,
        p_reporte: reporte,
        p_expected_revision: revision
      });
      if (error) return { success: false, error: error.message };
      if (data && (data.success === false || data.error)) return { success: false, code: data.code, error: data.error };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  global.SIDE = global.SIDE || {};
  global.SIDE.DecisionesService = { guardar, obtenerReporte, obtenerCatalogo, guardarReporte };
})(window);
