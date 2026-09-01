# SIDE — Simulador empresarial · versión integrada 3D

Esta versión transforma el módulo de decisiones en una experiencia tipo juego con navegación por pestañas y caja visible.

## Acceso demo
- Profesor: `profesor@upch.pe`
- Contraseña: `Heredia`
- Código estudiante: `SIDE-000`
- Cada estudiante registra su propio nombre legal y nombre comercial al ingresar. No existe una empresa predeterminada.

## Pestañas del jugador
1. Empresa
2. Infraestructura
3. Producción (RR. HH. + insumos)
4. Canales y ventas
5. Inversiones y finanzas

## Cambios principales
- Login del estudiante únicamente con código.
- Tutorial obligatorio; se eliminó “Saltar tutorial”.
- Flechas del tutorial más gruesas.
- Caja/efectivo visible; capital inicial por defecto S/ 100,000.
- El saldo se proyecta y se actualiza al guardar cada pestaña.
- Efecto visual al descontar o aumentar caja.
- Sin códigos internos ni indicadores visibles de eficiencia/calidad/reputación.
- Títulos y pestañas anclados mientras se hace scroll.
- Cantidades para mesas, maquinaria, personal e insumos.
- Maquinaria adquirida marcada como “Ya tienes”.
- Moldes no se deprecian y quedan bloqueados desde el ciclo siguiente a su compra.
- Mantenimiento correctivo: S/ 200.
- Local de producción movido a Infraestructura.
- Producción reúne personal, compras, materiales y volumen objetivo.
- Analista de compras: S/ 5,000 por ciclo; negocia descuentos decrecientes por ciclo.
- Eliminadas las decisiones de número de proveedores, lead time, política de pago e inventario.
- Canales: web, Los Olivos, Miraflores y San Juan de Lurigancho.
- Personal de ventas se activa solo al elegir tienda física; S/ 1,300 por persona/ciclo.
- % de ventas a crédito se muestra como dato automático, no como decisión.
- Garantía de proveedor en 0%, 80% o 100%, sin afectar caja al elegirla.
- Inversiones y Finanzas combinadas.
- Préstamo bancario muestra TEA y monto máximo definidos por el docente.
- Eliminada la decisión de depreciación.
- Banco central de rutas de iconos en `icon_bank.js`.

## Panel docente
- Caja inicial por empresa.
- Demanda configurable por distrito.
- TEA inicial por defecto 20% y límite de préstamo.
- % inicial de ventas a crédito.
- Tiempo por ciclo en horas y minutos.
- Cierre manual o automático.
- Botón para cortar el ciclo cuando el cierre es manual.
- Eventos no elegibles: solo banco de posibles eventos y ocurrencia aleatoria.
- Estado de empresa: activo/tomando decisiones o sin actividad reciente.
- Botón “Guardar e iniciar partida”.
- La TEA baja 1 punto porcentual al avanzar cada ciclo, y el docente puede modificarla.

## Nota técnica
El proyecto mantiene el modo local con `localStorage` y conserva los puntos de integración con Supabase. Las reglas que dependen de un motor contable completo de ventas/devoluciones se presentan como reglas del juego, mientras que caja, compras, cantidades, préstamo y costos sí se calculan en esta versión.

## Actualización 29/08/2026
La versión actual incorpora obligatoriedad selectiva de decisiones, saldo guardado por pestaña, capital fijo/aleatorio, ciclos manuales/automáticos, timer del estudiante, préstamo porcentual, banco de 50 eventos, noticias, seguimiento docente por apartados y resultados financieros disgregados. Consulta `CORRECCIONES_29_08_2026.md` para el detalle completo.

## Mejora GLB de realismo 3D
La versión actual incorpora modelos GLB locales para NPCs, bolsos, caja/POS, estanterías y mobiliario. Los NPC utilizan animaciones con `THREE.AnimationMixer` y existe fallback procedural si un recurso no carga. Ver `MODELOS_GLB_REALISMO.md`.

## Realismo visual: sombras, entorno PMREM y post-procesado (actualización 31/08/2026)
Se incorporó un segundo nivel de realismo sobre la base GLB existente, apoyado en las librerías de referencia `three.js` (r0.180.0) y `postprocessing` (pmndrs, v6.39.4):

- **Sombras dinámicas**: la luz solar (`sunLight`) proyecta sombras suaves (`PCFSoftShadowMap`) sobre toda la tienda y el mobiliario cercano. El vidrio queda excluido para no generar sombras sólidas irreales.
- **Mapa de entorno PMREM**: se genera un entorno de iluminación (`RoomEnvironment` + `THREE.PMREMGenerator`) que mejora los reflejos del piso de madera, el mostrador y los vidrios de la fachada.
- **Post-procesado**: `EffectComposer` con Bloom (brillos de luces/vidrieras), SMAA (antialiasing) y viñeta sutil. En calidad **Alta** se suma Ambient Occlusion (SSAO) con un `NormalPass` dedicado para reforzar el contacto de los objetos con el piso.
- **Todo ligado a la calidad gráfica existente** (`Baja/Media/Alta/Auto`): en Baja se desactivan sombras y post-procesado para máximo rendimiento; Media/Auto activan sombras + Bloom/SMAA/viñeta; Alta suma SSAO. Cambiar la calidad desde el panel de ajustes reconstruye estos efectos al instante.
- **Carga tolerante a fallos**: si el CDN de `postprocessing` o el módulo `RoomEnvironment` no cargan (sin conexión, bloqueo de red, etc.), el simulador sigue funcionando exactamente igual que antes, solo sin estas mejoras visuales.
- Requiere el `<script type="importmap">` agregado en `index.html` que resuelve `three`, `three/addons/` y `postprocessing` a CDN (jsDelivr), manteniendo el mismo enfoque sin build step que ya usaba el proyecto.
