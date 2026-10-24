# Frontera del mundo recreativo

`js/shared/world_bridge.js` se carga antes de `app.js` y `simulator3d.js`.

- `SIDE_WORLD_BRIDGE.getWorldSnapshot()` devuelve una copia nueva, profunda y congelada recursivamente. Solo contiene `company`, `cycle`, `products`, `approximateStock`, `storeLevel`, `news` y `events`. Consultarla no ejecuta funciones del motor ni escribe almacenamiento. Sin una publicación válida conserva la última copia o valores de respaldo.
- `SIDE_WORLD_PUBLISHER.publish(snapshot)` pertenece al 2D. Copia y congela antes de publicar; una publicación no serializable se rechaza sin sustituir el snapshot válido. `app.js` proyecta solo atributos visuales desde sus propios hooks; no publica ledger, caja, crédito, planes confirmados ni reportes financieros. Las publicaciones parciales actualizan únicamente los campos entregados.
- `SIDE_WORLD_BRIDGE.emitFunSale({context, points})` incrementa clientes atendidos y puntos locales, en `side3d_fun_receipts_<context>`. Devuelve una copia congelada. Nunca llama al motor ni a Supabase. `simulator3d.js` conserva también su turno, productos, pedidos, devoluciones y mejoras dentro de `side3d_fun_*`.
- `SIDE_WORLD_NAVIGATION.openDecisions(category)` es navegación de interfaz. La Tablet conserva los controles económicos 2D habituales. Cerrarla vuelve al turno recreativo. El mundo no recibe funciones contables.

La admisión legítima a una sala se mantiene; una sesión admitida puede seguir jugando con el motor desconectado o el ciclo económico pausado. La cancelación y expulsión explícitas continúan siendo controles de acceso. El cierre económico no consulta la sesión, contadores, precios ni inventario recreativos. Los datos antiguos `side3d_*` no se reutilizan como economía ni se borran; la defensa previa del ledger heredado permanece intacta.

No se necesita persistencia recreativa en Supabase. El SQL de `supabase/migrations/2026-10-23_separacion_2d_3d.sql` retira únicamente dos triggers históricos interferentes; se aplica manualmente después del paquete de cierre vigente si aún estaba pendiente. El propio archivo documenta orden y reversión.

Los recursos de juego y pedidos sobreviven a recargas dentro de la misma empresa/sala/ciclo. El código de sala procede de `company.gameCode` publicado, no de un texto del lobby. El acumulado recreativo de gastos no se reinicia al reconstruir el turno, para que una entrega pendiente conserve su costo local. El aviso de costos económicos se difiere mientras está visible el mundo o su pantalla de carga; vuelve a mostrarse al abrir la interfaz 2D, sin recalcular cargos.
