// masters/reel_packing_master.js
// Source: 02-master-architecture.md §Reel Type / Packing Type Master
// packing_cost_per_meter is applied to the TOTAL ORDER LENGTH (not L_eff) — fixes bug C2.
// applies_to: 'reel' = a reel type; 'packing' = a packing/crating type; 'both' = either context.

export const REEL_PACKING_MASTER = Object.freeze([
  { id: 'RPK-HDPE',    code: 'HDPE Packing',    name: 'HDPE Packing',    packing_cost_per_meter: 90.00,  applies_to: 'packing', active: true },
  { id: 'RPK-WOODEN',  code: 'Wooden Crate',    name: 'Wooden Crate',    packing_cost_per_meter: 12.00,  applies_to: 'packing', active: true },
  { id: 'RPK-STEEL',   code: 'Steel Crate',     name: 'Steel Crate',     packing_cost_per_meter: 200.00, applies_to: 'packing', active: true },
  { id: 'RPK-TWIN',     code: 'Twin Roll',      name: 'Twin Roll',       packing_cost_per_meter: 4.00,   applies_to: 'reel',    active: true },
  { id: 'RPK-CASSETTE',code: 'Cassette Reel',   name: 'Cassette Reel',   packing_cost_per_meter: 6.00,   applies_to: 'reel',    active: true },
  { id: 'RPK-SINGLE',  code: 'Single Roll',     name: 'Single Roll',     packing_cost_per_meter: 3.00,   applies_to: 'reel',    active: true },
]);
