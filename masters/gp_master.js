// masters/gp_master.js
// Source: 05-costing-and-quotation-flow.md §GP / Discount tier
// GP% bands for standard quotations. min_gp_pct is the approval-gate threshold.
// If effective GP% drops below min_gp_pct, a warning banner is shown (does not block save in prototype).
// override_bounds: upper limits for override fields on the quotation form.

export const GP_MASTER = Object.freeze({
  bands: [
    { id: 'GP-MIN',  label: 'Minimum (20%)',   gp_pct: 0.20, active: true },
    { id: 'GP-STD',  label: 'Standard (35%)',  gp_pct: 0.35, active: true },
    { id: 'GP-PREM', label: 'Premium (40%)',   gp_pct: 0.40, active: true },
    { id: 'GP-KEY',  label: 'Key Account (25%)',gp_pct: 0.25, active: true },
    { id: 'GP-GOVT', label: 'Government (22%)',gp_pct: 0.22, active: true },
  ],
  min_gp_pct: 0.20,  // approval-gate threshold — warn if effective GP% drops below 20%
  expenses_per_kg_default: 20,  // ₹/kg default loaded into Expense per KG when not entered
  override_bounds: {
    sg_top:            { min: 0.80, max: 2.00 },
    sg_bottom:         { min: 0.80, max: 2.00 },
    cover_rate_top:    { min: 1.00, max: 1000.00 },
    cover_rate_bottom: { min: 1.00, max: 1000.00 },
    tbt:               { min: 1.00, max: 10000.00 },
    expenses_per_kg:   { min: 0,    max: 200 },
    cop_rate_per_kg:   { min: 0,    max: 500 },
  },
});
