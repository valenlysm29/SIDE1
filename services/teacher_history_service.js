/** Read-only teacher history. Ownership and replacement are enforced by Supabase. */
(function initTeacherHistoryService(global) {
  'use strict';

  function client() {
    return global.SIDE?.SupabaseClient?.get() || null;
  }

  function failure(error) {
    const code = String(error?.code || '');
    const message = String(error?.message || error || 'No se pudo consultar el historial.');
    if (/^(PGRST202|PGRST205|42P01|42883)$/.test(code) ||
        /(?:obtener_ultima_partida_docente|side_teacher_history).*(?:schema cache|does not exist)/i.test(message)) {
      return {
        success: false, unavailable: true, code: 'HISTORIAL_NO_CONFIGURADO',
        error: 'Aplica supabase/migrations/supabase_teacher_history.sql en Supabase para habilitar el apartado Historial.'
      };
    }
    return { success: false, code: code || undefined, error: message };
  }

  /** { success, data: null | { partida, empresas: [{ reportes, decisiones, ... }] } }. */
  async function obtenerUltima() {
    try {
      const sb = client();
      if (!sb) return { success: false, offline: true, error: 'Supabase no disponible (modo local).' };
      const { data, error } = await sb.rpc('obtener_ultima_partida_docente');
      if (error) return failure(error);
      if (data?.success === false || data?.error) return failure({ code: data.code, message: data.error });
      if(data?.partida?.id&&global.SIDE_OFFICIAL_HISTORY){
        const official=await sb.rpc('side_historial_oficial',{p_partida_id:data.partida.id,p_empresa_id:null});
        if(official.error)return failure(official.error);
        for(const company of data.empresas||[]){
          company.reportes=global.SIDE_OFFICIAL_HISTORY.rows(official.data,company.id).filter(row=>row.closureStatus==='confirmed').map(row=>({
            empresa_id:company.id,ciclo:row.round,ingresos:row.estadoResultados.ingresos,costos:row.estadoResultados.costos,
            utilidad:row.estadoResultados.utilidadNeta??row.estadoResultados.utilidad,caja_final:row.balanceCaja.cajaFinal,
            balance_caja:row.balanceCaja,flujo_caja:row.flujoCaja,estado_resultados:{...row.estadoResultados,balanceGeneral:row.balanceGeneral,cycleReceipt:row.cycleReceipt},created_at:row.closedAt
          }));
        }
      }
      return { success: true, data: data || null };
    } catch (error) {
      return failure(error);
    }
  }

  async function listar(){
    try{const sb=client();if(!sb)return failure('Supabase no disponible.');
      const {data,error}=await sb.from('partidas').select('id,codigo,nombre,created_at,configuracion,estado').eq('estado','finalizada').order('created_at',{ascending:false}).limit(100);
      return error?failure(error):{success:true,data:data||[]};
    }catch(error){return failure(error);}
  }
  async function obtener(id){
    if(!id)return obtenerUltima();
    try{const sb=client();if(!sb)return failure('Supabase no disponible.');
      const game=await sb.from('partidas').select('id,codigo,nombre,curso,created_at,side_finalizada_at,configuracion').eq('id',id).single();
      if(game.error)return failure(game.error);
      const response=await sb.rpc('side_historial_oficial',{p_partida_id:id,p_empresa_id:null});
      if(response.error)return failure(response.error);
      const p=game.data,history=response.data;
      const empresas=(history.companies||[]).map(company=>({id:company.id,nombre_comercial:company.nombre,decisiones:[],
        reportes:global.SIDE_OFFICIAL_HISTORY.rows(history,company.id).filter(r=>r.closureStatus==='confirmed').map(r=>({ciclo:r.round,ingresos:r.estadoResultados.ingresos,costos:r.estadoResultados.costos,utilidad:r.estadoResultados.utilidadNeta??r.estadoResultados.utilidad,caja_final:r.balanceCaja.cajaFinal,balance_caja:r.balanceCaja,flujo_caja:r.flujoCaja,estado_resultados:{...r.estadoResultados,balanceGeneral:r.balanceGeneral,cycleReceipt:r.cycleReceipt},created_at:r.closedAt}))}));
      return {success:true,data:{partida:{...p,finalizada_at:p.side_finalizada_at,ciclos_jugados:Number(p.configuracion?.cycles)||1},empresas}};
    }catch(error){return failure(error);}
  }
  global.SIDE = global.SIDE || {};
  global.SIDE.TeacherHistoryService = { obtenerUltima,listar,obtener };
})(window);
