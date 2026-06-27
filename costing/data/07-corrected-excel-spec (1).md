# Corrected Excel — what it is and how to use it

Date: 2026-05-28
File: `Corrected-Multiply-Belt-Costing.xlsx` (built by `build_corrected_excel.py`)

## What it is
A clean, master-driven rebuild of the **Multiply Conveyor Belt with Breaker** costing — the sheet Jitesh focused on. Two tabs:
- **Masters** — every rate in one place (compounds, fabric/belt-ratings, breakers, edge, freight, packing, cost-of-production, assumptions, cover↔skim matches). Yellow cells = prices to keep updated.
- **Multiply with Breaker** — the costing. Blue cells = you type; green = pulled from Masters by lookup; black = calculated.

## Validation — reproduces the original to the rupee
With the same rates the old sheet hardcoded, the corrected sheet returns identical numbers:

| Figure | Original (cached) | Corrected |
|---|---|---|
| Total belt weight | 22,868.76 kg | 22,868.76 ✓ |
| Total belt cost | ₹3,339,183.16 | ₹3,339,183.16 ✓ |
| RMC / m | ₹3,339.18 | ₹3,339.18 ✓ |
| Standard price / m | ₹4,507.90 | ₹4,507.90 ✓ |
| VD price / m | ₹4,286.39 | ₹4,286.39 ✓ |

→ Use it as the **QA oracle**: the software's Multiply-with-Breaker engine must match this sheet for the same inputs.

## What's fixed / new vs the old sheet
- ✅ **Fabric Skim is now a dropdown** (compound master, role=Skim) — the original ask. Was hardcoded ₹65.
- ✅ **Top & bottom cover are separate compounds** (default both M-24; change either).
- ✅ **Width wastage is edge-driven** (Cut Edge +30 mm, Moulded +0) — FIX C8. Change Edge Type → wastage follows.
- ✅ **Length rule is explicit** (open-end ×1.03, endless +3 m from Assumptions) — FIX X2.
- ✅ **Packing uses length, not pieces** — FIX C2.
- ✅ **RMC always ÷ length** — FIX C1.
- ✅ **No rate typed in any formula** — all via VLOOKUP to Masters.
- ✅ **Skim↔Cover match check** — shows the recommended skim for the chosen cover's grade family and warns if the selected skim's family doesn't match (the bonding rule).
- ✅ **Standard + VD prices side by side**, discount → final; **no rounding**.

## How to extend
- Add a compound/fabric/breaker → just add a row in Masters; it appears in the dropdowns.
- The same two-tab pattern is the template for the other belt types (Steep Angle, Chevron, Sidewall, Endless…) — copy the costing tab, change which component rows are present per `03-belt-type-matrix.md`.

## Caveat
Seed rates in Masters are taken from the old sheet's values + representative Indus grades. **Replace with real current prices** before using for live quoting. (This is also the "seed data" the software team needs — see `00` open questions.)
