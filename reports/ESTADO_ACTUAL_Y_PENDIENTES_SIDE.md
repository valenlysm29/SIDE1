# Estado actual y pendientes de SIDE

Rama: `logia_prueba_mejora`. Este documento describe el estado local comprobado hasta `40e65e6`; consultar `git log -1` para el commit que lo publica. No confundir la disponibilidad experimental con aceptación integral.

## Estado general y avances

SIDE dispone de creación de partidas, ingreso de empresas, decisiones, producción, ventas, resultados, cierre de servidor y panel docente. Manual, Aleatorio y Equilibrado disponen de programación autoritativa experimental y se habilitan por partida; la activación global de eventos económicos experimentales permanece desactivada. La rotación equilibrada utiliza PE69, PE71 y PE75; no garantiza ganancias iguales.

En la rama se integraron compras por presentaciones, confirmación de pedidos, recepciones parciales y libro de materiales. Las presentaciones se convierten a unidades físicas para producción y sus costos se reflejan en los cierres. El avance docente y el cierre oficial están implementados; su funcionamiento conjunto con todas las compras y los tres modos aún no está validado de extremo a extremo.

## Evidencia y límites

- Seis salas locales reales de 3 y 6 ciclos, una por modo y duración, integraron tres empresas cada una. Auth, creación y reintento, ingreso, selección guardada, programación inicial y noticias se comprobaron por HTTP. Ninguna cerró ciclos en esa ejecución. Véase `reports/validacion_integral_modos_side.md` y `tests/modos_local_reales.py`.
- `reports/validacion_compras_local_d1880e6.md` registra una prueba de compra y cierre local con Edge real, y otra prueba por roles con pedidos, recepciones parciales y Kardex. Son casos específicos, no seis ciclos integrados por modo. Las pruebas PGlite de seis ciclos tampoco sustituyen Auth y Edge reales.
- Una prueba de PostgreSQL aislado serializó asignaciones y dos trabajadores cerraron una vez; los roles Auth se simularon. La comprobación Edge con token válido e inválido no procesó cierres.
- Última selección comparable ejecutada: 842 pruebas, 825 aprobadas, 17 fallidas, ninguna cancelada. Los nombres de los 17 fallos coincidieron con la referencia histórica; no equivale a la selección anterior de 968. Los registros en `tests/output/` están ignorados y pueden no existir en otra copia.

## Prioridades

- **P0:** completar seis partidas reales, Manual/Aleatorio/Equilibrado × 3/6 ciclos, con tres empresas cada una y los pasos de la matriz del informe integral.
- **P1:** automatizar con navegador real decisiones, compras por presentación, confirmación, recepciones, consulta del Kardex, cierres, avance, resultados y finalización; registrar qué se hace por clic y qué por HTTP autenticado.
- **P2:** probar dos cierres simultáneos por Edge con trabajo real, reintentos y conciliación de inventario, caja y balances entre estudiante, docente y Laboratorio; ejecutar regresión con selección idéntica a la referencia.
- **P3:** revisar los 17 fallos históricos y el Excel original disponible por separado, y completar la documentación de entrega.

## Guía de continuación

1. Desde la raíz instalar dependencias con `npm ci`, y disponer de Node.js, Python y Docker Desktop. Para abrir el entorno experimental ya configurado en este equipo, ejecutar `INICIAR_EXPERIMENTAL.bat` y abrir `http://localhost:8099/index.html`. El lanzador usa `.codex-work/aceptacion-modos` y comprueba que la API sea `http://127.0.0.1:59321`; esa configuración está ignorada y no viaja con Git. El servidor inicia también un worker de cierre; evitar ejecutarlo simultáneamente con otra prueba que pretenda controlar los cierres.
2. Para una nueva instancia, crear una configuración local aislada bajo `.codex-work/` con `npx supabase init --workdir .codex-work/modos-e2e`, asignar puertos libres y habilitar Auth anónimo en su `supabase/config.toml`, y arrancarla con `npx supabase start --workdir .codex-work/modos-e2e`. El script de prueba exige API `http://127.0.0.1:62321`. La base nueva requiere cargar el esquema base y las migraciones en orden: ver `tests/p01_http_local_setup.py` para la lista base y el informe integral para las migraciones de eventos y presentaciones. Ese script fija otro contenedor; no ejecutarlo sin adaptarlo y verificar el destino. La inicialización completa desde un clon limpio aún no está automatizada ni validada.
3. `python tests/modos_local_reales.py` crea seis salas nuevas y registra el primer tramo en `tests/output/modos_local_reales.json`. Retorna 1 intencionalmente porque no termina ciclos. No publica ni conserva tokens de los participantes; las salas existentes solo se pueden continuar si se dispone de sus sesiones originales. Recrear salas controladamente y conservar sesiones únicamente en memoria o almacenamiento local protegido.
4. Para Edge local usar `npx supabase functions serve --workdir .codex-work/modos-e2e --no-verify-jwt` con el código presente en el directorio local de funciones y la configuración local correspondiente. La función valida su propio token en Vault; no registrar ni compartir tokens ni claves de servicio. No desplegarla remotamente para estas pruebas.
5. Consultar las partidas, Kardex y cierres mediante sesiones autorizadas y RPC: `side_material_preview_v1`, `side_student_events_v1`, `side_teacher_events_v1` y `side_consultar_cierre_negocio`; el worker usa `side_cierres_pendientes`. Comparar ciclo, empresa y resultados entre las vistas y comprobar reintentos antes de avanzar. Ver `services/decisiones_service.js`, `services/partida_service.js`, `services/laboratorio_service.js` y `tests/p01_http_browser_admission.cjs` como referencias, con las limitaciones indicadas en el informe integral.
6. Revisar `js/docente.js`, `js/production_model.js`, `js/cycle_model.js`, `js/financial_model.js`, `services/business_runtime.cjs` y las migraciones de pedidos, eventos y cierre. La lista exacta de las migraciones de eventos aplicadas en la prueba local debe reconstruirse desde sus dependencias; no asumir que todos los archivos de migración se pueden aplicar en orden automático a una base con datos.

## Restricciones

No modificar `main`, bases remotas ni cierres históricos; no desplegar ni hacer push sin autorización. Preservar respaldos y stashes. No alterar fórmulas económicas, mantenimiento, depreciación, opciones de decisiones ni funcionalidades experimentales sin un defecto reproducible y su prueba. Mantener claves de servicio y resultados privados fuera de Git. No usar el proyecto local sobre datos compartidos o históricos, ni reiniciarlo destructivamente.
