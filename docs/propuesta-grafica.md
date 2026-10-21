# Propuesta gráfica SIDE — 21 de octubre de 2026

## Refinamiento con frontend-design

Dirección: panel de trabajo académico para configurar y seguir simulaciones.
Se conserva la paleta explícita de la facultad: azul general `#081a34`, azul
de panel `#09182f`, lateral `#030712`, selección `#023863`, celeste `#39d0ff`
y blanco `#f8feff`. Poppins 600 para títulos y acciones, 500 para campos y
400–500 para lectura. Alineación de contenido a la izquierda.

En escritorio se conserva la navegación lateral y la grilla de dos columnas.
En móvil se compararon la tira horizontal y una grilla de navegación: se
elige la grilla porque permite descubrir todas las secciones sin deslizar.

```text
Escritorio                 Móvil
SIDE | Título / acciones    SIDE          Volver
Menú | Estado              Secciones en 3 columnas
     | Panel  | Panel      Título / acciones compactas
     | Panel  | Panel      Estado / paneles verticales
```

La revisión mantiene los títulos celestes en mayúsculas, bordes finos y fondos
oscuros porque son parte del encargo. Se evita añadir tarjetas decorativas,
animaciones o etiquetas sin función. El refinamiento reduce el espacio de
cabecera en móvil, distingue la acción de guardar y limita las líneas de las
descripciones. Se verifica la navegación tanto antes de iniciar una partida
como con la sección Rondas y eventos visible.

Aplicada al panel docente (`docente.html`) a partir de las tres páginas de
`web graficas.pdf` y de la flecha entregada por el usuario.

| Elemento | Valor de la propuesta |
| --- | --- |
| Fondo general | `#081a34` |
| Paneles y campos | `#09182f` |
| Barra lateral | `#030712` |
| Selección y cajas informativas | `#023863` |
| Acentos y bordes | `#39d0ff` |
| Texto principal | `#f8feff` |
| Texto secundario | `#f8feff` al 70 % |
| Tipografía | Poppins, archivos locales, pesos 400–800 |

Los títulos de las cajas aparecen en mayúsculas y celeste. Las etiquetas y
los campos usan 14 px; las descripciones conservan ese tamaño con menor
opacidad. Los estados de error y éxito mantienen sus colores semánticos.

La hoja `css/faculty-theme.css` se carga al final del panel docente para
conservar su distribución adaptable y los componentes de trabajo existentes.
No modifica la lógica, las reglas financieras ni la base de datos. Los campos,
avisos y secciones actuales se conservan aunque no aparezcan en la maqueta.

La marca SIDE de esta vista usa una composición tipográfica blanca en Poppins
ExtraBold Italic. La flecha original se conserva en WebP y se muestra mediante
una máscara CSS, con su margen transparente compensado y el color del botón.

Poppins procede del repositorio Google Fonts (`ofl/poppins`) y se distribuye
con su licencia en `LICENSES/Poppins-OFL.txt`.

Verificación visual aislada: `python tests/faculty_theme_ui.py` (requiere
Playwright y Chrome). Genera capturas y comprobaciones en
`tests/output/faculty-theme/`. La prueba utiliza datos en memoria y bloquea la
red; no crea cuentas ni partidas remotas.
