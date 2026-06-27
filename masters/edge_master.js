// masters/edge_master.js
// Edge type determines the width cutting allowance added to the nominal belt width.
// width_wastage_mm is added to ordered width before fabric/cover area calculations.
// Locked rule — do not change without director approval (fixes legacy bug C8).

export const EDGE_MASTER = Object.freeze([
  { id: 'EDGE-CE', code: 'CUT_EDGE',   name: 'Cut Edge',   width_wastage_mm: 30, active: true },
  { id: 'EDGE-MD', code: 'MOULDED',    name: 'Moulded',    width_wastage_mm:  0, active: true },
  { id: 'EDGE-VL', code: 'VULCANISED', name: 'Vulcanised', width_wastage_mm:  0, active: true },
]);
