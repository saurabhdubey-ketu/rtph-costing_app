// engine/rmc.js
// Source: 04-calculation-engine.md §RMC — fixes bug C1/X1
// RMC = Raw Material Cost per meter = total_belt_cost ÷ total_length (not L_eff).
// Always divide by ORDER length, not effective length.

/**
 * Sum all component costs into total material cost.
 * @param {number[]} component_costs - Array of individual component cost values.
 * @returns {number}
 */
export function materialCostTotal(component_costs) {
  return component_costs.reduce((sum, c) => sum + c, 0);
}

/**
 * Compute total belt cost (material + CoP + expenses + packing + freight).
 * @param {number} material_cost
 * @param {number} cost_of_production - Pure COP (cop_rate × weight), excludes expenses.
 * @param {number} expenses_cost      - Expenses loading (expenses_per_kg × weight), separate from COP.
 * @param {number} packing
 * @param {number} freight
 * @returns {number}
 */
export function totalBeltCost(material_cost, cost_of_production, expenses_cost, packing, freight) {
  return material_cost + cost_of_production + expenses_cost + packing + freight;
}

/**
 * Compute RMC per metre — fixes bug C1.
 * @param {number} total_cost
 * @param {number} total_length_m - Total ORDER length in metres.
 * @returns {number}
 */
export function rmcPerMeter(total_cost, total_length_m) {
  return total_cost / total_length_m;
}
