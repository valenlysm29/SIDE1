'use strict';
// Compatibility entry point: Mona now shares the articulated NPC build pipeline.
process.argv[2]='mona';
require('./prepare_npcs.cjs');
