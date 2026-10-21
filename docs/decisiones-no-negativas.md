# Valores no negativos en decisiones del estudiante

Los campos numéricos de la toma de decisiones y los precios del panel 3D
bloquean el signo menos. Al pegar un valor negativo se coloca cero. Los
eventos de entrada normalizan el valor visible antes de que el editor lo
registre en su borrador; los botones de cantidad tampoco bajan de cero.
Se conservan los decimales positivos y la posibilidad de vaciar un campo
mientras se edita. Los límites superiores y requisitos de cada decisión se
siguen aplicando al confirmar.

Los borradores tradicionales normalizan cantidades, personal, producción y
préstamos antes del cálculo y el guardado. El editor por lotes normaliza
precios, producción, compras, maquinaria, personal, tiendas y financiamiento,
incluidos los borradores restaurados. La compra de activos ya no utiliza
cantidades negativas para representar liquidaciones.

No se cambian los importes con signo de los estados financieros, movimientos
de caja o resultados históricos: una pérdida puede seguir mostrándose como
negativa. Esta validación de los editores no necesita una migración nueva.
La migración de expulsión de empresas sigue siendo necesaria para esa mejora.

Verificación: `python tests/decision_nonnegative_ui.py` con Playwright y Chrome.
Comprueba entrada, teclado, pegado, decrementos, guardado, borradores anteriores
y decimales positivos en los dos editores. Guarda las evidencias en
`tests/output/decision-nonnegative/`.
