# Guía de continuidad local de SIDE

Repositorio: https://github.com/valenlysm29/SIDE1; rama de desarrollo: `logia_prueba_mejora`.

## Instalación

1. Clonar el repositorio y cambiar a `logia_prueba_mejora`. Ejecutar los comandos desde la raíz del proyecto.
2. Instalar Node.js, Python, Docker Desktop y las dependencias con `npm ci`. La versión fijada de la CLI de Supabase figura en `package-lock.json`. Algunas pruebas usan PGlite o Playwright y requieren instalarlos localmente para la ejecución específica; no forman parte del contrato de `npm ci` actual.
3. Configurar un proyecto de Supabase local aislado y sus puertos en un directorio bajo `.codex-work/`; no reutilizar un puerto de otra instancia. El esquema base y las migraciones deben aplicarse en el orden adecuado. La instalación no es automática ni está validada desde cero con todas las migraciones de este repositorio.
4. Para el navegador, `js/config.js` contiene la URL y clave publicable del entorno configurado. Para pruebas locales, usar una configuración local aislada; nunca incorporar claves de servicio o archivos `.env` al repositorio.
5. Iniciar `python servidor_local.py --no-browser` y abrir la dirección local que muestra. Para el cierre en servidor, `services/business_worker.cjs` requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en el entorno del servidor. La función Edge también requiere esos valores y valida un token de trabajo guardado en Vault; no incluirlos en frontend ni documentación.
6. Ejecutar pruebas focalizadas con `node --test <archivos>`; la suite general es `node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs tests/*.test.cjs`. Algunas pruebas requieren navegador y contenedores Docker. Consultar `reports/auditoria_parcial_side_20261031.md` antes de interpretar los fallos conocidos.

## Arquitectura

Las páginas `index.html` y `docente.html` cargan interfaz y servicios en `js/` y `services/`. PostgreSQL y sus RPC guardan sesiones, decisiones, pedidos, recepciones y cierres. `js/production_model.js` calcula capacidad y materiales; `js/cycle_model.js` integra la liquidación; `js/financial_model.js` construye estados financieros. El worker y `supabase/functions/side-business-close/` usan el mismo cierre empaquetado. El Laboratorio consulta cierres oficiales y calcula escenarios de solo lectura cuando dispone de datos verificables.

No ejecutar migraciones o desplegar funciones en un entorno compartido sin comprobar compatibilidad y autorización. Si una conexión falla, comprobar primero puertos locales, autenticación y migraciones instaladas; no eliminar datos ni restablecer una instancia ajena.
