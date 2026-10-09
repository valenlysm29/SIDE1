# Diagnóstico inicial: Godot, 1080p y 24 NPC

Fecha: 9 de octubre de 2026. Repositorio: SIDE1 (`origin`: valenlysm29/SIDE1).
Rama de trabajo: `codex/godot-world-1080p`. Auditoría de exploración realizada
por tres subagentes en paralelo, exclusivamente mediante lectura, antes de editar.
Los ocho frentes solicitados se distribuyen en tandas por el límite de cuatro
agentes simultáneos. Respaldo local: `.codex-work/godot-audit-20261009/`.

## Estado real de partida

El checkout ya incluye una losa continua de 176 × 176 m, jugador, tienda,
24 NPC persistentes, NavigationRegion3D, MultiMesh, ambiente y siete pruebas.
No hay cargas de escena al cruzar la tienda. Las caras superiores de los
acabados están separadas milímetros; la colisión de apoyo es una sola losa
con superficie en y=0. No encontramos un hueco estructural de suelo en el
código actual. Las métricas y logs de entregas anteriores no se presentan
como mediciones nuevas de esta intervención.

## Causas y correcciones propuestas

| Problema | Causa concreta en la versión inicial | Corrección y prueba necesaria |
| --- | --- | --- |
| Personajes se atraviesan | Player.tscn y Npc.tscn tienen máscara 1: sólo consultan mundo | Jugador máscara 3, NPC máscara 7; contacto real entre cápsulas |
| Se atraviesan bancos, farolas y árboles | Bancos creados sin colisión; postes/troncos sólo son MultiMesh | Cajas físicas a escala, incorporadas a la navegación; barridos de cápsula |
| Frontera no sólida | Valla exclusivamente visual; jugador limitado mediante clamp | Vallado visible y cuerpos sólidos; carrera y salto contra límite |
| Agentes atraviesan peatones quietos o lejanos | IDLE/INTERACT y LOD desregistran avoidance | Mantener agentes registrados con velocidad cero al esperar; contactos y LOD |
| Atasco sin recuperación | No se mide progreso hacia destino | Recalcular/escoger ruta conectada con temporización, sin teleport |
| Reposición bloqueada | Manager abandona al encontrar primer slot ocupado | Buscar otros slots fuera de cámara y comprobar suelo y volumen libre |
| Saltos repetidos | Se consulta espacio sostenido cada aterrizaje | Salto por nueva pulsación; prueba de mantener tecla |
| Movimiento brusco y jitter potencial | Velocidad instantánea, cámara desde input e interpolación implícita | Aceleración configurable, rotación en física, 60 Hz e interpolación explícita |
| Bordillos sin manejo | No hay subida de escalón; mapa actual plano | Barridos de cápsula con techo y apoyo; fixtures de bordillo, muro y rampa |
| Popping | visibility_range_end entre 65 y 110 m sin transición | Conservar geometría visible del barrio, optimizar lotes y medir coste |
| Benchmark insuficiente | Sólo panorama, 720p, 12 s de muestra y NPC aleatorios | Línea base nueva y comparación a 1080p con mismas vistas, calidad y población |

## Decisiones de validación

El usuario confirmó **esta PC, 1920 × 1080 y 24 NPC**. Hardware detectado:
i5-12500H, RTX 3050 Laptop e Iris Xe; el log gráfico debe confirmar qué GPU
usa Godot. Motor local disponible: Godot 4.7.2 oficial. Se mantiene
Compatibility y GodotPhysics3D para conservar el comportamiento de partida;
un cambio a Jolt necesita su propia comparación antes de adoptarlo.

La navegación actual deriva BoxShape3D sobre un plano. Es apropiada para
este mapa plano; no representa automáticamente plantas superpuestas ni
rampas futuras. Las pruebas de rampas verificarán el controlador, no una
capacidad inexistente del generador de navegación.

Se aplica la skill instalada de anthropics/skills `doc-coauthoring` a la
estructura, trazabilidad y revisión independiente de la entrega. Las skills
web no son un sustituto de las pruebas del ejecutable Godot.

La entrega deberá distinguir reducción de draw calls, tiempo real de frame,
monitores de proceso/física y FPS observados. No se mide tiempo GPU aislado.
No se afirmará alcanzar 60 FPS estables si los
percentiles de las mediciones no lo sostienen.
