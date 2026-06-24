// engine/skim_weight.js
// Source: 04-calculation-engine.md §3 Carcass skim — remainder method.
// The established method approximates the whole no-breaker sandwich at cover SG,
// then subtracts cover + fabric; the leftover is skim rubber.
// Preserved for continuity with validated numbers — do not substitute another method.
//
// Formula:
//   belt_wt_without_breaker = W_eff × (carcass_thk + top_thk + bottom_thk) × cover_sg × L_eff
//   skim_weight = belt_wt_without_breaker − top_cover_weight − bottom_cover_weight − fabric_weight
//
// If skim_weight < 0, the caller must surface a warning — never silently clamp to 0.

/**
 * Compute carcass skim weight using the remainder method.
 * @param {number} w_eff_m - Effective width in metres.
 * @param {number} nominal_carcass_thickness_mm - Total carcass thickness from FABRIC_STRENGTH_MASTER.
 * @param {number} top_thickness_mm - Top cover thickness in mm.
 * @param {number} bottom_thickness_mm - Bottom cover thickness in mm.
 * @param {number} cover_sg - SG of the top cover compound (used as sandwich approximation per spec).
 * @param {number} l_eff_m - Effective length in metres.
 * @param {number} top_cover_weight_kg - Pre-computed top cover weight.
 * @param {number} bottom_cover_weight_kg - Pre-computed bottom cover weight.
 * @param {number} fabric_weight_kg - Pre-computed carcass fabric weight.
 * @returns {{ skim_weight_kg: number, belt_wt_without_breaker_kg: number, negative: boolean }}
 */
export function skimWeight(
  w_eff_m,
  nominal_carcass_thickness_mm,
  top_thickness_mm,
  bottom_thickness_mm,
  cover_sg,
  l_eff_m,
  top_cover_weight_kg,
  bottom_cover_weight_kg,
  fabric_weight_kg,
) {
  const belt_wt_without_breaker_kg =
    w_eff_m * (nominal_carcass_thickness_mm + top_thickness_mm + bottom_thickness_mm) * cover_sg * l_eff_m;
  const skim_weight_kg = belt_wt_without_breaker_kg - top_cover_weight_kg - bottom_cover_weight_kg - fabric_weight_kg;
  return {
    skim_weight_kg,
    belt_wt_without_breaker_kg,
    negative: skim_weight_kg < 0,
  };
}
