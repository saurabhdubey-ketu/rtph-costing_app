// masters/fabric_rate_master.js
// Two-part master for fabric pricing.
//
// type_defaults → fallback ₹/kg used when no specific grade is selected.
//                 The engine falls back here if no matching grade row is found.
//
// grades        → fabric grades keyed by fabric_type + per_ply_rating.
//                 Engine looks up: fabric_type === line.fabric_type && per_ply_rating === fabricRow.per_ply_rating
//                 price_per_kg here takes precedence over type_defaults.
//
// GRADE FIELD REFERENCE
// ┌───────────────────────┬──────────────────────────────────────────────────────────┐
// │ Field                 │ Meaning                                                  │
// ├───────────────────────┼──────────────────────────────────────────────────────────┤
// │ id / code             │ FRM-{TYPE}-{PPR}                                         │
// │ fabric_type           │ EP | NN | EE | EN | PP | SW                             │
// │ per_ply_rating        │ Strength per ply (kN/m) — lookup key                    │
// │ gsm                   │ Fabric weight per ply (g/m²) — used in weight calc      │
// │ thickness_mm          │ Single-ply thickness (mm)                               │
// │ price_per_kg          │ Purchase price in ₹/kg                                 │
// │ active                │ false = delisted                                        │
// └───────────────────────┴──────────────────────────────────────────────────────────┘

export const FABRIC_RATE_MASTER = Object.freeze({

  // ── Fallback prices per fabric type ────────────────────────────────────────
  type_defaults: [
    { fabric_type: 'EP', default_rate_per_kg: 265.00 },
    { fabric_type: 'NN', default_rate_per_kg: 300.00 },
    { fabric_type: 'EE', default_rate_per_kg: 210.00 },
    { fabric_type: 'EN', default_rate_per_kg: 242.00 },
    { fabric_type: 'PP', default_rate_per_kg: 400.00 },
    { fabric_type: 'SW', default_rate_per_kg: 280.00 },
  ],

  // ── Grades — lookup key: fabric_type + per_ply_rating ─────────────────────
  // price_per_kg = type_default rate (supplier-specific prices to be added when confirmed)
  grades: [

    // ── NN ──────────────────────────────────────────────────────────────────
    { id: 'FRM-NN-100',  code: 'NN-100',  fabric_type: 'NN', per_ply_rating: 100,  gsm:  300, thickness_mm: 0.60, price_per_kg: 300.00, active: true },
    { id: 'FRM-NN-125',  code: 'NN-125',  fabric_type: 'NN', per_ply_rating: 125,  gsm:  375, thickness_mm: 0.65, price_per_kg: 300.00, active: true },
    { id: 'FRM-NN-150',  code: 'NN-150',  fabric_type: 'NN', per_ply_rating: 150,  gsm:  400, thickness_mm: 0.65, price_per_kg: 300.00, active: true },
    { id: 'FRM-NN-160',  code: 'NN-160',  fabric_type: 'NN', per_ply_rating: 160,  gsm:  440, thickness_mm: 0.70, price_per_kg: 300.00, active: true },
    { id: 'FRM-NN-200',  code: 'NN-200',  fabric_type: 'NN', per_ply_rating: 200,  gsm:  500, thickness_mm: 0.80, price_per_kg: 300.00, active: true },
    { id: 'FRM-NN-250',  code: 'NN-250',  fabric_type: 'NN', per_ply_rating: 250,  gsm:  590, thickness_mm: 0.95, price_per_kg: 300.00, active: true },
    { id: 'FRM-NN-300',  code: 'NN-300',  fabric_type: 'NN', per_ply_rating: 300,  gsm:  660, thickness_mm: 1.05, price_per_kg: 300.00, active: true },
    { id: 'FRM-NN-315',  code: 'NN-315',  fabric_type: 'NN', per_ply_rating: 315,  gsm:  700, thickness_mm: 1.10, price_per_kg: 300.00, active: true },
    { id: 'FRM-NN-350',  code: 'NN-350',  fabric_type: 'NN', per_ply_rating: 350,  gsm:  780, thickness_mm: 1.15, price_per_kg: 300.00, active: true },
    { id: 'FRM-NN-400',  code: 'NN-400',  fabric_type: 'NN', per_ply_rating: 400,  gsm:  860, thickness_mm: 1.25, price_per_kg: 300.00, active: true },
    { id: 'FRM-NN-450',  code: 'NN-450',  fabric_type: 'NN', per_ply_rating: 450,  gsm:  950, thickness_mm: 1.45, price_per_kg: 300.00, active: true },
    { id: 'FRM-NN-500',  code: 'NN-500',  fabric_type: 'NN', per_ply_rating: 500,  gsm: 1180, thickness_mm: 1.75, price_per_kg: 300.00, active: true },
    { id: 'FRM-EP-100',  code: 'EP-100',  fabric_type: 'EP', per_ply_rating: 100,  gsm:  360, thickness_mm: 0.50, price_per_kg: 265.00, active: true },
    { id: 'FRM-EP-125',  code: 'EP-125',  fabric_type: 'EP', per_ply_rating: 125,  gsm:  460, thickness_mm: 0.65, price_per_kg: 265.00, active: true },
    { id: 'FRM-EP-160',  code: 'EP-160',  fabric_type: 'EP', per_ply_rating: 160,  gsm:  570, thickness_mm: 0.80, price_per_kg: 265.00, active: true },
    { id: 'FRM-EP-200',  code: 'EP-200',  fabric_type: 'EP', per_ply_rating: 200,  gsm:  660, thickness_mm: 0.95, price_per_kg: 265.00, active: true },
    { id: 'FRM-EP-250',  code: 'EP-250',  fabric_type: 'EP', per_ply_rating: 250,  gsm:  830, thickness_mm: 1.15, price_per_kg: 265.00, active: true },
    { id: 'FRM-EP-300',  code: 'EP-300',  fabric_type: 'EP', per_ply_rating: 300,  gsm:  950, thickness_mm: 1.35, price_per_kg: 265.00, active: true },
    { id: 'FRM-EP-315',  code: 'EP-315',  fabric_type: 'EP', per_ply_rating: 315,  gsm: 1020, thickness_mm: 1.40, price_per_kg: 265.00, active: true },
    { id: 'FRM-EP-350',  code: 'EP-350',  fabric_type: 'EP', per_ply_rating: 350,  gsm: 1150, thickness_mm: 1.65, price_per_kg: 265.00, active: true },
    { id: 'FRM-EP-400',  code: 'EP-400',  fabric_type: 'EP', per_ply_rating: 400,  gsm: 1300, thickness_mm: 1.75, price_per_kg: 265.00, active: true },
    { id: 'FRM-EP-450',  code: 'EP-450',  fabric_type: 'EP', per_ply_rating: 450,  gsm: 1450, thickness_mm: 2.05, price_per_kg: 265.00, active: true },
    { id: 'FRM-EP-500',  code: 'EP-500',  fabric_type: 'EP', per_ply_rating: 500,  gsm: 1770, thickness_mm: 2.35, price_per_kg: 265.00, active: true },
    { id: 'FRM-EP-600',  code: 'EP-600',  fabric_type: 'EP', per_ply_rating: 600,  gsm: 2100, thickness_mm: 2.80, price_per_kg: 265.00, active: true },
    { id: 'FRM-EP-630',  code: 'EP-630',  fabric_type: 'EP', per_ply_rating: 630,  gsm: 2100, thickness_mm: 2.80, price_per_kg: 265.00, active: true },
    { id: 'FRM-EE-100',  code: 'EE-100',  fabric_type: 'EE', per_ply_rating: 100,  gsm:  365, thickness_mm: 0.50, price_per_kg: 210.00, active: true },
    { id: 'FRM-EE-125',  code: 'EE-125',  fabric_type: 'EE', per_ply_rating: 125,  gsm:  460, thickness_mm: 0.60, price_per_kg: 210.00, active: true },
    { id: 'FRM-EE-150',  code: 'EE-150',  fabric_type: 'EE', per_ply_rating: 150,  gsm:  530, thickness_mm: 0.75, price_per_kg: 210.00, active: true },
    { id: 'FRM-EE-160',  code: 'EE-160',  fabric_type: 'EE', per_ply_rating: 160,  gsm:  570, thickness_mm: 0.75, price_per_kg: 210.00, active: true },
    { id: 'FRM-EE-200',  code: 'EE-200',  fabric_type: 'EE', per_ply_rating: 200,  gsm:  720, thickness_mm: 0.95, price_per_kg: 210.00, active: true },
    { id: 'FRM-EE-250',  code: 'EE-250',  fabric_type: 'EE', per_ply_rating: 250,  gsm:  850, thickness_mm: 1.15, price_per_kg: 210.00, active: true },
    { id: 'FRM-EE-280',  code: 'EE-280',  fabric_type: 'EE', per_ply_rating: 280,  gsm:  920, thickness_mm: 1.24, price_per_kg: 210.00, active: true },
    { id: 'FRM-EE-315',  code: 'EE-315',  fabric_type: 'EE', per_ply_rating: 315,  gsm: 1000, thickness_mm: 1.35, price_per_kg: 210.00, active: true },
    { id: 'FRM-EE-350',  code: 'EE-350',  fabric_type: 'EE', per_ply_rating: 350,  gsm: 1170, thickness_mm: 1.60, price_per_kg: 210.00, active: true },
    { id: 'FRM-EE-400',  code: 'EE-400',  fabric_type: 'EE', per_ply_rating: 400,  gsm: 1250, thickness_mm: 1.75, price_per_kg: 210.00, active: true },
    { id: 'FRM-EE-450',  code: 'EE-450',  fabric_type: 'EE', per_ply_rating: 450,  gsm: 1350, thickness_mm: 1.95, price_per_kg: 210.00, active: true },
    { id: 'FRM-EE-500',  code: 'EE-500',  fabric_type: 'EE', per_ply_rating: 500,  gsm: 1500, thickness_mm: 2.30, price_per_kg: 210.00, active: true },
    { id: 'FRM-EN-100',  code: 'EN-100',  fabric_type: 'EN', per_ply_rating: 100,  gsm:  365, thickness_mm: 0.55, price_per_kg: 242.00, active: true },
    { id: 'FRM-EN-125',  code: 'EN-125',  fabric_type: 'EN', per_ply_rating: 125,  gsm:  460, thickness_mm: 0.65, price_per_kg: 242.00, active: true },
    { id: 'FRM-EN-150',  code: 'EN-150',  fabric_type: 'EN', per_ply_rating: 150,  gsm:  530, thickness_mm: 0.75, price_per_kg: 242.00, active: true },
    { id: 'FRM-EN-160',  code: 'EN-160',  fabric_type: 'EN', per_ply_rating: 160,  gsm:  570, thickness_mm: 0.80, price_per_kg: 242.00, active: true },
    { id: 'FRM-EN-200',  code: 'EN-200',  fabric_type: 'EN', per_ply_rating: 200,  gsm:  660, thickness_mm: 1.00, price_per_kg: 242.00, active: true },
    { id: 'FRM-EN-250',  code: 'EN-250',  fabric_type: 'EN', per_ply_rating: 250,  gsm:  850, thickness_mm: 1.20, price_per_kg: 242.00, active: true },
    { id: 'FRM-EN-300',  code: 'EN-300',  fabric_type: 'EN', per_ply_rating: 300,  gsm:  950, thickness_mm: 1.30, price_per_kg: 242.00, active: true },
    { id: 'FRM-EN-315',  code: 'EN-315',  fabric_type: 'EN', per_ply_rating: 315,  gsm: 1000, thickness_mm: 1.40, price_per_kg: 242.00, active: true },
    { id: 'FRM-EN-350',  code: 'EN-350',  fabric_type: 'EN', per_ply_rating: 350,  gsm: 1170, thickness_mm: 1.60, price_per_kg: 242.00, active: true },
    { id: 'FRM-EN-400',  code: 'EN-400',  fabric_type: 'EN', per_ply_rating: 400,  gsm: 1300, thickness_mm: 1.80, price_per_kg: 242.00, active: true },
    { id: 'FRM-EN-450',  code: 'EN-450',  fabric_type: 'EN', per_ply_rating: 450,  gsm: 1590, thickness_mm: 2.30, price_per_kg: 242.00, active: true },
    { id: 'FRM-EN-500',  code: 'EN-500',  fabric_type: 'EN', per_ply_rating: 500,  gsm: 1780, thickness_mm: 2.40, price_per_kg: 242.00, active: true },
    { id: 'FRM-PP-100',  code: 'PP-100',  fabric_type: 'PP', per_ply_rating: 100,  gsm:  320, thickness_mm: 0.60, price_per_kg: 400.00, active: true },
    { id: 'FRM-PP-125',  code: 'PP-125',  fabric_type: 'PP', per_ply_rating: 125,  gsm:  385, thickness_mm: 0.65, price_per_kg: 400.00, active: true },
    { id: 'FRM-PP-160',  code: 'PP-160',  fabric_type: 'PP', per_ply_rating: 160,  gsm:  460, thickness_mm: 0.80, price_per_kg: 400.00, active: true },
    { id: 'FRM-PP-200',  code: 'PP-200',  fabric_type: 'PP', per_ply_rating: 200,  gsm:  510, thickness_mm: 0.85, price_per_kg: 400.00, active: true },
    { id: 'FRM-PP-250',  code: 'PP-250',  fabric_type: 'PP', per_ply_rating: 250,  gsm:  600, thickness_mm: 0.95, price_per_kg: 400.00, active: true },
    { id: 'FRM-PP-300',  code: 'PP-300',  fabric_type: 'PP', per_ply_rating: 300,  gsm:  680, thickness_mm: 1.05, price_per_kg: 400.00, active: true },
    { id: 'FRM-PP-315',  code: 'PP-315',  fabric_type: 'PP', per_ply_rating: 315,  gsm:  710, thickness_mm: 1.10, price_per_kg: 400.00, active: true },
    { id: 'FRM-PP-350',  code: 'PP-350',  fabric_type: 'PP', per_ply_rating: 350,  gsm:  790, thickness_mm: 1.15, price_per_kg: 400.00, active: true },
    { id: 'FRM-PP-400',  code: 'PP-400',  fabric_type: 'PP', per_ply_rating: 400,  gsm:  870, thickness_mm: 1.20, price_per_kg: 400.00, active: true },

  ],
});
