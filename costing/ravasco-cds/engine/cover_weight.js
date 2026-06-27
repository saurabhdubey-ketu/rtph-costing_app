// engine/cover_weight.js
// Source: 04-calculation-engine.md §1 Covers
// Formula: layer_weight_kg = W_eff(m) × thickness(mm) × SG × L_eff(m)
// thickness(mm) × SG(g/cm³) = kg/m², × width(m) × length(m) = kg.
// Top and bottom covers select compounds independently.

/**
 * Compute the weight of a single solid rubber cover layer.
 * @param {number} w_eff_m - Effective width in metres.
 * @param {number} thickness_mm - Cover thickness in mm.
 * @param {number} sg - Specific gravity of the compound (g/cm³).
 * @param {number} l_eff_m - Effective length in metres.
 * @returns {number} Layer weight in kg.
 */
export function coverWeight(w_eff_m, thickness_mm, sg, l_eff_m) {
  return w_eff_m * thickness_mm * sg * l_eff_m;
}
