// engine/breaker_weight.js
// Source: 04-calculation-engine.md §4 Breakers
// Breaker fabric weight uses GSM (no SG) — it's a woven layer, same formula as carcass fabric.
// Breaker skim weight uses thickness × SG (rubber layer formula).
// Both are only computed when the belt type declares has_breaker = true.

/**
 * Compute the weight of a breaker fabric layer.
 * @param {number} w_eff_m   - Effective width in metres.
 * @param {number} gsm       - GSM of the breaker from BREAKER_MASTER.
 * @param {number} l_eff_m   - Effective length in metres.
 * @param {number} no_of_ply - Breaker ply count.
 * @returns {{ weight_kg: number, breaker_length_m: number }}
 */
export function breakerFabricWeight(w_eff_m, gsm, l_eff_m, no_of_ply) {
  const breaker_length_m = l_eff_m * no_of_ply;
  return {
    weight_kg:        w_eff_m * (gsm / 1000) * breaker_length_m,
    breaker_length_m,
  };
}

/**
 * Compute the weight of a breaker skim (rubber) layer.
 * @param {number} w_eff_m - Effective width in metres.
 * @param {number} skim_thickness_mm - Skim thickness in mm.
 * @param {number} skim_sg - SG of the skim compound from COMPOUND_MASTER.
 * @param {number} l_eff_m - Effective length in metres.
 * @returns {number} Breaker skim weight in kg.
 */
export function breakerSkimWeight(w_eff_m, skim_thickness_mm, skim_sg, l_eff_m) {
  return w_eff_m * skim_thickness_mm * skim_sg * l_eff_m;
}
