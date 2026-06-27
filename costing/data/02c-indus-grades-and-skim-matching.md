# Indus Belts Grade Families + Cover↔Skim Matching

Date: 2026-05-28
Source: indusbelts.com (Jitesh's brand) product pages — super-brute, super-thermo, super-blaze, super-slick, super-frost, super-eco.

> **Why this matters for costing:** Jitesh's rule — *"skims must chemically match the cover; GP cover ↔ GP skim, abrasion ↔ abrasion, heat-resistant ↔ heat-resistant skim."* This is not a UI nicety; it's rubber engineering. A cover and its skim must **co-vulcanise and bond**. You cannot bond an EPDM (UHR heat-resistant) cover to an NR/SBR general-purpose skim — different polymer families won't cure together. So the software must (a) know each cover's grade family/polymer, (b) know which skim matches, (c) default to the right skim, (d) warn on mismatch.

---

## Cover grade families (real Indus grades)

| Family code | Label | Indus brand | Typical polymer base | Real cover grades (examples) |
|---|---|---|---|---|
| `GP` | General Purpose | Super Brute | NR / SBR | DIN-Z, RMA-2, ISO-L, IS-N-17, AS-N, SANS-N, RMA-1, DIN-Y, IS-M-24, ISO-H, DIN-X |
| `AR` | Abrasion / Wear Resistant | Super Brute | NR / SBR / BR | DIN-W (HAR), SAR (AS-A), UAR, Crusher+, Crusher++, RTR-A, RTR-B |
| `HR` | Heat Resistant | Super Thermo | SBR (HR/SHR), **EPDM (UHR/SUHR)** | HR (T-1) 125°C, SHR (T-2) 150°C, SHAR 150°C, UHR 200°C, SUHR 250°C |
| `FR` | Fire / Flame Resistant | Super Blaze | SBR / CR / PVC blends | FR, FR-SAR, FR-HR-OR, MSHA 2G, MSHA Part 14, ISO 340, S, K (DIN-K/DIN-S) |
| `OR` | Oil / Grease Resistant | Super Slick | NBR | ROR (regular), MOR (moderate), HOR (high), OR-HR |
| `COLD` | Frost / Cold Resistant | Super Frost | NR (special) | cold-flex grades, AS-S |
| `LRR` | Low Rolling Resistant | Super Eco | special | eco grades |

> **Critical nuance:** even *within* the Heat Resistant family the polymer splits — HR/SHR are SBR-based, but UHR/SUHR are EPDM-based. Their skims are therefore **different**. This is why matching sometimes has to be done per-specific-grade, not just per-family. Jitesh: *"the skims of those grades could be common or unique to the different covers… we can cover that 1 by 1."*

Each cover grade can also carry its spec values for reference/printing (not for costing): tensile (MPa), elongation (%), abrasion loss (mm³). Example: IS-M-24 = 24 MPa / 450% / 150 mm³; SAR = 17 MPa / 400% / 70 mm³; DIN-X = 25 MPa / 450% / 120 mm³.

---

## The Cover↔Skim matching model

### Compound fields this requires

**On a Cover compound** (roles `TOP_COVER` / `BOTTOM_COVER`):
- `grade_family` — one of `GP / AR / HR / FR / OR / COLD / LRR` (above)
- `polymer_base` — optional, e.g. `NR/SBR`, `SBR`, `EPDM`, `NBR` (drives the harder compatibility cases)

**On a Skim compound** (role `SKIM` — a single list, per Jitesh):
- `skim_for` — multi-select: `FABRIC` and/or `STEEL_BREAKER` (the usage identification Jitesh asked for — fabric carcass vs metal/steel breaker)
- compatibility to covers is expressed in the match table below

### `cover_skim_compatibility` (the link table)

One row links a **skim** to the covers it may be used with. A row targets EITHER a whole grade-family (the common case) OR a specific cover compound (the unique case):

| Field | Example (family match) | Example (specific match) |
|---|---|---|
| `skim_compound_id` | GP-Skim-01 | UHR-Skim-EPDM |
| `match_level` | `FAMILY` | `COMPOUND` |
| `cover_grade_family` | `GP` | — |
| `cover_compound_id` | — | UHR (specific) |
| `is_default` | ✓ | ✓ |
| `notes` | "Standard GP/AR skim" | "EPDM skim — only for UHR/SUHR" |

### Resolution logic (what the software does when a cover is chosen)

> **Jitesh's rule (refined): DO NOT auto-fill the skim.** The user must consciously select it. The dropdown simply **lists recommended (matching) skims first**, then the rest. Selecting a non-matching skim triggers a warning. Nothing is silently chosen.

```
When user selects a Cover compound C, then opens the Skim dropdown:
  1. Compute the "recommended" set:
        - any skim with a COMPOUND-level match where cover_compound_id = C
        - PLUS any skim with a FAMILY-level match where cover_grade_family = C.grade_family
  2. Render the dropdown in two groups, no pre-selection:
        ── Recommended for {C.code} ──
           (recommended skims, sorted; show skim_for tag: Fabric / Steel Breaker)
        ── Other skims ──
           (all remaining active skims)
  3. The Skim field stays EMPTY until the user picks one (cannot save the costing without a skim).
  4. If the user picks from "Other skims" (a non-recommended one):
        → yellow warning: "GP-Skim is not a recommended skim for a UHR (EPDM) cover.
           These may not bond well. Confirm this is intentional."
        → on confirm, the override + reason is logged on the quote.
  5. If NO recommended skims exist for C (match table not yet populated):
        → info note: "No recommended skim defined for this cover yet. Choose manually
           or ask an admin to set the cover↔skim match." (still no warning on selection,
           since nothing is defined to violate)
```

This delivers everything Jitesh specified:
- Skim is ONE list (not split fabric/breaker) ✓
- Usage identification fabric vs metal breaker = `skim_for` tag, shown in the dropdown ✓
- Skim ↔ cover relationship by grade/category = the match table ✓
- GP↔GP, AR↔AR, HR↔HR matching = recommended-first ordering ✓
- Common OR unique skims per cover = `FAMILY` vs `COMPOUND` match level ✓
- **User must actively select (no auto-fill)** = step 3 ✓
- **Recommended listed first, non-matching warns** = steps 2 & 4 ✓

---

## Solution & Hardener (resolved with Jitesh)

- **Solution (rubber cement):** made in-house **and** bought-out depending on the case. → Model as role `SOLUTION`; `price_source` can be `MANUAL` (bought) or `RAVASCO_COMPUTED` (made from recipe). Both supported; no schema change needed — the `price_source` field already covers it.
- **Hardener:** always bought-out. → role `HARDENER`, `price_source = MANUAL` always. Effectively a purchased chemical with a ₹/kg.

---

## Open follow-ups (low priority — can be filled grade-by-grade later)

1. Build the actual cover-grade → skim mapping table, grade by grade, from Ravasco's compound library once it has the skims. Start with the common families (GP, AR, HR-SBR, UHR-EPDM, OR-NBR, FR).
2. Decide whether `polymer_base` is needed as a hard rule or just advisory. (Recommendation: advisory for v1 — the match table is the hard rule; polymer is shown for context.)
3. Confirm whether bottom cover for a heat/oil/fire belt is sometimes a cheaper GP grade (common in industry) — if so the top/bottom-different-compound feature already handles it.
