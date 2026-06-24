// masters/breaker_master.js
// Reinforcement layers placed above/below the carcass for impact resistance.
//
// FIELD REFERENCE
// ┌───────────────────────┬──────────────────────────────────────────────────────────┐
// │ Field                 │ Meaning                                                  │
// ├───────────────────────┼──────────────────────────────────────────────────────────┤
// │ id / code             │ Same value — matches belt_type_master breaker component  │
// │ breaker_type          │ Material class: fabric | steel | cord                    │
// │ supplier_short_form   │ Preferred supplier abbreviation                          │
// │ supplier_material_code│ Supplier's own part/grade code (null if not assigned)    │
// │ gsm                   │ Grams per m² of the breaker layer                       │
// │ thickness_mm          │ Single-layer thickness in mm                             │
// │ no_of_ply_default     │ Default ply count used in costing (usually 1)           │
// │ price_per_kg          │ Raw material cost in ₹/kg                               │
// │ default_mount         │ NON_FLOATING = fixed position in belt build              │
// │                       │ FLOATING     = position varies with design               │
// │ active                │ false = archived, not shown in new quotations            │
// └───────────────────────┴──────────────────────────────────────────────────────────┘

export const BREAKER_MASTER = Object.freeze([

  // BOT — Breaker On Top (fabric layer, top-side)
  {
    id:                    'BRK-TOP',
    code:                  'BRK-TOP',
    name:                  'BOT - Breaker On Top',
    breaker_type:          'Fabric Breaker',
    supplier_short_form:   'MIT',
    supplier_material_code:'MCO16',
    gsm:                   145,
    thickness_mm:          0.3,
    skim_thickness_mm:     0.6,
    no_of_ply_default:     1,
    price_per_kg:          330.00,
    default_mount:         'NON_FLOATING',
    active:                true,
  },

  // BOB — Breaker On Bottom (fabric layer, bottom-side)
  {
    id:                    'BRK-BOB',
    code:                  'BRK-BOB',
    name:                  'BOB - Breaker On Bottom',
    breaker_type:          'Fabric Breaker',
    supplier_short_form:   'MIT',
    supplier_material_code: null,
    gsm:                   145,
    thickness_mm:          0.3,
    skim_thickness_mm:     0.6,
    no_of_ply_default:     1,
    price_per_kg:          330.00,
    default_mount:         'NON_FLOATING',
    active:                true,
  },

  // Steel breaker — retired from standard form; kept for reference
  {
    id:                    'BRK-BOT-STEEL',
    code:                  'BRK-BOT-STEEL',
    name:                  'Steel Breaker',
    breaker_type:          'Steel Breaker',
    supplier_short_form:   'MIT',
    supplier_material_code:'MCO25',
    gsm:                   650,
    thickness_mm:          1.5,
    skim_thickness_mm:     0.6,
    no_of_ply_default:     1,
    price_per_kg:          550.00,
    default_mount:         'NON_FLOATING',
    active:                false,
  },

  // Cord breaker — floating mount, position set per belt design specification
  {
    id:                    'BRK-CORD',
    code:                  'BRK-CORD',
    name:                  'Cord Breaker',
    breaker_type:          'Cord Breaker',
    supplier_short_form:   'MIT',
    supplier_material_code: null,           // supplier code not yet assigned
    gsm:                   1270,
    thickness_mm:          1.45,
    skim_thickness_mm:     0.6,
    no_of_ply_default:     1,
    price_per_kg:          520.00,
    default_mount:         'FLOATING',
    active:                true,
  },
]);
