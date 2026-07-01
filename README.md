# Ravasco CDS — Commercial Data Sheet & Costing System

**Owner:** RTPH (Indus Belts)  
**Phase:** HTML prototype for director review  
**Stack:** HTML5 / CSS3 / Vanilla ES6+ modules / localStorage (no backend)

---

## How to Open the Prototype

Because the app uses ES modules (`<script type="module">`), it **cannot be opened directly as a `file://` URL** — browsers block module imports in that mode.

**Option A — VS Code Live Server (recommended):**
1. Install the "Live Server" extension in VS Code.
2. Right-click `index.html` → "Open with Live Server".
3. Browser opens at `http://127.0.0.1:5500/`.

**Option B — Python HTTP server:**
```bash
cd path/to/ravasco-cds
python -m http.server 8000
# Open http://localhost:8000
```

**Option C — npx serve:**
```bash
npx serve .
```

**Engine Test Harness:** open `engine/test.html` the same way (same HTTP server, navigate to `/engine/test.html`). All oracle tests must show PASS before director review.

---

## Where Masters Live

All reference data (rates, SG values, wastage rules) lives in `masters/*.js`. Each file is a frozen array exported from one JS file.

| File | What it controls |
|---|---|
| `masters/compound_master.js` | Rubber compound rates + SG |
| `masters/fabric_strength_master.js` | Belt ratings (EP-1000/5 etc.) — GSM, carcass thickness, price |
| `masters/belt_type_master.js` | 14 belt types + component declarations |
| `masters/edge_master.js` | Width wastage per edge type (30 mm for cut-edge, 0 for moulded) |
| `masters/breaker_master.js` | Breaker fabric GSM + price |
| `masters/freight_master.js` | Freight destinations + rates |
| `masters/gp_master.js` | GP% bands + minimum threshold |
| `masters/reel_packing_master.js` | Packing cost per meter |

**To update a rate:** edit the relevant master JS file and reload. All *draft* quotations will pick up the new rate. Sent quotations are frozen at their snapshot rates.

---

## How to Add a New Belt Type

1. Open `masters/belt_type_master.js`.
2. Add one new row to the `BELT_TYPE_MASTER` array:
   ```js
   {
     id: 'BT-MY-NEW-TYPE',
     code: 'MY_NEW_TYPE',
     name: 'My New Belt Type',
     has_top_cover: true,
     has_bottom_cover: true,
     has_fabric: true,
     has_skim: true,
     has_breaker: false,
     has_cleat: false,
     has_sidewall: false,
     has_blinker: false,
     has_solution: false,
     has_hardener: false,
     length_rule: 'open_end',
     open_end_wastage_pct: 0.03,
     splice_allowance_m: 3,
     cost_of_production_rate_per_kg: 22,
     active: true,
     phase: 1,
   }
   ```
3. Save. The new type appears in the Belt Type dropdown immediately. **Zero code changes to the engine.**

---

## Django Migration Notes

The prototype is structured so the Django migration is mechanical, not a rewrite:

| Prototype | Django equivalent |
|---|---|
| `masters/*.js` frozen array | Django model + initial data fixture |
| `engine/*.js` pure function | Same formula ported verbatim to Python; testable with `pytest` |
| `localStorage.setItem(key, JSON)` | `Model.objects.create(...)` ORM save |
| `localStorage.getItem(key)` | `Model.objects.get(id=...)` |
| `lib/id.js` ID generators | Django auto-increment + custom format in `__str__` |
| `lib/audit.js` append-only log | `AuditLog` Django model |
| `modules/*.js` view functions | Django views + templates |

Key invariant: the `runEngine()` function in `engine/engine.js` takes and returns plain JSON. Port it to Python as `run_engine(line: dict) -> dict` and wire the same tests.

---

## Bug Fixes Implemented (vs Legacy Excel)

| Bug | Fix |
|---|---|
| **C1** Endless RMC divided by pieces not length | RMC = total_cost / total_length always |
| **C2** Endless packing cost counted pieces × rate | Packing = cost_per_m × total_length |
| **C8** Width wastage +30mm even for moulded edge | Width wastage from edge_master.width_wastage_mm |
| **X2** Length wastage formula inconsistent | Single rule from belt_type_master.length_rule |
| **S1** All rates hardcoded in formula cells | All rates from masters — none hardcoded in engine |
| **S2** SG hardcoded | SG from compound_master.sg |
| **S7** No fabric skim compound dropdown | Skim compound is independently selectable |
| Silent-zero bug | Every master lookup throws on miss — never silently zeros |
