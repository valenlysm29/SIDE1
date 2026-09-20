# Integración Frontend ↔ Supabase (SIDE)

Fecha: 2026-09-20 · Rama: `develop`

## 1. Qué se hizo y por qué

El frontend guardaba todo en `localStorage` del navegador: decisiones,
reportes, configuración y estado del juego. Esto impedía que profesor y
estudiantes compartieran datos entre dispositivos.

Se agregó una **capa de servicios** (`services/`) que sincroniza con
Supabase sin romper el modo local. Si Supabase falla o no está configurado,
la app sigue funcionando con `localStorage` como antes.

## 2. Arquitectura

```
index.html
  └─ config.js                    → URL + key del proyecto Supabase
  └─ services/supabase_client.js  → crea el cliente (singleton)
  └─ services/partida_service.js  → partidas (buscar, crear, avanzar ciclo)
  └─ services/empresa_service.js  → empresas (crear, estado del juego)
  └─ services/decisiones_service.js → decisiones (guardar, reporte)
  └─ app.js                       → UI + lógica (usa los servicios)
```

Reglas:
- Cada servicio tiene **una responsabilidad** y no toca UI.
- Todas las funciones retornan `{ success, data?, error?, offline? }`.
- Nunca se lanza excepción hacia la UI; los errores se registran en consola.
- `localStorage` sigue siendo la fuente local; Supabase es sincronización.

## 3. Tablas y RPCs usadas

| Recurso Supabase | Origen | Uso en frontend |
|---|---|---|
| `partidas` | `supabase_schema.sql` + migración | Crear partida, leer config |
| `participantes` | `supabase_schema.sql` + migración | Vínculo estudiante → empresa |
| `profesores` | `supabase_schema.sql` + migración | Perfil del docente (trigger) |
| `empresas` | Existente + migración | Crear empresa al unirse |
| `decisiones_catalogo` | Existente + migración (poblado) | Catálogo de decisiones |
| `decisiones_opciones` | Existente + migración (poblado) | Opciones por decisión |
| `empresas_decisiones` | Existente + migración | Decisiones guardadas por ciclo |
| `reportes_ciclo` | Migración (nueva) | Reportes para el docente |
| `eventos_estudiante` | Migración (nueva) | Eventos por estudiante |
| RPC `buscar_partida_por_codigo` | Migración | Estudiante busca partida |
| RPC `crear_empresa` | Migración | Crea empresa + participante |
| RPC `guardar_decisiones` | Migración | Guarda decisiones del ciclo |
| RPC `obtener_estado_juego` | Migración | Estado para el estudiante |
| RPC `obtener_reporte_empresa` | Migración | Reporte para el docente |
| RPC `avanzar_ciclo` | Migración | Profesor avanza el ciclo |

Script SQL: `docs/supabase_migration.sql` (ejecutar en SQL Editor una vez).

## 4. Cambios en archivos existentes

| Archivo | Cambio | Líneas aprox. |
|---|---|---|
| `index.html` | 4 `<script>` de servicios tras `config.js` | — |
| `app.js` | `currentStudent` agrega `empresaId` | ~24 |
| `app.js` | Join usa `PartidaService` + `EmpresaService` (con fallback local) | ~143-165 |
| `app.js` | `syncSectionToSupabase(cat)` implementada + `buildSupabaseDecision()` | ~728+ |
| `config.js` | URL + key del proyecto real | 4-5 |

## 5. Fases de verificación

### Fase A — Join del estudiante
1. Profesor crea partida en Supabase (o usa RPC/trigger).
2. Estudiante ingresa código + empresa en la web local.
3. Verificar en Supabase → Table Editor:
   - `empresas`: aparece la fila con `nombre_comercial`.
   - `participantes`: aparece la fila vinculada (`empresa_id` lleno).

### Fase B — Guardado de decisiones
1. Estudiante toma decisiones y guarda la sección.
2. Verificar en Supabase → `empresas_decisiones`:
   - Filas con `empresa_id`, `ciclo`, `decision_id`, `opcion_id`, `enviada=true`.

### Fase C — Pendiente
- `docente.js`: crear partida, leer reportes, avanzar ciclo.
- Cargar `obtenerEstadoJuego` al entrar (sincronizar ciclo/config).

## 6. Cómo testear en local

```bash
# Desde la carpeta SIDE1:
python3 servidor_local.py
# Abrir http://localhost:8000
```

Probar servicios desde la consola del navegador (F12):

```js
// 1. Verificar cliente
SIDE.SupabaseClient.isReady(); // debe ser true

// 2. Buscar partida (reemplazar CODIGO)
await SIDE.PartidaService.buscarPorCodigo('SIDE-XXXX');

// 3. Ver estado de empresa (reemplazar ID)
await SIDE.EmpresaService.obtenerEstado(1);

// 4. Ver reporte de empresa
await SIDE.DecisionesService.obtenerReporte(1);
```

Luego verificar las filas en Supabase Dashboard → Table Editor.

## 7. Fase C1 — El docente crea la partida en Supabase

**Archivos:** `docente.html` (4 `<script>` de servicios) + `docente.js`
(`state.partidaId`, `ensureSupabasePartida()`, `startGame()` ahora async).

**Flujo:** Guardar e iniciar partida → `saveConfig()` (local, como antes) →
`ensureSupabasePartida()` → `PartidaService.crear()` (INSERT en `partidas`
con nombre, curso, configuración y eventos) → se guarda el `partidaId` en
`state` + `localStorage (SIDE_PARTIDA_ID)` y el `codigo` real generado por
la base reemplaza al código local en el formulario.

**Reglas:** si Supabase no está disponible o la creación falla, se avisa con
toast y se continúa en modo local sin bloquear. Si ya existe `partidaId`,
no se crea otra (una partida activa por flujo).

**Fix anti-doble-clic:** la primera versión creaba partidas duplicadas si el
docente pulsaba el botón dos veces seguidas (`state.partidaId` solo se
seteaba al terminar el RPC). Se agregó `creatingPartida` (promesa en curso
que las llamadas concurrentes reutilizan) + el botón se deshabilita mientras
crea y se rehabilita en `finally`.

**Verificación:** fila nueva en `partidas` con la configuración; el
estudiante entra con ese código (Fase A) y aparecen `empresas` +
`participantes`.

## 8. Cómo extender (para el equipo)

Para agregar una operación nueva:

1. Crear la RPC o tabla en Supabase (SQL Editor).
2. Agregar la función en el servicio que corresponda (`services/*.js`)
   con JSDoc (qué hace, @param, @returns).
3. Llamarla desde `app.js`/`docente.js` verificando `SIDE.XxxService`
   y manteniendo el fallback a `localStorage`.
4. Documentar la función en la tabla de la sección 3 de este archivo.

No agregar acceso directo a `supabaseClient` fuera de `services/`.

## 9. Solución de problemas

| Síntoma | Causa probable | Fix |
|---|---|---|
| `guardar_decisiones` falla con error `42P10` | Falta el UNIQUE en `empresas_decisiones(empresa_id, ciclo, decision_id)` | Ejecutar la sección 14 del `supabase_migration.sql` (crea el constraint) |
| Join dice "no encontramos partida" | `estado` distinto de `esperando` o código con espacios | `UPDATE partidas SET estado='esperando'`; copiar el código exacto |
| Registro no redirige | Confirmación por correo activada en Auth | Desactivar "Confirm email" en Authentication → Settings |
| `profesores` vacío tras registro | El trigger no disparó | Insert manual con el UID de Authentication → Users |
| El navegador traduce `SIDE-XXXX` a otro texto | Traductor automático del navegador | Desactivar traducción en la pestaña de Supabase |
