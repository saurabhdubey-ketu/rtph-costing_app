// engine/component_costs.js
// Source: 04-calculation-engine.md §Component costs
// All rates are passed in from master lookups — NEVER hardcoded here.

/**
 * Compute cost of a component from its weight and rate.
 * @param {number} weight_kg
 * @param {number} rate_per_kg
 * @returns {number}
 */
export function componentCost(weight_kg, rate_per_kg) {
  return weight_kg * rate_per_kg;
}

/**
 * Compute Cost of Production for the belt.
 * @param {number} rate_per_kg - From BELT_TYPE_MASTER.cost_of_production_rate_per_kg.
 * @param {number} total_belt_weight_kg
 * @returns {number}
 */
export function costOfProduction(rate_per_kg, total_belt_weight_kg) {
  return rate_per_kg * total_belt_weight_kg;
}

/**
 * Compute packing cost.
 * Uses TOTAL ORDER LENGTH (not L_eff) — fixes bug C2.
 * @param {number} cost_per_meter - From REEL_PACKING_MASTER.
 * @param {number} total_length_m - Total order length in metres.
 * @returns {number}
 */
export function packingCost(cost_per_meter, total_length_m) {
  return cost_per_meter * total_length_m;
}

/**
 * Compute freight cost based on cost_type.
 * @param {number} freight_rate - Rate from FREIGHT_MASTER.
 * @param {string} cost_type - 'KG' | 'SQMTR' | 'RM'.
 * @param {number} total_belt_weight_kg
 * @param {number} total_length_m
 * @param {number} w_eff_m - Effective width in metres (for SQMTR).
 * @param {number} l_eff_m - Effective length in metres (for SQMTR).
 * @returns {number}
 */
export function freightCost(freight_rate, cost_type, total_belt_weight_kg, total_length_m, w_eff_m, l_eff_m) {
  if (cost_type === 'KG')     return freight_rate * total_belt_weight_kg;
  if (cost_type === 'RM')     return freight_rate * total_length_m;
  if (cost_type === 'SQMTR')  return freight_rate * (w_eff_m * l_eff_m);
  throw new Error(`Unknown freight cost_type: ${cost_type}`);
}
