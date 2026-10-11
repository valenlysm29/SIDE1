# Revisión independiente — continuación 4

Revisión de solo lectura de snapshots, arneses y ruta activa; no se ejecutó un segundo navegador. Sin incidencias críticas del arnés. Baseline9fbe6ec y HEADc73d801 aislados y verificados por OID; las ejecuciones originales alternan versiones, conservan las aserciones del modo fallback y todos sus tiempos. Ningún cambio de NPC, mundo3D ni navegación se incluyó.

La comparación9fbe6ec..HEAD está vacía para supplied_npcs, simulator3d, simulator3d-config, navegación NPC/interiores, business_interiors, world_decision_state, asset_manager, personajes, hub, player_motion, gameplay_objectives y previewNPC. Sí cambian módulos de integración cargados por index: app, catálogo, resumen, motor y editor. No se afirma identidad total de dependencias.

Las tres proyecciones nuevas de company_summary están dentro de `if(decisionState.__excel?.habilitado)` (líneas189/215/239). La prueba borra localStorage y usa un seed legacy sin__excel; los guards de app también requieren habilitado. El editor deshabilitado no genera `[data-excel-preview]` ni ejecuta la proyección del motor. El motor no agrega Math.random ni temporizadores.

`step(100)` avanza un bucle síncrono. Los puntos, velocidad y espera del cliente usan Math.random sin semilla; el avance toma geometría, vecinos, velocidad y dt, no caja ni resultados Excel. El fallo observado en BROWSE con blocked0/routeBlockedfalse sugiere avance/oscilación pero no demuestra su causa. Un replay fiel necesitaría además velocidad, arquetipo y vecinos originales, ausentes en los registros.

Muestra original: baseline8/8, HEAD7/8; no cumple casos1/2. Diagnósticos controlados adicionales0.5/0.9 PASSenambos no sustituyen esa muestra; semilla tardía inconclusiva. Dictamen: caso3 pendiente, no publicar ni inventar una corrección de integración sin evidencia. Informe y límites en diagnostico_npc_cont4.md.
