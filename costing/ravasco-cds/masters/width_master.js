// masters/width_master.js
// Metric widths: 50–4000 mm in 50 mm steps = 79 standard options.
// Use getWidthOptions() in the UI combobox — never hardcode the list.
// If a typed value is not in the generated list → route to custom width workflow.

// ── Metric range rule ──────────────────────────────────────────────────────
export const WIDTH_METRIC_RANGE = Object.freeze({
  min_mm:   50,
  max_mm: 4000,
  step_mm:  50,
});

// ── Imperial discrete sizes ────────────────────────────────────────────────
export const WIDTH_IMPERIAL = Object.freeze([
  { id: 'W-IN-018', unit_type: 'imperial', value:  18, display:  '18"', active: true },
  { id: 'W-IN-024', unit_type: 'imperial', value:  24, display:  '24"', active: true },
  { id: 'W-IN-030', unit_type: 'imperial', value:  30, display:  '30"', active: true },
  { id: 'W-IN-036', unit_type: 'imperial', value:  36, display:  '36"', active: true },
  { id: 'W-IN-042', unit_type: 'imperial', value:  42, display:  '42"', active: true },
  { id: 'W-IN-048', unit_type: 'imperial', value:  48, display:  '48"', active: true },
  { id: 'W-IN-054', unit_type: 'imperial', value:  54, display:  '54"', active: true },
  { id: 'W-IN-060', unit_type: 'imperial', value:  60, display:  '60"', active: true },
]);

/**
 * Generate all standard metric width options from the range rule.
 * Returns { id, unit_type, value, display, active } — same shape as WIDTH_IMPERIAL entries.
 * Call this at render time to populate the combobox.
 */
export function getWidthOptions() {
  const { min_mm, max_mm, step_mm } = WIDTH_METRIC_RANGE;
  const options = [];
  for (let w = min_mm; w <= max_mm; w += step_mm) {
    options.push({
      id:        `W-MM-${String(w).padStart(4, '0')}`,
      unit_type: 'metric',
      value:     w,
      display:   `${w} mm`,
      active:    true,
    });
  }
  return options;
}

/**
 * Check if a given mm value is a standard width.
 * Returns the matching entry or null (null = custom width flow).
 */
export function findWidth(value_mm) {
  const v = Number(value_mm);
  const { min_mm, max_mm, step_mm } = WIDTH_METRIC_RANGE;
  if (v >= min_mm && v <= max_mm && (v - min_mm) % step_mm === 0) {
    return {
      id:        `W-MM-${String(v).padStart(4, '0')}`,
      unit_type: 'metric',
      value:     v,
      display:   `${v} mm`,
      active:    true,
    };
  }
  return null; // custom width
}

/** Convert a width entry to mm regardless of unit_type. */
export function widthToMm(widthRow) {
  return widthRow.unit_type === 'imperial' ? widthRow.value * 25.4 : widthRow.value;
}
