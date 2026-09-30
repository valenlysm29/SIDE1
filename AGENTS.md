# Regla de ubicación del proyecto

Por instrucción explícita del usuario, todos los archivos y carpetas de trabajo
de este proyecto deben estar dentro de `SIDE1`, incluidos resultados, imágenes,
referencias, scripts auxiliares y archivos temporales. No crear una carpeta
`output` ni otros artefactos en el directorio padre de `SIDE1`.

Ejecutar los comandos de Git desde `SIDE1`, que es la raíz del repositorio.

## Regla permanente para futuras tareas

- Establecer `SIDE1` como directorio de trabajo antes de ejecutar comandos,
  scripts, pruebas, generación de archivos, commits o pushes.
- Resolver rutas de salida desde la raíz de `SIDE1`; no usar el directorio
  padre ni rutas `../` para guardar artefactos del proyecto.
- Guardar capturas y resultados en `tests/output/`, entregas en `output/`,
  documentación en `docs/` y análisis en `reports/`.
- Guardar JavaScript de las páginas en `js/`, estilos en `css/`, servicios
  en `services/`, el esquema SQL en `supabase/schema.sql` y migraciones en
  `supabase/migrations/`. Actualizar las rutas al mover archivos.
- Mantener en la raíz las páginas HTML, el lanzador, el servidor y las guías
  principales. Conservar licencias en `LICENSES/` e históricos en `archive/`,
  `reports/legacy/` o `tests/output/legacy/`, según su función.
- Las carpetas auxiliares `outputs/` y `.codex-work/` también pertenecen a
  `SIDE1`. Sus contenidos temporales permanecen locales e ignorados por Git.
- Antes de terminar, comprobar que el directorio contenedor del proyecto no
  tenga nuevos archivos o carpetas de trabajo de SIDE fuera de `SIDE1`.
- No modificar repositorios ni documentos ajenos que existan por encima de
  `SIDE1`; verificar que el remoto de Git sea el de este proyecto.
