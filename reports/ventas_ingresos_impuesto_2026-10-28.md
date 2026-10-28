# Ventas, ingresos e impuesto — 28 de octubre de 2026

## Estado

Trabajo en curso, no desplegar: la suite general tiene fallos y no se ha verificado aislamiento individual ni todas las vistas integradas. No se alteró la base real.

## Diagnóstico

El proyecto real contiene cierres con ventas y otros con producción cero. En cierres inspeccionados constan causas «sin molde» y «no planificó producción»; no se identificó una sala específica que permita confirmar la causa individual del caso relatado. La función desplegada de contexto incluía expulsión al faltar el primer plan; la migración del repositorio de 26/10 evita la expulsión pero deja pendiente el cierre. La nueva migración crea un plan de producción cero, sin expulsión, conserva los inventarios y no modifica cierres previos. La tabla de cierres utiliza clave partida/ciclo; el RPC valida y guarda cierres, reportes y snapshots en una transacción.

La identidad del estudiante se resuelve por código de sala y nombres de empresa, no mediante un identificador autenticado individual. Por tanto no se ha demostrado aislamiento seguro entre estudiantes: conocer esos datos permite suplantar la identidad. Corregirlo exige rediseñar el acceso existente.

## Parámetros y decisiones

La reputación predeterminada es la del ciclo, promedio de los cuatro factores; suavizado con la previa configurable y apagado. El reparto usa ROUND individual y los participantes sintéticos se derivan de los perfiles reales; el número es configurable y se registra en el comprobante. El umbral supuesto del descuento del 8 % es 100 unidades físicas por opción, configurable. Los formularios actuales ya usan m² y metros; no deben convertirse una segunda vez. Las compras de activos afectan caja y se amortizan por depreciación, evitando llevar adquisición y depreciación como gasto simultáneo.

UIT 2026: S/ 5,500, [MEF](https://www.gob.pe/institucion/mef/noticias/1314665-mef-establece-en-s-5500-el-valor-de-la-uit-para-el-ano-2026). Régimen general 29.5 %; MYPE tributario 10 % hasta 15 UIT y 29.5 % sobre el exceso, [SUNAT](https://orientacion.sunat.gob.pe/7037-03-tasa-del-impuesto). Parámetros configurables; la implementación infiere el régimen tributario del régimen laboral seleccionado, supuesto que requiere confirmación.

## Validación

- `node tests/restaurar_decisiones_oraculo.cjs`: 3,104 comparaciones, cero diferencias.
- `node tests/side_three_cycles_db.cjs`: PGlite aislado, tres ciclos, cuatro empresas, ventas, stock, impuesto positivo final, sin expulsión y reintento sin duplicación.
- `node tests/business_worker_db.cjs --edge`: dos ciclos y liquidación positiva en runtime empaquetado.
- Pruebas focales de mercado, vistas e impuesto: 20 aprobadas.
- Suite Node completa: 748 pruebas, 712 aprobadas y 36 fallidas en la última ejecución. Algunas reflejan expectativas anteriores al cambio de reglas; 13 fallos de interfaz y dos de inventario se reprodujeron en una copia limpia de HEAD. Dos fallos de aislamiento docente se corrigieron y pasan en la prueba focal. No se han clasificado todos los demás.
- `tests/simulaciones_v19.cjs` falla en calidad premium esperada 7 frente a 5; se reprodujo el mismo fallo en copia limpia de HEAD.

## Simulación PGlite

| Empresa | Ciclo | Producido | Disponible | Demanda | Vendido | Ingresos S/ | Costos S/ | Utilidad S/ | Caja S/ | Impuesto S/ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 90 | 90 | 199 | 90 | 21600 | 12719.09 | 8880.91 | 193129.7 | 0 |
| 1 | 2 | 90 | 90 | 199 | 90 | 21600 | 12719.09 | 8880.91 | 200594.4 | 0 |
| 1 | 3 | 90 | 90 | 199 | 90 | 21600 | 15383.36 | 6216.64 | 205394.83 | 2664.27 |
| 2 | 1 | 90 | 90 | 201 | 90 | 22500 | 12728.09 | 9771.91 | 193840.7 | 0 |
| 2 | 2 | 90 | 90 | 201 | 90 | 22500 | 12728.09 | 9771.91 | 202151.4 | 0 |
| 2 | 3 | 90 | 90 | 201 | 90 | 22500 | 15659.66 | 6840.34 | 207530.53 | 2931.57 |
| 3 | 1 | 90 | 90 | 199 | 90 | 23400 | 12737.09 | 10662.91 | 194551.7 | 0 |
| 3 | 2 | 90 | 90 | 199 | 90 | 23400 | 12737.09 | 10662.91 | 203708.4 | 0 |
| 3 | 3 | 90 | 90 | 199 | 90 | 23400 | 15935.96 | 7464.04 | 209666.23 | 3198.87 |
| 4 | 1 | 0 | 0 | 0 | 0 | 0 | 712.32 | -712.32 | 199287.68 | 0 |
| 4 | 2 | 0 | 0 | 0 | 0 | 0 | 712.32 | -712.32 | 198575.36 | 0 |
| 4 | 3 | 0 | 0 | 0 | 0 | 0 | 712.32 | -712.32 | 197863.04 | 0 |

La simulación no verifica el conjunto completo de RLS ni la concurrencia real en Supabase, y las capturas de paneles deben revisarse por separado. No se ejecutaron migraciones ni despliegues en producción. La migración propuesta y el runtime son artefactos de trabajo y no son una recomendación de instalación mientras haya fallos.

Las capturas estudiante/docente de escritorio y móvil se generan con `node tests/side_results_screenshots.cjs` usando las filas completas de PGlite. El script carga el HTML local y alimenta las vistas con snapshots, sin una sesión remota ni navegación integral de la aplicación.
`nLa prueba de navegador `node tests/teacher_results_isolation_ui.cjs` agotó el tiempo esperando `queuedReads`; falta determinar la causa.
