/**
 * supabase_client.js
 * ---------------------------------------------------------------------------
 * Módulo base: inicializa y expone el cliente Supabase para toda la app.
 *
 * Responsabilidad ÚNICA: crear el cliente una sola vez y decir si está
 * disponible. No contiene lógica de negocio ni acceso a tablas.
 *
 * Uso:
 *   const client = SupabaseClient.get();        // null si no hay config/SDK
 *   const ok = SupabaseClient.isReady();        // true/false
 *
 * @module services/supabase_client
 */
(function initSupabaseClientModule(global) {
  'use strict';

  /** @type {object|null} Cliente Supabase (singleton). */
  let client = null;

  /** @type {boolean} Indica si ya se intentó inicializar. */
  let initialized = false;

  /**
   * Lee la configuración global inyectada por config.js.
   * @returns {{url: string, key: string}|null} Config o null si inválida.
   */
  function readConfig() {
    const cfg = global.SIDE_CONFIG || {};
    const url = String(cfg.SUPABASE_URL || '').trim();
    const key = String(cfg.SUPABASE_PUBLISHABLE_KEY || '').trim();
    if (!url || url.includes('TU-PROYECTO')) return null;
    if (!key || key.includes('TU-PUBLISHABLE')) return null;
    return { url, key };
  }

  /**
   * Inicializa el cliente Supabase (idempotente).
   * Debe llamarse una vez al arrancar; los servicios lo llaman solos.
   * @returns {object|null} Cliente Supabase o null si no se pudo crear.
   */
  function init() {
    if (initialized) return client;
    initialized = true;
    const cfg = readConfig();
    if (!cfg) return null;
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      console.warn('SIDE: SDK de Supabase no cargado. Modo local activo.');
      return null;
    }
    try {
      client = global.supabase.createClient(cfg.url, cfg.key);
    } catch (err) {
      console.error('SIDE: no se pudo crear el cliente Supabase', err);
      client = null;
    }
    return client;
  }

  /**
   * Obtiene el cliente, inicializándolo si hace falta.
   * @returns {object|null} Cliente Supabase o null.
   */
  function get() {
    if (!initialized) init();
    return client;
  }

  /**
   * Indica si hay conexión usable con Supabase.
   * @returns {boolean} true si el cliente existe.
   */
  function isReady() {
    return get() !== null;
  }

  // Expone el módulo en el namespace global SIDE.
  global.SIDE = global.SIDE || {};
  global.SIDE.SupabaseClient = { init, get, isReady };
})(window);
