// masters/belt_type_master.js
// Source: 03-belt-type-matrix.md — 14 belt types
//
// PURPOSE
// Each belt type row declares which cost components are present.
// The calculation engine reads these flags and iterates only the declared
// components — adding a new belt type requires only one row here, no engine changes.
//
// FIELD REFERENCE
// ┌─────────────────────────────────┬──────────────────────────────────────────────────────┐
// │ Field                           │ Meaning                                              │
// ├─────────────────────────────────┼──────────────────────────────────────────────────────┤
// │ id                              │ Unique key  e.g. 'BT-MULTIPLY'                       │
// │ code                            │ Business code used in forms / API                    │
// │ name                            │ Display label shown in UI                            │
// │ product_type_code               │ Always 'CB' (Conveyor Belt) — reserved for future    │
// │ calc_family                     │ Engine routing: BASE | BASE_BREAKER | BASE_CLEAT |   │
// │                                 │   SIDEWALL | FULL | BASE_PIPE                        │
// │ ravasco_sub_category_code       │ Always 'TEXTILE' for this master                     │
// │ has_*                           │ Boolean flags — true = component is costed           │
// │ length_rule                     │ 'open_end'  → effective_length × (1 + wastage_pct)  │
// │                                 │ 'endless'   → ordered_length  + splice_allowance_m  │
// │ open_end_wastage_pct            │ Cutting waste as a decimal  e.g. 0.03 = 3 %         │
// │ splice_allowance_m              │ Flat metre addition for endless belts                │
// │ cost_of_production_rate_per_kg  │ Labour + overhead in ₹/kg (§04-calculation-engine)  │
// │ active                          │ false = v2 placeholder, hidden in UI                 │
// │ phase                           │ 1 = live in v1,  2 = not yet implemented             │
// └─────────────────────────────────┴──────────────────────────────────────────────────────┘
//
// COMPONENT FLAGS QUICK-REFERENCE
//   BASE         : top_cover  bottom_cover  fabric  skim
//   BASE_BREAKER : BASE + breaker (top and/or bottom)
//   BASE_CLEAT   : BASE + cleat
//   SIDEWALL     : BASE + sidewall + solution + hardener
//   FULL         : BASE + cleat + sidewall + blinker + solution + hardener
//   BASE_PIPE    : BASE  (pipe geometry handled separately in v2)

export const BELT_TYPE_MASTER = Object.freeze([

  // ══════════════════════════════════════════════════════════════════════════
  //  v1 — BASE family  (standard carcass: fabric + skim + top/bottom cover)
  // ══════════════════════════════════════════════════════════════════════════

  // Standard open-end multi-ply belt — most common configuration
  {
    id: 'BT-MULTIPLY',
    code: 'MULTIPLY',
    name: 'Multi-Ply Textile',
    product_type_code: 'CB',
    calc_family: 'BASE',
    ravasco_sub_category_code: 'TEXTILE',
    has_top_cover: true,
    has_bottom_cover: true,
    has_fabric: true,
    has_skim: true,
    has_breaker: false,
    has_cleat: false,
    has_sidewall: false,
    has_blinker: false,
    has_solution: false,
    has_hardener: false,
    length_rule: 'open_end',
    open_end_wastage_pct: 0.03,
    splice_allowance_m: 3,
    cost_of_production_rate_per_kg: 22,
    active: true,
    phase: 1,
  },

  // Straight-warp weave — higher lateral stiffness, same cost model as multiply
  {
    id: 'BT-STRAIGHT-WARP',
    code: 'STRAIGHT_WARP',
    name: 'Straight Warp',
    product_type_code: 'CB',
    calc_family: 'BASE',
    ravasco_sub_category_code: 'TEXTILE',
    has_top_cover: true,
    has_bottom_cover: true,
    has_fabric: true,
    has_skim: true,
    has_breaker: false,
    has_cleat: false,
    has_sidewall: false,
    has_blinker: false,
    has_solution: false,
    has_hardener: false,
    length_rule: 'open_end',
    open_end_wastage_pct: 0.03,
    splice_allowance_m: 3,
    cost_of_production_rate_per_kg: 22,
    active: true,
    phase: 1,
  },

  // Rough-top surface — grip finish on top cover, base construction unchanged
  {
    id: 'BT-ROUGH-TOP',
    code: 'ROUGH_TOP',
    name: 'Rough Top',
    product_type_code: 'CB',
    calc_family: 'BASE',
    ravasco_sub_category_code: 'TEXTILE',
    has_top_cover: true,
    has_bottom_cover: true,
    has_fabric: true,
    has_skim: true,
    has_breaker: false,
    has_cleat: false,
    has_sidewall: false,
    has_blinker: false,
    has_solution: false,
    has_hardener: false,
    length_rule: 'open_end',
    open_end_wastage_pct: 0.03,
    splice_allowance_m: 3,
    cost_of_production_rate_per_kg: 22,
    active: true,
    phase: 1,
  },

  // Wavy-top surface — undulating grip profile, base construction unchanged
  {
    id: 'BT-WAVY-TOP',
    code: 'WAVY_TOP',
    name: 'Wavy Top',
    product_type_code: 'CB',
    calc_family: 'BASE',
    ravasco_sub_category_code: 'TEXTILE',
    has_top_cover: true,
    has_bottom_cover: true,
    has_fabric: true,
    has_skim: true,
    has_breaker: false,
    has_cleat: false,
    has_sidewall: false,
    has_blinker: false,
    has_solution: false,
    has_hardener: false,
    length_rule: 'open_end',
    open_end_wastage_pct: 0.03,
    splice_allowance_m: 3,
    cost_of_production_rate_per_kg: 22,
    active: true,
    phase: 1,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  v1 — BASE family  (endless length rule — no cutting waste, splice added)
  // ══════════════════════════════════════════════════════════════════════════

  // Spliced endless loop — length = ordered + splice_allowance_m
  {
    id: 'BT-ENDLESS',
    code: 'ENDLESS',
    name: 'Endless',
    product_type_code: 'CB',
    calc_family: 'BASE',
    ravasco_sub_category_code: 'TEXTILE',
    has_top_cover: true,
    has_bottom_cover: true,
    has_fabric: true,
    has_skim: true,
    has_breaker: false,
    has_cleat: false,
    has_sidewall: false,
    has_blinker: false,
    has_solution: false,
    has_hardener: false,
    length_rule: 'endless',
    open_end_wastage_pct: 0.03,
    splice_allowance_m: 3,
    cost_of_production_rate_per_kg: 22,
    active: true,
    phase: 1,
  },

  // Factory-vulcanised endless — no field splice, same length rule as endless
  {
    id: 'BT-JOINTLESS',
    code: 'JOINTLESS',
    name: 'Jointless',
    product_type_code: 'CB',
    calc_family: 'BASE',
    ravasco_sub_category_code: 'TEXTILE',
    has_top_cover: true,
    has_bottom_cover: true,
    has_fabric: true,
    has_skim: true,
    has_breaker: false,
    has_cleat: false,
    has_sidewall: false,
    has_blinker: false,
    has_solution: false,
    has_hardener: false,
    length_rule: 'endless',
    open_end_wastage_pct: 0.03,
    splice_allowance_m: 3,
    cost_of_production_rate_per_kg: 22,
    active: true,
    phase: 1,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  v1 — BASE_BREAKER family  (BASE + breaker plies for impact resistance)
  // ══════════════════════════════════════════════════════════════════════════

  // Multi-ply with top + bottom breaker — heavy-duty impact zones
  {
    id: 'BT-MULTIPLY-BRK',
    code: 'MULTIPLY_BREAKER',
    name: 'Multi-Ply with Breaker',
    product_type_code: 'CB',
    calc_family: 'BASE_BREAKER',
    ravasco_sub_category_code: 'TEXTILE',
    has_top_cover: true,
    has_bottom_cover: true,
    has_fabric: true,
    has_skim: true,
    has_breaker: true,       // BREAKER_TOP + BREAKER_BOTTOM
    has_cleat: false,
    has_sidewall: false,
    has_blinker: false,
    has_solution: false,
    has_hardener: false,
    length_rule: 'open_end',
    open_end_wastage_pct: 0.03,
    splice_allowance_m: 3,
    cost_of_production_rate_per_kg: 22,
    active: true,
    phase: 1,
  },

  // Bag diverter — top breaker only; handles lateral impact at divert points
  {
    id: 'BT-BAG-DIVERTER',
    code: 'BAG_DIVERTER',
    name: 'Bag Diverter',
    product_type_code: 'CB',
    calc_family: 'BASE_BREAKER',
    ravasco_sub_category_code: 'TEXTILE',
    has_top_cover: true,
    has_bottom_cover: true,
    has_fabric: true,
    has_skim: true,
    has_breaker: true,       // BREAKER_TOP only
    has_cleat: false,
    has_sidewall: false,
    has_blinker: false,
    has_solution: false,
    has_hardener: false,
    length_rule: 'open_end',
    open_end_wastage_pct: 0.03,
    splice_allowance_m: 3,
    cost_of_production_rate_per_kg: 22,
    active: true,
    phase: 1,
  },

  // Bucket elevator — top breaker for bolt pull-out resistance; higher COP rate
  {
    id: 'BT-BUCKET-ELEV',
    code: 'BUCKET_ELEVATOR',
    name: 'Bucket Elevator',
    product_type_code: 'CB',
    calc_family: 'BASE_BREAKER',
    ravasco_sub_category_code: 'TEXTILE',
    has_top_cover: true,
    has_bottom_cover: true,
    has_fabric: true,
    has_skim: true,
    has_breaker: true,       // BREAKER_TOP only
    has_cleat: false,
    has_sidewall: false,
    has_blinker: false,
    has_solution: false,
    has_hardener: false,
    length_rule: 'open_end',
    open_end_wastage_pct: 0.03,
    splice_allowance_m: 3,
    cost_of_production_rate_per_kg: 24,  // higher than standard — bolt-hole reinforcement
    active: true,
    phase: 1,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  v1 — BASE_CLEAT family  (BASE + moulded cleats for incline conveying)
  // ══════════════════════════════════════════════════════════════════════════

  // Chevron V-cleats — moderate incline, self-cleaning profile
  {
    id: 'BT-CHEVRON',
    code: 'CHEVRON',
    name: 'Chevron',
    product_type_code: 'CB',
    calc_family: 'BASE_CLEAT',
    ravasco_sub_category_code: 'TEXTILE',
    has_top_cover: true,
    has_bottom_cover: true,
    has_fabric: true,
    has_skim: true,
    has_breaker: false,
    has_cleat: true,
    has_sidewall: false,
    has_blinker: false,
    has_solution: false,
    has_hardener: false,
    length_rule: 'open_end',
    open_end_wastage_pct: 0.03,
    splice_allowance_m: 3,
    cost_of_production_rate_per_kg: 30,  // higher COP — cleat moulding labour
    active: true,
    phase: 1,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  v1 — SIDEWALL family  (BASE + corrugated sidewalls + adhesive system)
  // ══════════════════════════════════════════════════════════════════════════

  // Sidewall with base belt — corrugated walls bonded with solution + hardener
  {
    id: 'BT-SIDEWALL',
    code: 'SIDEWALL',
    name: 'Sidewall',
    product_type_code: 'CB',
    calc_family: 'SIDEWALL',
    ravasco_sub_category_code: 'TEXTILE',
    has_top_cover: true,
    has_bottom_cover: true,
    has_fabric: true,
    has_skim: true,
    has_breaker: false,
    has_cleat: false,
    has_sidewall: true,
    has_blinker: false,
    has_solution: true,      // bonding agent for sidewall attachment
    has_hardener: true,      // hardener mixed with solution
    length_rule: 'open_end',
    open_end_wastage_pct: 0.03,
    splice_allowance_m: 3,
    cost_of_production_rate_per_kg: 30,
    active: true,
    phase: 1,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  v1 — FULL family  (all components: cleats + sidewalls + blinkers + adhesive)
  // ══════════════════════════════════════════════════════════════════════════

  // Steep-angle belt — full component set for high-incline containment
  {
    id: 'BT-STEEP-ANGLE',
    code: 'STEEP_ANGLE',
    name: 'Steep Angle',
    product_type_code: 'CB',
    calc_family: 'FULL',
    ravasco_sub_category_code: 'TEXTILE',
    has_top_cover: true,
    has_bottom_cover: true,
    has_fabric: true,
    has_skim: true,
    has_breaker: false,
    has_cleat: true,         // transverse cleats
    has_sidewall: true,      // corrugated sidewalls
    has_blinker: true,       // blinker flaps between cleats
    has_solution: true,      // bonding agent
    has_hardener: true,      // hardener mixed with solution
    length_rule: 'open_end',
    open_end_wastage_pct: 0.03,
    splice_allowance_m: 3,
    cost_of_production_rate_per_kg: 30,
    active: true,
    phase: 1,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  v2 — Placeholders (active: false — not yet calculable, hidden in UI)
  // ══════════════════════════════════════════════════════════════════════════

  // Pipe belt — rolled into a tube; geometry handled outside BASE engine (v2)
  {
    id: 'BT-PIPE',
    code: 'PIPE',
    name: 'Pipe',
    product_type_code: 'CB',
    calc_family: 'BASE_PIPE',
    ravasco_sub_category_code: 'TEXTILE',
    has_top_cover: true,
    has_bottom_cover: true,
    has_fabric: true,
    has_skim: true,
    has_breaker: false,
    has_cleat: false,
    has_sidewall: false,
    has_blinker: false,
    has_solution: false,
    has_hardener: false,
    length_rule: 'open_end',
    open_end_wastage_pct: 0.03,
    splice_allowance_m: 3,
    cost_of_production_rate_per_kg: 25,
    active: false,
    phase: 2,
  },

  // Paper reel belt — specialised surface treatment; costing model TBD in v2
  {
    id: 'BT-PAPER-REEL',
    code: 'PAPER_REEL',
    name: 'Paper Reel',
    product_type_code: 'CB',
    calc_family: 'BASE',
    ravasco_sub_category_code: 'TEXTILE',
    has_top_cover: true,
    has_bottom_cover: true,
    has_fabric: true,
    has_skim: true,
    has_breaker: false,
    has_cleat: false,
    has_sidewall: false,
    has_blinker: false,
    has_solution: false,
    has_hardener: false,
    length_rule: 'open_end',
    open_end_wastage_pct: 0.03,
    splice_allowance_m: 3,
    cost_of_production_rate_per_kg: 22,
    active: false,
    phase: 2,
  },
]);
