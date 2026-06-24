// masters/fabric_type_master.js
// Source: 02-master-architecture.md §Fabric Master Level A
// Fabric type (reinforcement family). Carries the type-level default price and length wastage %.
//
// length_wastage_pct: proportion added to ordered length to cover cutting/handling loss.
//   NN = 4%, EP/EE/EN/EEH = 3%, PP = 5%.  Open-end only — endless belts use splice_allowance_m.
//   null = data not yet confirmed for this type; engine falls back to belt_type_master.open_end_wastage_pct.
//
// Width wastage for cut-edge belts is a FIXED +30 mm regardless of fabric type.
//   It is applied in engine.js, NOT stored here.

export const FABRIC_TYPE_MASTER = Object.freeze([
  { id: 'FT-NN',  code: 'NN',  name: 'Nylon–Nylon (NN)',                              length_wastage_pct: 0.04, active: true },
  { id: 'FT-EP',  code: 'EP',  name: 'Polyester–Polyamide (EP)',                      length_wastage_pct: 0.03, active: true },
  { id: 'FT-EEH', code: 'EEH', name: 'Polyester–Polyester Heavy-duty (EEH)',          length_wastage_pct: 0.03, active: true },
  { id: 'FT-EE',  code: 'EE',  name: 'Polyester–Polyester (EE)',                      length_wastage_pct: 0.03, active: true },
  { id: 'FT-SW',  code: 'SW',  name: 'Straight Warp (SW)',                            length_wastage_pct: null, active: true },
  { id: 'FT-EM',  code: 'EM',  name: 'Polyester–Polyamide Monofilament Fabric (EM)', length_wastage_pct: null, active: true },
  { id: 'FT-EN',  code: 'EN',  name: 'Polyester–Nylon (EN)',                          length_wastage_pct: 0.03, active: true },
  { id: 'FT-PP',  code: 'PP',  name: 'Polypropylene–Polypropylene (PP)',              length_wastage_pct: 0.05, active: true },
]);
