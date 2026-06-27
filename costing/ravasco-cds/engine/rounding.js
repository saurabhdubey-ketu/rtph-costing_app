// engine/rounding.js
// Source: Developer Prompt §5 — MROUND to nearest ₹5.
// All displayed prices are rounded here. Never inline a rounding expression elsewhere.

/**
 * Round a value to the nearest multiple of `multiple`.
 * Equivalent to Excel's MROUND(value, multiple).
 * @param {number} value
 * @param {number} [multiple=5]
 * @returns {number}
 */
export function mround(value, multiple = 5) {
  return Math.round(value / multiple) * multiple;
}
