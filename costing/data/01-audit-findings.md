# Costing Excel Audit — Findings

Date: 2026-05-28
Scope: Every sheet in both source files
- `Multiply Fabric Conveyor Belt with Breaker ERP Costing.xlsx` (6 sheets)
- `DEALER & DISTRIBUTOR MASTERSHEE 26-27.xlsx` (6 sheets)

Severity scale:
- **CRITICAL** — produces a wrong number in the actual cost / price
- **STRUCTURAL** — hardcoded values that should be master-driven (the team has to fix these in the new software anyway)
- **CONSISTENCY** — same calculation done differently across belt-type sheets
- **SILENT FAILURE** — formula hides the error instead of flagging it
- **COSMETIC** — wrong label, leftover cell, doesn't break anything

---

## CRITICAL bugs

### C1. Endless belt — RMC formula doesn't divide by length, breaking the reverse-GP%
**Where:** `Endless & Jointles Conv. Belt` sheet, cells B86, C86, C92
- B86 = `=B74` (total belt cost — NOT per meter)
- C86 = `=($B$103 - B86) / B86` — this compares Custom Price/Meter (₹12,500) against the *total* belt cost (lakhs of rupees)
- Result: the "Reverse GP%" column gives a meaningless huge negative number
- C92 = `=C91 / B26` — divides by B26 (=10, "Pieces") instead of B23 (=29.19, "Length") → per-meter price wrong by factor of ~3x

**Compare with:** Multiply sheet B86 = `=B74/B26` (correctly divided)

### C2. Endless belt — Total Quantity / Length cell holds wrong value
**Where:** `Endless & Jointles Conv. Belt` B26 = `10` (hardcoded number)
- Should be `=B23*B24` (Length per piece × Pieces) = 29.19 × 10 = 291.9 m
- Currently B26 = 10 → packing cost B83 = `=B33*B26` = 4 × 10 = ₹40 for a 291.9 m belt run
- This silently undercounts packing cost by 29x

### C3. Cleat compound has two rows of calculation, but only the second is used
**Where:** `Chevron Conveyor Belt` rows 73 and 74
- Row 73 computes cleat weight using master values (B73=N36 cleat weight/m, no SG override)
- Row 74 computes the same with a "custom SG" override: `=(B74/N39)*C74`
- Total weight (B81) pulls only row 74 — row 73 is computed but ignored
- If user enters values in row 73 expecting them to apply, they don't. Confusing.

### C4. Sidewall — Free Lateral Space formula references a cell that no longer exists
**Where:** `Sidewall Conveyor Belt` B32 = `=(B6-B30-B26-B30)/2`
- B26 is unlabeled and empty in the Sidewall sheet (cleat was removed)
- Formula treats B26 as 0 → Free Lateral Space = (Width - 2×SidewallBase) / 2
- This may be correct by accident, but is fragile — anyone entering a value in B26 corrupts the layout

### C5. Steep Angle — "Blinkers Yes/No" toggle has no effect
**Where:** `Steep Angle Conveyor Belt` B36 = "Yes"
- Cells B101 (blinker weight), B115 (added to total), B131 (blinker cost) always include blinkers regardless of B36 value
- Set B36 to "No" → blinker cost still added. User-visible bug.

### C6. Dealer Mainsheet — Revised Quotation Rate formula returns GP% instead of price
**Where:** `Main` sheet CP5/CR5/CT5/CV5 (revision columns)
- Formula: `IF(CO5<1, discount-mode, IF(CO5<25, per-mm-mode, GP%-mode))`
- Third branch returns `((CO5-BW5)/BW5)*100` which is a percentage number
- When sales user types a revised rate ≥ 25, they get a GP% in the "Revised Price" cell, not a price
- This means revisions only "work" when you enter a discount % (<1) or per-mm rate (<25)

### C7. Dealer Mainsheet — Fabric Style lookup falls through silently above range
**Where:** `Main` sheet AS5 (and copies in all 5000 rows)
- Formula maps fabric strength (AR5) to a "Style" bucket
- For NN/EN/PP fabrics, only handles up to 506 strength
- For EE fabrics, only up to 506
- For EP fabrics, only up to 659
- Above these → returns `FALSE` → AT5 (Fabric Style Type) becomes "EP-FALSE" or similar → BB5 GSM VLOOKUP fails → fabric weight = 0
- If you ever quote EP 800/5, the fabric cost silently drops to zero

### C8. Multiply / Chevron — Width wastage applied even when edge is moulded
**Where:** Multiply B47 = `=((B6)+30)/1000`; Chevron B52 = `=((B6)+30)/1000`
- Adds 30 mm of cut-edge wastage unconditionally
- For moulded-edge belts (Steep Angle, Sidewall) the wastage is correctly removed: B63 = `=((B6))/1000`
- But the choice is hardcoded by sheet — there's no IF(edge="Cut-Edge", +30, 0) — so if you change Edge Type in Multiply to Moulded, the formula still adds 30mm
- The dealer Main sheet *does* handle this correctly: `=IF(P5="Cut-Edge",((I5+30)/1000),I5/1000)`. The costing-template sheets do not.

---

## STRUCTURAL — hardcoded values that should be master-driven

These are already known to be a problem (the whole reason for the new software) but listing them for completeness:

### S1. Per-kg rates baked into formula cells
Across all 6 belt-type sheets in File 1:
| Cell | What | Hardcoded ₹/kg |
|---|---|---|
| G47/G52/G63 | Cover compound | 80 (Multiply, Chevron) / 125 (Steep Angle, Sidewall) |
| G50/G55/G66 | Fabric | 240 |
| G53/G58/G69 | Fabric skim | 65 (most) / 85 (Steep Angle, Sidewall) |
| G56/G61/G72 | Breaker 1 | 400 |
| G59/G64/G75 | Breaker 1 skim | 65 (most) / 85 (Steep Angle, Sidewall) |
| G62/G67/G78 | Breaker 2 | 400–550 |
| G65/G70/G81 | Breaker 2 skim | 88 / 85 |
| G73/G84 | Cleat / Steep Angle cleat | 150 |
| G88 | Sidewall | 150 |
| G92/G95 | Solution (cleat/sidewall) | 1000 |
| G98 | Hardener | 750 |
| G101 | Blinker | 150 |

→ In the new software: every rate comes from the compound master; no rate is ever typed inside a formula.

### S2. Specific Gravity hardcoded
D44/D60 (Cover SG = 1.18), D59/D75 (Breaker 1 Skim SG = 1.22), D65/D81 (Breaker 2 Skim SG = 1.22 or 1.25), D88 (Sidewall SG via N38 = 1.25)
→ Should come from the compound master row.

### S3. Wastage percentages and splice allowances hardcoded
- 3% wastage on length for open-end (`$B$26*3%`)
- 3 m flat splice allowance for endless (`$B$23+3`) — wrong for short belts
- 4 m splice allowance for endless in dealer sheet (`(T5+4)`)
- 10% wastage on cleats/sidewalls (`D84*10%`, `D88*10%`)
- 10% hardener on solution (`F92*10%`, `F95*10%`)
- 30 mm width wastage for cut-edge
→ All should be parameters on the **Belt Type** master and/or **Edge** master, editable.

### S4. Cost of Production rate hardcoded per sheet
Per-sheet B28/B33/B44 ranges from ₹22 to ₹30/kg. Should be a master entry — possibly per-plant or per-belt-type.

### S5. Freight rate hardcoded per sheet
B38/B43/B54 hardcoded. The dealer file already has the right pattern: state → rate VLOOKup from Sheet0 AK:AL.

### S6. Reel Type / Packing Type / Edge Type — text values, no link to a master
B30 = "Circular" (typed text). If misspelled "Circullar", silently breaks any downstream logic.

### S7. The "Skim Compound" gap (your original ask)
G53 (fabric skim ₹65) sits with no compound name attached. There's a dropdown for Breaker 1 Skim Type (NN-III) and Breaker 2 Skim Type (STBR-III) but **no dropdown for Fabric Skim Type** — the rate just sits there.

---

## CONSISTENCY — same calc done differently across belt-type sheets

### X1. RMC denominator differs
- Multiply: `=B74/B26` → per-meter
- Endless: `=B74` → total (then B87 = `=B86/B23` for per-meter)
- All other sheets vary slightly
→ One canonical formula in the new software.

### X2. Length wastage formula differs
- Multiply: `IF(B4="Open End", B26*1.03, B26)` — 3% wastage
- Endless: `=$B$23+3` — flat 3 m
- Sidewall/Steep Angle: same as Multiply
- Dealer Main sheet uses `(T5+3)` for endless and 3% via Sheet0 lookup for open-end
→ One Belt Type master entry: "wastage rule" (percentage or flat allowance).

### X3. Cover SG sometimes 1.18 hardcoded, sometimes from master N38=1.25 (sidewall)
Different sheets pick different SG values for the same compound — because each compound's SG is buried in a different cell. After we centralize compounds, this disappears.

### X4. Multiply sheet B20 references I33 ("STBR-III"), Endless sheet B20 also references I33 ("STBR-III"), but Steep Angle B20 references I33 ("NN-III") — same cell address holds *different compound names* depending on the sheet, and they're all called "Breaker 2 Skim Type"
→ The "compound choice" travels by cell reference, not by master ID — fragile.

### X5. Cleat handling — Steep Angle has full cleat math, Sidewall has cleat master cells but no calculations, Chevron has a confusing two-row cleat calc
→ Each belt type should *declare* what components it has, not inherit residual cells from another belt-type template.

---

## SILENT FAILURES — wrap errors in IFERROR(...,0)

These are everywhere in the dealer Main sheet:
- AJ5 carcass thickness → fabric not in master → 0 → entire belt weight = wrong
- AL5/AM5/AN5/AV5 → grade not in master → SG/rates = 0 → cost massively understated
- AY5 length factor → fabric type not in master → 0 → fabric weight = 0
- BS5 freight → state spelling wrong → freight = 0
- BB5 GSM → fabric style mismatch → 0 → fabric weight = 0

**Why this matters:** when a master lookup fails, the cost goes silently lower (zero) — the worst possible behaviour for a costing system. You quote a customer too cheap, you find out at margin review or never.
→ New software: every lookup either succeeds or hard-blocks the quotation with a visible error. Never silently zero.

---

## COSMETIC

- Sheet name "Endless & Jointles Conv. Belt" — typo, missing 's' (Jointless)
- B46 = "Steep Angle Belt" in both Steep Angle and Sidewall sheets — looks like a copy-paste residue under the "Reel Type" label
- Steep Angle C34 = `=150+80+540+80+150` (hardcoded sanity check, won't update with width)
- A41 in Chevron has "Freight Destination" label but no value
- "Save Under Individual Ply Rating" (J35) — looks like a TODO note left in a cell

---

## What this means for the new software

1. **Calculation engine is the single source of truth.** The new system stores the formula once, applied to every belt type. The formula reads from masters; no rate is ever hardcoded in a calculation.

2. **Every lookup is hard-validated.** If a master row is missing, the quotation can't be saved — the UI surfaces the gap and asks the user to add the master row or pick a different option.

3. **Belt Type master declares its components.** A Multiply belt declares: cover, fabric, fabric skim, breaker 1, breaker 1 skim, breaker 2, breaker 2 skim. A Sidewall belt declares: cover, fabric, fabric skim, sidewall, solution, hardener. A Steep Angle belt adds cleats and blinkers. The calculation engine reads these declarations.

4. **Edge type drives wastage parametrically.** Cut-Edge adds 30 mm to width; Moulded adds 0. Editable in the Edge master.

5. **Wastage and splice allowance live on Belt Type.** Open-end: 3% length wastage. Endless: 3 m splice (or whatever the master says). Editable per belt type.

6. **Fabric Skim becomes a first-class compound selection** — fixes the original ask.
