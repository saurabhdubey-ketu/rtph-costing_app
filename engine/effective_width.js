// engine/effective_width.js
// Width wastage for cut-edge belts is a fixed +30 mm regardless of fabric type.
// Moulded and vulcanised edges have no cutting waste → add_mm = 0.

/**
 * Compute effective belt width in metres.
 * @param {number} width_mm - Nominal belt width in mm.
 * @param {number} add_mm   - Fixed mm to add (30 for CUT_EDGE, 0 for others).
 * @returns {number} Effective width in metres.
 */
export function effectiveWidth(width_mm, add_mm = 0) {
  return (width_mm + add_mm) / 1000;
}
