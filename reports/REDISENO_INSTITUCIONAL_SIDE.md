# Rediseño institucional de SIDE — avance

## Alcance implementado

Se rediseñaron la bienvenida, la selección de perfiles y los formularios de acceso con fondo marino, tarjetas azules, contornos cian y botones claros. La barra inicial era un temporizador artificial y se retiró; Empezar queda disponible directamente. Se conservaron los campos, manejadores, autenticación y recuperación existentes; se añadió una explicación visible para recuperar una empresa. Los tokens compartidos del estudiante se alinearon con la paleta docente existente. El panel docente y el Laboratorio ya disponían de una hoja institucional; no se alteraron sus consultas ni su lógica.

## Archivos y recursos

- `index.html`: estructura de tarjetas, texto de ayuda y hoja institucional.
- `css/institutional.css`: paleta, Poppins local y estilos de acceso, perfiles y formularios.
- `js/app.js`: eliminación del temporizador de carga ficticia.
- `assets/icons/profile-person.webp`: icono entregado, utilizado en ambos perfiles.

La propuesta muestra una marca específica de la Facultad que no se encontró entre los recursos del proyecto. Se conserva el escudo UPCH ya existente como alternativa provisional; no se afirma que sea la marca específica autorizada para esta propuesta. También se conserva el logotipo SIDE existente, que difiere del de la propuesta. El archivo adjunto contiene un icono de persona; se reutiliza para ambos perfiles a falta de un recurso docente diferenciado.

## Identidad

Poppins local; fondo `#081a34`, panel `#09182f`, azul de tarjeta `#023863`, cian `#39d0ff`, texto `#f8feff` y secundario `#b4c5d3`. Los colores se basan en la propuesta y en la hoja docente existente, no en una especificación institucional externa verificada.

## Evidencia y pruebas

Las capturas están en `tests/output/`: `institucional-antes-inicio.png`, `institucional-antes-perfiles.png`, y las capturas `institucional-despues-*` para escritorio y móvil. Las capturas de propuesta renderizadas permanecen locales. Se verificó en Chromium a 1920, 1366, 768, 390 y 360 píxeles que Empezar abre perfiles y que ambas tarjetas abren y cierran sus formularios; no se observó desbordamiento horizontal de la página de perfiles. Se inspeccionaron visualmente inicio y formularios en escritorio y móvil.

- 31 pruebas seleccionadas de contabilidad, ciclos, productividad y créditos: aprobadas.
- `python tests/local_server_test.py`: 2 pruebas aprobadas.
- No existe un comando de compilación declarado en `package.json`.
- No se modificaron fórmulas, SQL, permisos ni persistencia. Las pruebas seleccionadas no constituyen una comparación exhaustiva de todos los resultados financieros antes y después.

## Pendiente

Este avance no completa la revisión visual y funcional integral de todas las pantallas internas, tablas, navegación, ciclos y estados del Laboratorio. Tampoco se verificaron inicio de sesión real de profesor, ingreso o recuperación reales de estudiante ni se recorrieron partidas con datos reales: requieren credenciales y una partida apropiada. Falta revisar foco y contraste de todos los componentes internos, así como recortes y superposiciones en las cinco resoluciones. La identidad aplicada mediante tokens compartidos requiere revisión detallada en los paneles estudiantiles. Solicitar al equipo de diseño el logotipo específico de la Facultad y el icono docente autorizado. No fusionar a main hasta completar estas validaciones.
