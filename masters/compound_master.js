// masters/compound_master.js
// Single table for every rubber compound used in belt construction.
//
// FIELD REFERENCE
// ┌──────────────────┬────────────────────────────────────────────────────────────────┐
// │ Field            │ Meaning                                                        │
// ├──────────────────┼────────────────────────────────────────────────────────────────┤
// │ id               │ Unique key — e.g. 'CMP-M24'                                   │
// │ code             │ Business code used in forms / API                              │
// │ name             │ Display label shown in UI                                      │
// │ roles            │ Pipe-separated eligible positions:                             │
// │                  │   TOP_COVER | BOTTOM_COVER | SKIM | SIDEWALL |                │
// │                  │   CLEAT | BLINKER | SOLUTION | HARDENER                       │
// │ chemical_category│ IS/DIN grade designation (M24, SAR, HR …) — null for skims    │
// │ grade_family     │ GP | AR | HR | FR | OR | OTHER                                │
// │ polymer_base     │ Rubber polymer system e.g. NR/SBR, EPDM, NBR                  │
// │ sg               │ Specific gravity (g/cm³) — used in weight calculations        │
// │ price_per_kg     │ Raw material cost in ₹/kg (MANUAL entry)                      │
// │ price_source     │ Always 'MANUAL' until Ravasco ERP integration                 │
// │ skim_usage       │ For SKIM role only: FABRIC | STEEL_BREAKER | BOTH | null      │
// │ tensile_mpa      │ Min tensile strength (MPa) per spec — null if not specified   │
// │ elongation_pct   │ Min elongation at break (%) — null if not specified           │
// │ abrasion_mm3     │ Max abrasion loss (mm³) — null if not specified               │
// │ max_temp_c       │ Max service temperature (°C) — null for ambient-grade covers  │
// │ brand_line       │ Ravasco brand name for this compound                          │
// │ standard_ref_ids │ Applicable standard codes e.g. 'IS 1891 M24', 'ISO 340'      │
// │ notes            │ Free-text remarks — null if none                              │
// │ active           │ false = archived, hidden from new quotation dropdowns         │
// └──────────────────┴────────────────────────────────────────────────────────────────┘

export const COMPOUND_MASTER = Object.freeze([

  // ══════════════════════════════════════════════════════════════════════════
  //  COVER COMPOUNDS — General Purpose (GP)
  //  roles: TOP_COVER | BOTTOM_COVER   grade_family: GP   brand: Super Brute
  // ══════════════════════════════════════════════════════════════════════════

  // IS 1891 M24 — highest tensile in the GP range, most common for mining
  {
    id:                'CMP-M24',
    code:              'M-24',
    name:              'M-24 General Purpose Cover',
    roles:             'TOP_COVER|BOTTOM_COVER',
    chemical_category: 'M24',
    grade_family:      'GP',
    polymer_base:      'NR/SBR',
    sg:                1.18,
    price_per_kg:      80.00,
    price_source:      'MANUAL',
    skim_usage:        null,
    tensile_mpa:       24,
    elongation_pct:    450,
    abrasion_mm3:      150,
    max_temp_c:        null,
    brand_line:        'Super Brute',
    standard_ref_ids:  'IS 1891 M24',
    notes:             null,
    active:            true,
  },

  // IS 1891 M15 — lighter duty GP cover, lower tensile requirement
  {
    id:                'CMP-M15',
    code:              'M-15',
    name:              'M-15 General Purpose Cover',
    roles:             'TOP_COVER|BOTTOM_COVER',
    chemical_category: 'M15',
    grade_family:      'GP',
    polymer_base:      'NR/SBR',
    sg:                1.18,
    price_per_kg:      78.00,
    price_source:      'MANUAL',
    skim_usage:        null,
    tensile_mpa:       15,
    elongation_pct:    350,
    abrasion_mm3:      200,
    max_temp_c:        null,
    brand_line:        'Super Brute',
    standard_ref_ids:  'IS 1891 M15',
    notes:             null,
    active:            true,
  },

  // IS N-17 — general purpose with balanced tensile and elongation
  {
    id:                'CMP-N17',
    code:              'N-17',
    name:              'N-17 Cover',
    roles:             'TOP_COVER|BOTTOM_COVER',
    chemical_category: 'N17',
    grade_family:      'GP',
    polymer_base:      'NR/SBR',
    sg:                1.17,
    price_per_kg:      76.00,
    price_source:      'MANUAL',
    skim_usage:        null,
    tensile_mpa:       17,
    elongation_pct:    400,
    abrasion_mm3:      200,
    max_temp_c:        null,
    brand_line:        'Super Brute',
    standard_ref_ids:  'IS-N-17',
    notes:             null,
    active:            true,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  COVER COMPOUNDS — Abrasion Resistant (AR)
  //  roles: TOP_COVER | BOTTOM_COVER   grade_family: AR   brand: Super Brute
  // ══════════════════════════════════════════════════════════════════════════

  // NR/SBR/BR blend — very low abrasion loss (70 mm³), premium AR grade
  {
    id:                'CMP-SAR',
    code:              'SAR',
    name:              'Super Abrasion Resistant Cover',
    roles:             'TOP_COVER|BOTTOM_COVER',
    chemical_category: 'SAR',
    grade_family:      'AR',
    polymer_base:      'NR/SBR/BR',
    sg:                1.16,
    price_per_kg:      110.00,
    price_source:      'MANUAL',
    skim_usage:        null,
    tensile_mpa:       17,
    elongation_pct:    400,
    abrasion_mm3:      70,
    max_temp_c:        null,
    brand_line:        'Super Brute',
    standard_ref_ids:  null,
    notes:             null,
    active:            true,
  },

  // DIN X — moderate AR, higher tensile than SAR, good impact resistance
  {
    id:                'CMP-DINX',
    code:              'DIN-X',
    name:              'DIN X Abrasion Cover',
    roles:             'TOP_COVER|BOTTOM_COVER',
    chemical_category: 'DINX',
    grade_family:      'AR',
    polymer_base:      'NR/SBR',
    sg:                1.16,
    price_per_kg:      105.00,
    price_source:      'MANUAL',
    skim_usage:        null,
    tensile_mpa:       25,
    elongation_pct:    450,
    abrasion_mm3:      120,
    max_temp_c:        null,
    brand_line:        'Super Brute',
    standard_ref_ids:  'DIN X',
    notes:             null,
    active:            true,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  COVER COMPOUNDS — Heat Resistant (HR)
  //  roles: TOP_COVER (UHR: TOP_COVER only)   grade_family: HR   brand: Super Thermo
  // ══════════════════════════════════════════════════════════════════════════

  // SBR-based — rated to 125 °C continuous service temperature
  {
    id:                'CMP-HRT1',
    code:              'HR-T1',
    name:              'Heat Resistant 125C Cover',
    roles:             'TOP_COVER|BOTTOM_COVER',
    chemical_category: 'HR',
    grade_family:      'HR',
    polymer_base:      'SBR',
    sg:                1.25,
    price_per_kg:      140.00,
    price_source:      'MANUAL',
    skim_usage:        null,
    tensile_mpa:       null,
    elongation_pct:    null,
    abrasion_mm3:      null,
    max_temp_c:        125,
    brand_line:        'Super Thermo',
    standard_ref_ids:  null,
    notes:             null,
    active:            true,
  },

  // SBR-based — rated to 150 °C, step up from HR-T1
  {
    id:                'CMP-SHRT2',
    code:              'SHR-T2',
    name:              'Super Heat Resistant 150C Cover',
    roles:             'TOP_COVER|BOTTOM_COVER',
    chemical_category: 'SHR',
    grade_family:      'HR',
    polymer_base:      'SBR',
    sg:                1.25,
    price_per_kg:      150.00,
    price_source:      'MANUAL',
    skim_usage:        null,
    tensile_mpa:       null,
    elongation_pct:    null,
    abrasion_mm3:      null,
    max_temp_c:        150,
    brand_line:        'Super Thermo',
    standard_ref_ids:  null,
    notes:             null,
    active:            true,
  },

  // EPDM-based — top cover only; rated to 200 °C; needs UHR-SKIM for bonding
  {
    id:                'CMP-UHR',
    code:              'UHR',
    name:              'Ultra Heat Resistant 200C Cover',
    roles:             'TOP_COVER',                  // bottom cover not used at 200 °C rating
    chemical_category: 'UHR',
    grade_family:      'HR',
    polymer_base:      'EPDM',
    sg:                1.20,
    price_per_kg:      165.00,
    price_source:      'MANUAL',
    skim_usage:        null,
    tensile_mpa:       null,
    elongation_pct:    null,
    abrasion_mm3:      null,
    max_temp_c:        200,
    brand_line:        'Super Thermo',
    standard_ref_ids:  null,
    notes:             null,
    active:            true,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  COVER COMPOUNDS — Fire Resistant (FR)
  //  roles: TOP_COVER | BOTTOM_COVER   grade_family: FR   brand: Super Blaze
  // ══════════════════════════════════════════════════════════════════════════

  // SBR/CR blend — passes ISO 340 drum friction and bunsen burner tests
  {
    id:                'CMP-FR',
    code:              'FR',
    name:              'Fire Resistant Cover',
    roles:             'TOP_COVER|BOTTOM_COVER',
    chemical_category: 'FR',
    grade_family:      'FR',
    polymer_base:      'SBR/CR',
    sg:                1.35,
    price_per_kg:      130.00,
    price_source:      'MANUAL',
    skim_usage:        null,
    tensile_mpa:       null,
    elongation_pct:    null,
    abrasion_mm3:      null,
    max_temp_c:        null,
    brand_line:        'Super Blaze',
    standard_ref_ids:  'ISO 340',
    notes:             null,
    active:            true,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  COVER COMPOUNDS — Oil Resistant (OR)
  //  roles: TOP_COVER | BOTTOM_COVER   grade_family: OR   brand: Super Slick
  // ══════════════════════════════════════════════════════════════════════════

  // NBR — excellent resistance to mineral oils and fats (moderate grade)
  {
    id:                'CMP-ORM',
    code:              'OR-M',
    name:              'Oil Resistant (Moderate) Cover',
    roles:             'TOP_COVER|BOTTOM_COVER',
    chemical_category: 'OR',
    grade_family:      'OR',
    polymer_base:      'NBR',
    sg:                1.25,
    price_per_kg:      145.00,
    price_source:      'MANUAL',
    skim_usage:        null,
    tensile_mpa:       null,
    elongation_pct:    null,
    abrasion_mm3:      null,
    max_temp_c:        null,
    brand_line:        'Super Slick',
    standard_ref_ids:  null,
    notes:             null,
    active:            true,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  SKIM COMPOUNDS — Carcass & Breaker Bonding
  //  roles: SKIM   skim_usage: FABRIC | STEEL_BREAKER | BOTH
  // ══════════════════════════════════════════════════════════════════════════

  // Standard fabric skim — selected per quotation; bonds plies to each other
  {
    id:                'CMP-SKFAB',
    code:              'SK-FAB',
    name:              'General Purpose Fabric Skim',
    roles:             'SKIM',
    chemical_category: null,
    grade_family:      'GP',
    polymer_base:      'NR/SBR',
    sg:                1.18,
    price_per_kg:      65.00,
    price_source:      'MANUAL',
    skim_usage:        'FABRIC',
    tensile_mpa:       null,
    elongation_pct:    null,
    abrasion_mm3:      null,
    max_temp_c:        null,
    brand_line:        null,
    standard_ref_ids:  null,
    notes:             'Carcass skim (the selectable skim)',
    active:            true,
  },

  // NN-III — fixed breaker skim for non-metallic (fabric) breaker
  {
    id:                'CMP-NNIII',
    code:              'NN-III',
    name:              'Breaker Skim NN-III',
    roles:             'SKIM',
    chemical_category: null,
    grade_family:      'GP',
    polymer_base:      'NR/SBR',
    sg:                1.22,
    price_per_kg:      65.00,
    price_source:      'MANUAL',
    skim_usage:        'STEEL_BREAKER',
    tensile_mpa:       null,
    elongation_pct:    null,
    abrasion_mm3:      null,
    max_temp_c:        null,
    brand_line:        null,
    standard_ref_ids:  null,
    notes:             null,
    active:            true,
  },

  // STBR-III — fixed breaker skim for steel cord / steel breaker
  {
    id:                'CMP-STBRIII',
    code:              'STBR-III',
    name:              'Breaker Skim STBR-III',
    roles:             'SKIM',
    chemical_category: null,
    grade_family:      'GP',
    polymer_base:      null,
    sg:                1.25,
    price_per_kg:      88.00,
    price_source:      'MANUAL',
    skim_usage:        'STEEL_BREAKER',
    tensile_mpa:       null,
    elongation_pct:    null,
    abrasion_mm3:      null,
    max_temp_c:        null,
    brand_line:        null,
    standard_ref_ids:  null,
    notes:             null,
    active:            true,
  },

  // HR skim — for use with heat-resistant covers (fabric and breaker both)
  {
    id:                'CMP-HRSKIM',
    code:              'HR-SKIM',
    name:              'Heat Resistant Skim',
    roles:             'SKIM',
    chemical_category: null,
    grade_family:      'HR',
    polymer_base:      'SBR',
    sg:                1.25,
    price_per_kg:      95.00,
    price_source:      'MANUAL',
    skim_usage:        'BOTH',
    tensile_mpa:       null,
    elongation_pct:    null,
    abrasion_mm3:      null,
    max_temp_c:        null,
    brand_line:        null,
    standard_ref_ids:  null,
    notes:             null,
    active:            true,
  },

  // EPDM skim — required when using UHR/SUHR EPDM covers; will not bond to NR
  {
    id:                'CMP-UHRSKIM',
    code:              'UHR-SKIM',
    name:              'Ultra HR Skim (EPDM)',
    roles:             'SKIM',
    chemical_category: null,
    grade_family:      'HR',
    polymer_base:      'EPDM',
    sg:                1.22,
    price_per_kg:      120.00,
    price_source:      'MANUAL',
    skim_usage:        'BOTH',
    tensile_mpa:       null,
    elongation_pct:    null,
    abrasion_mm3:      null,
    max_temp_c:        null,
    brand_line:        null,
    standard_ref_ids:  null,
    notes:             'EPDM — only bonds to UHR/SUHR covers',
    active:            true,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  STRUCTURAL COMPOUNDS — Sidewall, Cleat, Blinker
  //  Used in SIDEWALL / CHEVRON / STEEP_ANGLE belt types
  // ══════════════════════════════════════════════════════════════════════════

  // Corrugated sidewall rubber — bonded with RB-SOL + HARDENER
  {
    id:                'CMP-SWF',
    code:              'SWF',
    name:              'Sidewall Compound',
    roles:             'SIDEWALL',
    chemical_category: null,
    grade_family:      'GP',
    polymer_base:      null,
    sg:                1.25,
    price_per_kg:      150.00,
    price_source:      'MANUAL',
    skim_usage:        null,
    tensile_mpa:       null,
    elongation_pct:    null,
    abrasion_mm3:      null,
    max_temp_c:        null,
    brand_line:        null,
    standard_ref_ids:  null,
    notes:             null,
    active:            true,
  },

  // General-purpose cleat compound — chevron and steep-angle profiles
  {
    id:                'CMP-CLEATGP',
    code:              'CLEAT-GP',
    name:              'Cleat Compound GP',
    roles:             'CLEAT',
    chemical_category: null,
    grade_family:      'GP',
    polymer_base:      null,
    sg:                1.15,
    price_per_kg:      150.00,
    price_source:      'MANUAL',
    skim_usage:        null,
    tensile_mpa:       null,
    elongation_pct:    null,
    abrasion_mm3:      null,
    max_temp_c:        null,
    brand_line:        null,
    standard_ref_ids:  null,
    notes:             null,
    active:            true,
  },

  // Blinker flap rubber — placed between cleats on steep-angle belts
  {
    id:                'CMP-BLINKERGP',
    code:              'BLINKER-GP',
    name:              'Blinker Compound',
    roles:             'BLINKER',
    chemical_category: null,
    grade_family:      'GP',
    polymer_base:      null,
    sg:                1.18,
    price_per_kg:      150.00,
    price_source:      'MANUAL',
    skim_usage:        null,
    tensile_mpa:       null,
    elongation_pct:    null,
    abrasion_mm3:      null,
    max_temp_c:        null,
    brand_line:        null,
    standard_ref_ids:  null,
    notes:             null,
    active:            true,
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ADHESIVE SYSTEM — Solution + Hardener
  //  Used together in SIDEWALL and STEEP_ANGLE belt types
  // ══════════════════════════════════════════════════════════════════════════

  // RB bonding solution — mixed with hardener before application; may be in-house or bought
  {
    id:                'CMP-RBSOL',
    code:              'RB-SOL',
    name:              'RB Bonding Solution',
    roles:             'SOLUTION',
    chemical_category: null,
    grade_family:      'GP',
    polymer_base:      null,
    sg:                0.85,
    price_per_kg:      1000.00,
    price_source:      'MANUAL',
    skim_usage:        null,
    tensile_mpa:       null,
    elongation_pct:    null,
    abrasion_mm3:      null,
    max_temp_c:        null,
    brand_line:        null,
    standard_ref_ids:  null,
    notes:             'Made or bought',
    active:            true,
  },

  // Standard hardener — bought-out item, mixed with RB-SOL at point of use
  {
    id:                'CMP-HARDENER',
    code:              'HARDENER',
    name:              'Standard Hardener',
    roles:             'HARDENER',
    chemical_category: null,
    grade_family:      'OTHER',
    polymer_base:      null,
    sg:                1.00,
    price_per_kg:      750.00,
    price_source:      'MANUAL',
    skim_usage:        null,
    tensile_mpa:       null,
    elongation_pct:    null,
    abrasion_mm3:      null,
    max_temp_c:        null,
    brand_line:        null,
    standard_ref_ids:  null,
    notes:             'Bought-out',
    active:            true,
  },
]);

// ══════════════════════════════════════════════════════════════════════════════
// COVER ↔ SKIM COMPATIBILITY
// Drives the "recommended skim" list shown in the quotation form.
//
// match_level = 'FAMILY'   → common case; one rule covers all compounds in the
//                            grade family (GP, AR, HR …)
// match_level = 'COMPOUND' → unique override for a single compound code;
//                            e.g. UHR = EPDM skim (won't bond with SBR skims)
//
// Lookup: COMPOUND match takes priority over any FAMILY rule for that compound.
// ══════════════════════════════════════════════════════════════════════════════
export const COVER_SKIM_COMPATIBILITY = Object.freeze([

  // GP covers (M-24, M-15, N-17) → standard fabric skim
  {
    skim_compound_id:    'CMP-SKFAB',
    match_level:         'FAMILY',
    cover_grade_family:  'GP',
    cover_compound_code: null,
    is_default:          true,
    notes:               'Standard GP skim',
  },

  // AR covers (SAR, DIN-X) → same fabric skim as GP
  {
    skim_compound_id:    'CMP-SKFAB',
    match_level:         'FAMILY',
    cover_grade_family:  'AR',
    cover_compound_code: null,
    is_default:          true,
    notes:               'Standard AR skim',
  },

  // HR covers (HR-T1, SHR-T2) → SBR-based heat skim
  {
    skim_compound_id:    'CMP-HRSKIM',
    match_level:         'FAMILY',
    cover_grade_family:  'HR',
    cover_compound_code: null,
    is_default:          true,
    notes:               'SBR heat skim for HR/SHR covers',
  },

  // UHR cover only → EPDM skim; overrides the HR family rule above
  {
    skim_compound_id:    'CMP-UHRSKIM',
    match_level:         'COMPOUND',
    cover_grade_family:  null,
    cover_compound_code: 'UHR',
    is_default:          true,
    notes:               'EPDM skim — only for UHR (won\'t bond to SBR covers)',
  },
]);
