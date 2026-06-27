// engine/fabric_weight.js
// Formula (per ply): per_ply_weight_kg = (W_eff × L_eff × GSM) / 1000
//          total:    fabric_weight_kg   = per_ply_weight_kg × no_of_ply
// W_eff and L_eff are in metres; GSM is g/m² per ply → result in kg.

/**
 * Compute carcass fabric weight for one belt.
 * @param {number} w_eff_m   - Effective width in metres (nominal + cut-edge wastage).
 * @param {number} gsm       - Grams per m² per ply.
 * @param {number} l_eff_m   - Effective length in metres (per single ply).
 * @param {number} no_of_ply - Number of fabric plies.
 * @returns {{ weight_kg: number, per_ply_weight_kg: number, per_ply_length_m: number }}
 */
export function fabricWeight(w_eff_m, gsm, l_eff_m, no_of_ply) {
  const per_ply_length_m  = l_eff_m;
  const per_ply_weight_kg = (w_eff_m * per_ply_length_m * gsm) / 1000;
  return {
    weight_kg:        per_ply_weight_kg * no_of_ply,
    per_ply_weight_kg,
    per_ply_length_m,
  };
}
