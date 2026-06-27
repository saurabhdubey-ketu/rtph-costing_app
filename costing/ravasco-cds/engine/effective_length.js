// engine/effective_length.js
// Length wastage % comes from FABRIC_TYPE_MASTER.length_wastage_pct (NN=4%, EP/EE/EN=3%, PP=5%).
// Falls back to belt_type_master.open_end_wastage_pct when the fabric type has no entry.
// open-end: total_length × (1 + wastage_pct)
// endless:  total_length + splice_allowance_m  (no cutting waste — belt loops continuously)

/**
 * Compute effective belt length in metres.
 * @param {number} total_length_m        - Total order length (length_per_roll × no_of_rolls).
 * @param {string} length_rule           - 'open_end' or 'endless' from BELT_TYPE_MASTER.
 * @param {number} open_end_wastage_pct  - Wastage fraction from FABRIC_TYPE_MASTER (e.g. 0.04).
 * @param {number} splice_allowance_m    - Flat metre addition for endless belts.
 * @returns {number} Effective length in metres.
 */
export function effectiveLength(total_length_m, length_rule, open_end_wastage_pct, splice_allowance_m) {
  if (length_rule === 'endless') {
    return total_length_m + splice_allowance_m;
  }
  // open_end (default)
  return total_length_m * (1 + open_end_wastage_pct);
}
