# DOP por cantidad deseada — 22/10/2026

## Alcance y punto de partida

Base: `7cb8e98`. Repositorio inicialmente limpio. Se conserva el menú de decisiones y no se modifican avatares ni mundo 3D. No se ejecuta SQL en producción.

Fuente de verdad: copia íntegra del archivo proporcionado, `.codex-work/DECISIONES_SIDE_16.xlsx`, SHA-256 `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`. Se leen fórmulas y valores en dos pasadas y el original no se sobrescribe. Los recálculos se realizarán sobre copias dentro de SIDE1.

## Antes

El objetivo ya multiplicaba coeficientes por molde para ciertos insumos, pero los nodos principales del DOP usaban `producibleUnits`, limitado por existencias y capacidad. Las materias primas del diagrama mostraban disponibilidad en lugar de necesidad; la antigua recomendación repartía la capacidad instalada entre moldes. Así, una meta positiva con almacén vacío podía mostrar un proceso de cero unidades.

## Contrato solicitado

1. La cantidad deseada y el molde definen los requisitos, sin leer existencias.
2. El DOP muestra primero esos requisitos de la meta.
3. Después se comparan necesidades y recursos disponibles, con faltantes, sobrantes y costos que el Excel permita determinar.
4. La producción ejecutable del motor puede seguir limitada por recursos; no se confunde con la meta ni se utiliza para construir sus necesidades.
5. Una comparación o estimación no compra recursos ni descuenta caja automáticamente.

## Criterios de Excel detectados

Las hojas de cantidad y costos tienen reglas de capacidad distintas. Cada resultado conservará su hoja y celda de procedencia; no se forzará una igualdad inexistente entre ellas. El libro no define una dotación inversa única de trabajadores y máquinas para cualquier meta, ni un redondeo de contratación mínimo. Esas ausencias se indicarán explícitamente y no se reemplazarán por fórmulas inventadas.

## Estado de trabajo

- Excel: lectura de fórmulas, celdas y casos esperados en curso.
- Código: separación de requisitos y comparación en curso.
- Auditoría: revisión de costos, unidades, capacidad, consumo, consecuencias y caja en curso.
- UI: meta como entrada principal y comparación posterior en curso.
- Pruebas: pendientes del contrato final; oráculo Excel real, SIM-1/2/3, Node y navegador se ejecutarán secuencialmente.
- Publicación: pendiente de validación. No se presentan resultados anteriores como verificación de esta entrega.
