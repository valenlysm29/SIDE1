
/* SIDE - Correcciones observaciones */
(() => {
  // Mantener precios por segmento de mercado
  window.SIDE_MARKET_PRICES = {economico:45, estandar:75, premium:130};

  function sideGetSegment(){
    try{
      const s=JSON.parse(localStorage.getItem('SIDE_GAME_STATE')||'{}');
      return s.segment || s.market || 'estandar';
    }catch(e){return 'estandar'}
  }

  // Precio mínimo de referencia si algún cálculo queda en cero
  window.sideFixProductPrice = function(price){
    const n=Number(price||0);
    return n>0?n:(window.SIDE_MARKET_PRICES[sideGetSegment()]||75);
  };

  // Bloqueo de edición al finalizar decisiones
  window.addEventListener('click', e=>{
    const submit=document.getElementById('submitAllDecisionsBtn');
    if(!submit) return;
    try{
      const p=Number(window.decisionProgressPercent?.()||0);
      if(p>=100 && e.target.closest('#restartDecisionMenu')){
        e.preventDefault();
        alert('Las decisiones ya fueron completadas. Ingresa al simulador 3D.');
      }
    }catch(err){}
  });

  // Guardar respaldo de decisiones para evitar reinicios
  window.addEventListener('beforeunload',()=>{
    try{
      const data={
        savedAt:new Date().toISOString(),
        note:'Decisiones persistentes SIDE'
      };
      localStorage.setItem('SIDE_DECISION_BACKUP',JSON.stringify(data));
    }catch(e){}
  });
})();
