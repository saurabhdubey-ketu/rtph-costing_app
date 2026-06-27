// masters/grade_master.js
// Source: 02-master-architecture.md §Cover grade spec fields
// Indus belt grades — published specification for datasheets and cover↔skim matching.
// Does not drive cost math directly; drives skim recommendation and datasheet generation.

export const GRADE_MASTER = Object.freeze([
  { id: 'GRD-M24',   code: 'M-24', name: 'M-24 General Purpose',           grade_family: 'GP',   tensile_mpa: 24, elongation_pct: 450, abrasion_mm3: 150, active: true },
  { id: 'GRD-M15',   code: 'M-15', name: 'M-15 General Purpose',           grade_family: 'GP',   tensile_mpa: 15, elongation_pct: 350, abrasion_mm3: 200, active: true },
  { id: 'GRD-SAR',   code: 'SAR',  name: 'Super Abrasion Resistant',       grade_family: 'AR',   tensile_mpa: 18, elongation_pct: 400, abrasion_mm3:  90, active: true },
  { id: 'GRD-HR',    code: 'HR',   name: 'Heat Resistant 125°C',           grade_family: 'HR',   tensile_mpa: 15, elongation_pct: 350, abrasion_mm3: 200, max_temp_c: 125, active: true },
  { id: 'GRD-SHR',   code: 'SHR',  name: 'Super Heat Resistant 150°C',    grade_family: 'HR',   tensile_mpa: 15, elongation_pct: 300, abrasion_mm3: 200, max_temp_c: 150, active: true },
  { id: 'GRD-UHR',   code: 'UHR',  name: 'Ultra Heat Resistant 200°C',    grade_family: 'HR',   tensile_mpa: 12, elongation_pct: 250, abrasion_mm3: 250, max_temp_c: 200, active: true },
  { id: 'GRD-FR',    code: 'FR',   name: 'Fire Resistant',                 grade_family: 'FR',   tensile_mpa: 15, elongation_pct: 350, abrasion_mm3: 200, active: true },
  { id: 'GRD-OR',    code: 'OR',   name: 'Oil Resistant',                  grade_family: 'OR',   tensile_mpa: 15, elongation_pct: 350, abrasion_mm3: 200, active: true },
]);
