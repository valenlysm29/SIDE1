# Organización de SIDE1 — 30 de septiembre de 2026

Se trasladaron 75 archivos conservando su contenido o actualizando únicamente
sus referencias cuando correspondía. La raíz pasó de 45 archivos a 9, incluida
la nueva guía `README.md`. No se borraron documentos, modelos ni entregas.

- JavaScript de las páginas: `js/`.
- Hojas de estilo: `css/`.
- Esquema SQL: `supabase/schema.sql`; migraciones: `supabase/migrations/`.
- Licencias antes mezcladas con documentación: `LICENSES/`.
- Registros históricos: `reports/legacy/`.
- Evidencias anteriores: `tests/output/legacy/`.
- Paquete de entrega anterior y su checksum: `output/entregas/`.
- Nota de prueba anterior: `archive/notes/`.

Se actualizaron páginas HTML, imports del simulador, herramientas de vista
previa, documentación y pruebas. Las imágenes de las hojas de estilo ahora
usan rutas relativas a `css/`. Una referencia móvil preexistente a
`assets/new/home-mobile.png`, que no existe, se corrigió para usar
`assets/landing_bg.png`.

Validación:

- 241 pruebas automatizadas aprobadas.
- 2 pruebas del servidor local aprobadas.
- 11 comprobaciones de entrega y estilos aprobadas tras el ajuste final.
- Prueba de navegador con WebGL aprobada: ciudad, peatones animados, cámara,
  colisiones, entrada a tienda, selección de distrito y diseño móvil.
- 26 rutas de imágenes e imports comprobadas.
- Los 75 archivos trasladados existen en su nueva ubicación; sus huellas
  antes y después están en `moves_2026-09-30.json`.

Los cambios locales anteriores se conservaron. La carpeta `reports/` que ya
existía fuera de SIDE1 no se modificó. No se ejecutaron migraciones en Supabase,
commits ni pushes. El ZIP anterior se conservó sin regenerarlo.
