# Sistema de diseño de SIDE

Versión inicial: 01/10/2026. Fuente de tokens: `css/design-system.css`.

SIDE conserva su logo, las superficies azul oscuro y la acción principal dorada.
El diseño expresa una empresa que se administra durante una partida: cifras
legibles, controles explícitos y estados de decisión visibles. Las ilustraciones,
el mundo 3D, los avatares y los iconos existentes mantienen su identidad.

## Carga y migración

`index.html` y `docente.html` cargan el sistema **antes** de sus hojas específicas.
`tutorial.html` es un fragmento que se inserta en la página del estudiante y hereda
los tokens; no necesita cargar otra hoja. Los tokens llevan el prefijo `--side-`
para evitar colisiones con Three.js y con las variables locales de cada pantalla.

Esta primera migración conecta la base de `styles.css`, el botón `.primary-gold`,
los alias docentes y los alias `--ui-*` del panel de decisiones. Preserva los
matices de las superficies de producción mediante tokens semánticos propios.
El oro de decisiones converge a `#ffd329` y el texto secundario docente a
`#a3b8c9`. La distribución de las pantallas se migra por separado.

No aplicar estilos globales de tamaño, posición o fondo a todos los botones del
simulador. Los componentes `.side-*` son optativos. Cada pantalla conserva sus
selectores, su comportamiento, su orden de carga y sus reglas responsivas.

## Color

| Token (prefijo `--side-`) | Valor | Uso |
| --- | --- | --- |
| `canvas` | `#020716` | Fondo principal |
| `panel` | `#06172e` | Panel estándar |
| `panel-raised` | `#0b1d36` | Controles y superficies elevadas |
| `panel-inset` | `#071726` | Campos y fondos interiores |
| `decision-canvas` | `#061321` | Entorno de la Tablet |
| `decision-panel` | `#091c2f` | Paneles de producción |
| `decision-raised` | `#0d263d` | Cabeceras de producción |
| `line` | `#294358` | Separadores decorativos |
| `line-subtle` | `rgba(255,255,255,.10)` | Bordes de panel, sin función interactiva |
| `line-control` | `#5c7890` | Límite visible de campos y controles |
| `text` / `text-bright` | `#eef5fa` / `#fff` | Texto principal / énfasis |
| `text-muted` | `#a3b8c9` | Ayuda y texto secundario |
| `gold` | `#ffd329` | Acción, selección, presupuesto y foco |
| `gold-light` / `gold-deep` | `#ffe985` / `#e7a800` | Gradiente de acción principal |
| `gold-ink` / `gold-edge` | `#501800` / `#8c5100` | Texto y relieve del botón dorado |
| `blue` / `blue-strong` | `#84cfff` / `#2f9bff` | Información / detalles gráficos existentes |
| `success` / `success-strong` | `#8be6b2` / `#5be89a` | Guardado y enviado / acento existente |
| `danger` / `danger-strong` | `#ff8b9a` / `#ff6d7d` | Error y bloqueo / acento existente |

Los acentos `*-strong` preservan elementos actuales. Para texto pequeño nuevo
usar los acentos claros. `line` y `line-subtle` no garantizan contraste de 3:1;
un control que dependa de su borde debe usar `line-control`.

## Tipografía

`--side-font`: **Montserrat**, Arial, sans-serif. Se conserva la fuente cargada
por SIDE; el sistema no agrega solicitudes de red ni fuentes nuevas. La Tablet
mantiene las reglas tipográficas heredadas hasta su migración específica.

| Token | Tamaño a raíz de 16 px | Uso |
| --- | --- | --- |
| `text-xs` | 12 px | Metadatos breves |
| `text-sm` | 14 px | Ayuda y controles |
| `text-md` | 16 px | Contenido principal |
| `text-lg` | 20 px | Títulos de sección |
| `text-xl` | 26 px | Títulos de pantalla |
| `text-2xl` | 36 px | Presentación de partida |
| `text-display` | 48 px | Hitos y resultados destacados |

Pesos: `weight-body` 500, `weight-label` 700, `weight-action` 800 y
`weight-title` 900. Interlineado: `leading-body` 1.55, `leading-title` 1.2.
El texto explicativo usa un máximo recomendado de 72 caracteres por línea.
Las cantidades comparables usan `.side-number` para alinear las cifras.
Usar mayúscula inicial y acciones concretas: «Guardar decisión», «Ver resultados».
No truncar nombres, instrucciones ni estados para encajar contenido en español.

## Espacio, forma y profundidad

Base de 4 px. Tokens `space-1/2/3/4/5/6/8/10`: **4/8/12/16/20/24/32/40 px**.
`space-panel` es `clamp(16px, 2vw, 24px)` para mantener margen en móvil.

Radios: `radius-sm` 8 px, `radius-control` 12 px, `radius-card` 18 px,
`radius-modal` 24 px, `radius-pill` 999 px. `radius-production` conserva los
14 px existentes para la migración gradual del diagrama productivo.

Sombras: `shadow-card` para paneles principales, `shadow-modal` para diálogos,
`shadow-soft` para producción y `shadow-action` para el relieve dorado.
No añadir sombras ni desenfoques al canvas 3D o a cada métrica del HUD.
La transición de controles es `transition` (160 ms); se desactiva cuando la
persona solicita movimiento reducido. No animar automáticamente cifras o estados.

## Componentes y estados

```html
<section class="side-panel">
  <h2>Presupuesto del ciclo</h2>
  <p class="side-prose">Revisa la caja disponible antes de enviar tus decisiones.</p>
  <label for="cantidad">Cantidad</label>
  <input id="cantidad" class="side-field" type="number" min="0">
  <button type="button" class="side-button side-button--primary">
    Guardar decisión
  </button>
  <span class="side-status side-status--success">Decisión guardada</span>
</section>
```

Los ejemplos no representan datos de partida. La lógica existente determina
los importes y cuándo una decisión está guardada, enviada o bloqueada.

| Estado | Representación |
| --- | --- |
| Normal | Fondo navy, borde visible; acción principal dorada |
| Hover | Borde dorado o aclarado del botón principal |
| Activo | Relieve interior; no desplazar el layout |
| Foco de teclado | Contorno dorado de 3 px, separado 3 px |
| Deshabilitado | Fondo interior, texto secundario, sin sombra; atributo `disabled` |
| Guardado / enviado | `.side-status--success` y texto explícito |
| Atención / presupuesto | `.side-status--warning` y explicación |
| Error / bloqueado | `.side-status--danger` y razón del bloqueo |

El color acompaña siempre a una etiqueta; no sustituye la explicación. El botón
primario migrado y los controles `.side-button` / `.side-field` tienen una altura
mínima de 44 px. `.side-button` también tiene ancho mínimo de 44 px. Para un
botón con sólo un icono, agregar `aria-label`. No convertir etiquetas informativas
en botones ni agregar estados ficticios a los datos reales.

## Contraste y accesibilidad

Contrastes calculados con luminancia relativa sRGB (WCAG), sin opacidad. La
superficie `decision-raised` es la más clara de las superficies principales.

| Combinación | Relación |
| --- | --- |
| Texto `#eef5fa` sobre `#06172e` | 16.31:1 |
| Secundario `#a3b8c9` sobre `#0d263d` | 7.53:1 |
| Oro `#ffd329` sobre `#0d263d` | 10.72:1 |
| Azul `#84cfff` sobre `#0d263d` | 9.07:1 |
| Verde `#8be6b2` sobre `#0d263d` | 10.32:1 |
| Rojo `#ff8b9a` sobre `#0d263d` | 6.91:1 |
| Texto de botón `#501800` sobre `#e7a800` | 6.79:1 |
| Borde de control `#5c7890` sobre `#0d263d` | 3.34:1 |

Estas combinaciones superan 4.5:1 para texto normal y 3:1 para el borde del
control. El extremo más oscuro del gradiente dorado también supera AA. Cambiar
fondos, opacidad o añadir imágenes detrás exige verificar de nuevo el contraste.
Esta tabla no certifica las pantallas heredadas aún sin migrar.

Validar en 360, 390 y 768 px, además de horizontal: el foco debe quedar visible,
los textos deben envolver, el HUD no debe tapar los controles y el minimapa debe
seguir funcionando. Evitar transiciones o animaciones cuando
`prefers-reduced-motion: reduce`. El sistema no modifica decisiones, ciclos,
personajes, avatares ni el esquema de Supabase.

## Skills aplicadas

- `theme-factory`: organización de paleta y tipografía como tema propio SIDE.
- `brand-guidelines`: disciplina de identidad; por instrucción del proyecto,
  se conserva la marca SIDE y no se aplica la paleta de Anthropic.
- `frontend-design`: jerarquía, componentes concretos, foco, responsividad y
  uso restringido de efectos. La elección de tema ya estaba fijada por el usuario.
