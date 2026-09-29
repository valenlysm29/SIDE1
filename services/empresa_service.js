/**
 * empresa_service.js
 * ---------------------------------------------------------------------------
 * Servicio de empresas (compañías de los estudiantes).
 *
 * Responsabilidad ÚNICA: operaciones sobre `empresas` y `participantes`.
 * No toca decisiones, reportes ni UI.
 *
 * Funciones:
 *   - ingresar(datos)                    → RPC ingresar_empresa
 *   - obtenerEstado(datos)                       → RPC obtener_estado_estudiante
 *   - guardarEstado(datos, snapshot, revision)  → RPC guardar_estado_estudiante
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

  function cleanText(value) {
    return String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ');
  }

  function cleanCode(value) {
    return cleanText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  }

  /**
   * Valida el código y la identidad empresarial en una sola transacción.
   * El servidor decide si crea una empresa o reingresa a la existente.
   * @param {object} datos { codigo, nombreLegal, nombreComercial }
   * @returns {Promise<{success: boolean, data?: object, code?: string, error?: string}>}
   */
  async function ingresar(datos) {
    const sb = client();
    if (!sb) return offline();
    const d = datos || {};
    const codigo = cleanCode(d.codigo);
    const nombreLegal = cleanText(d.nombreLegal);
    const nombreComercial = cleanText(d.nombreComercial);
    if (!codigo || !nombreLegal || !nombreComercial) {
      return { success: false, code: 'DATOS_INCOMPLETOS', error: 'Faltan datos de ingreso.' };
    }
    try {
      const { data: response, error } = await sb.rpc('ingresar_empresa', {
        p_codigo: codigo,
        p_nombre_legal: nombreLegal,
        p_nombre_comercial: nombreComercial
      });
      if (error) return { success: false, error: error.message };
      const data = Array.isArray(response) ? response[0] : response;
      if (!data || data.success === false || data.error) {
        return { success: false, code: data && (data.code || data.codigo_error), error: (data && data.error) || 'No se pudo validar el ingreso.' };
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  /**
   * Obtiene el estado completo del juego para un estudiante.
   * @param {object} datos { codigo, nombreLegal, nombreComercial }
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   *   data = { empresa, partida, ciclo_partida, decisiones_ciclo }.
   */
  async function obtenerEstado(datos) {
    const sb = client();
    if (!sb) return offline();
    const d = datos || {};
    const codigo = cleanCode(d.codigo);
    const nombreLegal = cleanText(d.nombreLegal);
    const nombreComercial = cleanText(d.nombreComercial);
    if (!codigo || !nombreLegal || !nombreComercial) return { success: false, code: 'CREDENCIALES_INVALIDAS', error: 'No se pudo validar el ingreso.' };
    try {
      const { data, error } = await sb.rpc('obtener_estado_estudiante', {
        p_codigo: codigo,
        p_nombre_legal: nombreLegal,
        p_nombre_comercial: nombreComercial
      });
      if (error) return { success: false, error: error.message };
      if (data && (data.success === false || data.error)) return { success: false, code: data.code, error: data.error };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  async function guardarEstado(datos, snapshot, expectedRevision) {
    const sb = client();
    if (!sb) return offline();
    const d = datos || {};
    const codigo = cleanCode(d.codigo);
    const nombreLegal = cleanText(d.nombreLegal);
    const nombreComercial = cleanText(d.nombreComercial);
    const revision = Number(expectedRevision);
    if (!codigo || !nombreLegal || !nombreComercial || !snapshot || typeof snapshot !== 'object' || !Number.isSafeInteger(revision) || revision < 0) {
      return { success: false, error: 'No se pudo preparar el estado del estudiante.' };
    }
    try {
      const { data, error } = await sb.rpc('guardar_estado_estudiante', {
        p_codigo: codigo,
        p_nombre_legal: nombreLegal,
        p_nombre_comercial: nombreComercial,
        p_snapshot: snapshot,
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
  global.SIDE.EmpresaService = { ingresar, obtenerEstado, guardarEstado, cleanText, cleanCode };
})(window);
