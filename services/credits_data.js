(function exposeSideCredits(global) {
  'use strict';

  // Fuente única para la pantalla de créditos. Añadir futuras atribuciones como
  // objetos nuevos mantiene el contenido desacoplado del HTML y de Supabase.
  global.SIDE_CREDITS = Object.freeze([
    Object.freeze({
      id: 'shop-cash-register',
      title: 'Cash register',
      author: 'Poly by Google',
      source: 'Poly Pizza',
      sourceUrl: 'https://poly.pizza/m/crXBxFOkCIp',
      license: 'CC BY 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
      assets: Object.freeze(['shop_cash_register.glb']),
      attributionRequired: true
    }),
    Object.freeze({
      id: 'warehouse-pallet-truck',
      title: 'Pallet Truck',
      author: 'KolosStudios',
      source: 'Poly Pizza',
      sourceUrl: 'https://poly.pizza/m/snDq7v3GRO',
      license: 'CC BY 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
      assets: Object.freeze(['warehouse_pallet_truck.glb']),
      attributionRequired: true
    }),
    Object.freeze({
      id: 'warehouse-fabric-rolls',
      title: 'Rolls of towels',
      author: 'Poly by Google',
      source: 'Poly Pizza',
      sourceUrl: 'https://poly.pizza/m/fvvbrnh-Gmr',
      license: 'CC BY 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
      assets: Object.freeze(['warehouse_fabric_rolls.glb']),
      attributionRequired: true
    }),
    Object.freeze({
      id: 'warehouse-fire-extinguisher',
      title: 'Fire Extinguisher',
      author: 'dook',
      source: 'Poly Pizza',
      sourceUrl: 'https://poly.pizza/m/LtrzDvRya9',
      license: 'CC BY 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
      assets: Object.freeze(['warehouse_fire_extinguisher.glb']),
      attributionRequired: true
    }),
    Object.freeze({
      id: 'shop-furniture-kit',
      title: 'Furniture Kit 2.0',
      author: 'Kenney',
      source: 'Kenney',
      sourceUrl: 'https://kenney.nl/assets/furniture-kit',
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      assets: Object.freeze([
        'shop_table_display.glb',
        'shop_checkout_counter.glb',
        'shop_checkout_counter_end.glb',
        'shop_shelf_tall.glb',
        'shop_shelf_low.glb',
        'shop_mirror_wall.glb'
      ]),
      attributionRequired: false
    })
  ]);
})(window);
