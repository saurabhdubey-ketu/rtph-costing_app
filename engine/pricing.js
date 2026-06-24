// engine/pricing.js
// Source: 04-calculation-engine.md §Pricing ladder — locked with Jitesh.
// CD = Standard pricing: GP% applied on FULL total_belt_cost.
// VD = GP% applied on MATERIAL cost only (covers+fabric+skim+breakers).
//      Production, packing, freight are passed through at cost.
// Do NOT write "Variable Direct" anywhere — label is "VD".
// NO rounding — MROUND removed per spec §6.6: "No rounding. Selling prices show exactly as computed."

/**
 * Compute CD (Standard) price per metre.
 * Formula: total_belt_cost × (1 + gp_pct) / total_length_m
 * @param {number} total_belt_cost
 * @param {number} gp_pct - e.g. 0.35 for 35%.
 * @param {number} total_length_m
 * @returns {number}
 */
export function cdPricePerMeter(total_belt_cost, gp_pct, total_length_m) {
  return (total_belt_cost * (1 + gp_pct)) / total_length_m;
}

/**
 * Compute VD price per metre.
 * Formula: (total_belt_cost + material_cost × gp_pct) / total_length_m
 * @param {number} total_belt_cost
 * @param {number} material_cost - Sum of rubber+fabric component costs only.
 * @param {number} gp_pct
 * @param {number} total_length_m
 * @returns {number}
 */
export function vdPricePerMeter(total_belt_cost, material_cost, gp_pct, total_length_m) {
  return (total_belt_cost + material_cost * gp_pct) / total_length_m;
}

/**
 * Compute final price after discount.
 * @param {number} price_per_meter
 * @param {number} discount_pct - e.g. 0.05 for 5%.
 * @returns {number}
 */
export function finalPricePerMeter(price_per_meter, discount_pct) {
  return price_per_meter * (1 - discount_pct);
}

/**
 * Reverse-compute implied GP% from a custom target price.
 * @param {number} custom_price_per_meter
 * @param {number} rmc_per_meter
 * @returns {number}
 */
export function impliedGpPct(custom_price_per_meter, rmc_per_meter) {
  return (custom_price_per_meter - rmc_per_meter) / rmc_per_meter;
}
