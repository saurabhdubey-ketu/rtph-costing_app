# Ravasco CDS — Developer Prompt (HTML Prototype Phase)

**Project:** Ravasco Commercial Data Sheet / Costing & Documentation System
**Owner:** RTPH (Indus Belts)
**Phase:** HTML prototype for director review. Django migration is the next phase — write the prototype so the migration is mechanical, not a rewrite.
**Role you are playing:** Senior full-stack engineer, 15+ years. Build like the calculations will be audited by the director line by line — because they will be.

---

## 1. Non-negotiable principles

These are locked architecture decisions. Do not deviate. If a requirement below appears to conflict with one of these, stop and flag it — do not silently resolve.

1. **All rates come from masters.** No hardcoded numeric values anywhere in calculation code. Not rubber rates, not fabric rates, not wastage percentages, not GP%, not freight, not packing. If a number appears in a formula, it was read from a master JSON.
2. **One calculation engine for all 14 belt construction types.** No per-belt-type branching in calculation logic. Belt types differ only in their *component declaration* (which layers exist: top cover, breaker, plies, skim, bottom cover, etc.). The engine iterates the declared components.
3. **Sent quotations freeze permanently.** The moment a quotation is marked Sent, every master-sourced rate it used is snapshotted into the quotation record. Editing a sent quotation is forbidden — only Revise (which creates a new version) is allowed.
4. **Every form field is an independently user-selected dropdown sourced from its own dedicated master.** No auto-population. No cascading. Selecting Belt Rating does not auto-set Plies. Selecting Top Cover Compound does not auto-set Bottom. The only exception is the Belt Rating display string itself, which is a read-only concatenation of independently selected Fabric Type, Strength, and Plies.
5. **No Excel anywhere in the deliverable.** The prototype is HTML/CSS/JS only. Do not propose Excel export, Excel import, or Excel-styled grids as a shortcut.
6. **The eight legacy bugs from the HRS Mastersheet are acceptance criteria.** The prototype must reproduce the corrected oracle numbers from `CorrectedMultiplyBeltCosting.xlsx`. If your numbers differ, your code is wrong — not the oracle.

---

## 2. Tech stack for the prototype

- **HTML5**, plain — no framework, no build step, no bundler. Open `index.html` in a browser and it runs.
- **CSS3** — one `styles.css`. Use CSS variables for the color palette. No Tailwind, no Bootstrap. Clean, modern, professional. Indus Belts is an industrial brand — restrained palette (deep blue / charcoal / white / one accent), generous whitespace, clear typography (system font stack), no decorative gradients.
- **Vanilla JavaScript (ES6+)** — modules via `<script type="module">`. No jQuery. No React. No Vue. No Alpine. The Django migration will replace the JS layer with Django views + a thin JS layer; keeping the prototype framework-free makes that clean.
- **Data persistence in prototype:** `localStorage` only. No backend. No fetch calls. Every master is a JSON object loaded from a dedicated JS file. Every customer/enquiry/quotation is stored as JSON in `localStorage` under namespaced keys (`ravasco.customer.<id>`, `ravasco.enquiry.<id>`, `ravasco.quotation.<id>`).
- **No external libraries** except (a) a small icon set (inline SVG, no CDN) and (b) optional `chart.js` only if a dashboard view is added in a later iteration — not in the first cut.

The Django migration plan: every `masters/*.js` becomes a Django model + fixture; every calculation function in `engine/` is ported verbatim to Python; every `localStorage` write becomes an ORM save. Write JS that translates cleanly.

---

## 3. File and folder structure

```
/ravasco-cds/
├── index.html                          # shell, nav, view container
├── styles.css                          # single stylesheet, CSS variables at top
├── /assets/
│   └── /icons/                         # inline SVG sprites
├── /masters/                           # one JS file per master, each exports a frozen JSON
│   ├── belt_type_master.js
│   ├── fabric_type_master.js
│   ├── fabric_strength_master.js
│   ├── fabric_rate_master.js           # type-level default + per-fabric override
│   ├── compound_master.js              # single table, role field: 'cover' | 'skim'
│   ├── grade_master.js
│   ├── cover_thickness_master.js
│   ├── width_master.js                 # unit_type discriminator: 'metric' | 'imperial'
│   ├── length_master.js
│   ├── edge_master.js                  # edge_type + width_wastage_mm
│   ├── reel_packing_master.js          # appliesTo flag + packingCostPerMeter
│   ├── breaker_master.js
│   ├── freight_master.js
│   ├── gp_master.js                    # GP% bands; min GP% threshold for approval gate
│   └── index.js                        # re-exports all masters
├── /engine/                            # pure calculation functions, no DOM
│   ├── effective_width.js
│   ├── effective_length.js
│   ├── fabric_weight.js
│   ├── cover_weight.js
│   ├── breaker_weight.js
│   ├── skim_weight.js                  # remainder method
│   ├── component_costs.js
│   ├── rmc.js                          # raw material cost aggregator
│   ├── pricing.js                      # CD (Standard) and VD bases
│   ├── rounding.js                     # MROUND to nearest ₹5
│   └── engine.js                       # orchestrator: declarations in → priced quotation out
├── /modules/                           # UI modules, one per screen
│   ├── customers.js
│   ├── enquiries.js
│   ├── quotations.js
│   ├── quotation_form.js
│   ├── masters_admin.js
│   └── dashboard.js
├── /lib/                               # shared helpers
│   ├── id.js                           # ID generators (Indian convention)
│   ├── storage.js                      # localStorage wrapper, namespaced
│   ├── dropdown.js                     # reusable dropdown component
│   ├── validator.js                    # field-level validation
│   ├── formatter.js                    # ₹ formatting, mm/inch, date dd-mmm-yyyy
│   └── audit.js                        # append-only audit log writer
└── /docs/
    └── architecture.md                 # link to the locked architecture docs
```

**Rule:** every file does one thing. If a file exceeds ~250 lines, split it. No file mixes UI and calculation. No master file contains logic — only data.

---

## 4. Master files — exact shape

Each master is its own JS file. Each exports a `Object.freeze()`-wrapped array. No mutation at runtime. Comments at the top explain the master's purpose, the source of truth (which architecture doc), and every field. Example shape — replicate this discipline for every master:

```js
// masters/edge_master.js
// Source: 02-master-architecture.md §Edge
// Edge type determines width wastage (mm added to nominal width for cutting allowance).
// Cut-Edge adds 30mm. Moulded and Vulcanised add 0mm.
// Locked rule — do not change without director approval.

export const EDGE_MASTER = Object.freeze([
  { id: 'EDGE-CE',  edge_type: 'Cut-Edge',    width_wastage_mm: 30, active: true },
  { id: 'EDGE-MD',  edge_type: 'Moulded',     width_wastage_mm:  0, active: true },
  { id: 'EDGE-VL',  edge_type: 'Vulcanised',  width_wastage_mm:  0, active: true },
]);
```

**Compound Master** uses a single `role` field — do not split into two tables. Top cover, bottom cover, and skim all select from the same master, filtered by role at the dropdown layer:

```js
// masters/compound_master.js
// Single table for all rubber compounds. The role field classifies usage.
// role = 'cover' → eligible for Top Cover and Bottom Cover dropdowns (independently)
// role = 'skim'  → eligible for Skim dropdown
// Skim selection is independent of breaker configuration — do not couple them.

export const COMPOUND_MASTER = Object.freeze([
  { id: 'CMP-001', name: 'M-24 Cover',   role: 'cover', grade: 'M-24', rate_per_kg: 185.00, sg: 1.15, active: true },
  // ...
]);
```

**Fabric Rate Master** carries the type-level default and per-fabric override — Jitesh's locked rule, no approval gate on override:

```js
// masters/fabric_rate_master.js
// Type-level default rate per kg, with optional per-fabric override.
// If override is null, fall back to default_rate_per_kg for the fabric_type.
// No approval workflow on override — locked by Jitesh.

export const FABRIC_RATE_MASTER = Object.freeze({
  type_defaults: [
    { fabric_type: 'NN', default_rate_per_kg: 220.00 },
    { fabric_type: 'EP', default_rate_per_kg: 245.00 },
    { fabric_type: 'EE', default_rate_per_kg: 410.00 },
    { fabric_type: 'EN', default_rate_per_kg: 320.00 },
    { fabric_type: 'PP', default_rate_per_kg: 195.00 },
  ],
  overrides: [
    // { fabric_id: 'FAB-EP-630/4', rate_per_kg: 252.00 }
  ],
});
```

**Width Master** carries both metric and imperial in one table with a discriminator:

```js
// masters/width_master.js
// unit_type = 'metric' rows store value in mm.
// unit_type = 'imperial' rows store value in inches; converted at calc time.
// Custom width is NOT in this master — it is a Request workflow (provisional quote pending Admin approval).

export const WIDTH_MASTER = Object.freeze([
  { id: 'W-MM-0500',  unit_type: 'metric',   value: 500,  display: '500 mm',  active: true },
  { id: 'W-IN-024',   unit_type: 'imperial', value: 24,   display: '24"',     active: true },
  // ...
]);
```

Apply the same discipline to every other master. Each file: header comment, source reference, frozen export.

---

## 5. The calculation engine — exact contract

The engine is the heart of the system. It must be pure: input JSON → output JSON. No DOM access. No `localStorage` access inside the engine. Testable in isolation.

**Input contract** — a `QuotationLine` object:

```js
{
  belt_type_id: 'BT-MPB-BREAKER',     // selects which components are declared
  width_id: 'W-MM-1200',
  length_id: 'L-100M',
  length_type: 'open_end' | 'endless',
  edge_id: 'EDGE-CE',
  fabric_type: 'EP',
  fabric_strength: 630,
  plies: 4,
  top_cover_compound_id: 'CMP-001',
  top_cover_thickness_mm: 6,
  bottom_cover_compound_id: 'CMP-002',
  bottom_cover_thickness_mm: 3,
  skim_compound_id: 'CMP-007',
  breaker_id: 'BRK-NN100-1',          // null if belt type has no breaker
  reel_packing_id: 'RPK-WOODEN-001',
  freight_id: 'FRT-NAGPUR-MUMBAI',
  gp_band_id: 'GP-STD',
  overrides: {                         // optional, all null by default
    sg_top: null, sg_bottom: null,
    cover_rate_top: null, cover_rate_bottom: null,
    tbt: null,
  }
}
```

**Output contract** — a `PricedQuotationLine`:

```js
{
  inputs: { ...echoed back... },
  derived: {
    effective_width_m: 1.230,           // (1200 + 30) / 1000
    effective_length_m: 103.00,         // 100 + 3% open-end, or 100 + 3m endless
    fabric_gsm: ...,
    fabric_weight_kg: ...,
    top_cover_weight_kg: ...,
    bottom_cover_weight_kg: ...,
    breaker_weight_kg: ...,
    skim_weight_kg: ...,                // remainder method
  },
  costs: {
    fabric_cost: ...,
    top_cover_cost: ...,
    bottom_cover_cost: ...,
    breaker_cost: ...,
    skim_cost: ...,
    packing_cost: ...,
    freight_cost: ...,
    rmc: ...,                            // sum of material costs
    total_cost: ...,                     // rmc + packing + freight + conversion
  },
  pricing: {
    cd_price_per_meter: ...,             // Standard: GP% on full total_cost, MROUND ₹5
    vd_price_per_meter: ...,             // VD method: total_cost + (material_cost × GP%), MROUND ₹5
    gp_pct_applied: 0.22,
  },
  snapshot: {
    // every master rate that fed this calculation, copied in by id+value
    // this is what gets frozen on Sent
  },
  warnings: []                           // e.g. effective GP% below minimum threshold
}
```

**Pricing labels — read carefully:**
- **CD** = Standard pricing. GP% applied on the full total cost.
- **VD** = the pricing method named after the person whose initials are VD. Formula: `total_belt_cost + (material_cost × GP%)`. **Do not write "Variable Direct" anywhere in the codebase, UI, or comments.** Just use "VD" as the label.

**Rounding:** all displayed prices use MROUND to nearest ₹5. Implement once in `engine/rounding.js` and call it from one place. Never inline a rounding expression.

**Skim weight uses the remainder method.** Document the formula in the file header. Do not invent an alternative.

**Width wastage** is read from `edge_master.width_wastage_mm` — never hardcoded. **Length wastage** is read from `belt_type_master` (open-end → +3% of length, endless → +3 m splice allowance) — **not from fabric**. If any spec text says length wastage varies by fabric, ignore it and flag it to the product owner.

---

## 6. The belt type declaration pattern

This is how you avoid 14 branches. Each belt type in `belt_type_master.js` declares which components it has:

```js
{
  id: 'BT-MPB-BREAKER',
  name: 'Multiply Belt with Breaker',
  has_top_cover: true,
  has_bottom_cover: true,
  has_breaker: true,
  has_skim: true,
  has_plies: true,
  length_wastage_pct_open_end: 0.03,
  length_wastage_endless_m: 3,
}
```

The engine reads these flags and iterates only the declared components. Adding a 15th belt type is one row in this master — zero code changes.

---

## 7. Hierarchy and ID conventions

**Hierarchy:** Customer → Enquiry → Quotation → (Revision = new version of Quotation).

**ID formats** (Indian financial year convention, FY runs Apr–Mar):

- Customer: `CUS-NNNN` (sequential, e.g. `CUS-0001`)
- Enquiry: `ENQ-YYYY-YY-NNNN` (e.g. `ENQ-2025-26-0042`)
- Quotation: `QTN-YYYY-YY-NNNN` (e.g. `QTN-2025-26-0128`)
- Revision: append `-R1`, `-R2` (e.g. `QTN-2025-26-0128-R1`)

Implement ID generation in `lib/id.js`. One function per entity. Read the last issued number from `localStorage`, increment, write back. Pad with leading zeros. Never reuse an ID.

---

## 8. The quotation form — UI rules

- One screen, sectioned. Sections: Customer & Enquiry header → Belt Specification → Compounds → Edge & Packing → Logistics → Pricing & Overrides → Summary.
- Every dropdown is built by the reusable `lib/dropdown.js` component. Signature: `createDropdown({ master, valueField, labelField, filter, onChange })`. No duplicated dropdown code.
- The Belt Rating display is a read-only `<input disabled>` that updates whenever Fabric Type, Strength, or Plies changes — concatenation only, no master lookup.
- Override fields (SG, Cover Rate, TBT) are always visible but disabled by default. A "Apply override" toggle next to each enables it. When enabled, the field is editable and the recalculated price is shown alongside the original. If the override drops effective GP% below the minimum threshold from `gp_master`, render a warning banner — **do not block save in the prototype** (the approval gate is an open question to the director; implement it as a feature flag stub).
- The Summary panel shows: RMC, Total Cost, GP%, Standard price/meter, VD price/meter, total line value. All numbers update live as inputs change. Use a single `recalculate()` function bound to every input's change event — no scattered recalculation calls.
- Custom width: a "Request custom width" button next to the width dropdown opens a small modal. Submitting it writes a `WidthRequest` record to `localStorage` and inserts a provisional row into the quotation marked `provisional: true` with a yellow badge. Sent quotations with provisional rows are blocked — the badge must clear (Admin approval, simulated by a toggle in the masters admin screen for the prototype) before Send is enabled.

---

## 9. Rate freeze — implementation

When a quotation transitions to `status: 'sent'`:

1. Walk every line's `snapshot` block.
2. For every master reference, copy the current rate, SG, wastage value, etc. into the quotation document itself.
3. Set `frozen_at` timestamp.
4. Mark the quotation read-only in the UI — every input gets `disabled`, every button except "Revise" and "Download PDF" (stub for prototype) is hidden.
5. "Revise" duplicates the quotation, increments the revision suffix, sets status back to `draft`, and re-resolves rates against the *current* masters (not the frozen snapshot). The previous revision stays frozen and visible.

The frozen snapshot is the audit record. Never read live master rates for a sent quotation under any circumstance.

---

## 10. Audit log

Every state-changing action writes one row to `localStorage` under `ravasco.audit.log`:

```js
{ ts: ISO8601, actor: 'prototype-user', entity: 'quotation', entity_id: 'QTN-...', action: 'created'|'edited'|'sent'|'revised'|'override_applied', diff: {...} }
```

Append-only. The audit screen reads this log and displays it as a chronological table, newest first, filterable by entity and action.

---

## 11. Validation

`lib/validator.js` exposes one `validate(field, value, context)` function. Rules live in a single object keyed by field name. Examples:

- Width: must exist in `width_master` OR be a pending `WidthRequest`.
- Cover thickness: must exist in `cover_thickness_master`; must be > 0.
- Plies: integer, 1–8 inclusive.
- Length: must be > 0; warn if > 500 m for open-end.
- Every override field: numeric, > 0, with a hard upper bound (configurable per field in `gp_master.override_bounds`).

Validation runs on blur and on submit. Errors render inline beneath the field — red border, short message. Submit is blocked until all errors clear.

---

## 12. Code quality rules

- **No silent failures.** Every catch block either re-throws or writes to the audit log with `action: 'error'`. Never swallow.
- **No magic numbers.** If you find yourself typing a number into a `.js` file outside a master file, stop. It belongs in a master.
- **No duplication.** If two functions look similar, extract the shared piece. The engine especially — every weight calculation goes through the same `componentWeight(component, context)` helper. Dropdowns through one component. Currency formatting through one formatter.
- **No loops creating loops.** Iterate the component declaration once. Compute costs once. Total once. If you write a nested loop, justify it in a comment or refactor it out.
- **Comments explain *why*, not *what*.** `// add 30mm for cut-edge wastage per Edge Master locked rule` — yes. `// loop through array` — no.
- **Every function has a JSDoc block** stating inputs, output, and which architecture doc backs the logic.
- **Pure functions in `engine/`. Period.** No side effects. No console.log in committed code. No DOM. The engine must be testable by passing JSON in and asserting JSON out.
- **ES modules only.** `import` / `export`. No globals on `window`.
- **One source of truth per concept.** GP% lives in `gp_master`. Width wastage lives in `edge_master`. Length wastage lives in `belt_type_master`. If a number appears in two places, one of them is wrong.

---

## 13. Visual design

- Color: deep navy `#0F2A44` primary, charcoal `#2A2F36` text, white background, single accent (warm amber `#E0A526`) for actions and warnings. Define all colors as CSS variables in `:root`.
- Typography: system font stack. One heading size scale, one body size, one mono (for IDs and numbers).
- Spacing: 8-px grid. Generous padding inside cards. No cramped tables.
- Tables: thin horizontal rules only, no vertical grid lines, right-aligned numerics, monospaced for ₹ amounts.
- Forms: labels above inputs, inputs full-width within their column, helper text small and grey below.
- Navigation: a left sidebar with the entity list (Customers, Enquiries, Quotations, Masters, Audit). One active state. No collapsing animations.
- Feedback: every save shows a brief toast top-right (3 sec, no close button needed). Every destructive action requires a confirm modal.
- Responsiveness: must work cleanly at 1280×800 (the director's laptop). Mobile is not a goal for this phase — do not waste time on it.
- No emoji in the UI. No icons that aren't load-bearing. Restraint over decoration.

---

## 14. Acceptance criteria for the prototype

The prototype is ready for director review when:

1. All 14 belt types from `03-belt-type-matrix.md` can be quoted using the single engine.
2. The eight legacy bugs catalogued in `01-audit-findings.md` are all resolved — verified by reproducing the oracle outputs from `CorrectedMultiplyBeltCosting.xlsx` for at least one test case per bug.
3. Every form field is dropdown-sourced from its master file. There is zero hardcoded business data in any `engine/` or `modules/` file.
4. A quotation can be created, sent (freezing rates), and revised (creating a new version with fresh rates). The previous revision remains frozen and viewable.
5. Override fields work, warn on margin breach, and never block save.
6. The audit log captures every create/edit/send/revise/override action.
7. Closing the browser and reopening it restores all data from `localStorage`.
8. The code passes a manual review against every rule in §12.

---

## 15. What NOT to do

- Do not add features not in this prompt without asking.
- Do not introduce a frontend framework. The Django migration assumes vanilla JS.
- Do not propose Excel as a fallback for any part of the workflow.
- Do not couple skim selection to breaker configuration.
- Do not auto-populate any field from another field's selection. Every dropdown is independent.
- Do not write "Variable Direct" anywhere. The label is "VD".
- Do not hardcode any rate, wastage, GP%, or threshold.
- Do not branch the engine by belt type. Branch by component declaration.
- Do not let length wastage be driven by fabric type. It is driven by belt type (open-end vs endless).
- Do not allow editing of a sent quotation. Only Revise.
- Do not skip the rate-freeze snapshot. It is the entire point of the audit story.

---

## 16. Deliverables for this phase

1. The folder structure in §3, populated.
2. A working `index.html` that boots into the Customers screen.
3. All masters from `02-master-architecture.md` implemented as JS files per §4.
4. The calculation engine per §5–§6, with a small test harness page (`/engine/test.html`) that runs the oracle test cases and shows pass/fail.
5. The quotation form per §8, fully functional end-to-end.
6. Rate freeze and revision per §9.
7. Audit log per §10.
8. A short `README.md` at the project root with: how to open the prototype, where masters live, how to add a new belt type, and the Django migration notes.

When you finish a module, mark it done in a `PROGRESS.md` checklist at the project root. Do not jump between modules — finish one, verify the oracle numbers it touches still pass, then move on.

Build it like the director will read every line. Because he will.
