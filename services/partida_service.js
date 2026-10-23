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

  const creationMigration = 'supabase/migrations/2026-10-11_fix_crear_partida.sql';
  const recoveryMigration = 'supabase/migrations/2026-10-11_recuperar_salas_compatibles.sql';
  function normalizeRoom(data){
    if(data?.configuracion){
      const config={...data.configuracion};
      if(config.lifecycleVersion==='2')config.lifecycleVersion=2;
      if('cancelledAt' in config&&(config.cancelledAt==null||['','null','false','0'].includes(String(config.cancelledAt).trim().toLowerCase())))delete config.cancelledAt;
      return {...data,configuracion:config};
    }
    return data;
  }
  function roomDetail(data) {
    return JSON.stringify({tipo:Array.isArray(data)?'array':typeof data,id:data?.id||null,codigo:data?.codigo||null,
      estado:data?.estado||null,lifecycleVersion:data?.configuracion?.lifecycleVersion||null,
      fase:data?.configuracion?.runtime?.phase||null,gameStartAt:data?.configuracion?.gameStartAt||null,
      serverTime:data?.serverTime||null},null,2);
  }
  function roomContractError(data,recoverable=false) {
    const identity=data?.id&&data.codigo&&['esperando','activa'].includes(data.estado);
    const legacy=identity&&data.configuracion?.lifecycleVersion!==2;
    if(recoverable&&identity){
      return creationError(null,{error:'La partida necesita recuperar su configuración y su reloj del servidor.',
        code:legacy?'SALA_ANTIGUA':'SALA_INCONSISTENTE',partida:data,technicalDetail:roomDetail(data)});
    }
    return creationError(null,{error:'Supabase devolvió una respuesta de sala incompleta. Verifica la instalación de 20261009_sala_espera_identidad_exacta.sql y 2026-10-11_fix_crear_partida.sql.',
      code:'CONTRATO_SALA',technicalDetail:roomDetail(data)});
  }
  function validRoom(data) {
    const phase=data?.configuracion?.runtime?.phase;
    return !!(data?.id&&data.codigo&&data.configuracion?.lifecycleVersion===2&&
      Number.isFinite(Date.parse(data.serverTime||''))&&
      (data.estado==='esperando'?phase==='integration'&&Number.isFinite(Date.parse(data.configuracion.gameStartAt||'')):
        data.estado==='activa'&&['decisions','results'].includes(phase)));
  }
  function creationError(error, data) {
    const code=error?.code||data?.code;
    const message=error?.message||data?.error||'El servidor no devolvió una sala válida.';
    const missing=/PGRST202|PGRST204|42883|42703/.test(code||'');
    console.error('SIDE: crear/recuperar sala:', error||data);
    return {success:false,code:missing?'MIGRACION_PENDIENTE':code,error:missing?'Falta actualizar la base de datos: ejecuta '+creationMigration+'.':message,data:data?.partida||data?.id&&data||undefined,migrationMissing:missing,technicalDetail:data?.technicalDetail};
  }
  function requestUuid() {
    if(global.crypto?.randomUUID)return global.crypto.randomUUID();
    if(!global.crypto?.getRandomValues)throw new Error('No se pudo generar la solicitud. Recarga el panel desde una conexión segura.');
    const bytes=global.crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
    return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
  }
  async function obtenerActiva() {
    const sb=client();if(!sb)return offline();
    try {
      const {data:response,error}=await sb.rpc('obtener_sala_docente');
      const data=normalizeRoom(response);
      if(error||data?.error)return creationError(error,data);
      if(data&&!validRoom(data))return roomContractError(data,true);
      return {success:true,data:data||null};
    } catch(error){return creationError(error);}
  }
  async function recuperarSala(partidaId,config=null){
    const sb=client();if(!sb)return offline();
    if(!partidaId)return {success:false,error:'No se pudo identificar la partida.'};
    try{
      const {data:response,error}=await sb.rpc('recuperar_sala_docente',{p_partida_id:partidaId,p_config:config});
      if(error||response?.error){
        if(/PGRST202|42883|42703/.test(error?.code||''))return {success:false,code:'MIGRACION_RECUPERACION_PENDIENTE',error:'Falta actualizar Supabase: ejecuta '+recoveryMigration+'.',technicalDetail:error.message};
        return creationError(error,response);
      }
      const data=normalizeRoom(response);
      if(data?.id===partidaId&&data.estado==='finalizada')return {success:true,data:null,terminal:true};
      if(!validRoom(data))return roomContractError(data,false);
      if(data.id!==partidaId)return {success:false,error:'Supabase devolvió otra partida al recuperar la sala.'};
      return {success:true,data};
    }catch(error){return creationError(error);}
  }

  /**
   * Busca una partida en estado 'esperando' por su código (ej. SIDE-WG2).
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
   *   data = fila creada (incluye id y codigo generado SIDE-WG2).
   */
  async function crear(datos) {
    const sb = client();
    if (!sb) return offline();
    const d = datos || {};
    if (!d.nombre) return { success: false, error: 'Falta el nombre de la partida.' };
    try {
      const { data: userData, error: userError } = await sb.auth.getUser();
      if (userError || !userData || !userData.user) {
        if(userError)console.error('SIDE: sesión al crear sala:',userError);
        return { success: false, error: 'Debes iniciar sesión como profesor.' };
      }
      if(d.configuracion?.lifecycleVersion===2){
      const {data:admissionFeatures,error:admissionFeatureError}=await sb.rpc('side_admission_features');
      if(admissionFeatureError)console.error('SIDE: comprobar admisión:',admissionFeatureError);
      if(admissionFeatureError&&!/PGRST202|42883/.test(admissionFeatureError.code||''))return {success:false,error:'No se pudo comprobar la conexión con Supabase. Intenta nuevamente.',code:admissionFeatureError.code};
      if(admissionFeatureError||admissionFeatures?.waitingRoomVersion!==3||admissionFeatures?.exactIdentityVersion!==2)return {success:false,code:'MIGRACION_PENDIENTE',error:'Falta aplicar la migración 20261009_sala_espera_identidad_exacta.sql en Supabase.'};

        const {data:features,error:featuresError}=await sb.rpc('side_game_features');
        if(featuresError)console.error('SIDE: comprobar lifecycle:',featuresError);
        if(featuresError&&!/PGRST202|42883/.test(featuresError.code||''))return {success:false,error:featuresError.message||'No se pudo comprobar Supabase. Vuelve a intentarlo.'};
        if(featuresError||features?.observationsVersion!==1)return {success:false,error:'Actualiza Supabase con supabase/migrations/supabase_game_lifecycle.sql para habilitar cancelación y eventos sin repetición.'};
        if(features?.gameCodeVersion!==2)return {success:false,error:'Actualiza Supabase con supabase/migrations/supabase_game_codes.sql para habilitar códigos como SIDE-WG2.'};
        // Read-only readiness check: do not leave an unusable lobby in an old DB.
        const {error:readinessError}=await sb.rpc('controlar_partida',{p_partida_id:null,p_accion:'sincronizar'});
        if(readinessError)console.error('SIDE: comprobar firma controlar_partida:',readinessError);
        if(readinessError)return {success:false,error:/PGRST202|42883/.test(readinessError.code||'')?'Aplica supabase/migrations/supabase_game_lifecycle.sql en Supabase antes de crear partidas.':readinessError.message};
      }
      const payload = {
        profesor_id: userData.user.id,
        nombre: d.nombre,
        curso: d.curso || null,
        segmento: d.segmento || 'Estandar',
        configuracion: d.configuracion || {},
        eventos_habilitados: d.eventos_habilitados || []
      };
      if(d.configuracion?.lifecycleVersion===2){
        const {data:response,error}=await sb.rpc('crear_sala_docente',{
          p_config:payload.configuracion,p_nombre:payload.nombre,p_curso:payload.curso||'',p_segmento:payload.segmento,
          p_request_id:d.requestId||requestUuid(),p_reemplazar_id:null
        });
        const data=normalizeRoom(response);
        if(error||data?.error)return creationError(error,data);
        const phase=data?.configuracion?.runtime?.phase;
        if(data?.estado==='finalizada'||['cancelled','finished'].includes(phase))return creationError(null,{error:'La sala de esa solicitud ya terminó. Pulsa Reintentar para crear una nueva.',code:'SOLICITUD_FINALIZADA',partida:data});
        if(!validRoom(data))return roomContractError(data,true);
        return {success:true,data};
      }
      const { data, error } = await sb.from('partidas').insert(payload).select().single();
      if (error) return creationError(error);
      return { success: true, data };
    } catch (err) {
      return creationError(err);
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
        .select('id, nombre, empresa, empresa_id, puntaje_docente, last_seen_at, expulsada_at, empresas(id, nombre_legal, nombre_comercial, caja_actual, ciclo_actual, reputacion)')
        .eq('partida_id', partidaId)
        .order('created_at', { ascending: true });
      if(error&&/expulsada_at/.test(error.message||'')){
        ({data,error}=await sb.from('participantes').select('id, nombre, empresa, empresa_id, puntaje_docente, last_seen_at, empresas(id, nombre_legal, nombre_comercial, caja_actual, ciclo_actual, reputacion)').eq('partida_id',partidaId).order('created_at',{ascending:true}));
      }
      if(error&&/last_seen_at/.test(error.message||'')){
        ({data,error}=await sb.from('participantes').select('id, nombre, empresa, empresa_id, puntaje_docente, empresas(id, nombre_legal, nombre_comercial, caja_actual, ciclo_actual, reputacion)').eq('partida_id',partidaId).order('created_at',{ascending:true}));
      }
      if(error&&/puntaje_docente/.test(error.message||'')){
        ({data,error}=await sb.from('participantes').select('id, nombre, empresa, empresa_id, empresas(id, nombre_legal, nombre_comercial, caja_actual, ciclo_actual, reputacion)').eq('partida_id',partidaId).order('created_at',{ascending:true}));
      }
      if (error) return { success: false, error: error.message };
      return { success: true, data: data || [] };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  async function expulsarEmpresa(partidaId,empresaId,expulsar=true) {
    const sb=client();if(!sb)return offline();
    if(!partidaId||!empresaId)return {success:false,error:'No se pudo identificar la empresa de esta partida.'};
    try {
      const {data,error}=await sb.rpc('side_expulsar_empresa',{p_partida_id:partidaId,p_empresa_id:empresaId,p_expulsar:expulsar});
      if(error){const missing=/PGRST202|42883|42703/.test(error.code||'');return {success:false,migrationMissing:missing,error:missing?'Aplica supabase/migrations/2026-10-21_expulsion_empresa.sql en Supabase para eliminar empresas de la partida.':error.message};}
      if(!data?.success)return {success:false,code:data?.code,error:data?.error||'No se pudo confirmar la expulsión de la empresa.'};
      return {success:true,data};
    }catch(error){return {success:false,error:error?.message||'No se pudo conectar con el servidor.'};}
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
    if(!partidaId||!empresaId)return {success:false,error:'Falta identificar la partida o la empresa para guardar la nota.'};
    if(!Number.isFinite(puntaje)||puntaje<0||puntaje>20)return {success:false,error:'La nota debe estar entre 0 y 20.'};
    try{
      const {data,error}=await sb.rpc('guardar_puntaje_docente',{p_partida_id:partidaId,p_empresa_id:empresaId,p_puntaje:puntaje});
      if(error||data?.error){
        const missing=/^(PGRST202|PGRST204|42703|42883)$/.test(String(error?.code||''));
        return {success:false,error:missing?'Falta configurar las notas en Supabase. Aplica supabase/migrations/20260929_guardar_puntaje_docente.sql.':error?.message||data.error};
      }
      if(data?.success!==true||data.puntaje==null||Number(data.puntaje)!==Math.round(puntaje*100)/100)return {success:false,error:'Supabase no confirmó el guardado de la nota. Vuelve a intentarlo.'};
      return {success:true,puntaje:Number(data.puntaje)};
    }
    catch(error){return {success:false,error:error.message};}
  }
  async function controlar(partidaId,accion,config=null,expectedRound=null){
    const sb=client();if(!sb)return offline();
    try{
      const {data,error}=await sb.rpc('controlar_partida',{p_partida_id:partidaId,p_accion:accion,p_config:config,p_expected_round:expectedRound});
      if(!error&&!data?.error&&accion==='guardar'&&config?.eventRules&&JSON.stringify(config.eventRules)!==JSON.stringify(data?.configuracion?.eventRules||{})){
        // JSONB can reorder keys; compare each rule instead of its serialization.
        const saved=data?.configuracion?.eventRules||{};
        if(Object.entries(config.eventRules).some(([id,rule])=>saved[id]?.firstRound!==rule.firstRound||saved[id]?.repeat!==rule.repeat))return {success:false,error:'No se guardaron las reglas de eventos. Actualiza supabase/migrations/supabase_game_lifecycle.sql en Supabase.'};
      }
      return error||data?.error?{success:false,error:error?.message||data.error}:{success:true,data};
    }catch(error){return {success:false,error:error.message};}
  }
  async function cancelar(partidaId){
    const sb=client();if(!sb)return offline();
    if(!partidaId)return {success:false,error:'No se pudo identificar la partida.'};
    let timer;
    try{
      const response=await Promise.race([
        sb.rpc('cancelar_partida',{p_partida_id:partidaId}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('La cancelación tardó demasiado. Comprueba la conexión y vuelve a intentarlo.')),15000);})
      ]);
      const {data,error}=response;
      if(error||data?.error){
        console.error('SIDE: cancelar partida:',error||data);
        const missing=/PGRST202|42883/.test(error?.code||'');
        return {success:false,code:error?.code||data?.code,error:missing?'Actualiza Supabase con supabase/migrations/2026-10-12_salas_codigo.sql para cancelar partidas.':error?.message||data.error};
      }
      if(data?.id!==partidaId||data?.estado!=='cancelada')return {success:false,error:'Supabase no confirmó la cancelación. Vuelve a consultar la sala antes de reintentar.'};
      return {success:true,data:normalizeRoom(data)};
    }catch(error){console.error('SIDE: cancelar partida:',error);return {success:false,error:error.message};}
    finally{clearTimeout(timer);}
  }
  async function cerrarNegocio(partidaId,ciclo){
    const sb=client();if(!sb)return offline();
    try{
      const context=await sb.rpc('side_contexto_cierre_negocio',{p_partida_id:partidaId,p_ciclo:ciclo});
      if(context.error||context.data?.error)return {success:false,error:context.error?.message||context.data.error,code:context.error?.code||context.data.code,migrationMissing:/PGRST202|42883/.test(context.error?.code||'')};
      const ctx=context.data;if(ctx.cierre)return {success:true,data:ctx.cierre,reused:true};
      const resultadosPorEmpresa={};
      for(const company of ctx.empresas||[]){
        const snapshot=company.snapshot||{},state=snapshot.decision_state||{},saved=state.__cyclePlans?.[ciclo];
        if(!saved)continue;
        const business=state.__cycleBusiness?.[ciclo]||{};
        resultadosPorEmpresa[company.id]=global.SIDE_CYCLE_MODEL.close({state:{...saved.state,__cycleSettlements:state.__cycleSettlements,__finishedGoods:state.__finishedGoods},ledger:snapshot.cash_ledger||{},catalog:global.SIDE_DECISION_CATALOG,round:ciclo,capital:Number(company.capital),sectionsByRound:snapshot.financial_sections||{},production:saved.production,...business});
        const result=resultadosPorEmpresa[company.id],financialLedger={...result.ledger};let previous=0;
        for(let round=1;round<=ciclo;round++){
          const adjustment=global.SIDE_FINANCE_CONFIG?.adjustment(ctx.financialConfig||{},round,company.id,Number(company.capital))||0;
          if(adjustment!==previous)financialLedger[`${round}:CAPITAL_ADJUSTMENT`]=adjustment-previous;
          previous=adjustment;
        }
        result.financial=global.SIDE_FINANCIAL_MODEL.calculate({capital:Number(company.capital),ledger:financialLedger,sectionsByRound:snapshot.financial_sections||{},catalog:global.SIDE_DECISION_CATALOG,round:ciclo,openingBalance:state.__openingBalance});
      }
      const response=await sb.rpc('side_guardar_cierre_negocio',{p_partida_id:partidaId,p_ciclo:ciclo,p_token:ctx.token,p_cierre:{ciclo,resultadosPorEmpresa}});
      if(response.error||response.data?.error)return {success:false,error:response.error?.message||response.data.error,code:response.error?.code||response.data.code};
      return {success:true,data:response.data.cierre,reused:!!response.data.reused};
    }catch(error){return {success:false,error:error.message};}
  }
  async function podio(partidaId,accion='consultar',minutos=0,justificacion=''){
    const sb=client();if(!sb)return offline();
    let timer;
    try{
      const {data,error}=await Promise.race([
        sb.rpc('side_podio_docente',{p_partida_id:partidaId,p_accion:accion,p_minutos:minutos,p_justificacion:justificacion}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('La publicación tardó demasiado. Consulta su estado antes de reintentar.')),15000);})
      ]);
      if(error||data?.error)return {success:false,error:/PGRST202|42883/.test(error?.code||'')?'Aplica supabase/migrations/2026-10-12_podio_programado.sql en Supabase.':error?.message||data.error};
      if(data?.success!==true)return {success:false,error:'Supabase no confirmó la publicación.'};
      return {success:true,data};
    }catch(error){return {success:false,error:error.message};}
    finally{clearTimeout(timer);}
  }
  global.SIDE.PartidaService = { buscarPorCodigo, crear, obtenerActiva, recuperarSala, avanzarCiclo, finalizar, obtener, listarParticipantes, expulsarEmpresa, actualizarConfiguracion, guardarPuntaje, controlar, cancelar,cerrarNegocio,podio };
})(window);
